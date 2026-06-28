import { supabase } from "@/integrations/supabase/client";

export type FriendRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined" | "blocked";
  created_at: string;
  profile?: any;
};

export async function searchUsers(query: string, excludeUserId?: string) {
  if (!query.trim()) return [];
  const term = `%${query}%`;
  let q = supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .or(`username.ilike.${term},display_name.ilike.${term}`)
    .limit(20);
  if (excludeUserId) q = q.neq("id", excludeUserId);
  const { data } = await q;
  return data || [];
}

export async function sendFriendRequest(requesterId: string, addresseeId: string) {
  // Check if friendship already exists either direction
  const { data: existing } = await (supabase.from("friendships" as any) as any)
    .select("id,status,requester_id,addressee_id")
    .or(
      `and(requester_id.eq.${requesterId},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${requesterId})`
    )
    .maybeSingle();
  if (existing) return { error: "Request already exists" };
  const { error } = await (supabase.from("friendships" as any) as any)
    .insert({ requester_id: requesterId, addressee_id: addresseeId, status: "pending" });
  return { error: error?.message };
}

export async function respondFriendRequest(id: string, accept: boolean) {
  const { error } = await (supabase.from("friendships" as any) as any)
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", id);
  return { error: error?.message };
}

export async function removeFriendship(id: string) {
  await (supabase.from("friendships" as any) as any).delete().eq("id", id);
}

export async function listFriendships(userId: string) {
  const { data } = await (supabase.from("friendships" as any) as any)
    .select("*")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  return (data as FriendRow[]) || [];
}

export async function inviteToRoom(roomId: string, fromUser: string, toUser: string) {
  const { error } = await (supabase.from("room_invites" as any) as any)
    .insert({ room_id: roomId, from_user: fromUser, to_user: toUser, status: "pending" });
  return { error: error?.message };
}