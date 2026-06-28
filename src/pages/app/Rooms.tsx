import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Bell, BellOff, Users, Clock, Lock, Play } from "lucide-react";
import { toast } from "sonner";

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
  const [reminderIds, setReminderIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState("live");

  const load = async () => {
    const { data } = await (supabase.from("watch_rooms" as any) as any)
      .select("id, host_id, title, content_kind, content_id, content_title, poster_url, stream_url, visibility, scheduled_at, status, participant_count, created_at")
      .eq("visibility", "public")
      .in("status", ["live", "scheduled"])
      .order("created_at", { ascending: false });
    setRooms((data || []) as any);
  };

  const loadReminders = async () => {
    if (!user) return;
    const { data } = await (supabase.from("watch_room_reminders" as any) as any)
      .select("room_id")
      .eq("user_id", user.id);
    setReminderIds(new Set((data || []).map((r: any) => r.room_id)));
  };

  useEffect(() => {
    load();
    loadReminders();
    const ch = supabase
      .channel("rooms-directory")
      .on("postgres_changes", { event: "*", schema: "public", table: "watch_rooms" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  const live = useMemo(() => rooms.filter((r) => r.status === "live"), [rooms]);
  const scheduled = useMemo(
    () => rooms.filter((r) => r.status === "scheduled" && r.scheduled_at && new Date(r.scheduled_at) > new Date()),
    [rooms]
  );

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
        <Link
          to="/movies"
          className="px-4 py-2 rounded-full bg-gradient-red shadow-neon text-sm font-semibold"
        >
          Start a room
        </Link>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="live">Live now ({live.length})</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled ({scheduled.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-4">
          {live.length === 0 ? (
            <Empty msg="No live rooms right now. Be the first — open a movie and hit Watch Together." />
          ) : (
            <Grid>
              {live.map((r) => (
                <RoomCard key={r.id} room={r} onJoin={() => navigate(`/watch/${r.id}`)} />
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
      </Tabs>
    </div>
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
        </div>
      </div>
    </div>
  );
}