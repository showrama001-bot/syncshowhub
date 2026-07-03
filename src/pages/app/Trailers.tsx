import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Clapperboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

type Trailer = {
  id: string;
  movie_title: string | null;
  youtube_url: string | null;
  movie_id: string | null;
  series_id: string | null;
  kind: string | null;
};

function youtubeId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

export default function Trailers() {
  const [rows, setRows] = useState<Trailer[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const targetId = searchParams.get("id");
  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("trailers")
        .select("id, movie_title, youtube_url, movie_id, series_id, kind")
        .order("created_at", { ascending: false });
      setRows((data as Trailer[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter((r) =>
    (r.movie_title ?? "").toLowerCase().includes(q.toLowerCase().trim()),
  );

  useEffect(() => {
    if (!targetId || loading) return;
    // Wait a tick for the grid to render, then scroll into view.
    const t = setTimeout(() => {
      targetRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return () => clearTimeout(t);
  }, [targetId, loading, rows]);

  return (
    <div className="pt-20 px-4 md:px-8 max-w-7xl mx-auto pb-16">
      <header className="mb-6">
        <h1 className="font-display text-3xl md:text-5xl tracking-wider neon-text flex items-center gap-3">
          <Clapperboard className="h-8 w-8" /> Trailers
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          Browse trailers for movies and series.
        </p>
      </header>
      <Input
        placeholder="Search trailers by title…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-6 max-w-md"
      />
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">No trailers found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((t) => {
            const yt = youtubeId(t.youtube_url);
            const isTarget = t.id === targetId;
            return (
              <div
                key={t.id}
                ref={isTarget ? targetRef : undefined}
                className={`rounded-2xl overflow-hidden border bg-card hover:border-primary/60 transition-all ${
                  isTarget ? "border-primary shadow-neon ring-2 ring-primary/60" : "border-border/40"
                }`}
              >
                <div className="relative aspect-video bg-black">
                  {yt ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${yt}${isTarget ? "?autoplay=1" : ""}`}
                      title={t.movie_title ?? "Trailer"}
                      loading="lazy"
                      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-muted-foreground text-xs">
                      No preview
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium truncate">{t.movie_title ?? "Untitled"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{t.kind ?? "movie"}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}