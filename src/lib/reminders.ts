import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const scheduled = new Map<string, ReturnType<typeof setTimeout>>();

export async function ensureNotificationPermission() {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const p = await Notification.requestPermission();
    return p === "granted";
  } catch {
    return false;
  }
}

function fireReminder(room: any, navigate?: (to: string) => void) {
  const title = `Starting now: ${room.content_title || room.title}`;
  const body = `Your watch party "${room.title}" is starting.`;
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const n = new Notification(title, { body, icon: room.poster_url || undefined });
      n.onclick = () => {
        window.focus();
        window.location.assign(`/watch/${room.id}`);
      };
    }
  } catch {}
  toast(title, {
    description: body,
    action: { label: "Join", onClick: () => (navigate ? navigate(`/watch/${room.id}`) : window.location.assign(`/watch/${room.id}`)) },
    duration: 15000,
  });
}

export async function syncReminders(userId: string, navigate?: (to: string) => void) {
  scheduled.forEach((t) => clearTimeout(t));
  scheduled.clear();
  const { data } = await (supabase.from("watch_room_reminders" as any) as any)
    .select("room_id, watch_rooms:room_id(id,title,content_title,poster_url,scheduled_at,status)")
    .eq("user_id", userId);
  const list = (data || []) as any[];
  for (const row of list) {
    const room = row.watch_rooms;
    if (!room?.scheduled_at) continue;
    const ms = new Date(room.scheduled_at).getTime() - Date.now();
    if (ms <= 0) continue;
    if (ms > 24 * 60 * 60 * 1000) continue; // cap horizon
    const t = setTimeout(() => fireReminder(room, navigate), ms);
    scheduled.set(room.id, t);
  }
}