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

    const { action, kind, query, tmdb_id } = await req.json();
    const type = kind === "series" || kind === "tv" ? "tv" : "movie";

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