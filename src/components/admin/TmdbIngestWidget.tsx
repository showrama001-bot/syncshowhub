import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Download, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

type Kind = "movie" | "series";
type Result = {
  tmdb_id: number;
  title: string;
  overview?: string | null;
  poster_url?: string | null;
  year?: string | null;
};

// No automatic embed/iframe generation: stream links are entered manually
// (direct video URLs) after import.
export default function TmdbIngestWidget() {
  const [kind, setKind] = useState<Kind>("movie");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const reqId = useRef(0);

  async function runSearch(term: string, k: Kind) {
    const id = ++reqId.current;
    if (!term.trim()) { setResults([]); return; }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("tmdb-scraper", {
      body: { action: "search", kind: k, query: term.trim() },
    });
    if (id !== reqId.current) return;
    setLoading(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || "TMDB search failed");
      return;
    }
    setResults(((data as any)?.results ?? []) as Result[]);
  }

  // Debounced live search as the admin types.
  useEffect(() => {
    const t = setTimeout(() => runSearch(q, kind), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, kind]);

  async function importItem(r: Result) {
    setBusy(r.tmdb_id);
    try {
      const { data: details, error: dErr } = await supabase.functions.invoke("tmdb-scraper", {
        body: { action: "details", kind, tmdb_id: r.tmdb_id },
      });
      if (dErr || !details || (details as any).error) throw new Error("Could not fetch metadata");
      const d = details as any;
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id ?? null;

      if (kind === "movie") {
        const { data: existing } = await (supabase.from("movies") as any)
          .select("id").eq("tmdb_id", r.tmdb_id).maybeSingle();
        const payload: Record<string, any> = {
          title: d.title,
          description: d.description,
          poster_url: d.poster_url,
          backdrop_url: d.backdrop_url,
          year: d.year,
          genre: d.genre,
          category: d.category,
          duration_minutes: d.duration_minutes,
          imdb_rating: d.imdb_rating,
          rating: d.rating,
          tmdb_id: r.tmdb_id,
          status: "published",
          is_admin_upload: true,
          created_by: uid,
        };
        if (existing?.id) {
          // Metadata-only update — never overwrite a manually entered stream link.
          const { error } = await (supabase.from("movies") as any).update(payload).eq("id", existing.id);
          if (error) throw error;
          toast.success(`Updated "${d.title}" in the catalog`);
        } else {
          const { error } = await (supabase.from("movies") as any)
            .insert([{ ...payload, source_type: "direct" }]);
          if (error) throw error;
          toast.success(`Imported "${d.title}" — add a direct stream link to publish playback`);
        }
      } else {
        // Series: upsert series row, then every season + episode with its embed.
        let seriesId: string | undefined;
        const { data: existing } = await (supabase.from("series") as any)
          .select("id").eq("tmdb_id", r.tmdb_id).maybeSingle();
        const sPayload = {
          title: d.title,
          description: d.description,
          poster_url: d.poster_url,
          backdrop_url: d.backdrop_url,
          year: d.year,
          genre: d.genre,
          category: d.category,
          imdb_rating: d.imdb_rating,
          tmdb_id: r.tmdb_id,
          created_by: uid,
        };
        if (existing?.id) {
          seriesId = existing.id;
          const { error } = await (supabase.from("series") as any).update(sPayload).eq("id", seriesId);
          if (error) throw error;
        } else {
          const { data: ins, error } = await (supabase.from("series") as any)
            .insert(sPayload).select("id").single();
          if (error) throw error;
          seriesId = ins.id;
        }

        const { data: struct } = await supabase.functions.invoke("tmdb-scraper", {
          body: { action: "series_structure", kind: "series", tmdb_id: r.tmdb_id },
        });
        let seasons = ((struct as any)?.seasons ?? []) as any[];
        // Guarantee at least S1E1 so the series is never left without a playable source.
        if (!seasons.length) {
          seasons = [{ season_number: 1, title: "Season 1", episodes: [{ episode_number: 1, title: "Episode 1" }] }];
        }
        let epCount = 0;
        for (const s of seasons) {
          const { data: exSeason } = await (supabase.from("seasons") as any)
            .select("id").eq("series_id", seriesId).eq("season_number", s.season_number).maybeSingle();
          let seasonId = exSeason?.id;
          if (!seasonId) {
            const { data: insS, error } = await (supabase.from("seasons") as any)
              .insert({ series_id: seriesId, season_number: s.season_number, title: s.title })
              .select("id").single();
            if (error) throw error;
            seasonId = insS.id;
          }
          const { data: exEps } = await (supabase.from("episodes") as any)
            .select("id, episode_number").eq("season_id", seasonId);
          const have = new Map<number, string>((exEps ?? []).map((e: any) => [e.episode_number, e.id]));
          const episodes = (s.episodes ?? []).length
            ? s.episodes
            : [{ episode_number: 1, title: "Episode 1" }];
          for (const ep of episodes) {
            const row = {
              season_id: seasonId,
              episode_number: ep.episode_number,
              title: ep.title,
            };
            const existingEp = have.get(ep.episode_number);
            if (existingEp) {
              const { error } = await (supabase.from("episodes") as any).update(row).eq("id", existingEp);
              if (error) throw error;
            } else {
              const { error } = await (supabase.from("episodes") as any).insert(row);
              if (error) throw error;
            }
            epCount++;
          }
        }
        toast.success(`Imported "${d.title}" — ${seasons.length} seasons, ${epCount} episodes`);
      }
      setDone((p) => ({ ...p, [`${kind}:${r.tmdb_id}`]: true }));
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="glass rounded-2xl p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl tracking-wide">TMDB Search &amp; Ingestion</h2>
          <p className="text-xs text-muted-foreground">
            Search TMDB, then import full metadata with a clean VidSrc embed source.
          </p>
        </div>
        <Tabs value={kind} onValueChange={(v) => { setKind(v as Kind); setResults([]); }}>
          <TabsList className="bg-secondary/40">
            <TabsTrigger value="movie">Movies</TabsTrigger>
            <TabsTrigger value="series">TV Series</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") runSearch(q, kind); }}
          placeholder={kind === "movie" ? "Search a movie, e.g. Inception…" : "Search a series, e.g. Breaking Bad…"}
          className="pl-9 bg-secondary/40"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {results.length === 0 && !loading && q.trim() !== "" && (
        <p className="text-sm text-muted-foreground">No TMDB results for “{q}”.</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {results.map((r) => {
          const imported = done[`${kind}:${r.tmdb_id}`];
          return (
            <div key={r.tmdb_id} className="rounded-xl overflow-hidden border border-border/40 bg-secondary/20 flex flex-col">
              <div className="aspect-[2/3] bg-black/40">
                {r.poster_url && (
                  <img src={r.poster_url} alt={`${r.title} poster`} loading="lazy" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="p-2 space-y-2 flex-1 flex flex-col">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.title}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <span>{r.year ?? "—"}</span>
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">TMDB {r.tmdb_id}</Badge>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={imported ? "secondary" : "default"}
                  className="w-full mt-auto"
                  disabled={busy === r.tmdb_id}
                  onClick={() => importItem(r)}
                >
                  {busy === r.tmdb_id ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Importing…</>
                  ) : imported ? (
                    <><Check className="h-3.5 w-3.5 mr-1" /> Imported</>
                  ) : (
                    <><Download className="h-3.5 w-3.5 mr-1" /> Import / Add to Site</>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
