import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Listens for incoming room invites and pops a toast with a Join action. */
export function InviteNotifier() {
  const { user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`room-invites:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_invites", filter: `to_user=eq.${user.id}` },
        async (payload: any) => {
          const invite = payload.new;
          const { data: prof } = await supabase.from("profiles").select("display_name, username").eq("id", invite.from_user).maybeSingle();
          const who = prof?.display_name || prof?.username || "A friend";
          toast(`${who} invited you to a Watch Together room`, {
            action: { label: "Join", onClick: () => nav(`/watch/${invite.room_id}`) },
            duration: 12000,
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, nav]);

  return null;
}