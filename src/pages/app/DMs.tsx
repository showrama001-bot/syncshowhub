import { sanitizeMessage, sanitizeBody, sanitizeTitle, sanitizeUrl } from "@/lib/sanitize";
import { checkRate, RATE_RULES, rateMessage } from "@/lib/submitGuard";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Ban, Flag, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Profile = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };
type Msg = { id: string; sender_id: string; recipient_id: string; content: string; created_at: string };

export default function DMs() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [active, setActive] = useState<Profile | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("id,username,display_name,avatar_url").neq("id", user.id).then(({ data }) => setProfiles(data ?? []));
    supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id).then(({ data }) => setBlocked(new Set((data ?? []).map((b) => b.blocked_id))));
  }, [user]);

  // Load conversation
  useEffect(() => {
    if (!user || !active) return;
    supabase
      .from("direct_messages")
      .select("*")
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${active.id}),and(sender_id.eq.${active.id},recipient_id.eq.${user.id})`)
      .order("created_at", { ascending: true })
      .then(({ data }) => setMsgs((data as Msg[]) ?? []));
  }, [user, active]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("dms-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
        const m = payload.new as Msg;
        if (!active) return;
        if (
          (m.sender_id === user.id && m.recipient_id === active.id) ||
          (m.sender_id === active.id && m.recipient_id === user.id)
        ) {
          setMsgs((prev) => (prev.find((x) => x.id === m.id) ? prev : [...prev, m]));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, active]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs]);

  const send = async () => {
    if (!user || !active) return;
    const content = sanitizeMessage(text);
    if (!content) return;
    const rl = checkRate(`dm:${user.id}`, RATE_RULES.dm);
    if (!rl.ok) return toast.error(rateMessage(rl));
    setText("");
    const { error } = await supabase.from("direct_messages").insert({
      sender_id: user.id, recipient_id: active.id, content,
    });
    if (error) toast.error(error.message);
  };

  const block = async () => {
    if (!user || !active) return;
    const { error } = await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: active.id });
    if (error) return toast.error(error.message);
    setBlocked((s) => new Set(s).add(active.id));
    toast.success("User blocked");
  };

  const report = async () => {
    if (!user || !active) return;
    const reason = prompt("Reason for report?");
    if (!reason) return;
    const { error } = await supabase.from("reports").insert({ reporter_id: user.id, reported_user_id: active.id, reason });
    if (error) return toast.error(error.message);
    toast.success("Report submitted");
  };

  const filtered = useMemo(
    () => profiles.filter((p) => (p.display_name || p.username || "").toLowerCase().includes(search.toLowerCase())),
    [profiles, search]
  );

  const isBlocked = active && blocked.has(active.id);

  return (
    <div className="pt-20 px-2 md:px-6 max-w-7xl mx-auto h-[100svh] pb-4">
      <div className="grid md:grid-cols-[300px_1fr] gap-4 h-full">
        <aside className="glass rounded-2xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border/40">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people…" className="pl-9 bg-secondary/50" />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => setActive(p)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-secondary/50 transition ${active?.id === p.id ? "bg-primary/10 border-l-2 border-primary" : ""}`}
              >
                <div className="w-9 h-9 rounded-full bg-gradient-red grid place-items-center font-bold text-sm">
                  {(p.display_name || p.username || "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{p.display_name || p.username || "User"}</div>
                  <div className="text-xs text-muted-foreground truncate">@{p.username || "user"}</div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="glass rounded-2xl flex flex-col overflow-hidden">
          {!active ? (
            <div className="flex-1 grid place-items-center text-muted-foreground">Select a conversation</div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between">
                <div className="font-semibold">{active.display_name || active.username}</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={report}><Flag className="h-4 w-4 mr-1" />Report</Button>
                  <Button size="sm" variant="ghost" onClick={block} disabled={isBlocked}><Ban className="h-4 w-4 mr-1" />{isBlocked ? "Blocked" : "Block"}</Button>
                </div>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
                {msgs.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${mine ? "bg-gradient-red text-primary-foreground shadow-neon" : "bg-secondary"}`}>
                        <div>{m.content}</div>
                        <div className="text-[10px] opacity-70 mt-1">{format(new Date(m.created_at), "HH:mm")}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-3 border-t border-border/40 flex gap-2">
                <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={isBlocked ? "You blocked this user" : "Message…"} disabled={!!isBlocked} className="bg-secondary/50" />
                <Button onClick={send} disabled={!!isBlocked} className="bg-gradient-red shadow-neon"><Send className="h-4 w-4" /></Button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}