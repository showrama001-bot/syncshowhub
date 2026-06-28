import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, Star, Clapperboard, Play } from "lucide-react";
import { TrailerModal } from "@/components/movies/TrailerModal";
import { Button } from "@/components/ui/button";
import { ContributeFallbackModal } from "@/components/contribute/ContributeFallbackModal";

export default function Series() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [trailer, setTrailer] = useState<{ id: string; title: string } | null>(null);
  const [trailerIds, setTrailerIds] = useState<Set<string>>(new Set());
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    (supabase.from("series" as any).select("*").order("created_at", { ascending: false }) as any)
      .then(({ data }: any) => setItems(data ?? []));
    (supabase.from("trailers" as any).select("series_id").eq("kind", "series") as any)
      .then(({ data }: any) => {
        setTrailerIds(new Set((data ?? []).map((t: any) => t.series_id).filter(Boolean)));
      });
  }, []);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return items;
    return items.filter((s) =>
      s.title.toLowerCase().includes(n) ||
      (s.genre ?? "").toLowerCase().includes(n) ||
      (s.category ?? "").toLowerCase().includes(n)
    );
  }, [items, q]);

  return (
    <div className="px-6 md:px-12 pt-20 pb-16 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <h1 className="font-display text-3xl md:text-5xl tracking-wider neon-text">Series</h1>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, genre…" className="pl-9 glass border-border/50" />
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-8 border border-border/40 text-center space-y-3">
          <p className="text-muted-foreground">
            {q.trim() ? `No series match "${q}".` : "No series yet."}
          </p>
          {q.trim() && (
            <Button onClick={() => setFallback(true)} className="bg-gradient-red shadow-neon">
              Contribute "{q}"
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((s) => (
            <div key={s.id} className="group glass rounded-2xl overflow-hidden hover:neon-border transition flex flex-col">
              <Link to={`/play/series/${s.id}`} className="block">
                <div className="aspect-[2/3] bg-secondary overflow-hidden relative">
                  {s.poster_url ? (
                    <img src={s.poster_url} alt={s.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition" />
                  ) : (
                    <div className="w-full h-full grid place-items-center font-display text-primary/60">{s.title.slice(0, 2)}</div>
                  )}
                  {s.imdb_rating != null && (
                    <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/70 text-yellow-400 text-[11px] font-semibold">
                      <Star className="h-2.5 w-2.5 fill-yellow-400" /> {Number(s.imdb_rating).toFixed(1)}
                    </div>
                  )}
                </div>
              </Link>
              <div className="p-3 flex-1 flex flex-col gap-2">
                <div>
                  <div className="font-semibold truncate">{s.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{s.year} {s.category ? `· ${s.category}` : s.genre ? `· ${s.genre}` : ""}</div>
                </div>
                <div className="flex gap-2 mt-auto">
                  <Link to={`/play/series/${s.id}`} className="flex-1 inline-flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-md bg-gradient-red shadow-neon font-semibold">
                    <Play className="h-3 w-3" /> Watch
                  </Link>
                  {trailerIds.has(s.id) && (
                    <button
                      type="button"
                      onClick={() => setTrailer({ id: s.id, title: s.title })}
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
      )}
      <TrailerModal
        open={!!trailer}
        onOpenChange={(v) => !v && setTrailer(null)}
        movieId={trailer?.id}
        movieTitle={trailer?.title}
        kind="series"
      />
      <ContributeFallbackModal open={fallback} onOpenChange={setFallback} query={q} />
    </div>
  );
}