import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ensureNotificationPermission, syncReminders } from "@/lib/reminders";

export function ReminderBell() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    ensureNotificationPermission();
    syncReminders(user.id, navigate);
    const ch = supabase
      .channel(`reminders:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "watch_room_reminders", filter: `user_id=eq.${user.id}` },
        () => syncReminders(user.id, navigate)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "watch_rooms" },
        () => syncReminders(user.id, navigate)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, navigate]);

  return null;
}