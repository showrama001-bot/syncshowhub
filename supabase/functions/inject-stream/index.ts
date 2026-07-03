import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-bot-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expected = Deno.env.get("BOT_SECRET_TOKEN");
  if (!expected) return json({ error: "Server not configured" }, 500);

  const provided = req.headers.get("x-admin-bot-key") ?? "";
  if (!provided || !timingSafeEqual(provided, expected)) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const tmdb_id = Number(payload?.tmdb_id);
  const stream_url = typeof payload?.stream_url === "string" ? payload.stream_url.trim() : "";
  const telegram_link = typeof payload?.telegram_link === "string" ? payload.telegram_link.trim() : "";
  const season_number = payload?.season_number != null ? Number(payload.season_number) : null;
  const episode_number = payload?.episode_number != null ? Number(payload.episode_number) : null;

  if (!Number.isFinite(tmdb_id) || tmdb_id <= 0) {
    return json({ error: "tmdb_id is required and must be a positive integer" }, 400);
  }
  if (!stream_url && !telegram_link) {
    return json({ error: "At least one of stream_url or telegram_link is required" }, 400);
  }
  for (const [k, v] of Object.entries({ stream_url, telegram_link })) {
    if (v && !/^https?:\/\//i.test(v) && !(k === "telegram_link" && /^tg:\/\//i.test(v))) {
      return json({ error: `${k} must be a valid URL` }, 400);
    }
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Try movie first
  const { data: movie, error: movieErr } = await admin
    .from("movies").select("id, stream_sources").eq("tmdb_id", tmdb_id).maybeSingle();
  if (movieErr) return json({ error: movieErr.message }, 500);

  if (movie) {
    const sources = Array.isArray(movie.stream_sources) ? [...movie.stream_sources as any[]] : [];
    if (stream_url) {
      const kind = /\.m3u8(\?|$)/i.test(stream_url) ? "hls" : /\.mp4(\?|$)/i.test(stream_url) ? "mp4" : "direct";
      if (!sources.some((s: any) => s?.url === stream_url)) {
        sources.push({ type: kind, url: stream_url, added_by: "bot", added_at: new Date().toISOString() });
      }
    }
    if (telegram_link && !sources.some((s: any) => s?.url === telegram_link)) {
      sources.push({ type: "telegram", url: telegram_link, added_by: "bot", added_at: new Date().toISOString() });
    }
    const patch: Record<string, unknown> = { stream_sources: sources };
    if (stream_url) { patch.stream_url = stream_url; patch.source_type = /\.m3u8(\?|$)/i.test(stream_url) ? "hls" : "direct"; }
    const { error: upErr } = await admin.from("movies").update(patch).eq("id", movie.id);
    if (upErr) return json({ error: upErr.message }, 500);
    return json({ ok: true, target: "movie", id: movie.id });
  }

  // Otherwise episode via series tmdb_id (+ optional season/episode numbers)
  const { data: series } = await admin
    .from("series").select("id").eq("tmdb_id", tmdb_id).maybeSingle();
  if (!series) return json({ error: "No movie or series found for tmdb_id" }, 404);

  const { data: seasons } = await admin
    .from("seasons").select("id, season_number").eq("series_id", series.id);
  const seasonIds = (seasons ?? []).map((s: any) => s.id);
  if (seasonIds.length === 0) return json({ error: "No seasons for series" }, 404);

  let epQuery = admin.from("episodes").select("id, season_id, episode_number, stream_sources").in("season_id", seasonIds);
  if (Number.isFinite(episode_number as number)) epQuery = epQuery.eq("episode_number", episode_number as number);
  if (Number.isFinite(season_number as number)) {
    const matchSeason = (seasons ?? []).find((s: any) => s.season_number === season_number);
    if (!matchSeason) return json({ error: "Season not found" }, 404);
    epQuery = epQuery.eq("season_id", matchSeason.id);
  }
  const { data: episodes, error: epErr } = await epQuery;
  if (epErr) return json({ error: epErr.message }, 500);
  if (!episodes || episodes.length === 0) return json({ error: "No matching episode(s) found" }, 404);
  if (episodes.length > 1 && !(Number.isFinite(episode_number as number) && Number.isFinite(season_number as number))) {
    return json({ error: "Ambiguous target: provide season_number and episode_number" }, 400);
  }

  const ep = episodes[0] as any;
  const sources = Array.isArray(ep.stream_sources) ? [...ep.stream_sources] : [];
  if (stream_url && !sources.some((s: any) => s?.url === stream_url)) {
    const kind = /\.m3u8(\?|$)/i.test(stream_url) ? "hls" : /\.mp4(\?|$)/i.test(stream_url) ? "mp4" : "direct";
    sources.push({ type: kind, url: stream_url, added_by: "bot", added_at: new Date().toISOString() });
  }
  if (telegram_link && !sources.some((s: any) => s?.url === telegram_link)) {
    sources.push({ type: "telegram", url: telegram_link, added_by: "bot", added_at: new Date().toISOString() });
  }
  const patch: Record<string, unknown> = { stream_sources: sources };
  if (stream_url) patch.stream_url = stream_url;
  const { error: upErr } = await admin.from("episodes").update(patch).eq("id", ep.id);
  if (upErr) return json({ error: upErr.message }, 500);
  return json({ ok: true, target: "episode", id: ep.id });
});