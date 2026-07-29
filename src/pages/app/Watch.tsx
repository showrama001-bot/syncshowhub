import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SyncedPlayer } from "@/components/streaming/SyncedPlayer";
import { MediaChat } from "@/components/rooms/MediaChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar, Send, Search, Settings, Lock,
  Copy, Bell, BellOff, Play, Users, UserX, Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDisplayIdentity } from "@/hooks/useDisplayIdentity";
import { toast } from "sonner";
import { sha256Hex } from "@/lib/watchRooms";
import { joinRoom, leaveRoom, removeRoomMember } from "@/lib/roomMembership";
import { FriendsSidebar } from "@/components/friends/FriendsSidebar";
import { RoomInvitePopover } from "@/components/rooms/RoomInvitePopover";
import { FollowHostButton } from "@/components/rooms/FollowHostButton";
import { FloatingReactions } from "@/components/reactions/FloatingReactions";
import { AmbientSounds } from "@/components/ambient/AmbientSounds";
import { RoomTakeoverBackground } from "@/components/ads/VipSpots";
import confetti from "canvas-confetti";

type Room = {
  id: string;
  host_id: string;
  title: string;
  content_kind: "movie" | "episode";
  content_id: string | null;
  content_title: string | null;
  poster_url: string | null;
  stream_url: string | null;
  visibility: "public" | "private" | "password";
  has_password?: boolean;
  scheduled_at: string | null;
  status: "live" | "scheduled" | "ended";
  participant_count: number;
};

