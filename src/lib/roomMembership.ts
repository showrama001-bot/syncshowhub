import { supabase } from "@/integrations/supabase/client";

/**
 * Per-room membership. RLS on room_chat_messages requires a matching
 * room_participants row, so every viewer must register on join and
 * clear it on leave.
 */
export async function joinRoom(roomId: string, userId: string) {
  const { error } = await (supabase.from("room_participants" as any) as any).upsert(
    { room_id: roomId, user_id: userId, last_seen_at: new Date().toISOString() },
    { onConflict: "room_id,user_id" },
  );
  return error ?? null;
}

export async function leaveRoom(roomId: string, userId: string) {
  await (supabase.from("room_participants" as any) as any)
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId);
}

/** Host/admin removal of another member. */
export async function removeRoomMember(roomId: string, userId: string) {
  await (supabase.from("room_participants" as any) as any)
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId);
}