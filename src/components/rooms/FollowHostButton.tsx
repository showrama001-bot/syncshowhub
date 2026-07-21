import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Heart, HeartOff } from "lucide-react";
import { toast } from "sonner";

/**
 * Follow a host to receive scheduled-room, time-updated, reminder, and
 * live notifications in the global notification bell. Works for both
 * watch-room hosts and studio-stream hosts (same host_id).
 */
export function FollowHostButton({
  hostId,
  size = "sm",
  variant = "outline",
  className,
}: {
  hostId: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
}) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !hostId || user.id === hostId) return;
    (supabase.from("host_follows" as any) as any)
      .select("id")
      .eq("follower_id", user.id)
      .eq("host_id", hostId)
      .maybeSingle()
      .then(({ data }: any) => setFollowing(!!data));
  }, [user?.id, hostId]);

  if (!user || !hostId || user.id === hostId) return null;

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (following) {
        const { error } = await (supabase.from("host_follows" as any) as any)
          .delete().eq("follower_id", user.id).eq("host_id", hostId);
        if (error) throw error;
        setFollowing(false);
        toast("Unfollowed host");
      } else {
        const { error } = await (supabase.from("host_follows" as any) as any)
          .insert({ follower_id: user.id, host_id: hostId });
        if (error) throw error;
        setFollowing(true);
        toast.success("Following — you'll get notified for their rooms");
      }
    } catch (err: any) {
      toast.error(err?.message || "Could not update follow");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size={size}
      variant={following ? "secondary" : variant}
      onClick={toggle}
      disabled={busy}
      className={className}
      title={following ? "Unfollow host" : "Follow host for notifications"}
    >
      {following ? (
        <><HeartOff className="h-4 w-4 mr-1" /> Following</>
      ) : (
        <><Heart className="h-4 w-4 mr-1" /> Follow</>
      )}
    </Button>
  );
}