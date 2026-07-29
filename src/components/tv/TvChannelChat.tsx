import { sanitizeMessage, sanitizeBody, sanitizeTitle, sanitizeUrl } from "@/lib/sanitize";
import { checkRate, RATE_RULES, rateMessage } from "@/lib/submitGuard";
import { useEffect, useRef, useState, FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Trash2, MessagesSquare } from "lucide-react";
import { toast } from "sonner";

interface Msg {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}
interface Profile {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export const TvChannelChat = ({ channelId }: { channelId: string }) => {
  const { user, isAdmin } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadProfiles = async (ids: string[]) => {
    const missing = ids.filter((id) => !profiles[id]);
    if (!missing.length) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", missing);
    if (data) {
      setProfiles((p) => {
        const next = { ...p };
        data.forEach((d: any) => (next[d.id] = d));
        return next;
      });
    }
  };

  useEffect(() => {
    if (!channelId) return;
    setMessages([]);
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("tv_channel_messages")
        .select("*")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      const list = (data ?? []).reverse() as Msg[];
      setMessages(list);
      loadProfiles(Array.from(new Set(list.map((m) => m.sender_id))));
    })();

    const ch = supabase
      .channel(`tv-chat-${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tv_channel_messages", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const m = payload.new as Msg;
          setMessages((prev) => [...prev, m]);
          loadProfiles([m.sender_id]);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "tv_channel_messages", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const m = payload.old as Msg;
          setMessages((prev) => prev.filter((x) => x.id !== m.id));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const content = sanitizeMessage(text);
    if (!content || !user) return;
    const rl = checkRate(`tvchat:${channelId}`, RATE_RULES.chat);
    if (!rl.ok) return toast.error(rateMessage(rl));
    setSending(true);
    const { error } = await supabase
      .from("tv_channel_messages")
      .insert({ channel_id: channelId, sender_id: user.id, content });
    setSending(false);
    if (error) return toast.error(error.message);
    setText("");
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("tv_channel_messages").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  return (
    <div className="glass rounded-2xl flex flex-col h-[60vh] lg:h-full min-h-[400px] overflow-hidden">
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
        <MessagesSquare className="h-4 w-4 text-primary" />
        <span className="font-display tracking-wider text-sm">Live Chat</span>
        <span className="ml-auto text-xs text-muted-foreground">{messages.length} msgs</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {messages.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-8">
            Be the first to say something.
          </div>
        )}
        {messages.map((m) => {
          const p = profiles[m.sender_id];
          const name = p?.display_name || p?.username || "User";
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className="group flex gap-2 items-start text-sm">
              {p?.avatar_url ? (
                <img src={p.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <div className="h-7 w-7 rounded-full bg-primary/20 grid place-items-center text-[10px] font-bold text-primary">
                  {name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className={`text-xs font-semibold truncate ${mine ? "text-primary" : "text-foreground"}`}>
                    {name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="text-sm break-words whitespace-pre-wrap leading-snug">{m.content}</div>
              </div>
              {(mine || isAdmin) && (
                <button
                  onClick={() => del(m.id)}
                  className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-destructive"
                  aria-label="Delete message"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <form onSubmit={send} className="p-2 border-t border-border/40 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder={user ? "Say something…" : "Sign in to chat"}
          disabled={!user || sending}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={!user || sending || !text.trim()} className="bg-gradient-red shadow-neon">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};