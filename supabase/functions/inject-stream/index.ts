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

const IMG = (p?: string | null) => (p ? `https://image.tmdb.org/t/p/original${p}` : null);

async function tmdb(path: string, params: Record<string, string> = {}) {
  const key = Deno.env.get("TMDB_API_KEY");
  if (!key) return null;
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("api_key", key);
  url.searchParams.set("language", "en-US");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function kindOf(url: string) {
  return /\.m3u8(\?|$)/i.test(url) ? "hls" : /\.mp4(\?|$)/i.test(url) ? "mp4" : "direct";
}

/** Merge new links into an existing stream_sources array without ever duplicating a URL. */
function mergeSources(existing: unknown, stream_url: string, telegram_link: string) {
  const sources = Array.isArray(existing) ? [...(existing as any[])] : [];
  const seen = new Set(sources.map((s: any) => String(s?.url ?? "")));
  const now = new Date().toISOString();
  if (stream_url && !seen.has(stream_url)) {
    sources.push({ type: kindOf(stream_url), url: stream_url, added_by: "bot", added_at: now });
    seen.add(stream_url);
  }
  if (telegram_link && !seen.has(telegram_link)) {
    sources.push({ type: "telegram", url: telegram_link, added_by: "bot", added_at: now });
  }
  return sources;
}

function firstString(obj: any, keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function makeAdmin() {
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey);
}

/** Auth: accept the bot secret key OR an authenticated admin user's JWT. */
async function isAuthorized(req: Request): Promise<{ ok: boolean; error?: string; status?: number }> {
  const expected = Deno.env.get("BOT_SECRET_TOKEN");
  const provided = (req.headers.get("x-admin-bot-key") ?? req.headers.get("X-Admin-Bot-Key") ?? "").trim();
  if (expected && provided && timingSafeEqual(provided, expected)) return { ok: true };

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (token) {
    const admin = makeAdmin();
    if (!admin) return { ok: false, error: "Server not configured: database credentials missing", status: 500 };
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (!userErr && user) {
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (isAdmin === true) return { ok: true };
      return { ok: false, error: "Forbidden: admin role required", status: 403 };
    }
  }
  return { ok: false, error: "Unauthorized: invalid or missing X-Admin-Bot-Key / admin session", status: 401 };
}

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const auth = await isAuthorized(req);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status ?? 401);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }
  if (!payload || typeof payload !== "object") {
    return json({ ok: false, error: "Body must be a JSON object" }, 400);
  }

  const tmdb_id = toNum(payload.tmdb_id ?? payload.tmdbId ?? payload.id);
  const stream_url = firstString(payload, ["stream_url", "streamUrl", "url", "video_url", "m3u8", "embed_url", "iframe"]);
  const telegram_link = firstString(payload, ["telegram_link", "telegramLink", "telegram", "tg_link"]);
  const season_number = toNum(payload.season_number ?? payload.season ?? payload.seasonNumber);
  const episode_number = toNum(payload.episode_number ?? payload.episode ?? payload.episodeNumber);

  if (tmdb_id == null || tmdb_id <= 0) {
    return json({ ok: false, error: "tmdb_id is required and must be a positive integer" }, 400);
  }
  if (!stream_url && !telegram_link) {
    return json({ ok: false, error: "At least one of stream_url or telegram_link is required" }, 400);
  }
  for (const [k, v] of Object.entries({ stream_url, telegram_link })) {
    if (v && !/^https?:\/\//i.test(v) && !(k === "telegram_link" && /^tg:\/\//i.test(v))) {
      return json({ ok: false, error: `${k} must be a valid URL` }, 400);
    }
  }

  const isEpisode = season_number != null && episode_number != null;

  const admin = makeAdmin();
  if (!admin) {
    return json({ ok: false, error: "Server not configured: database credentials missing" }, 500);
  }



  // ---------------------------------------------------------------- MOVIE ---
  if (!isEpisode) {
    const { data: movie, error: movieErr } = await admin
      .from("movies").select("id, stream_sources").eq("tmdb_id", tmdb_id).maybeSingle();
    if (movieErr) return json({ error: movieErr.message }, 500);

    if (movie) {
      const sources = mergeSources(movie.stream_sources, stream_url, telegram_link);
      const patch: Record<string, unknown> = { stream_sources: sources };
      if (stream_url) { patch.stream_url = stream_url; patch.source_type = kindOf(stream_url); }
      const { error: upErr } = await admin.from("movies").update(patch).eq("id", movie.id);
      if (upErr) return json({ error: upErr.message }, 500);
      return json({ ok: true, target: "movie", created: false, id: movie.id, sources: sources.length });
    }

    // Auto-create the movie from TMDB metadata.
    const meta = await tmdb(`/movie/${tmdb_id}`);
    const sources = mergeSources([], stream_url, telegram_link);
    const row: Record<string, unknown> = {
      tmdb_id,
      title: meta?.title ?? meta?.original_title ?? `TMDB #${tmdb_id}`,
      description: meta?.overview ?? null,
      poster_url: IMG(meta?.poster_path),
      backdrop_url: IMG(meta?.backdrop_path),
      year: meta?.release_date ? Number(String(meta.release_date).slice(0, 4)) : null,
      genre: meta?.genres?.[0]?.name ?? null,
      duration_minutes: meta?.runtime ?? null,
      imdb_rating: meta?.vote_average ?? null,
      stream_url: stream_url || null,
      source_type: stream_url ? kindOf(stream_url) : "direct",
      stream_sources: sources,
      is_admin_upload: true,
      status: "published",
    };
    const { data: created, error: insErr } = await admin
      .from("movies").insert(row).select("id").single();
    if (insErr) return json({ error: insErr.message }, 500);
    return json({
      ok: true, target: "movie", created: true, id: created.id,
      metadata: meta ? "tmdb" : "basic", sources: sources.length,
    });
  }

  // -------------------------------------------------------------- EPISODE ---
  // Ensure series exists.
  let seriesId: string | null = null;
  const { data: series, error: serErr } = await admin
    .from("series").select("id").eq("tmdb_id", tmdb_id).maybeSingle();
  if (serErr) return json({ error: serErr.message }, 500);
  seriesId = series?.id ?? null;

  if (!seriesId) {
    const meta = await tmdb(`/tv/${tmdb_id}`);
    const { data: createdSeries, error: sErr } = await admin.from("series").insert({
      tmdb_id,
      title: meta?.name ?? meta?.original_name ?? `TMDB #${tmdb_id}`,
      description: meta?.overview ?? null,
      poster_url: IMG(meta?.poster_path),
      backdrop_url: IMG(meta?.backdrop_path),
      genre: meta?.genres?.[0]?.name ?? null,
      year: meta?.first_air_date ? Number(String(meta.first_air_date).slice(0, 4)) : null,
      imdb_rating: meta?.vote_average ?? null,
    }).select("id").single();
    if (sErr) return json({ error: sErr.message }, 500);
    seriesId = createdSeries.id;
  }

  // Ensure season exists.
  let seasonId: string | null = null;
  const { data: season } = await admin
    .from("seasons").select("id").eq("series_id", seriesId).eq("season_number", season_number).maybeSingle();
  seasonId = season?.id ?? null;

  if (!seasonId) {
    const { data: createdSeason, error: seErr } = await admin.from("seasons").insert({
      series_id: seriesId,
      season_number,
      title: `Season ${season_number}`,
    }).select("id").single();
    if (seErr) return json({ error: seErr.message }, 500);
    seasonId = createdSeason.id;
  }

  // Ensure episode exists, then merge sources.
  const { data: ep } = await admin
    .from("episodes").select("id, stream_sources")
    .eq("season_id", seasonId).eq("episode_number", episode_number).maybeSingle();

  if (ep) {
    const sources = mergeSources(ep.stream_sources, stream_url, telegram_link);
    const patch: Record<string, unknown> = { stream_sources: sources };
    if (stream_url) patch.stream_url = stream_url;
    const { error: upErr } = await admin.from("episodes").update(patch).eq("id", ep.id);
    if (upErr) return json({ error: upErr.message }, 500);
    return json({ ok: true, target: "episode", created: false, id: ep.id, sources: sources.length });
  }

  const epMeta = await tmdb(`/tv/${tmdb_id}/season/${season_number}/episode/${episode_number}`);
  const sources = mergeSources([], stream_url, telegram_link);
  const { data: createdEp, error: eErr } = await admin.from("episodes").insert({
    season_id: seasonId,
    episode_number,
    title: epMeta?.name ?? `Episode ${episode_number}`,
    stream_url: stream_url || null,
    stream_sources: sources,
  }).select("id").single();
  if (eErr) return json({ error: eErr.message }, 500);

  return json({
    ok: true, target: "episode", created: true, id: createdEp.id,
    series_id: seriesId, season_id: seasonId,
    metadata: epMeta ? "tmdb" : "basic", sources: sources.length,
  });
}

Deno.serve(handle);
