import { supabase } from "@/integrations/supabase/client";

export type NextEpisode = {
  season_number: number;
  episode_number: number;
  episode_title: string;
  total_seasons: number;
  total_in_season: number;
  // True when the entire series is already fully contributed/published.
  complete: boolean;
};

export type TmdbSeriesMeta = {
  tmdb_id: number;
  title: string;
  description?: string | null;
  poster_url?: string | null;
  backdrop_url?: string | null;
  year?: number | null;
  genre?: string | null;
};

/**
 * Sequential contribution logic — given a series TMDB id, return the next
 * episode the platform is missing. Looks at:
 *   1. published `series` + `seasons` + `episodes` (with a stream_url)
 *   2. `community_uploads` rows for that series (pending/approved)
 *   3. the canonical TMDB structure (total seasons / episodes per season)
 * and returns whichever (season, episode) tuple comes next.
 */
export async function getNextEpisodeForSeries(seriesTmdbId: number): Promise<NextEpisode | null> {
  // 1. Canonical structure from TMDB (English).
  const { data: structure, error: sErr } = await supabase.functions.invoke("tmdb-scraper", {
    body: { action: "series_structure", kind: "series", tmdb_id: seriesTmdbId },
  });
  if (sErr || !structure || (structure as any).error) return null;
  const seasons: { season_number: number; episodes: { episode_number: number; title: string }[] }[] =
    (structure as any).seasons ?? [];
  if (seasons.length === 0) return null;

  // Build a flat ordered list of every canonical episode.
  const flat: { s: number; e: number; title: string }[] = [];
  for (const s of seasons) {
    for (const ep of s.episodes ?? []) {
      flat.push({ s: s.season_number, e: ep.episode_number, title: ep.title });
    }
  }
  if (flat.length === 0) return null;

  // 2. Already-published episodes for this series in our DB.
  const taken = new Set<string>();
  const { data: pubSeries } = await (supabase.from("series" as any) as any)
    .select("id")
    .eq("tmdb_id", seriesTmdbId)
    .maybeSingle();
  if (pubSeries?.id) {
    const { data: pubSeasons } = await (supabase.from("seasons" as any) as any)
      .select("id, season_number")
      .eq("series_id", pubSeries.id);
    const seasonMap = new Map<string, number>(
      (pubSeasons ?? []).map((row: any) => [row.id, row.season_number]),
    );
    if (seasonMap.size > 0) {
      const { data: pubEps } = await (supabase.from("episodes" as any) as any)
        .select("season_id, episode_number, stream_url")
        .in("season_id", Array.from(seasonMap.keys()));
      for (const ep of pubEps ?? []) {
        const sn = seasonMap.get(ep.season_id);
        if (sn != null && ep.episode_number != null && ep.stream_url) {
          taken.add(`${sn}:${ep.episode_number}`);
        }
      }
    }
  }

  // 3. Pending/approved community uploads for this series.
  const { data: pending } = await (supabase.from("community_uploads" as any) as any)
    .select("season_number, episode_number")
    .eq("kind", "episode")
    .eq("series_tmdb_id", seriesTmdbId)
    .in("status", ["pending", "approved"]);
  for (const row of pending ?? []) {
    if (row.season_number != null && row.episode_number != null) {
      taken.add(`${row.season_number}:${row.episode_number}`);
    }
  }

  // 4. First canonical episode not yet taken.
  const next = flat.find((x) => !taken.has(`${x.s}:${x.e}`));
  if (!next) {
    const last = flat[flat.length - 1];
    return {
      season_number: last.s,
      episode_number: last.e,
      episode_title: last.title,
      total_seasons: seasons.length,
      total_in_season:
        seasons.find((ss) => ss.season_number === last.s)?.episodes.length ?? 0,
      complete: true,
    };
  }
  return {
    season_number: next.s,
    episode_number: next.e,
    episode_title: next.title,
    total_seasons: seasons.length,
    total_in_season:
      seasons.find((ss) => ss.season_number === next.s)?.episodes.length ?? 0,
    complete: false,
  };
}

/** Look up a series by name in TMDB (English). Returns top matches. */
export async function searchTmdbSeries(query: string): Promise<TmdbSeriesMeta[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase.functions.invoke("tmdb-scraper", {
    body: { action: "search", kind: "series", query: query.trim() },
  });
  if (error || !data || (data as any).error) return [];
  return ((data as any).results ?? []).map((r: any) => ({
    tmdb_id: r.tmdb_id,
    title: r.title,
    description: r.overview,
    poster_url: r.poster_url,
    year: r.year ? Number(r.year) : null,
  }));
}

/** Search both movies and series in TMDB (used by the no-results fallback). */
export async function searchTmdbAny(query: string): Promise<
  ({ kind: "movie" | "series" } & TmdbSeriesMeta)[]
> {
  if (!query.trim()) return [];
  const [m, s] = await Promise.all([
    supabase.functions.invoke("tmdb-scraper", {
      body: { action: "search", kind: "movie", query: query.trim() },
    }),
    supabase.functions.invoke("tmdb-scraper", {
      body: { action: "search", kind: "series", query: query.trim() },
    }),
  ]);
  const toRows = (resp: any, kind: "movie" | "series") =>
    ((resp?.data?.results ?? []) as any[]).slice(0, 8).map((r) => ({
      kind,
      tmdb_id: r.tmdb_id,
      title: r.title,
      description: r.overview,
      poster_url: r.poster_url,
      year: r.year ? Number(r.year) : null,
    }));
  return [...toRows(m, "movie"), ...toRows(s, "series")];
}

/** Detailed metadata for a single TMDB title (used right before upload). */
export async function fetchTmdbDetails(
  tmdbId: number,
  kind: "movie" | "series",
): Promise<TmdbSeriesMeta | null> {
  const { data, error } = await supabase.functions.invoke("tmdb-scraper", {
    body: { action: "details", kind, tmdb_id: tmdbId },
  });
  if (error || !data || (data as any).error) return null;
  const d = data as any;
  return {
    tmdb_id: d.tmdb_id,
    title: d.title,
    description: d.description,
    poster_url: d.poster_url,
    backdrop_url: d.backdrop_url,
    year: d.year,
    genre: d.genre,
  };
}