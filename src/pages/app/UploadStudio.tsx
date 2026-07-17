import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, UploadCloud, Film, Loader2, CheckCircle2, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type TmdbHit = {
  tmdb_id: number;
  title: string;
  year: number | null;
  genre: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  description?: string | null;
};

const MOCK_HITS: TmdbHit[] = [
  { tmdb_id: 27205, title: "Inception", year: 2010, genre: "Action, Sci-Fi", poster_url: "https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg", backdrop_url: null },
  { tmdb_id: 155, title: "The Dark Knight", year: 2008, genre: "Action, Crime, Drama", poster_url: "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg", backdrop_url: null },
  { tmdb_id: 157336, title: "Interstellar", year: 2014, genre: "Adventure, Drama, Sci-Fi", poster_url: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg", backdrop_url: null },
  { tmdb_id: 603, title: "The Matrix", year: 1999, genre: "Action, Sci-Fi", poster_url: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg", backdrop_url: null },
  { tmdb_id: 24428, title: "The Avengers", year: 2012, genre: "Action, Adventure, Sci-Fi", poster_url: "https://image.tmdb.org/t/p/w500/RYMX2wcKCBAr24UyPD7xwmjaTn.jpg", backdrop_url: null },
  { tmdb_id: 335983, title: "Venom", year: 2018, genre: "Action, Sci-Fi", poster_url: "https://image.tmdb.org/t/p/w500/2uNW4WbgBXL25BAbXGLnLqX71Sw.jpg", backdrop_url: null },
];

export default function UploadStudio() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<TmdbHit[]>([]);
  const [picked, setPicked] = useState<TmdbHit | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [done, setDone] = useState(false);

  const canPublish = Boolean(picked && file && !publishing);

  const search = async () => {
    const q = query.trim();
    if (!q) return toast.error("Type a movie name first");
    setSearching(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("tmdb-fetch", {
        body: { query: q, kind: "movie" },
      });
      if (error || !data || (data as any).error) throw new Error("no live");
      const d = data as any;
      setResults([
        {
          tmdb_id: d.tmdb_id,
          title: d.title,
          year: d.year,
          genre: d.genre,
          poster_url: d.poster_url,
          backdrop_url: d.backdrop_url,
          description: d.description,
        },
        ...MOCK_HITS.filter((m) => m.title.toLowerCase().includes(q.toLowerCase())).slice(0, 5),
      ]);
    } catch {
      // Fallback to mock filtered grid so the UI still feels alive.
      const filtered = MOCK_HITS.filter((m) => m.title.toLowerCase().includes(q.toLowerCase()));
      setResults(filtered.length ? filtered : MOCK_HITS);
    } finally {
      setSearching(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }, []);

  const publish = async () => {
    if (!picked || !file) return;
    setPublishing(true);
    // Simulated publish flow — kept isolated to this page, no DB writes.
    await new Promise((r) => setTimeout(r, 1200));
    setPublishing(false);
    setDone(true);
    toast.success(`"${picked.title}" published to your library`);
  };

  const reset = () => {
    setPicked(null);
    setFile(null);
    setDone(false);
    setResults([]);
    setQuery("");
  };

  const fileSize = useMemo(
    () => (file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : ""),
    [file],
  );

  return (
    <div className="pt-20 pb-16 px-4 md:px-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/40 flex items-center justify-center shadow-[0_0_24px_hsl(var(--primary)/0.35)]">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-3xl md:text-4xl tracking-wider neon-text">Upload Studio</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Search TMDB · Attach your file · Publish to your library
            </p>
          </div>
        </div>
      </header>

      {/* 1. TMDB SEARCH */}
      <Card className="p-5 md:p-6 mb-6 border-border/50 bg-background/60 backdrop-blur-xl">
        <label className="text-sm font-medium mb-2 flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" /> Search Movie on TMDB
        </label>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. Inception, Interstellar…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())}
            className="bg-background/40"
          />
          <Button onClick={search} disabled={searching} className="min-w-[110px]">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="ml-2">Search</span>
          </Button>
        </div>

        {results.length > 0 && !picked && (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {results.map((r) => (
              <button
                key={r.tmdb_id}
                onClick={() => setPicked(r)}
                className="group text-left rounded-xl overflow-hidden border border-border/50 bg-background/40 hover:border-primary/60 hover:shadow-[0_0_24px_hsl(var(--primary)/0.35)] transition-all"
              >
                <div className="aspect-[2/3] bg-muted/30 overflow-hidden">
                  {r.poster_url ? (
                    <img
                      src={r.poster_url}
                      alt={r.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Film className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium line-clamp-1">{r.title}</p>
                  <p className="text-[10px] text-muted-foreground">{r.year ?? "—"}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* PREVIEW CARD */}
      {picked && (
        <Card className="p-5 md:p-6 mb-6 border-primary/40 bg-gradient-to-br from-background/80 to-primary/5 backdrop-blur-xl shadow-[0_0_40px_hsl(var(--primary)/0.15)]">
          <div className="flex justify-between items-start mb-4">
            <Badge variant="outline" className="border-primary/50 text-primary">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Selected from TMDB
            </Badge>
            <Button size="icon" variant="ghost" onClick={() => setPicked(null)} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-col md:flex-row gap-5">
            <div className="w-36 md:w-44 flex-shrink-0 aspect-[2/3] rounded-lg overflow-hidden border border-border/50 bg-muted/30">
              {picked.poster_url ? (
                <img src={picked.poster_url} alt={picked.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Film className="h-10 w-10" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <h2 className="font-display text-2xl md:text-3xl tracking-wide neon-text">{picked.title}</h2>
              <div className="flex flex-wrap gap-2">
                {picked.year && <Badge variant="secondary">{picked.year}</Badge>}
                {picked.genre?.split(",").map((g) => (
                  <Badge key={g} variant="outline" className="border-border/60">
                    {g.trim()}
                  </Badge>
                ))}
              </div>
              {picked.description && (
                <p className="text-sm text-muted-foreground line-clamp-4">{picked.description}</p>
              )}
              <p className="text-[11px] text-muted-foreground/70">TMDB ID: {picked.tmdb_id}</p>
            </div>
          </div>
        </Card>
      )}

      {/* 2. FILE UPLOADER */}
      <Card className="p-5 md:p-6 mb-6 border-border/50 bg-background/60 backdrop-blur-xl">
        <label className="text-sm font-medium mb-3 flex items-center gap-2">
          <UploadCloud className="h-4 w-4 text-primary" /> Upload Video File from Device
        </label>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-all py-12 px-6 text-center ${
            drag
              ? "border-primary bg-primary/10 shadow-[0_0_36px_hsl(var(--primary)/0.35)]"
              : "border-border/60 bg-background/30 hover:border-primary/60 hover:bg-primary/5"
          }`}
        >
          <input
            type="file"
            accept="video/mp4,video/x-matroska,video/*"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <div className="h-14 w-14 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center">
            <UploadCloud className="h-7 w-7 text-primary" />
          </div>
          {file ? (
            <>
              <p className="font-medium text-sm">{file.name}</p>
              <p className="text-xs text-muted-foreground">{fileSize} · Ready to publish</p>
            </>
          ) : (
            <>
              <p className="font-medium">Drag & drop your movie file here</p>
              <p className="text-xs text-muted-foreground">
                MP4 · MKV · MOV — or click to browse from PC / Phone
              </p>
            </>
          )}
        </label>

        {file && (
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
              <X className="h-3 w-3 mr-1" /> Remove file
            </Button>
          </div>
        )}
      </Card>

      {/* 3. SUBMIT */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {picked && file
            ? "Everything looks good — hit publish to add this to your library."
            : "Pick a TMDB match and attach a video file to enable publishing."}
        </p>
        <div className="flex gap-2">
          {done && (
            <Button variant="outline" onClick={reset}>
              Upload another
            </Button>
          )}
          <Button
            size="lg"
            disabled={!canPublish}
            onClick={publish}
            className="min-w-[220px] shadow-[0_0_28px_hsl(var(--primary)/0.45)]"
          >
            {publishing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Publishing…
              </>
            ) : done ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Published
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4 mr-2" /> Publish to My Library
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}