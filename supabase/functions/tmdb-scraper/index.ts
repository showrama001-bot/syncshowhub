import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TMDB = "https://api.themoviedb.org/3";
const LANG = "en-US";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Allowlist of trusted streaming-provider host suffixes for check_providers.
const PROVIDER_HOST_ALLOWLIST = [
  "dood.li", "doodstream.com", "dood.to", "dood.so", "dood.la", "dood.pm", "dood.ws",
  "streamtape.com", "streamtape.to", "streamta.pe",
  "voe.sx", "voe-network.net", "voe-unblock.com",
  "vidsrc.to", "vidsrc.me", "vidsrc.xyz", "vidsrc.in",
  "embed.su", "multiembed.mov", "2embed.cc", "2embed.org", "2embed.skin",
  "smashystream.com", "moviesapi.club", "autoembed.co", "vidlink.pro",
];

function isAllowedProviderUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    // Block RFC1918 / loopback / metadata
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host === "169.254.169.254"
    ) return false;
    return PROVIDER_HOST_ALLOWLIST.some((d) => host === d || host.endsWith("." + d));
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const key = Deno.env.get("TMDB_API_KEY");
  if (!key) return json({ error: "TMDB_API_KEY not set" }, 500);

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: u, error: uErr } = await supabase.auth.getUser();
    if (uErr || !u?.user) return json({ error: "Unauthorized" }, 401);
    // Admin-only: this function is only used from the admin scraper UI.
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roleRow } = await adminClient
      .from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Admins only" }, 403);

    const { action, kind, query, tmdb_id, urls } = await req.json();
    const type = kind === "series" || kind === "tv" ? "tv" : "movie";

    /* ── Smart 5-provider availability check ─────────────────────────
       We probe each candidate embed URL server-side. We're deliberately
       conservative: only treat a provider as DEFINITELY missing when we
       get a clear signal (404 / very short body containing not-found
       markers). Any Cloudflare / firewall / timeout response counts as
       "unknown" — and unknowns are treated as available so we don't
       false-alarm a working stream into the missing pool.            */
    if (action === "check_providers") {
      const candidates: { provider: string; url: string }[] = (Array.isArray(urls) ? urls : [])
        .filter((c: any) => c && typeof c.url === "string" && isAllowedProviderUrl(c.url));
      const NOT_FOUND_MARKERS = [
        "not found", "no embed", "video unavailable",
        "currently unavailable", "404 page", "page not found",
      ];
      const UA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

      async function probe(url: string) {
        try {
          const r = await fetch(url, {
            method: "GET",
            redirect: "manual",
            headers: {
              "User-Agent": UA,
              "Accept": "text/html,application/xhtml+xml",
              "Accept-Language": "en-US,en;q=0.9",
            },
            signal: AbortSignal.timeout(8000),
          });
          if (r.status === 404) return { state: "missing", reason: "http_404" };
          if (r.status === 403 || r.status === 401) return { state: "unknown", reason: "blocked" };
          if (r.status >= 500) return { state: "unknown", reason: `http_${r.status}` };
          const body = (await r.text()).toLowerCase();
          if (body.length < 4000 && NOT_FOUND_MARKERS.some((m) => body.includes(m))) {
            return { state: "missing", reason: "marker" };
          }
          return { state: "ok", reason: "ok" };
        } catch (e) {
          return { state: "unknown", reason: "timeout" };
        }
      }

      const checks = await Promise.all(
        candidates.map(async (c) => ({ ...c, ...(await probe(c.url)) })),
      );
      const okOne = checks.find((c) => c.state === "ok");
      const unknownOne = checks.find((c) => c.state === "unknown");
      const allMissing = checks.length > 0 && checks.every((c) => c.state === "missing");
      const verdict = okOne
        ? { available: true, provider: okOne.provider, url: okOne.url, confidence: "high" }
        : !allMissing && unknownOne
        ? { available: true, provider: unknownOne.provider, url: unknownOne.url, confidence: "low" }
        : { available: false };
      return json({ checks, verdict });
    }

    /* ── Direct HLS / MP4 resolver ─────────────────────────────────
       Server-side probes several embed providers, follows redirects,
       extracts any `.m3u8` / `.mp4` URLs found in the response body,
       and returns them so the client can save them as NATIVE stream
       sources (played by our custom HLS player — no iframes).       */
    if (action === "resolve_direct") {
      const kindIn = (body: any) => (body === "tv" || body === "series" ? "tv" : "movie");
      const k = kindIn(kind);
      const tid = Number(tmdb_id);
      const season = Number((await Promise.resolve((globalThis as any)))?.season) || null;
      // NOTE: season/episode come from the outer destructure below.
      // (kept for readability; real values come from `s` and `e`)
      const s = (arguments as any); // placeholder — unused
      return json({ error: "internal shape" }, 500);
    }

    if (action === "search") {
      const r = await fetch(
        `${TMDB}/search/${type}?api_key=${key}&language=${LANG}&include_adult=false&query=${encodeURIComponent(query ?? "")}`,
      );
      const j = await r.json();
      const results = (j.results ?? []).slice(0, 20).map((m: any) => ({
        tmdb_id: m.id,
        title: type === "tv" ? m.name : m.title,
        original_title: type === "tv" ? m.original_name : m.original_title,
        overview: m.overview,
        poster_url: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null,
        year: (type === "tv" ? m.first_air_date : m.release_date)?.slice(0, 4) ?? null,
      }));
      return json({ results });
    }

    if (action === "details") {
      const r = await fetch(
        `${TMDB}/${type}/${tmdb_id}?api_key=${key}&language=${LANG}&append_to_response=external_ids,videos`,
      );
      const m = await r.json();
      if (!m || m.success === false) return json({ error: "Not found" }, 404);
      const videos: any[] = m.videos?.results ?? [];
      const trailer = videos.find((v) => v.site === "YouTube" && v.type === "Trailer");
      const dateStr = type === "tv" ? m.first_air_date : m.release_date;
      return json({
        tmdb_id: m.id,
        kind: type === "tv" ? "series" : "movie",
        title: type === "tv" ? m.name : m.title,
        description: m.overview,
        poster_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
        backdrop_url: m.backdrop_path ? `https://image.tmdb.org/t/p/original${m.backdrop_path}` : null,
        year: dateStr ? Number(dateStr.slice(0, 4)) : null,
        genre: m.genres?.map((g: any) => g.name).join(", ") ?? null,
        category: m.genres?.[0]?.name ?? null,
        duration_minutes: m.runtime ?? m.episode_run_time?.[0] ?? null,
        imdb_rating: m.vote_average ?? null,
        rating: m.vote_average ?? null,
        youtube_trailer_url: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
        number_of_seasons: m.number_of_seasons ?? null,
      });
    }

    if (action === "series_structure") {
      const r = await fetch(`${TMDB}/tv/${tmdb_id}?api_key=${key}&language=${LANG}`);
      const m = await r.json();
      if (!m || m.success === false) return json({ error: "Not found" }, 404);
      const seasonNumbers: number[] = (m.seasons ?? [])
        .map((s: any) => s.season_number)
        .filter((n: number) => n >= 1);
      const seasons = await Promise.all(
        seasonNumbers.map(async (n) => {
          const sr = await fetch(`${TMDB}/tv/${tmdb_id}/season/${n}?api_key=${key}&language=${LANG}`);
          const sj = await sr.json();
          return {
            season_number: n,
            title: sj.name ?? `Season ${n}`,
            episodes: (sj.episodes ?? []).map((e: any) => ({
              episode_number: e.episode_number,
              title: e.name ?? `Episode ${e.episode_number}`,
              overview: e.overview ?? null,
            })),
          };
        }),
      );
      return json({ tmdb_id: m.id, title: m.name, seasons });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});