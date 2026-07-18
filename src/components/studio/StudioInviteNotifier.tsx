import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Realtime popup when a friend invites the user to their live studio stream. */
export function StudioInviteNotifier() {
  const { user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`studio-invites:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "studio_invites", filter: `to_user=eq.${user.id}` },
        async (payload: any) => {
          const inv = payload.new;
          const { data: prof } = await supabase
            .from("profiles")
            .select("display_name, username")
            .eq("id", inv.from_user)
            .maybeSingle();
          const who = prof?.display_name || prof?.username || "A friend";
          toast(`${who} is inviting you to join their live stream!`, {
            action: { label: "Join Room", onClick: () => nav(`/live-stream?stream=${inv.stream_id}`) },
            duration: 15000,
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, nav]);

  return null;
}