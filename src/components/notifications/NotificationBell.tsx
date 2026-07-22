import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Radio, UserPlus, MessageSquare, CalendarClock, AlarmClock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Notif = {
  id: string;
  kind:
    | "room_invite"
    | "studio_invite"
    | "live"
    | "room_scheduled"
    | "room_time_updated"
    | "room_reminder"
    | "room_live"
    | "studio_live";
  title: string;
  href: string;
  at: string;
};

export function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [seenAt, setSeenAt] = useState<number>(() => Number(localStorage.getItem("notif:seenAt") || 0));
  const navigate = useNavigate();

  const load = async () => {
    if (!user) return;
    const [ri, si, live, notifs] = await Promise.all([
      (supabase.from("room_invites" as any) as any)
        .select("id, room_id, from_user, status, created_at")
        .eq("to_user", user.id).eq("status", "pending")
        .order("created_at", { ascending: false }).limit(15),
      (supabase.from("studio_invites" as any) as any)
        .select("id, stream_id, from_user, status, created_at")
        .eq("to_user", user.id).eq("status", "pending")
        .order("created_at", { ascending: false }).limit(15),
      (supabase.from("studio_streams" as any) as any)
        .select("id, title, created_at")
        .eq("status", "live")
        .order("created_at", { ascending: false }).limit(5),
      (supabase.from("notifications" as any) as any)
        .select("id, kind, title, href, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(30),
    ]);
    const fromIds = new Set<string>([
      ...((ri.data || []) as any[]).map((r) => r.from_user),
      ...((si.data || []) as any[]).map((r) => r.from_user),
    ]);
    let names: Record<string, string> = {};
    if (fromIds.size) {
      const { data: profs } = await supabase
        .from("profiles").select("id, display_name, username")
        .in("id", Array.from(fromIds));
      (profs || []).forEach((p: any) => { names[p.id] = p.display_name || p.username || "Someone"; });
    }
    const out: Notif[] = [
      ...((ri.data || []) as any[]).map((r) => ({
        id: `ri-${r.id}`, kind: "room_invite" as const,
        title: `${names[r.from_user] || "Someone"} invited you to a room`,
        href: `/watch/${r.room_id}`, at: r.created_at,
      })),
      ...((si.data || []) as any[]).map((r) => ({
        id: `si-${r.id}`, kind: "studio_invite" as const,
        title: `${names[r.from_user] || "Someone"} invited you to a live studio`,
        href: `/live-stream?stream=${r.stream_id}`, at: r.created_at,
      })),
      ...((live.data || []) as any[]).map((r) => ({
        id: `live-${r.id}`, kind: "live" as const,
        title: `Live now: ${r.title}`,
        href: `/live-stream?stream=${r.id}`, at: r.created_at,
      })),
      ...((notifs.data || []) as any[]).map((r) => ({
        id: `n-${r.id}`,
        kind: r.kind as Notif["kind"],
        title: r.title,
        href: r.href || "/rooms",
        at: r.created_at,
      })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1));
    setItems(out);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel(`notif:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_invites", filter: `to_user=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "studio_invites", filter: `to_user=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "studio_streams" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const unread = useMemo(
    () => items.filter((i) => new Date(i.at).getTime() > seenAt).length,
    [items, seenAt]
  );

  const markSeen = () => {
    const now = Date.now();
    setSeenAt(now);
    localStorage.setItem("notif:seenAt", String(now));
  };

  if (!user) return null;

  const iconFor = (k: Notif["kind"]) =>
    (k === "live" || k === "room_live" || k === "studio_live") ? <Radio className="h-4 w-4 text-red-500" />
    : k === "room_scheduled" ? <CalendarClock className="h-4 w-4 text-primary" />
    : k === "room_time_updated" ? <RefreshCw className="h-4 w-4 text-yellow-500" />
    : k === "room_reminder" ? <AlarmClock className="h-4 w-4 text-yellow-400" />
    : k === "studio_invite" ? <MessageSquare className="h-4 w-4 text-primary" />
    : <UserPlus className="h-4 w-4 text-primary" />;

  return (
    <Popover onOpenChange={(o) => o && markSeen()}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="fixed right-4 top-4 z-50 glass rounded-full h-10 w-10 grid place-items-center hover:neon-border transition-all"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center border-2 border-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        collisionPadding={12}
        className="z-[100] w-[calc(100vw-1.5rem)] sm:w-80 max-w-sm p-0 rounded-2xl shadow-xl bg-background/95 backdrop-blur-xl border border-border/60"
      >
        <div className="p-3 border-b border-border/40 flex items-center justify-between">
          <span className="font-display tracking-widest text-sm">NOTIFICATIONS</span>
          <span className="text-[10px] text-muted-foreground">{items.length} total</span>
        </div>
        <div className="max-h-80 overflow-y-auto scrollbar-hide">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">You're all caught up.</div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => navigate(n.href)}
                className="w-full flex items-start gap-3 p-3 hover:bg-secondary/40 text-left border-b border-border/30 last:border-b-0"
              >
                <span className="mt-0.5">{iconFor(n.kind)}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm truncate">{n.title}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {new Date(n.at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}