import { supabase } from "@/integrations/supabase/client";

export const STUDIO_TELEGRAM_MAX_BYTES = 50 * 1024 * 1024;

export type StudioTelegramUploadResult = { stream_url: string; file_id: string };

/** Upload a file to the isolated Studio Telegram bot with progress reporting. */
export async function uploadToStudioTelegram(
  file: File,
  caption: string,
  onProgress?: (pct: number) => void,
): Promise<StudioTelegramUploadResult> {
  if (!file) throw new Error("No file selected");
  if (file.size === 0) throw new Error("Empty file");
  if (file.size > STUDIO_TELEGRAM_MAX_BYTES) {
    throw new Error(
      `File is ${(file.size / 1024 / 1024).toFixed(1)} MB. Telegram Bot API limit is 50 MB.`,
    );
  }
  const { data: sess } = await supabase.auth.getSession();
  const accessToken = sess.session?.access_token;
  if (!accessToken) throw new Error("Not signed in");

  const fd = new FormData();
  fd.append("file", file, file.name);
  fd.append("caption", caption.slice(0, 1024));

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-telegram-upload`;
  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) {
        onProgress(Math.round((ev.loaded / ev.total) * 95));
      }
    };
    xhr.onload = () => {
      try {
        const j = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300 && j.stream_url) resolve(j);
        else reject(new Error(j?.error || `Upload failed (${xhr.status})`));
      } catch {
        reject(new Error("Bad response from upload service"));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(fd);
  });
}