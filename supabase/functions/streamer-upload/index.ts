// Public streamer upload: streams the file into a dedicated Telegram channel
// (Bot 2 — isolated from admin uploads), fetches TMDB metadata for the title
// provided by the streamer, and inserts the resulting movie into the public
// `movies` catalog using the service role.
//
// This endpoint is intentionally public — anyone can upload. Keep the
// 50 MB Telegram Bot API cap.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
    const TMDB_KEY = Deno.env.get("TMDB_API_KEY");
    if (!BOT_TOKEN || !CHAT_ID) {
      return json({ error: "Streamer Telegram credentials not configured" }, 500);
    }

    const form = await req.formData();
    const file = form.get("file");
    const title = String(form.get("title") ?? "").trim();
    const streamer = String(form.get("streamer") ?? "").trim();
    if (!(file instanceof File)) return json({ error: "Missing file" }, 400);
    if (!title) return json({ error: "Missing title" }, 400);
    if (file.size === 0) return json({ error: "Empty file" }, 400);
    if (file.size > MAX_BYTES) {
      return json({ error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Telegram limit is 50 MB.` }, 413);
    }

    // 1. Send to Telegram (Bot 2)
    const tgForm = new FormData();
    tgForm.append("chat_id", CHAT_ID);
    tgForm.append("caption", `${title}${streamer ? ` — @${streamer}` : ""}`.slice(0, 1024));
    tgForm.append("supports_streaming", "true");
    tgForm.append("video", file, file.name || "movie.mp4");

    let sendJson: any;
    const sendRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`, { method: "POST", body: tgForm });
    sendJson = await sendRes.json();
    if (!sendJson.ok) {
      const docForm = new FormData();
      docForm.append("chat_id", CHAT_ID);
      docForm.append("caption", title.slice(0, 1024));
      docForm.append("document", file, file.name || "movie.mp4");
      const docRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, { method: "POST", body: docForm });
      const docJson = await docRes.json();
      if (!docJson.ok) return json({ error: `Telegram rejected: ${sendJson.description || docJson.description}` }, 502);
      sendJson = { ok: true, result: docJson.result };
    }
    const result = sendJson.result;
    const fileId: string | undefined = result?.video?.file_id || result?.document?.file_id;
    if (!fileId) return json({ error: "No file_id from Telegram" }, 502);

    const gfRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const gfJson = await gfRes.json();
    if (!gfJson.ok) return json({ error: `getFile failed: ${gfJson.description}` }, 502);
    const streamUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${gfJson.result.file_path}`;

    // 2. Fetch TMDB metadata from title
    let meta: any = { title };
    if (TMDB_KEY) {
      try {
        const s = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}`);
        const sj = await s.json();
        const first = sj.results?.[0];
        if (first) {
          const d = await fetch(`https://api.themoviedb.org/3/movie/${first.id}?api_key=${TMDB_KEY}`);
          const m = await d.json();
          meta = {
            tmdb_id: m.id,
            title: m.title || title,
            description: m.overview ?? null,
            poster_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
            backdrop_url: m.backdrop_path ? `https://image.tmdb.org/t/p/original${m.backdrop_path}` : null,
            year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
            genre: m.genres?.map((g: any) => g.name).join(", ") ?? null,
            category: m.genres?.[0]?.name ?? null,
            duration_minutes: m.runtime ?? null,
            rating: m.vote_average ?? null,
            imdb_rating: m.vote_average ?? null,
          };
        }
      } catch (_) { /* keep title-only meta */ }
    }

    // 3. Insert into movies with service role (public catalog)
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: inserted, error: insErr } = await admin
      .from("movies")
      .insert({
        ...meta,
        stream_url: streamUrl,
        source_type: "direct",
        provider: "telegram-streamer",
        status: "published",
      })
      .select("id")
      .maybeSingle();
    if (insErr) return json({ error: `DB insert failed: ${insErr.message}` }, 500);

    return json({ ok: true, movie_id: inserted?.id, stream_url: streamUrl, file_id: fileId, meta });
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