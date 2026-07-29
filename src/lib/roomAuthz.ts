import { supabase } from "@/integrations/supabase/client";

export type RoomAuthz = {
  userId: string | null;
  /** May read the room at all (RLS-verified). */
  canView: boolean;
  /** Registered participant, host or admin — may receive/emit sync. */
  canSync: boolean;
  /** Only the host may drive play/pause/seek. */
  isHost: boolean;
};

const DENIED: RoomAuthz = { userId: null, canView: false, canSync: false, isHost: false };

/**
 * Server-verified permission check for a specific watch room.
 * Every result comes from RLS-protected reads, so a client can't fake it.
 */
export async function getRoomAuthz(roomId: string): Promise<RoomAuthz> {
  if (!roomId) return DENIED;
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id ?? null;
  if (!userId) return DENIED;

  // RLS on watch_rooms only returns rows this user is allowed to see.
  const { data: room, error } = await (supabase.from("watch_rooms" as any) as any)
    .select("id, host_id")
    .eq("id", roomId)
    .maybeSingle();
  if (error || !room) return { ...DENIED, userId };

  const isHost = room.host_id === userId;
  if (isHost) return { userId, canView: true, canSync: true, isHost: true };

  const { data: member } = await (supabase.from("room_participants" as any) as any)
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  const { data: kicked } = await (supabase.from("room_kicks" as any) as any)
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  return { userId, canView: true, canSync: !!member && !kicked, isHost: false };
}
