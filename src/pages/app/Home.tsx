import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import heroBg from "@/assets/hero-bg.jpg";
import { Play, Film, Tv, Trophy, Clapperboard, Tv2, Flame, Radio } from "lucide-react";
import { TrailerModal } from "@/components/movies/TrailerModal";
import { HeroVipBanner } from "@/components/ads/VipSpots";

type Movie = {
  id: string;
  title: string;
  poster_url: string | null;
  backdrop_url: string | null;
  genre: string | null;
  year: number | null;
  rating: number | null;
};

export default function Home() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [trailerTarget, setTrailerTarget] = useState<{ kind: "movie" | "series"; id: string; title: string } | null>(null);
  const [seriesTrailerIds, setSeriesTrailerIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadMovies = async () => {
      const { data } = await supabase
        .from("movies")
        .select("id,title,poster_url,backdrop_url,genre,year,rating")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(24);
      const remote = (data ?? []) as Movie[];
      const merged: Movie[] = [];
      const seenId = new Set<string>();
      const seenTmdb = new Set<number>();
      const push = (m: any) => {
        if (!m || !m.id) return;
        if (seenId.has(m.id)) return;
        if (m.tmdb_id && seenTmdb.has(m.tmdb_id)) return;
        seenId.add(m.id);
        if (m.tmdb_id) seenTmdb.add(m.tmdb_id);
        merged.push({
          id: m.id,
          title: m.title,
          poster_url: m.poster_url ?? null,
          backdrop_url: m.backdrop_url ?? m.poster_url ?? null,
          genre: m.genre ?? null,
          year: m.year ?? null,
          rating: m.rating ?? m.imdb_rating ?? null,
        });
      };
      remote.forEach(push);
      setMovies(merged);
    };
    loadMovies();
    (supabase.from("series" as any).select("id,title,poster_url,backdrop_url,genre,year")
      .order("created_at", { ascending: false }).limit(12) as any)
      .then(({ data }: any) => setSeries(data ?? []));
    (supabase.from("trailers" as any).select("series_id").eq("kind", "series") as any)
      .then(({ data }: any) => {
        setSeriesTrailerIds(new Set((data ?? []).map((t: any) => t.series_id).filter(Boolean)));
      });
  }, []);

  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative h-[88vh] min-h-[560px] w-full overflow-hidden">
        <img
          src={heroBg}
          alt=""
          width={1920}
          height={1080}
          className="absolute inset-0 w-full h-full object-cover scale-110"
        />
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6">
          <p className="uppercase tracking-[0.4em] text-xs text-muted-foreground mb-4">
            Stream · Sync · Share
          </p>
          <h1 className="font-display text-6xl md:text-8xl lg:text-9xl tracking-widest neon-text animate-flicker">
            syncshow
          </h1>
          <p className="mt-6 max-w-xl text-muted-foreground text-base md:text-lg">
            A neon-lit cinema for movies, live TV and sports — watch together with friends in real time.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link
              to="/trailers"
              className="px-6 py-3 rounded-full bg-gradient-red shadow-neon font-semibold flex items-center gap-2 hover:scale-105 transition"
            >
              <Clapperboard className="h-4 w-4" /> Watch Trailers
            </Link>
            <Link
              to="/movies"
              className="px-6 py-3 rounded-full glass font-semibold flex items-center gap-2 hover:neon-border transition"
            >
              <Play className="h-4 w-4" /> Browse Movies
            </Link>
            <Link
              to="/watch"
              className="px-6 py-3 rounded-full glass font-semibold hover:neon-border transition"
            >
              Start a Watch Party
            </Link>
          </div>
        </div>
      </section>

      <div className="px-6 md:px-12 pt-6 max-w-6xl mx-auto"><HeroVipBanner /></div>

      {/* Quick categories */}
      <section className="px-6 md:px-12 -mt-16 relative z-20 grid grid-cols-3 md:grid-cols-7 gap-3 md:gap-4 max-w-6xl mx-auto">
        {[
          { to: "/movies", label: "Movies", icon: Film },
          { to: "/series", label: "Series", icon: Tv2 },
          { to: "/tv", label: "Live TV", icon: Tv },
          { to: "/sports", label: "Sports", icon: Trophy },
          { to: "/trailers", label: "Trailers", icon: Clapperboard },
          { to: "/reels", label: "Reels", icon: Flame },
          { to: "/studio", label: "Studio", icon: Radio },
        ].map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="glass rounded-2xl p-4 md:p-6 text-center hover:neon-border transition group"
          >
            <c.icon className="h-6 w-6 md:h-7 md:w-7 mx-auto text-primary group-hover:scale-110 transition" />
            <div className="mt-2 font-semibold text-sm md:text-base">{c.label}</div>
          </Link>
        ))}
      </section>

      {/* Movie grid */}
      <section className="px-6 md:px-12 py-16 max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-6">
          <h2 className="font-display text-2xl md:text-3xl tracking-wider">Trending</h2>
          <Link to="/movies" className="text-sm text-primary hover:underline">View all</Link>
        </div>
        {movies.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
            No movies yet. Ask an admin to add some from the Admin Panel.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {movies.map((m) => (
              <div key={m.id} className="group rounded-2xl overflow-hidden glass hover:neon-border transition animate-float-up flex flex-col">
                <Link to={`/play/movie/${m.id}`} className="block">
                  <div className="aspect-[2/3] bg-secondary overflow-hidden">
                    {m.poster_url ? (
                      <img src={m.poster_url} alt={m.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition duration-500" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-primary/60 font-display">{m.title.slice(0, 2)}</div>
                    )}
                  </div>
                </Link>
                <div className="p-3 flex-1 flex flex-col gap-2">
                  <div>
                    <div className="font-semibold text-sm truncate">{m.title}</div>
                    <div className="text-xs text-muted-foreground">{m.year ?? ""} {m.genre ? `· ${m.genre}` : ""}</div>
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <Link to={`/play/movie/${m.id}`} className="flex-1 inline-flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-md bg-gradient-red shadow-neon font-semibold">
                      <Play className="h-3 w-3" /> Watch
                    </Link>
                    <button
                      type="button"
                      onClick={() => setTrailerTarget({ kind: "movie", id: m.id, title: m.title })}
                      className="flex-1 inline-flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-md glass hover:neon-border transition"
                    >
                      <Clapperboard className="h-3 w-3" /> Trailer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {series.length > 0 && (
        <section className="px-6 md:px-12 pb-16 max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-6">
            <h2 className="font-display text-2xl md:text-3xl tracking-wider">Series</h2>
            <Link to="/series" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {series.map((s) => (
              <div key={s.id} className="group rounded-2xl overflow-hidden glass hover:neon-border transition flex flex-col">
                <Link to={`/play/series/${s.id}`} className="block">
                  <div className="aspect-[2/3] bg-secondary overflow-hidden">
                    {s.poster_url ? (
                      <img src={s.poster_url} alt={s.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition duration-500" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-primary/60 font-display">{s.title.slice(0, 2)}</div>
                    )}
                  </div>
                </Link>
                <div className="p-3 flex-1 flex flex-col gap-2">
                  <div>
                    <div className="font-semibold text-sm truncate">{s.title}</div>
                    <div className="text-xs text-muted-foreground">{s.year ?? ""} {s.genre ? `· ${s.genre}` : ""}</div>
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <Link to={`/play/series/${s.id}`} className="flex-1 inline-flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-md bg-gradient-red shadow-neon font-semibold">
                      <Play className="h-3 w-3" /> Watch
                    </Link>
                    {seriesTrailerIds.has(s.id) && (
                      <button
                        type="button"
                        onClick={() => setTrailerTarget({ kind: "series", id: s.id, title: s.title })}
                        className="flex-1 inline-flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-md glass hover:neon-border transition"
                      >
                        <Clapperboard className="h-3 w-3" /> Trailer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <TrailerModal
        open={!!trailerTarget}
        onOpenChange={(v) => !v && setTrailerTarget(null)}
        movieId={trailerTarget?.id}
        movieTitle={trailerTarget?.title}
        kind={trailerTarget?.kind ?? "movie"}
      />
    </div>
  );
}