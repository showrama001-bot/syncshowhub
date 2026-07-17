import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Radio } from "lucide-react";
import { toast } from "sonner";

type Room = {
  id: string; streamer_id: string; username_slug: string; title: string; description: string | null;
  is_live: boolean; mode: string; current_video_url: string | null; current_video_title: string | null; current_poster: string | null;
};
type Msg = { id: string; user_id: string; content: string; created_at: string };

export default function StreamerRoom() {
  const { username } = useParams();
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Load room
  useEffect(() => {
    if (!username) return;
    (async () => {
      const { data } = await supabase.from("streamer_rooms").select("*").eq("username_slug", username.toLowerCase()).maybeSingle();
      if (!data) { setNotFound(true); return; }
      setRoom(data as Room);
    })();
  }, [username]);

  // Subscribe to room updates (live status / current video)
  useEffect(() => {
    if (!room) return;
    const ch = supabase.channel(`room-${room.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "streamer_rooms", filter: `id=eq.${room.id}` },
        (payload) => setRoom((prev) => prev ? { ...prev, ...(payload.new as any) } : prev))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [room?.id]);

  // Load + subscribe chat
  useEffect(() => {
    if (!room) return;
    (async () => {
      const { data } = await supabase.from("room_chat_messages")
        .select("id, user_id, content, created_at")
        .eq("room_id", room.id).order("created_at", { ascending: true }).limit(100);
      setMessages((data as Msg[]) ?? []);
    })();
    const ch = supabase.channel(`chat-${room.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_chat_messages", filter: `room_id=eq.${room.id}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Msg]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [room?.id]);

  // Resolve usernames for messages
  useEffect(() => {
    const missing = Array.from(new Set(messages.map(m => m.user_id))).filter(id => !names[id]);
    if (missing.length === 0) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("id, username, display_name").in("id", missing);
      const map: Record<string, string> = { ...names };
      (data ?? []).forEach((p: any) => { map[p.id] = p.username || p.display_name || p.id.slice(0, 6); });
      setNames(map);
    })();
  }, [messages]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!user) return toast.error("Sign in to chat");
    if (!room) return;
    const content = text.trim();
    if (!content) return;
    setText("");
    const { error } = await supabase.from("room_chat_messages").insert({ room_id: room.id, user_id: user.id, content });
    if (error) toast.error(error.message);
  };

  if (notFound) return <div className="pt-20 text-center">Streamer not found.</div>;
  if (!room) return <div className="pt-20 text-center text-muted-foreground">Loading room…</div>;

  return (
    <div className="pt-16 px-4 md:px-8 max-w-7xl mx-auto pb-8">
      <header className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-2xl md:text-4xl neon-text flex items-center gap-3">
            <Radio className="h-7 w-7" /> @{room.username_slug}
          </h1>
          <p className="text-muted-foreground text-sm">{room.title}</p>
        </div>
        <Badge variant={room.is_live ? "default" : "secondary"} className={room.is_live ? "bg-red-500/90 text-white animate-pulse" : ""}>
          {room.is_live ? "● LIVE" : "OFFLINE"}
        </Badge>
      </header>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 aspect-video bg-black rounded-xl overflow-hidden relative">
          {room.is_live && room.current_video_url ? (
            <video className="w-full h-full" src={room.current_video_url} controls playsInline poster={room.current_poster || undefined} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Radio className="h-12 w-12 opacity-40" />
              <p>{room.is_live ? "Streamer is live — waiting for signal…" : "Streamer is offline."}</p>
              <Link to="/" className="text-xs text-primary underline">Back to home</Link>
            </div>
          )}
        </div>

        <aside className="flex flex-col rounded-xl border border-border/40 bg-background/40 h-[560px]">
          <div className="p-3 border-b border-border/40 text-sm font-semibold">Live chat</div>
          <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 && <p className="text-xs text-muted-foreground">Be the first to say hi 👋</p>}
            {messages.map(m => (
              <div key={m.id} className="text-sm">
                <span className="text-primary font-medium">{names[m.user_id] || "…"}: </span>
                <span className="break-words">{m.content}</span>
              </div>
            ))}
          </div>
          <form className="p-2 border-t border-border/40 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <Input placeholder={user ? "Say something…" : "Sign in to chat"} value={text} onChange={(e) => setText(e.target.value)} disabled={!user} maxLength={500} />
            <Button type="submit" size="icon" disabled={!user || !text.trim()}><Send className="h-4 w-4" /></Button>
          </form>
        </aside>
      </div>
    </div>
  );
}