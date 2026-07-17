// Streamer-scoped Telegram upload — uses a SEPARATE bot (Bot 2) to
// isolate streamer uploads from the main platform bot traffic.
// Requires: TELEGRAM_STREAMER_BOT_TOKEN + TELEGRAM_STREAMER_CHAT_ID.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BYTES = 50 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const BOT_TOKEN = Deno.env.get("TELEGRAM_STREAMER_BOT_TOKEN");
    const CHAT_ID = Deno.env.get("TELEGRAM_STREAMER_CHAT_ID");
    if (!BOT_TOKEN || !CHAT_ID) return json({ error: "Streamer Telegram bot not configured" }, 500);

    const form = await req.formData();
    const file = form.get("file");
    const caption = String(form.get("caption") ?? "");
    if (!(file instanceof File)) return json({ error: "Missing 'file'" }, 400);
    if (file.size === 0) return json({ error: "Empty file" }, 400);
    if (file.size > MAX_BYTES) {
      return json({ error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Bot API limit is 50 MB.` }, 413);
    }

    const tgForm = new FormData();
    tgForm.append("chat_id", CHAT_ID);
    tgForm.append("caption", caption.slice(0, 1024));
    tgForm.append("supports_streaming", "true");
    tgForm.append("video", file, file.name || "movie.mp4");

    let sendJson: any = await (await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`, { method: "POST", body: tgForm })).json();
    if (!sendJson.ok) {
      const docForm = new FormData();
      docForm.append("chat_id", CHAT_ID);
      docForm.append("caption", caption.slice(0, 1024));
      docForm.append("document", file, file.name || "movie.mp4");
      const docJson = await (await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, { method: "POST", body: docForm })).json();
      if (!docJson.ok) return json({ error: `Telegram rejected: ${sendJson.description || docJson.description}` }, 502);
      sendJson = { ok: true, result: docJson.result };
    }

    const result = sendJson.result;
    const fileId = result?.video?.file_id || result?.document?.file_id || result?.animation?.file_id;
    if (!fileId) return json({ error: "No file_id returned" }, 502);

    const gf = await (await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`)).json();
    if (!gf.ok || !gf.result?.file_path) return json({ error: `getFile failed` }, 502);

    return json({ ok: true, stream_url: `https://api.telegram.org/file/bot${BOT_TOKEN}/${gf.result.file_path}`, file_id: fileId });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}