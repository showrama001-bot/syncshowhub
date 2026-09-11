import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Streams an authenticated user's video into our private Telegram channel.
// The response contains only an application proxy URL; the bot token never
// leaves this server-side function.
//
// Hard limit (Telegram-enforced): 50 MB per file via Bot API.
// Larger files require an MTProto worker (planned, hibernated for now).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BYTES = 50 * 1024 * 1024; // Telegram Bot API hard cap

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!authHeader.startsWith("Bearer ") || !supabaseUrl || !anonKey) {
      return json({ error: "Authentication required" }, 401);
    }
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Authentication required" }, 401);

    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!BOT_TOKEN || !CHAT_ID) {
      return json({ error: "Telegram credentials not configured" }, 500);
    }

    const form = await req.formData();
    const file = form.get("file");
    const caption = String(form.get("caption") ?? "");
    if (!(file instanceof File)) {
      return json({ error: "Missing 'file' in form data" }, 400);
    }
    if (file.size === 0) return json({ error: "Empty file" }, 400);
    if (file.size > MAX_BYTES) {
      return json(
        {
          error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Telegram Bot API limit is 50 MB. Compress the file or wait for the premium tier.`,
        },
        413,
      );
    }

    // Forward the multipart payload straight to Telegram sendVideo.
    const tgForm = new FormData();
    tgForm.append("chat_id", CHAT_ID);
    tgForm.append("caption", caption.slice(0, 1024));
    tgForm.append("supports_streaming", "true");
    tgForm.append("video", file, file.name || "movie.mp4");

    const sendRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`,
      { method: "POST", body: tgForm },
    );
    const sendJson = await sendRes.json();
    if (!sendJson.ok) {
      // Fallback: try sendDocument for unusual container formats.
      const docForm = new FormData();
      docForm.append("chat_id", CHAT_ID);
      docForm.append("caption", caption.slice(0, 1024));
      docForm.append("document", file, file.name || "movie.mp4");
      const docRes = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`,
        { method: "POST", body: docForm },
      );
      const docJson = await docRes.json();
      if (!docJson.ok) {
        return json(
          { error: `Telegram rejected file: ${sendJson.description || docJson.description}` },
          502,
        );
      }
      sendJson.result = docJson.result;
      sendJson.ok = true;
    }

    const result = sendJson.result;
    const fileId: string | undefined =
      result?.video?.file_id ||
      result?.document?.file_id ||
      result?.animation?.file_id;
    if (!fileId) return json({ error: "No file_id returned from Telegram" }, 502);

    const expires = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    const signature = await signMediaReference(BOT_TOKEN, "main", fileId, expires);
    const streamUrl = `${supabaseUrl}/functions/v1/telegram-media?source=main&file_id=${encodeURIComponent(fileId)}&expires=${expires}&signature=${signature}`;

    return json({
      ok: true,
      stream_url: streamUrl,
      file_id: fileId,
      message_id: result?.message_id ?? null,
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function signMediaReference(secret: string, source: string, fileId: string, expires: number) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${source}:${fileId}:${expires}`));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}