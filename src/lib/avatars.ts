import { supabase } from "@/integrations/supabase/client";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data, error: signErr } = await supabase.storage
    .from("avatars")
    .createSignedUrl(path, ONE_YEAR);
  if (signErr || !data) throw signErr ?? new Error("Failed to create signed URL");
  return data.signedUrl;
}