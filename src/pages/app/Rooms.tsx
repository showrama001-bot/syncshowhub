import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AmbientSounds } from "@/components/ambient/AmbientSounds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Bell, BellOff, Users, Clock, Lock, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { Radio } from "lucide-react";
import { LiveStoriesRail } from "@/components/rooms/LiveStoriesRail";
import { FollowHostButton } from "@/components/rooms/FollowHostButton";

type Room = {
  id: string;
  title: string;
  host_id: string;
  content_title: string | null;
  poster_url: string | null;
  visibility: string;
  status: string;
  scheduled_at: string | null;
  participant_count: number;
};

export default function Rooms() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [liveStudios, setLiveStudios] = useState<Array<{ id: string; title: string; host_id: string; poster_url: string | null; viewer_count: number; host_name?: string }>>([]);
  const [reminderIds, setReminderIds] = useState<Set<string>>(new Set());
  const [followedHosts, setFollowedHosts] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState("live");

  const load = async () => {
    const { data } = await (supabase.from("watch_rooms" as any) as any)
      .select("id, host_id, title, content_kind, content_id, content_title, poster_url, stream_url, visibility, scheduled_at, status, participant_count, created_at")
      .eq("visibility", "public")
      .in("status", ["live", "scheduled"])
      .order("created_at", { ascending: false });
    const remote = ((data || []) as Room[]);
    const merged: Room[] = [];
    const seen = new Set<string>();
    const push = (r: Room | null) => {
      if (!r || seen.has(r.id)) return;
      seen.add(r.id);
      merged.push(r);
    };
    remote.forEach(push);
    setRooms(merged);
  };

  const loadStudios = async () => {
    const { data } = await (supabase.from("studio_streams" as any) as any)
      .select("id, title, host_id, poster_url, viewer_count")
      .eq("status", "live")
      .order("created_at", { ascending: false });
    const rows = (data as any[]) || [];
    const ids = rows.map((r) => r.host_id);
    let names: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name, username").in("id", ids);
      (profs || []).forEach((p: any) => { names[p.id] = p.display_name || p.username || "Host"; });
    }
    setLiveStudios(rows.map((r) => ({ ...r, host_name: names[r.host_id] })));
  };

  const loadReminders = async () => {
    if (!user) return;
    const { data } = await (supabase.from("watch_room_reminders" as any) as any)
      .select("room_id")
      .eq("user_id", user.id);
    setReminderIds(new Set((data || []).map((r: any) => r.room_id)));
  };

  const loadFollowedHosts = async () => {
    if (!user) { setFollowedHosts(new Set()); return; }
    const { data } = await (supabase.from("host_follows" as any) as any)
      .select("host_id")
      .eq("follower_id", user.id);
    setFollowedHosts(new Set((data || []).map((r: any) => r.host_id)));
  };

  useEffect(() => {
    load();
    loadStudios();
    loadReminders();
    loadFollowedHosts();
    const ch = supabase
      .channel("rooms-directory")
      .on("postgres_changes", { event: "*", schema: "public", table: "watch_rooms" }, () => load())
      .subscribe();
    const chS = supabase
      .channel("rooms-directory-studios")
      .on("postgres_changes", { event: "*", schema: "public", table: "studio_streams" }, () => loadStudios())
      .subscribe();
    const chF = user
      ? supabase
          .channel(`rooms-directory-follows:${user.id}`)
          .on("postgres_changes",
            { event: "*", schema: "public", table: "host_follows", filter: `follower_id=eq.${user.id}` },
            () => loadFollowedHosts())
          .subscribe()
      : null;
    return () => {
      supabase.removeChannel(ch);
      supabase.removeChannel(chS);
      if (chF) supabase.removeChannel(chF);
    };
  }, [user?.id]);

  const live = useMemo(() => rooms.filter((r) => r.status === "live"), [rooms]);
  const scheduled = useMemo(
    () => rooms.filter((r) => r.status === "scheduled" && r.scheduled_at && new Date(r.scheduled_at) > new Date()),
    [rooms]
  );
  const followedLiveRooms = useMemo(
    () => live.filter((r) => followedHosts.has(r.host_id)),
    [live, followedHosts]
  );
  const followedLiveStudios = useMemo(
    () => liveStudios.filter((s) => followedHosts.has(s.host_id)),
    [liveStudios, followedHosts]
  );
  const followedScheduled = useMemo(
    () => scheduled.filter((r) => followedHosts.has(r.host_id)),
    [scheduled, followedHosts]
  );
  const followedTotal = followedLiveRooms.length + followedLiveStudios.length + followedScheduled.length;

  const toggleReminder = async (room: Room) => {
    if (!user) {
      toast.error("Sign in to set reminders");
      return;
    }
    if (reminderIds.has(room.id)) {
      await (supabase.from("watch_room_reminders" as any) as any)
        .delete()
        .eq("user_id", user.id)
        .eq("room_id", room.id);
      toast("Reminder removed");
    } else {
      await (supabase.from("watch_room_reminders" as any) as any).insert({ user_id: user.id, room_id: room.id });
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        try { await Notification.requestPermission(); } catch {}
      }
      toast.success("We'll remind you");
    }
    loadReminders();
  };

  return (
    <div className="pt-20 px-4 md:px-6 pb-12 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl md:text-4xl tracking-wider">Watch Together</h1>
          <p className="text-muted-foreground text-sm">Jump into a public room or schedule one with friends.</p>
        </div>
        <div className="flex items-center gap-2">
          <AmbientSounds />
          <CreateRoomDialog onCreated={(id) => navigate(`/watch/${id}`)} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="live">Live now ({live.length})</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled ({scheduled.length})</TabsTrigger>
          <TabsTrigger value="following">Following ({followedTotal})</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-4">
          <LiveStoriesRail />
          {live.length === 0 && liveStudios.length === 0 ? (
            <Empty msg="No live rooms right now. Be the first — open a movie and hit Watch Together." />
          ) : (
            <Grid>
              {liveStudios.map((s) => (
                <div key={s.id} className="glass rounded-2xl overflow-hidden flex flex-col group hover:shadow-neon transition">
                  <div className="relative aspect-[2/3] bg-secondary/40">
                    {s.poster_url ? (
                      <img src={s.poster_url} alt={s.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-muted-foreground"><Radio className="h-8 w-8" /></div>
                    )}
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-red-500/90 text-white text-xs font-semibold animate-pulse flex items-center gap-1">
                      <Radio className="h-3 w-3" /> LIVE STUDIO
                    </span>
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-xs flex items-center gap-1">
                      <Users className="h-3 w-3" /> {s.viewer_count || 0}
                    </div>
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    <div className="font-semibold truncate">{s.title}</div>
                    <div className="text-xs text-muted-foreground truncate">Hosted by {s.host_name || "…"}</div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" className="flex-1 bg-gradient-red shadow-neon"
                        onClick={() => navigate(`/live-stream?stream=${s.id}`)}>
                        Watch live
                      </Button>
                      <FollowHostButton hostId={s.host_id} />
                    </div>
                  </div>
                </div>
              ))}
              {live.map((r) => (
                <RoomCard
                  key={r.id}
                  room={r}
                  onJoin={() =>
                    navigate(`/watch/${r.id}`)
                  }
                />
              ))}
            </Grid>
          )}
        </TabsContent>

        <TabsContent value="scheduled" className="mt-4">
          {scheduled.length === 0 ? (
            <Empty msg="No upcoming rooms. Create one and pick a start time." />
          ) : (
            <Grid>
              {scheduled.map((r) => (
                <RoomCard
                  key={r.id}
                  room={r}
                  scheduled
                  reminded={reminderIds.has(r.id)}
                  onRemind={() => toggleReminder(r)}
                  onJoin={() => navigate(`/watch/${r.id}`)}
                />
              ))}
            </Grid>
          )}
        </TabsContent>

        <TabsContent value="following" className="mt-4">
          {!user ? (
            <Empty msg="Sign in to follow hosts and see their rooms here." />
          ) : followedTotal === 0 ? (
            <Empty msg="You're not following any live or scheduled hosts yet. Tap Follow on a room or studio to get notified." />
          ) : (
            <Grid>
              {followedLiveStudios.map((s) => (
                <div key={s.id} className="glass rounded-2xl overflow-hidden flex flex-col group hover:shadow-neon transition">
                  <div className="relative aspect-[2/3] bg-secondary/40">
                    {s.poster_url ? (
                      <img src={s.poster_url} alt={s.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-muted-foreground"><Radio className="h-8 w-8" /></div>
                    )}
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-red-500/90 text-white text-xs font-semibold animate-pulse flex items-center gap-1">
                      <Radio className="h-3 w-3" /> LIVE STUDIO
                    </span>
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    <div className="font-semibold truncate">{s.title}</div>
                    <div className="text-xs text-muted-foreground truncate">Hosted by {s.host_name || "…"}</div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" className="flex-1 bg-gradient-red shadow-neon"
                        onClick={() => navigate(`/live-stream?stream=${s.id}`)}>
                        Watch live
                      </Button>
                      <FollowHostButton hostId={s.host_id} />
                    </div>
                  </div>
                </div>
              ))}
              {followedLiveRooms.map((r) => (
                <RoomCard key={r.id} room={r} onJoin={() => navigate(`/watch/${r.id}`)} />
              ))}
              {followedScheduled.map((r) => (
                <RoomCard
                  key={r.id}
                  room={r}
                  scheduled
                  reminded={reminderIds.has(r.id)}
                  onRemind={() => toggleReminder(r)}
                  onJoin={() => navigate(`/watch/${r.id}`)}
                />
              ))}
            </Grid>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CreateRoomDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!user) { toast.error("Sign in required"); return; }
    const clean = title.trim();
    if (clean.length < 3) { toast.error("Room name must be at least 3 characters"); return; }
    setBusy(true);
    // Uniqueness pre-check (DB has UNIQUE index; catch collision explicitly).
    const { data: existing } = await (supabase.from("watch_rooms" as any) as any)
      .select("id").eq("title", clean).maybeSingle();
    if (existing) {
      setBusy(false);
      toast.error("That room name is already taken. Pick a unique one.");
      return;
    }
    const { data, error } = await (supabase.from("watch_rooms" as any) as any)
      .insert({ host_id: user.id, title: clean, visibility, status: "live" })
      .select("id").maybeSingle();
    setBusy(false);
    if (error) return toast.error(error.message);
    setOpen(false);
    onCreated(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-red shadow-neon rounded-full"><Plus className="h-4 w-4 mr-1" /> Start a room</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a Watch Room</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Unique room name</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Friday Sci-Fi Night" />
          </div>
          <div className="flex gap-2">
            {(["public", "private"] as const).map(v => (
              <button key={v} type="button"
                onClick={() => setVisibility(v)}
                className={`px-3 py-1.5 rounded-full text-xs border ${visibility === v ? "bg-primary/20 border-primary text-primary" : "border-border/50"}`}>
                {v}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Room names must be unique. Once created, use the search inside the room to pick a movie or episode.
          </p>
        </div>
        <DialogFooter>
          <Button className="bg-gradient-red shadow-neon" onClick={create} disabled={busy}>
            {busy ? "Creating…" : "Create room"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{children}</div>
);

const Empty = ({ msg }: { msg: string }) => (
  <div className="glass rounded-2xl p-10 text-center text-muted-foreground">{msg}</div>
);

function RoomCard({
  room,
  scheduled,
  reminded,
  onRemind,
  onJoin,
}: {
  room: Room;
  scheduled?: boolean;
  reminded?: boolean;
  onRemind?: () => void;
  onJoin: () => void;
}) {
  const when = room.scheduled_at ? new Date(room.scheduled_at) : null;
  return (
    <div className="glass rounded-2xl overflow-hidden flex flex-col group hover:shadow-neon transition">
      <div className="relative aspect-[2/3] bg-secondary/40">
        {room.poster_url ? (
          <img src={room.poster_url} alt={room.content_title || room.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full grid place-items-center text-muted-foreground"><Play className="h-8 w-8" /></div>
        )}
        <div className="absolute top-2 left-2 flex gap-1">
          {scheduled ? (
            <span className="px-2 py-0.5 rounded-full bg-yellow-500/80 text-black text-xs font-semibold flex items-center gap-1">
              <Clock className="h-3 w-3" /> Scheduled
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-red-500/90 text-white text-xs font-semibold animate-pulse">LIVE</span>
          )}
          {room.visibility === "password" && (
            <span className="px-2 py-0.5 rounded-full bg-black/60 text-white text-xs font-semibold flex items-center gap-1">
              <Lock className="h-3 w-3" /> PIN
            </span>
          )}
        </div>
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-xs flex items-center gap-1">
          <Users className="h-3 w-3" /> {room.participant_count || 0}
        </div>
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <div className="font-semibold truncate">{room.title}</div>
        <div className="text-xs text-muted-foreground truncate">{room.content_title || "—"}</div>
        {when && (
          <div className="text-xs text-primary mt-1">
            {when.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1 bg-gradient-red shadow-neon" onClick={onJoin}>
            {scheduled ? "Preview" : "Join"}
          </Button>
          {scheduled && onRemind && (
            <Button size="sm" variant="outline" onClick={onRemind} title={reminded ? "Remove reminder" : "Remind me"}>
              {reminded ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            </Button>
          )}
          <FollowHostButton hostId={room.host_id} />
        </div>
      </div>
    </div>
  );
}