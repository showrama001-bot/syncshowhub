import { useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Search, Loader2, Send, Tv2, Film, CheckCircle2, Sparkles,
} from "lucide-react";
import {
  searchTmdbSeries,
  fetchTmdbDetails,
  getNextEpisodeForSeries,
  type NextEpisode,
  type TmdbSeriesMeta,
} from "@/lib/contribute";
import { uploadToTelegram, TELEGRAM_MAX_BYTES } from "@/lib/telegramUpload";

export default function Contribute() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const prefillSeries = Number(params.get("series_tmdb_id")) || undefined;
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="pt-20 px-4 md:px-8 max-w-3xl mx-auto pb-16">
      <header className="mb-8">
        <h1 className="font-display text-3xl md:text-5xl tracking-wider neon-text flex items-center gap-3">
          <Sparkles className="h-8 w-8" /> Contribute
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          Help complete the catalogue. Series uploads are sequential — the platform
          automatically asks you for the next missing episode.
        </p>
      </header>
      <Tabs defaultValue="series">
        <TabsList className="grid grid-cols-2 mb-6">
          <TabsTrigger value="series" className="gap-2"><Tv2 className="h-4 w-4" /> Series episode</TabsTrigger>
          <TabsTrigger value="movie" className="gap-2"><Film className="h-4 w-4" /> Movie</TabsTrigger>
        </TabsList>
        <TabsContent value="series">
          <SeriesContributeForm userId={user.id} prefillTmdbId={prefillSeries} />
        </TabsContent>
        <TabsContent value="movie">
          <div className="glass rounded-2xl p-6 border border-border/40 text-sm text-muted-foreground">
            For full-movie uploads, use the <a href="/upload-share" className="text-primary hover:underline">Upload &amp; Share</a> page —
            same Telegram pipeline, TMDB-locked metadata.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SeriesContributeForm({ userId, prefillTmdbId }: { userId: string; prefillTmdbId?: number }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbSeriesMeta[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<TmdbSeriesMeta | null>(null);
  const [nextEp, setNextEp] = useState<NextEpisode | null>(null);
  const [loadingNext, setLoadingNext] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Optional prefill from the no-results fallback modal.
  useEffect(() => {
    if (!prefillTmdbId) return;
    (async () => {
      const meta = await fetchTmdbDetails(prefillTmdbId, "series");
      if (meta) pickSeries(meta);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillTmdbId]);

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      setResults(await searchTmdbSeries(query));
    } finally {
      setSearching(false);
    }
  };

  const pickSeries = async (meta: TmdbSeriesMeta) => {
    setPicked(meta);
    setResults([]);
    setNextEp(null);
    setLoadingNext(true);
    try {
      const next = await getNextEpisodeForSeries(meta.tmdb_id);
      setNextEp(next);
      if (!next) toast.error("Couldn't load the series structure from TMDB.");
    } finally {
      setLoadingNext(false);
    }
  };

  const reset = () => {
    setPicked(null); setNextEp(null); setFile(null); setProgress(0); setQuery("");
  };

  const submit = async () => {
    if (!picked || !nextEp) return;
    if (nextEp.complete) {
      toast.info("This series is already fully contributed.");
      return;
    }
    if (!file) return toast.error("Choose a video file");
    if (file.size > TELEGRAM_MAX_BYTES) {
      return toast.error(
        `File is ${(file.size / 1024 / 1024).toFixed(1)} MB. Current free Telegram limit is 50 MB.`,
      );
    }
    setUploading(true);
    setProgress(0);
    try {
      const caption = `${picked.title} S${nextEp.season_number}E${nextEp.episode_number} — ${nextEp.episode_title}`;
      const tg = await uploadToTelegram(file, caption, setProgress);
      setProgress(98);
      const { error: insErr } = await (supabase.from("community_uploads" as any) as any).insert({
        uploader_id: userId,
        kind: "episode",
        title: picked.title,
        description: picked.description ?? null,
        poster_url: picked.poster_url ?? null,
        backdrop_url: picked.backdrop_url ?? null,
        year: picked.year ?? null,
        genre: picked.genre ?? null,
        series_tmdb_id: picked.tmdb_id,
        tmdb_id: picked.tmdb_id,
        season_number: nextEp.season_number,
        episode_number: nextEp.episode_number,
        episode_title: nextEp.episode_title,
        stream_url: tg.stream_url,
        telegram_file_id: tg.file_id,
        source_type: "mp4",
        status: "pending",
      });
      if (insErr) {
        if ((insErr as any).code === "23505") {
          throw new Error("Someone just submitted this episode. Refresh to fetch the next one.");
        }
        throw insErr;
      }
      setProgress(100);
      toast.success(`S${nextEp.season_number}E${nextEp.episode_number} submitted! Loading the next missing episode…`);
      // Auto-advance: re-fetch next missing episode for the same series.
      setFile(null);
      const fresh = await getNextEpisodeForSeries(picked.tmdb_id);
      setNextEp(fresh);
      setProgress(0);
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const epLabel = useMemo(() => {
    if (!nextEp) return null;
    return `S${nextEp.season_number} · E${nextEp.episode_number} — ${nextEp.episode_title}`;
  }, [nextEp]);

  return (
    <section className="glass rounded-2xl p-6 space-y-6 border border-border/40">
      {!picked && (
        <>
          <div className="space-y-2">
            <Label>1. Find the series on TMDB</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Breaking Bad"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), runSearch())}
                disabled={searching}
              />
              <Button onClick={runSearch} disabled={searching} type="button">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-2">Search</span>
              </Button>
            </div>
          </div>
          {results.length > 0 && (
            <ul className="space-y-2 max-h-96 overflow-auto">
              {results.map((r) => (
                <li key={r.tmdb_id}>
                  <button
                    type="button"
                    onClick={() => pickSeries(r)}
                    className="w-full flex gap-3 p-3 rounded-xl border border-border/40 hover:border-primary/60 hover:bg-primary/5 transition text-left"
                  >
                    {r.poster_url && (
                      <img src={r.poster_url} alt="" loading="lazy" draggable={false} className="w-12 h-16 object-cover rounded select-none pointer-events-none" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.title}</div>
                      <div className="text-xs text-muted-foreground">{r.year ?? "—"}</div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{r.description}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {picked && (
        <div className="space-y-6">
          <div className="flex gap-4 items-start">
            {picked.poster_url && (
              <img src={picked.poster_url} alt={picked.title} loading="lazy" draggable={false}
                className="w-24 rounded-md select-none pointer-events-none" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-display text-xl">{picked.title}</div>
              <div className="text-xs text-muted-foreground">{picked.year ?? "—"}</div>
              <p className="text-sm text-muted-foreground line-clamp-3 mt-1">{picked.description}</p>
              <button type="button" onClick={reset}
                className="text-xs text-primary hover:underline mt-2">Pick a different series</button>
            </div>
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            {loadingNext ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Detecting the next missing episode…
              </div>
            ) : !nextEp ? (
              <div className="text-sm text-muted-foreground">Couldn't load the series structure.</div>
            ) : nextEp.complete ? (
              <div className="flex items-center gap-2 text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                This series is fully contributed — nothing missing right now.
              </div>
            ) : (
              <>
                <div className="text-xs uppercase tracking-widest text-primary/80 mb-1">
                  Next missing episode
                </div>
                <div className="font-display text-lg">{epLabel}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Season {nextEp.season_number} of {nextEp.total_seasons} · {nextEp.total_in_season} episodes total
                </div>
              </>
            )}
          </div>

          {nextEp && !nextEp.complete && (
            <>
              <div className="space-y-2">
                <Label>2. Attach the episode video file</Label>
                <Input type="file" accept="video/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={uploading} />
                {file && (
                  <p className="text-xs text-muted-foreground">
                    {file.name} — {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Free tier limit: 50 MB per file (Telegram Bot API cap).
                </p>
              </div>

              {uploading && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-xs text-muted-foreground">
                    {progress < 95 ? `Uploading to Telegram… ${progress}%` : progress < 100 ? "Saving…" : "Done"}
                  </p>
                </div>
              )}

              <Button className="w-full" onClick={submit} disabled={uploading || !file}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Submit S{nextEp.season_number}E{nextEp.episode_number}
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

// Re-export for the fallback modal so it can drop the user directly into the series flow.
export { SeriesContributeForm };