export default function Watch() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const identity = useDisplayIdentity();
  const navigate = useNavigate();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinOk, setPinOk] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [now, setNow] = useState(Date.now());
  const [chat, setChat] = useState<{ id: string; user: string; text: string; ts: number }[]>([]);
  const [msg, setMsg] = useState("");
  const [reminded, setReminded] = useState(false);
  const [participants, setParticipants] = useState(0);
  const [participantList, setParticipantList] = useState<{ id: string; name: string }[]>([]);
  const channelRef = useRef<any>(null);
  const presenceRef = useRef<any>(null);

  const isHost = !!user && !!room && user.id === room.host_id;

  // Load subtitle tracks for the currently-playing movie/episode.
  const [subtitles, setSubtitles] = useState<any[]>([]);
  const [introStart, setIntroStart] = useState<number | null>(null);
  const [introEnd, setIntroEnd] = useState<number | null>(null);
  useEffect(() => {
    setSubtitles([]);
    setIntroStart(null);
    setIntroEnd(null);
    if (!room?.content_id || !room?.content_kind) return;
    const table =
      room.content_kind === "episode" ? "episodes" :
      room.content_kind === "movie" ? "movies" : null;
    if (!table) return;
    (supabase.from(table as any) as any)
      .select("subtitles, intro_start_seconds, intro_end_seconds").eq("id", room.content_id).maybeSingle()
      .then(({ data }: any) => {
        setSubtitles(Array.isArray(data?.subtitles) ? data.subtitles : []);
        setIntroStart(typeof data?.intro_start_seconds === "number" ? data.intro_start_seconds : null);
        setIntroEnd(typeof data?.intro_end_seconds === "number" ? data.intro_end_seconds : null);
      });
  }, [room?.content_id, room?.content_kind]);
  // End-of-movie celebration — plays for everyone in the room the moment
  // the shared video reaches its end event.
  const celebrate = () => {
    try {
      const end = Date.now() + 1400;
      const colors = ["#ef4444", "#f59e0b", "#22d3ee", "#a855f7", "#ffffff"];
      (function frame() {
        confetti({ particleCount: 4, angle: 60, spread: 65, origin: { x: 0, y: 0.75 }, colors });
        confetti({ particleCount: 4, angle: 120, spread: 65, origin: { x: 1, y: 0.75 }, colors });
        if (Date.now() < end) requestAnimationFrame(frame);
      })();
    } catch {}
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
      notes.forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "triangle";
        o.frequency.value = f;
        const t0 = ctx.currentTime + i * 0.12;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
        o.connect(g).connect(ctx.destination);
        o.start(t0);
        o.stop(t0 + 0.4);
      });
      setTimeout(() => ctx.close().catch(() => {}), 1600);
    } catch {}
  };


  // Load room + subscribe to changes
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    const fetchRoom = async () => {
      const { data } = await (supabase.from("watch_rooms" as any) as any)
        .select("id, host_id, title, content_kind, content_id, content_title, poster_url, stream_url, visibility, scheduled_at, status, participant_count, created_at")
        .eq("id", roomId)
        .maybeSingle();
      if (!cancelled) {
        setRoom(data as any);
        setLoading(false);
      }
    };
    fetchRoom();
    const ch = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "watch_rooms", filter: `id=eq.${roomId}` },
        (payload) => setRoom(payload.new as any)
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [roomId]);

  // Reminder state
  useEffect(() => {
    if (!user || !roomId) return;
    (supabase.from("watch_room_reminders" as any) as any)
      .select("id").eq("user_id", user.id).eq("room_id", roomId).maybeSingle()
      .then(({ data }: any) => setReminded(!!data));
  }, [user?.id, roomId]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Chat broadcast + presence
  useEffect(() => {
    if (!roomId) return;
    const ch = supabase.channel(`watch:${roomId}`, {
      config: { broadcast: { self: false }, presence: { key: user?.id || crypto.randomUUID() } },
    });
    ch.on("broadcast", { event: "msg" }, ({ payload }) => {
      setChat((c) => [...c, payload as any]);
    });
    ch.on("broadcast", { event: "kick" }, ({ payload }) => {
      if (payload?.userId && user && (payload.userId === user.id || payload.userId === "*")) {
        toast.error("You were removed from this room by the host.");
        setTimeout(() => navigate("/"), 400);
      }
    });
    // Participant → host channel-change requests.
    ch.on("broadcast", { event: "channel-request" }, ({ payload }) => {
      if (!room || !user || user.id !== room.host_id) return;
      if (!payload?.channel?.stream_url) return;
      const from = payload.from || "A viewer";
      toast(`${from} requested channel: ${payload.channel.name}`, {
        action: {
          label: "Switch",
          onClick: () => {
            (supabase.from("watch_rooms" as any) as any)
              .update({
                content_kind: "movie",
                content_id: payload.channel.id,
                content_title: `📺 ${payload.channel.name}`,
                poster_url: payload.channel.logo_url ?? null,
                stream_url: payload.channel.stream_url,
              })
              .eq("id", room.id);
          },
        },
        duration: 12000,
      });
    });
    ch.on("broadcast", { event: "channel-request-ack" }, ({ payload }) => {
      if (payload?.toUserId && user && payload.toUserId === user.id) {
        toast.success(payload.text || "Host received your request");
      }
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      const count = Object.keys(state).length;
      setParticipants(count);
      const list = Object.entries(state).map(([id, metas]: [string, any]) => ({
        id,
        name: (metas?.[0]?.user as string) || id.slice(0, 6),
      }));
      setParticipantList(list);
      // Best-effort update participant count (only host writes to avoid contention)
      if (room && user && room.host_id === user.id) {
        (supabase.from("watch_rooms" as any) as any).update({ participant_count: count }).eq("id", roomId);
      }
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        if (user) await joinRoom(roomId, user.id);
        await ch.track({ user: identity.displayName || "Guest", joined_at: Date.now() });
      }
    });
    channelRef.current = ch;
    presenceRef.current = ch;
    return () => {
      if (user && roomId) leaveRoom(roomId, user.id);
      supabase.removeChannel(ch);
    };
  }, [roomId, user?.id, room?.host_id, room?.id, navigate]);

  // If a persistent kick exists, boot user immediately on load.
  useEffect(() => {
    if (!user || !roomId) return;
    (supabase.from("room_kicks" as any) as any)
      .select("id").eq("room_id", roomId).eq("user_id", user.id).maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          toast.error("You are banned from this room.");
          navigate("/");
        }
      });
  }, [user?.id, roomId, navigate]);

  const kickUser = async (targetId: string) => {
    if (!isHost || !room || targetId === user?.id) return;
    await (supabase.from("room_kicks" as any) as any).insert({
      room_id: room.id, user_id: targetId, kicked_by: user!.id,
    });
    await removeRoomMember(room.id, targetId);
    channelRef.current?.send({ type: "broadcast", event: "kick", payload: { userId: targetId } });
    toast.success("User kicked");
  };

  const sendChat = () => {
    if (!msg.trim()) return;
    const payload = {
      id: crypto.randomUUID(),
      user: identity.displayName || "Guest",
      text: msg.slice(0, 500),
      ts: Date.now(),
    };
    channelRef.current?.send({ type: "broadcast", event: "msg", payload });
    setChat((c) => [...c, payload]);
    setMsg("");
  };

  // Pin gate
  const submitPin = async () => {
    if (!room) return;
    const hash = await sha256Hex(pinInput);
    const { data, error } = await supabase.rpc("verify_watch_room_password", {
      _room_id: room.id,
      _password_hash: hash,
    });
    if (error) return toast.error(error.message);
    if (data) setPinOk(true);
    else toast.error("Incorrect PIN");
  };

  const updateRoom = async (patch: Partial<Room>) => {
    if (!room) return;
    const { error } = await (supabase.from("watch_rooms" as any) as any).update(patch).eq("id", room.id);
    if (error) toast.error(error.message);
  };

  const deleteRoom = async () => {
    if (!room || !isHost) return;
    if (!confirm("Close and delete this watch room? Everyone will be removed.")) return;
    // Notify all participants to leave
    channelRef.current?.send({ type: "broadcast", event: "kick", payload: { userId: "*" } });
    const { error } = await (supabase.from("watch_rooms" as any) as any).delete().eq("id", room.id);
    if (error) return toast.error(error.message);
    toast.success("Room closed");
    navigate("/rooms");
  };

  const countdown = useMemo(() => {
    if (!room?.scheduled_at) return null;
    const diff = new Date(room.scheduled_at).getTime() - now;
    if (diff <= 0) return "Starting now!";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  }, [room?.scheduled_at, now]);

  const toggleReminder = async () => {
    if (!user || !room) return;
    if (reminded) {
      await (supabase.from("watch_room_reminders" as any) as any)
        .delete().eq("user_id", user.id).eq("room_id", room.id);
      setReminded(false);
    } else {
      await (supabase.from("watch_room_reminders" as any) as any)
        .insert({ user_id: user.id, room_id: room.id });
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        try { await Notification.requestPermission(); } catch {}
      }
      setReminded(true);
      toast.success("We'll remind you when it starts");
    }
  };

  if (loading) return <div className="pt-24 px-6 text-muted-foreground">Loading room…</div>;
  if (!room) return <div className="pt-24 px-6 text-muted-foreground">Room not found.</div>;

  // PIN gate
  if (room.visibility === "password" && !isHost && !pinOk) {
    return (
      <div className="pt-24 px-6 max-w-md mx-auto">
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-2xl flex items-center gap-2"><Lock className="h-5 w-5" /> PIN required</h2>
          <p className="text-sm text-muted-foreground">"{room.title}" is password-protected.</p>
          <Input value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="Enter PIN" type="password" />
          <Button onClick={submitPin} className="w-full bg-gradient-red shadow-neon">Enter Room</Button>
        </div>
      </div>
    );
  }

  const src = room.stream_url || "";

  return (
    <div className="pt-20 px-3 md:px-6 pb-10 max-w-[1600px] mx-auto">
      <RoomTakeoverBackground />
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="font-display text-xl md:text-3xl tracking-wider flex-1 min-w-0 truncate">{room.title}</h1>
        <span className="text-xs px-2 py-1 rounded-full glass flex items-center gap-1">
          <Users className="h-3 w-3" /> {participants}
        </span>
        <RoomInvitePopover roomId={room.id} title={room.title} />
        <FriendsSidebar roomId={room.id} />
        <AmbientSounds />
        {isHost && <HostSettings room={room} update={updateRoom} />}
        {isHost && (
          <Button size="sm" variant="destructive" onClick={deleteRoom}>
            <Trash2 className="h-4 w-4 mr-1" /> Close room
          </Button>
        )}
        {!isHost && room.status === "scheduled" && (
          <Button size="sm" variant="outline" onClick={toggleReminder}>
            {reminded ? <BellOff className="h-4 w-4 mr-1" /> : <Bell className="h-4 w-4 mr-1" />}
            {reminded ? "Reminding" : "Remind me"}
          </Button>
        )}
        {!isHost && <FollowHostButton hostId={room.host_id} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 lg:gap-6">
        <div className="space-y-4 min-w-0">
          {room.status === "scheduled" && countdown ? (
            <div className="aspect-video rounded-2xl glass grid place-items-center text-center p-6">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Starts in</div>
                <div className="font-display text-4xl md:text-6xl neon-text animate-pulse">{countdown}</div>
                {isHost && (
                  <Button className="mt-6 bg-gradient-red shadow-neon" onClick={() => updateRoom({ status: "live", scheduled_at: null } as any)}>
                    <Play className="h-4 w-4 mr-1" /> Go Live now
                  </Button>
                )}
              </div>
            </div>
          ) : src ? (
            <div className="relative">
              <SyncedPlayer
                roomId={room.id}
                src={src}
                poster={room.poster_url || undefined}
                isHost={isHost}
                hostId={room.host_id}
                subtitles={subtitles}
                introStart={introStart}
                introEnd={introEnd}
                onEnded={celebrate}
                reactionChannelKey={`room:${room.id}`}
              />
              <FloatingReactions channelKey={`room:${room.id}`} />
            </div>
          ) : (
            <div className="aspect-video rounded-2xl glass grid place-items-center text-muted-foreground text-center px-4">
              {isHost ? "Search a movie or episode below to start playing." : "Host hasn't picked content yet."}
            </div>
          )}

          {/* Host content picker */}
          {isHost ? (
            <ContentSearch room={room} update={updateRoom} />
          ) : (
            <div className="glass rounded-2xl p-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5 text-primary" />
              <span className="flex-1 min-w-[180px]">
                Only the host can switch the movie, episode, or live TV channel in this room.
              </span>
              <RequestChannelChange
                channel={channelRef}
                fromName={identity.displayName || "A viewer"}
                userId={user?.id ?? ""}
              />
            </div>
          )}

          {/* In-app WebRTC video + voice — mobile/tablet only; desktop shows it in the sidebar */}
          {user && (
            <div className="lg:hidden">
              <MediaChat
                roomId={room.id}
                userId={user.id}
                hostId={room.host_id}
                isHost={isHost}
                onKick={(uid) => kickUser(uid)}
              />
            </div>
          )}

          {/* Participants + host kick */}
          <div className="glass rounded-2xl p-3">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
              <Users className="h-3 w-3" /> Participants ({participantList.length})
            </div>
            {participantList.length === 0 && (
              <div className="text-xs text-muted-foreground">No one else here yet.</div>
            )}
            <div className="flex flex-wrap gap-2">
              {participantList.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-full px-3 py-1 bg-secondary/40 text-sm">
                  <span className={p.id === room.host_id ? "text-primary font-semibold" : ""}>
                    {p.name}{p.id === room.host_id ? " · host" : ""}
                  </span>
                  {isHost && p.id !== user?.id && (
                    <button
                      onClick={() => kickUser(p.id)}
                      className="text-destructive hover:text-destructive/80"
                      title="Kick user"
                    >
                      <UserX className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar / Chat */}
        <aside className="lg:sticky lg:top-20 self-start w-full">
          <div className="flex flex-col gap-3 lg:h-[calc(100vh-110px)]">
            {/* Desktop: video/voice tiles above chat */}
            {user && (
              <div className="hidden lg:block">
                <MediaChat
                  roomId={room.id}
                  userId={user.id}
                  hostId={room.host_id}
                  isHost={isHost}
                  onKick={(uid) => kickUser(uid)}
                />
              </div>
            )}
            <div className="glass rounded-2xl flex flex-col h-[60vh] lg:h-auto lg:flex-1 min-h-[320px]">
            <div className="px-4 py-2 text-xs uppercase tracking-widest text-muted-foreground border-b border-border/40 flex items-center justify-between">
              <span>Group Chat</span>
              <span className="normal-case tracking-normal text-[10px]">Room {room.id.slice(0, 8)}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {chat.length === 0 && <p className="text-xs text-muted-foreground text-center mt-4">Say hi to your crew 👋</p>}
              {chat.map((m) => (
                <div key={m.id} className="text-sm break-words">
                  <span className="text-primary font-semibold">{m.user}: </span>{m.text}
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-border/40 flex gap-2">
              <Input
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
                placeholder="Message…"
                className="bg-secondary/50"
              />
              <Button size="icon" onClick={sendChat} className="bg-gradient-red shadow-neon"><Send className="h-4 w-4" /></Button>
            </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ------------------ Host settings popover ------------------ */

function HostSettings({ room, update }: { room: Room; update: (p: Partial<Room>) => Promise<void> }) {
  const [visibility, setVisibility] = useState<Room["visibility"]>(room.visibility);
  const [pin, setPin] = useState("");
  const [title, setTitle] = useState(room.title);
  const [scheduledAt, setScheduledAt] = useState<string>(
    room.scheduled_at ? new Date(room.scheduled_at).toISOString().slice(0, 16) : ""
  );

  const save = async () => {
    const patch: any = { title, visibility };
    if (visibility === "password") {
      if (pin) (patch as any).password_hash = await sha256Hex(pin);
    } else {
      (patch as any).password_hash = null;
    }
    if (scheduledAt) {
      patch.scheduled_at = new Date(scheduledAt).toISOString();
      patch.status = "scheduled";
    } else {
      patch.scheduled_at = null;
      if (room.status === "scheduled") patch.status = "live";
    }
    await update(patch);
    toast.success("Room updated");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline"><Settings className="h-4 w-4 mr-1" /> Room</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Room title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Visibility</label>
          <Select value={visibility} onValueChange={(v: any) => setVisibility(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public (listed)</SelectItem>
              <SelectItem value="private">Private (link only)</SelectItem>
              <SelectItem value="password">Password / PIN</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {visibility === "password" && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">PIN (leave blank to keep existing)</label>
            <Input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="e.g. 1234" />
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Schedule</label>
          <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        </div>
        <Button onClick={save} className="w-full bg-gradient-red shadow-neon">Save</Button>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------ Host content search ------------------ */

/* ------------------ Participant → host channel-change request ------------------ */

function RequestChannelChange({
  channel,
  fromName,
  userId,
}: {
  channel: React.MutableRefObject<any>;
  fromName: string;
  userId: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || !q.trim()) { setResults([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("tv_channels")
        .select("id,name,logo_url,m3u_url,country")
        .ilike("name", `%${q}%`)
        .limit(10);
      if (!cancelled) setResults(data ?? []);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, open]);

  const request = (c: any) => {
    channel.current?.send({
      type: "broadcast",
      event: "channel-request",
      payload: {
        from: fromName,
        fromUserId: userId,
        channel: { id: c.id, name: c.name, logo_url: c.logo_url, stream_url: c.m3u_url },
      },
    });
    toast.success(`Requested "${c.name}" — waiting for host`);
    setQ("");
    setResults([]);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="ml-auto">
          <Send className="h-3.5 w-3.5 mr-1" /> Request channel change
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2">
        <div className="text-xs text-muted-foreground">Ask the host to switch to a Live TV channel.</div>
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search channels (e.g. ZDF)…"
            className="bg-secondary/50"
          />
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {results.length === 0 && q.trim() && (
            <div className="text-xs text-muted-foreground py-2">No matches.</div>
          )}
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => request(c)}
              className="w-full text-left p-2 rounded-lg border border-border/40 hover:border-primary/60 hover:bg-primary/5 flex items-center gap-2"
            >
              {c.logo_url ? (
                <img src={c.logo_url} alt="" className="w-8 h-8 object-contain rounded bg-secondary/40" />
              ) : (
                <div className="w-8 h-8 rounded bg-secondary grid place-items-center text-[9px] uppercase">TV</div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{c.name}</div>
                {c.country && <div className="text-[10px] text-muted-foreground">{c.country}</div>}
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------ Host content search ------------------ */

function ContentSearch({ room, update }: { room: Room; update: (p: Partial<Room>) => Promise<void> }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const term = `%${q}%`;
      const [movies, episodes, channels] = await Promise.all([
        supabase.from("movies").select("id,title,poster_url,backdrop_url,stream_url").ilike("title", term).limit(8),
        (supabase.from("episodes" as any) as any).select("id,title,stream_url,episode_number,season_id").ilike("title", term).limit(8),
        supabase.from("tv_channels").select("id,name,logo_url,m3u_url,country,category").ilike("name", term).limit(8),
      ]);
      if (cancelled) return;
      const m = (movies.data || []).map((x: any) => ({ kind: "movie", ...x }));
      const e = (episodes.data || []).map((x: any) => ({ kind: "episode", ...x, poster_url: null }));
      const tv = (channels.data || []).map((x: any) => ({
        kind: "tv",
        id: x.id,
        title: `📺 ${x.name}${x.country ? ` · ${x.country}` : ""}`,
        poster_url: x.logo_url,
        stream_url: x.m3u_url,
      }));
      setResults([...tv, ...m, ...e]);
      setSearching(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  const pick = async (r: any) => {
    if (!r.stream_url) {
      toast.error("That title has no stream URL");
      return;
    }
    await update({
      content_kind: r.kind === "tv" ? "movie" : r.kind,
      content_id: r.id,
      content_title: r.title,
      poster_url: r.poster_url || room.poster_url,
      stream_url: r.stream_url,
    } as any);
    toast.success(`Now playing: ${r.title}`);
    setQ("");
    setResults([]);
  };

  return (
    <div className="glass rounded-2xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search movies, episodes, or live TV channels (e.g. ZDF)…"
          className="bg-secondary/50"
        />
      </div>
      {searching && <div className="text-xs text-muted-foreground">Searching…</div>}
      {results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
          {results.map((r) => (
            <button
              key={`${r.kind}-${r.id}`}
              onClick={() => pick(r)}
              className="text-left p-2 rounded-xl border border-border/40 hover:border-primary/60 hover:bg-primary/5 flex gap-2 items-center"
            >
              {r.poster_url ? (
                <img src={r.poster_url} className="w-10 h-14 object-cover rounded" alt="" />
              ) : (
                <div className="w-10 h-14 bg-secondary rounded grid place-items-center text-[10px] uppercase text-muted-foreground">{r.kind}</div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{r.title}</div>
                <div className="text-[10px] uppercase text-muted-foreground">{r.kind}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}