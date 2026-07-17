import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, Star, Play, Clapperboard } from "lucide-react";
import { TrailerModal } from "@/components/movies/TrailerModal";
import { GridBanner } from "@/components/ads/GridBanner";
import { Button } from "@/components/ui/button";
import { ContributeFallbackModal } from "@/components/contribute/ContributeFallbackModal";

export default function Movies() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [trailer, setTrailer] = useState<{ id: string; title: string } | null>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("movies")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      const remote = data ?? [];
      const merged: any[] = [];
      const seenTmdb = new Set<number>();
      const seenId = new Set<string>();
      const push = (m: any) => {
        if (!m) return;
        if (m.tmdb_id && seenTmdb.has(m.tmdb_id)) return;
        if (m.id && seenId.has(m.id)) return;
        if (m.tmdb_id) seenTmdb.add(m.tmdb_id);
        if (m.id) seenId.add(m.id);
        merged.push(m);
      };
      remote.forEach(push);
      setItems(merged);
    };
    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((m) => {
      if (m.category) set.add(m.category);
      else if (m.genre) m.genre.split(",").forEach((g: string) => set.add(g.trim()));
    });
    return ["All", ...Array.from(set).filter(Boolean).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((m) => {
      const matchesCat =
        cat === "All" ||
        m.category === cat ||
        (m.genre ?? "").toLowerCase().includes(cat.toLowerCase());
      const matchesQ =
        !needle ||
        m.title.toLowerCase().includes(needle) ||
        (m.genre ?? "").toLowerCase().includes(needle) ||
        (m.category ?? "").toLowerCase().includes(needle) ||
        String(m.year ?? "").includes(needle);
      return matchesCat && matchesQ;
    });
  }, [items, q, cat]);

  return (
    <div className="px-6 md:px-12 pt-20 pb-16 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <h1 className="font-display text-3xl md:text-5xl tracking-wider neon-text">Movies</h1>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, genre, year…" className="pl-9 glass border-border/50" />
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 -mx-2 px-2 scrollbar-thin">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition border ${
              cat === c
                ? "bg-primary text-primary-foreground border-primary shadow-neon"
                : "glass border-border/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-8 border border-border/40 text-center space-y-3">
          <p className="text-muted-foreground">No movies match "{q || cat}".</p>
          {q.trim() && (
            <Button onClick={() => setFallback(true)} className="bg-gradient-red shadow-neon">
              Contribute "{q}"
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.flatMap((m, idx) => {
            const card = (
            <div key={m.id} className="group glass rounded-2xl overflow-hidden hover:neon-border transition flex flex-col">
              <Link to={`/play/movie/${m.id}`} className="block">
                <div className="aspect-[2/3] bg-secondary overflow-hidden relative">
                  {m.poster_url ? (
                    <img src={m.poster_url} alt={m.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition" />
                  ) : (
                    <div className="w-full h-full grid place-items-center font-display text-primary/60">{m.title.slice(0, 2)}</div>
                  )}
                  {m.imdb_rating != null && (
                    <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/70 text-yellow-400 text-[11px] font-semibold">
                      <Star className="h-2.5 w-2.5 fill-yellow-400" /> {Number(m.imdb_rating).toFixed(1)}
                    </div>
                  )}
                </div>
              </Link>
              <div className="p-3 flex-1 flex flex-col gap-2">
                <div>
                  <div className="font-semibold truncate">{m.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{m.year} {m.category ? `· ${m.category}` : m.genre ? `· ${m.genre}` : ""}</div>
                </div>
                <div className="flex gap-2 mt-auto">
                  <Link to={`/play/movie/${m.id}`} className="flex-1 inline-flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-md bg-gradient-red shadow-neon font-semibold">
                    <Play className="h-3 w-3" /> Watch
                  </Link>
                  <button
                    type="button"
                    onClick={() => setTrailer({ id: m.id, title: m.title })}
                    className="flex-1 inline-flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-md glass hover:neon-border transition"
                  >
                    <Clapperboard className="h-3 w-3" /> Trailer
                  </button>
                </div>
              </div>
            </div>
            );
            const out: any[] = [card];
            if ((idx + 1) % 8 === 0) out.push(<GridBanner key={`ad-${idx}`} />);
            return out;
          })}
        </div>
      )}
      <ContributeFallbackModal open={fallback} onOpenChange={setFallback} query={q} />
      <TrailerModal
        open={!!trailer}
        onOpenChange={(v) => !v && setTrailer(null)}
        movieId={trailer?.id}
        movieTitle={trailer?.title}
        kind="movie"
      />
    </div>
  );
}