import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clapperboard, Play } from "lucide-react";
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
            const thumb = yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null;
            const linkTo = t.movie_id
              ? `/play/movie/${t.movie_id}`
              : t.series_id
              ? `/play/series/${t.series_id}`
              : "#";
            return (
              <Link
                key={t.id}
                to={linkTo}
                className="group rounded-2xl overflow-hidden border border-border/40 bg-card hover:border-primary/60 transition-all"
              >
                <div className="relative aspect-video bg-black">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={t.movie_title ?? "Trailer"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-muted-foreground text-xs">
                      No preview
                    </div>
                  )}
                  <div className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition bg-black/40">
                    <Play className="h-10 w-10 text-primary" />
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium truncate">{t.movie_title ?? "Untitled"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{t.kind ?? "movie"}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}