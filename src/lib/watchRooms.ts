import { supabase } from "@/integrations/supabase/client";

export async function sha256Hex(input: string) {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type RoomVisibility = "public" | "private" | "password";

export type CreateRoomInput = {
  title?: string;
  content_kind: "movie" | "episode";
  content_id?: string | null;
  content_title?: string | null;
  poster_url?: string | null;
  stream_url?: string | null;
  visibility?: RoomVisibility;
  password?: string | null;
  scheduled_at?: string | null;
};

export async function createWatchRoom(input: CreateRoomInput) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sign in to create a watch room");
  const password_hash = input.password ? await sha256Hex(input.password) : null;
  const status = input.scheduled_at ? "scheduled" : "live";
  const payload = {
    host_id: u.user.id,
    title: input.title || "Watch Party",
    content_kind: input.content_kind,
    content_id: input.content_id ?? null,
    content_title: input.content_title ?? null,
    poster_url: input.poster_url ?? null,
    stream_url: input.stream_url ?? null,
    visibility: input.visibility ?? "public",
    password_hash,
    scheduled_at: input.scheduled_at ?? null,
    status,
  };
  const { data, error } = await (supabase.from("watch_rooms" as any) as any)
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}