import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: u, error: uErr } = await userClient.auth.getUser();
    if (uErr || !u?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { query, tmdb_id, kind } = await req.json();
    const type = kind === "series" || kind === "tv" ? "tv" : "movie";
    const key = Deno.env.get("TMDB_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "TMDB_API_KEY not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let movie: any = null;
    if (tmdb_id) {
      const r = await fetch(`https://api.themoviedb.org/3/${type}/${tmdb_id}?api_key=${key}&append_to_response=external_ids,videos`);
      movie = await r.json();
    } else if (query) {
      const r = await fetch(`https://api.themoviedb.org/3/search/${type}?api_key=${key}&query=${encodeURIComponent(query)}`);
      const j = await r.json();
      const first = j.results?.[0];
      if (first) {
        const r2 = await fetch(`https://api.themoviedb.org/3/${type}/${first.id}?api_key=${key}&append_to_response=external_ids,videos`);
        movie = await r2.json();
      }
    }

    if (!movie || movie.success === false) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const videos: any[] = movie.videos?.results ?? [];
    const trailer =
      videos.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official) ||
      videos.find((v) => v.site === "YouTube" && v.type === "Trailer") ||
      videos.find((v) => v.site === "YouTube");
    const youtube_trailer_url = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;

    const dateStr = type === "tv" ? movie.first_air_date : movie.release_date;
    const result = {
      tmdb_id: movie.id,
      kind: type === "tv" ? "series" : "movie",
      title: type === "tv" ? movie.name : movie.title,
      description: movie.overview,
      poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
      backdrop_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null,
      year: dateStr ? Number(dateStr.slice(0, 4)) : null,
      genre: movie.genres?.map((g: any) => g.name).join(", ") ?? null,
      category: movie.genres?.[0]?.name ?? null,
      duration_minutes: movie.runtime ?? null,
      imdb_rating: movie.vote_average ?? null,
      rating: movie.vote_average ?? null,
      youtube_trailer_url,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});