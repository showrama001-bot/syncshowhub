import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Search, Loader2, Film, Tv, Sparkles, Link as LinkIcon } from "lucide-react";
import MissingStreamsPanel from "./MissingStreamsPanel";

/* ────────────────────────────────────────────────────────────────────
   Super Scraper Dashboard — Isolated from existing upload system.
   Uses NEW edge function `tmdb-scraper`; writes only to existing
   movies/series/seasons/episodes tables via standard inserts.
   ──────────────────────────────────────────────────────────────────── */

type SearchResult = {
  tmdb_id: number;
  title: string;
  original_title?: string;
  overview: string;
  poster_url: string | null;
  year: string | null;
};

type Details = {
  tmdb_id: number;
  title: string;
  description: string;
  poster_url: string | null;
  backdrop_url: string | null;
  year: number | null;
  genre: string | null;
  category: string | null;
  duration_minutes: number | null;
  imdb_rating: number | null;
  rating: number | null;
  number_of_seasons?: number | null;
};

type StreamMode = "embed" | "hls";

const EMBED_PROVIDERS = [
  { id: "vidsrc.xyz", label: "VidSrc (vidsrc.xyz)" },
  { id: "vidsrc.to", label: "VidSrc.to" },
  { id: "embed.su", label: "Embed.su" },
  { id: "autoembed.cc", label: "AutoEmbed.cc" },
  { id: "multiembed.mov", label: "MultiEmbed.mov" },
] as const;

type ProviderId = (typeof EMBED_PROVIDERS)[number]["id"];
const ALL_PROVIDER_IDS: ProviderId[] = EMBED_PROVIDERS.map((p) => p.id);

function buildEmbedUrl(
  provider: ProviderId,
  kind: "movie" | "tv",
  tmdbId: number,
  season?: number,
  episode?: number,
): string {
  const isTv = kind === "tv";
  switch (provider) {
    case "vidsrc.xyz":
      return isTv
        ? `https://vidsrc.xyz/embed/tv/${tmdbId}/${season}/${episode}`
        : `https://vidsrc.xyz/embed/movie/${tmdbId}`;
    case "vidsrc.to":
      return isTv
        ? `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`
        : `https://vidsrc.to/embed/movie/${tmdbId}`;
    case "embed.su":
      return isTv
        ? `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}`
        : `https://embed.su/embed/movie/${tmdbId}`;
    case "autoembed.cc":
      return isTv
        ? `https://player.autoembed.cc/embed/tv/${tmdbId}/${season}/${episode}`
        : `https://player.autoembed.cc/embed/movie/${tmdbId}`;
    case "multiembed.mov":
      return isTv
        ? `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}`
        : `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`;
  }
}

async function callScraper(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("tmdb-scraper", { body: payload });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

async function checkAllProviders(kind: "movie" | "tv", tmdbId: number) {
  const urls = ALL_PROVIDER_IDS.map((p) => ({
    provider: p,
    url: buildEmbedUrl(p, kind, tmdbId),
  }));
  return (await callScraper({ action: "check_providers", urls })) as {
    checks: { provider: ProviderId; url: string; state: "ok" | "missing" | "unknown"; reason: string }[];
    verdict:
      | { available: true; provider: ProviderId; url: string; confidence: "high" | "low" }
      | { available: false };
  };
}

async function resolveDirectStreams(
  kind: "movie" | "tv",
  tmdbId: number,
  season?: number,
  episode?: number,
) {
  const data = (await callScraper({
    action: "resolve_direct",
    kind,
    tmdb_id: tmdbId,
    season,
    episode,
  })) as { sources: { provider: string; url: string; kind: "hls" | "mp4" }[]; count: number };
  return data.sources ?? [];
}

type StreamSource = { provider: string; url: string };

/** Merge two source lists dropping duplicate URLs (case-insensitive on url). */
function dedupeSources(...lists: StreamSource[][]): StreamSource[] {
  const seen = new Set<string>();
  const out: StreamSource[] = [];
  for (const list of lists) {
    for (const s of list) {
      if (!s?.url) continue;
      const key = s.url.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ provider: s.provider, url: s.url.trim() });
    }
  }
  return out;
}

/* ───────── Shared title-search panel ───────── */
function TitleSearch({
  kind,
  onPick,
}: {
  kind: "movie" | "tv";
  onPick: (r: SearchResult) => void;
}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  const run = async () => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const data = await callScraper({ action: "search", kind, query: q.trim() });
      setResults((data as any).results ?? []);
    } catch (e: any) {
      toast.error(e.message ?? "Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder={`Search ${kind === "tv" ? "series" : "movies"} by title (English)`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
        />
        <Button onClick={run} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <Search />} Search
        </Button>
      </div>
      {results.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[480px] overflow-y-auto pr-1">
          {results.map((r) => (
            <button
              key={r.tmdb_id}
              onClick={() => onPick(r)}
              className="text-left rounded-lg border bg-card hover:border-primary transition overflow-hidden"
            >
              {r.poster_url ? (
                <img src={r.poster_url} alt={r.title} className="w-full aspect-[2/3] object-cover" />
              ) : (
                <div className="w-full aspect-[2/3] bg-muted" />
              )}
              <div className="p-2">
                <div className="text-sm font-medium line-clamp-2">{r.title}</div>
                <div className="text-xs text-muted-foreground">{r.year ?? "—"}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────── Stream mode picker ───────── */
function StreamModePicker({
  mode,
  setMode,
  provider,
  setProvider,
  hlsUrl,
  setHlsUrl,
}: {
  mode: StreamMode;
  setMode: (m: StreamMode) => void;
  provider: ProviderId;
  setProvider: (p: ProviderId) => void;
  hlsUrl: string;
  setHlsUrl: (s: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border p-4 bg-card/50">
      <Label className="text-sm font-semibold">Stream Mode</Label>
      <RadioGroup value={mode} onValueChange={(v) => setMode(v as StreamMode)} className="flex flex-col sm:flex-row gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <RadioGroupItem value="embed" id="m-embed" />
          <span>Auto-Resolve Direct Stream (JSON aggregators → .m3u8)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <RadioGroupItem value="hls" id="m-hls" />
          <span>Clean HLS / M3U8 (custom player, no ads)</span>
        </label>
      </RadioGroup>

      {mode === "embed" ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            The scraper calls a list of JSON aggregator APIs (configured via the
            <code className="mx-1">SCRAPER_AGGREGATOR_URLS</code> secret) that return raw
            <code className="mx-1">.m3u8</code>/<code className="mx-1">.mp4</code> URLs for a TMDB id.
            Iframes are never used. If no aggregator returns a stream, the item is
            routed to Missing Streams with a "No streamable source found" notice.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-xs">Direct .m3u8 / .mp4 URL (resolver fallback / manual paste)</Label>
          <Input
            placeholder="https://.../master.m3u8"
            value={hlsUrl}
            onChange={(e) => setHlsUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Paste a clean direct link from public IPTV-org / GitHub stream aggregators.
            This URL is used for ALL episodes when applied to a series in HLS mode.
          </p>
        </div>
      )}
    </div>
  );
}

/* ───────────────────── Movies Scraper ───────────────────── */
function MoviesScraper() {
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [details, setDetails] = useState<Details | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [mode, setMode] = useState<StreamMode>("embed");
  const [provider, setProvider] = useState<ProviderId>("vidsrc.xyz");
  const [hlsUrl, setHlsUrl] = useState("");

  const pick = async (r: SearchResult) => {
    setPicked(r);
    setDetails(null);
    setLoading(true);
    try {
      const d = await callScraper({ action: "details", kind: "movie", tmdb_id: r.tmdb_id });
      setDetails(d as Details);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load details");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!details) return;
    setSaving(true);
    try {
      let status: "published" | "missing_stream" = "published";
      let stream_url: string | null = null;
      let chosenProvider: string | null = null;
      let sourceType: "iframe" | "hls" = mode === "embed" ? "iframe" : "hls";
      let newSources: StreamSource[] = [];

      if (mode === "hls") {
        stream_url = hlsUrl.trim();
        if (!stream_url) {
          toast.error("Please provide a direct HLS/MP4 URL");
          setSaving(false);
          return;
        }
        newSources = [{ provider: "hls", url: stream_url }];
      } else {
        // ── Direct-only auto resolver (no iframe fallback) ──
        toast.info("Resolving direct .m3u8 / .mp4 stream…");
        const direct = await resolveDirectStreams("movie", details.tmdb_id);
        if (direct.length > 0) {
          newSources = direct.map((d) => ({ provider: d.provider, url: d.url }));
          sourceType = "hls";
          chosenProvider = direct[0].provider;
          stream_url = direct[0].url;
          toast.success(`Found ${direct.length} direct stream(s) — native player`);
        } else {
          // Zero iframes policy: route to Missing Streams instead.
          status = "missing_stream";
          sourceType = "hls";
          stream_url = null;
          newSources = [];
          toast.warning("No streamable source found — routed to Missing Streams.");
        }
      }

      // Duplicate-prevention: merge into existing movie with same tmdb_id.
      const { data: existing } = await supabase
        .from("movies")
        .select("id, stream_sources, stream_url, provider")
        .eq("tmdb_id", details.tmdb_id)
        .maybeSingle();

      if (existing) {
        const merged = dedupeSources(
          (existing.stream_sources as StreamSource[]) ?? [],
          newSources,
        );
        const { error } = await supabase
          .from("movies")
          .update({
            stream_sources: merged as any,
            stream_url: existing.stream_url ?? stream_url,
            provider: existing.provider ?? chosenProvider,
            source_type: sourceType,
            status: merged.length ? "published" : "missing_stream",
          } as any)
          .eq("id", existing.id);
        if (error) throw error;
        toast.success(`Merged into existing "${details.title}" — ${merged.length} unique server(s)`);
      } else {
        const { error } = await supabase.from("movies").insert({
          title: details.title,
          description: details.description,
          poster_url: details.poster_url,
          backdrop_url: details.backdrop_url,
          year: details.year,
          genre: details.genre,
          category: details.category,
          duration_minutes: details.duration_minutes,
          imdb_rating: details.imdb_rating,
          rating: details.rating,
          tmdb_id: details.tmdb_id,
          stream_url,
          stream_sources: newSources as any,
          source_type: sourceType,
          status,
          provider: chosenProvider,
          is_admin_upload: true,
        } as any);
        if (error) throw error;
      }
      setPicked(null);
      setDetails(null);
      setHlsUrl("");
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <TitleSearch kind="movie" onPick={pick} />
      {picked && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Film className="h-5 w-5" /> {picked.title}{" "}
              <Badge variant="outline">{picked.year ?? "—"}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading || !details ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading TMDB metadata…
              </div>
            ) : (
              <>
                <div className="grid md:grid-cols-[160px_1fr] gap-4">
                  {details.poster_url && (
                    <img src={details.poster_url} alt={details.title} className="rounded-md w-40" />
                  )}
                  <div className="space-y-1 text-sm">
                    <div><span className="text-muted-foreground">Genre:</span> {details.genre ?? "—"}</div>
                    <div><span className="text-muted-foreground">Runtime:</span> {details.duration_minutes ?? "—"} min</div>
                    <div><span className="text-muted-foreground">TMDB:</span> {details.tmdb_id}</div>
                    <p className="text-muted-foreground line-clamp-5 pt-2">{details.description}</p>
                  </div>
                </div>
                <StreamModePicker
                  mode={mode} setMode={setMode}
                  provider={provider} setProvider={setProvider}
                  hlsUrl={hlsUrl} setHlsUrl={setHlsUrl}
                />
                <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
                  {saving ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  Inject Movie
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ───────────────────── TV Series Scraper ───────────────────── */
type SeasonStruct = {
  season_number: number;
  title: string;
  episodes: { episode_number: number; title: string; overview: string | null }[];
};

function SeriesScraper() {
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [details, setDetails] = useState<Details | null>(null);
  const [structure, setStructure] = useState<SeasonStruct[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [mode, setMode] = useState<StreamMode>("embed");
  const [provider, setProvider] = useState<ProviderId>("vidsrc.xyz");
  const [hlsUrl, setHlsUrl] = useState("");

  const pick = async (r: SearchResult) => {
    setPicked(r);
    setDetails(null);
    setStructure([]);
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        callScraper({ action: "details", kind: "tv", tmdb_id: r.tmdb_id }),
        callScraper({ action: "series_structure", kind: "tv", tmdb_id: r.tmdb_id }),
      ]);
      setDetails(d as Details);
      setStructure((s as any).seasons ?? []);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load series");
    } finally {
      setLoading(false);
    }
  };

  const totalEpisodes = structure.reduce((n, s) => n + s.episodes.length, 0);

  const save = async () => {
    if (!details || structure.length === 0) return;
    if (mode === "hls" && !hlsUrl.trim()) {
      toast.error("Provide a direct HLS/MP4 URL for episodes");
      return;
    }
    setSaving(true);
    try {
      // Direct-only auto resolver per episode. No iframe fallback.
      if (mode === "embed") {
        toast.info("Auto-resolving direct streams per episode…");
      }
      let missingCount = 0;
      let resolvedCount = 0;

      // Upsert-style: reuse existing series with same tmdb_id if any.
      const { data: existingSeries } = await supabase
        .from("series")
        .select("id")
        .eq("tmdb_id", details.tmdb_id)
        .maybeSingle();

      let seriesId: string;
      if (existingSeries) {
        seriesId = existingSeries.id as string;
      } else {
        const { data: seriesRow, error: sErr } = await supabase
          .from("series")
          .insert({
            title: details.title,
            description: details.description,
            poster_url: details.poster_url,
            backdrop_url: details.backdrop_url,
            year: details.year,
            genre: details.genre,
            category: details.category,
            imdb_rating: details.imdb_rating,
            tmdb_id: details.tmdb_id,
          })
          .select("id")
          .single();
        if (sErr) throw sErr;
        seriesId = seriesRow.id as string;
      }

      for (const season of structure) {
        // Upsert season by (series_id, season_number).
        const { data: seasonRow, error: seErr } = await supabase
          .from("seasons")
          .upsert(
            {
              series_id: seriesId,
              season_number: season.season_number,
              title: season.title,
            },
            { onConflict: "series_id,season_number" },
          )
          .select("id")
          .single();
        if (seErr) throw seErr;
        const seasonId = seasonRow.id as string;

        // Existing episodes so we can merge stream_sources without duplicates.
        const { data: existingEps } = await supabase
          .from("episodes")
          .select("id, episode_number, stream_sources, stream_url")
          .eq("season_id", seasonId);
        const existingMap = new Map<number, any>(
          (existingEps ?? []).map((e: any) => [e.episode_number, e]),
        );

        for (const e of season.episodes) {
          let generated: StreamSource[];
          if (mode === "hls") {
            generated = [{ provider: "hls", url: hlsUrl.trim() }];
          } else {
            const direct = await resolveDirectStreams(
              "tv",
              details.tmdb_id,
              season.season_number,
              e.episode_number,
            ).catch(() => []);
            if (direct.length > 0) {
              generated = direct.map((d) => ({ provider: d.provider, url: d.url }));
              resolvedCount++;
            } else {
              // Zero-iframe policy: leave this episode without sources.
              generated = [];
              missingCount++;
            }
          }

          const existingEp = existingMap.get(e.episode_number);
          const merged = dedupeSources(
            (existingEp?.stream_sources as StreamSource[]) ?? [],
            generated,
          );
          const primary = existingEp?.stream_url || merged[0]?.url || null;

          if (existingEp) {
            const { error: upErr } = await supabase
              .from("episodes")
              .update({
                title: e.title,
                stream_url: primary,
                stream_sources: merged as any,
              } as any)
              .eq("id", existingEp.id);
            if (upErr) throw upErr;
          } else {
            const { error: insErr } = await supabase.from("episodes").insert({
              season_id: seasonId,
              episode_number: e.episode_number,
              title: e.title,
              stream_url: primary,
              stream_sources: merged as any,
            } as any);
            if (insErr) throw insErr;
          }
        }
      }
      if (mode === "embed") {
        toast.success(
          `Injected "${details.title}" — ${resolvedCount} episode(s) with direct streams` +
            (missingCount > 0 ? `, ${missingCount} with no streamable source` : ""),
        );
      } else {
        toast.success(`Injected "${details.title}" — ${structure.length} seasons / ${totalEpisodes} episodes`);
      }
      setPicked(null);
      setDetails(null);
      setStructure([]);
      setHlsUrl("");
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <TitleSearch kind="tv" onPick={pick} />
      {picked && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Tv className="h-5 w-5" /> {picked.title}{" "}
              <Badge variant="outline">{picked.year ?? "—"}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading || !details ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading TMDB structure…
              </div>
            ) : (
              <>
                <div className="grid md:grid-cols-[160px_1fr] gap-4">
                  {details.poster_url && (
                    <img src={details.poster_url} alt={details.title} className="rounded-md w-40" />
                  )}
                  <div className="space-y-1 text-sm">
                    <div><span className="text-muted-foreground">Genre:</span> {details.genre ?? "—"}</div>
                    <div><span className="text-muted-foreground">Seasons:</span> {structure.length}</div>
                    <div><span className="text-muted-foreground">Episodes:</span> {totalEpisodes}</div>
                    <div><span className="text-muted-foreground">TMDB:</span> {details.tmdb_id}</div>
                    <p className="text-muted-foreground line-clamp-5 pt-2">{details.description}</p>
                  </div>
                </div>

                <StreamModePicker
                  mode={mode} setMode={setMode}
                  provider={provider} setProvider={setProvider}
                  hlsUrl={hlsUrl} setHlsUrl={setHlsUrl}
                />

                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 border rounded-md p-3">
                  {structure.map((s) => (
                    <div key={s.season_number} className="text-sm">
                      <div className="font-medium flex items-center gap-2">
                        <LinkIcon className="h-3 w-3" /> {s.title}
                        <Badge variant="secondary">{s.episodes.length} ep</Badge>
                      </div>
                    </div>
                  ))}
                </div>

                <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
                  {saving ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  Inject Series + All Episodes
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ───────────────────── Root ───────────────────── */
export default function SuperScraperDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> Super Scraper Dashboard
        </h2>
        <p className="text-sm text-muted-foreground">
          Isolated TMDB-powered title scraper with dual-route streaming (External Embed or Clean HLS).
          Existing manual upload tools are not affected.
        </p>
      </div>
      <Tabs defaultValue="movies">
        <TabsList>
          <TabsTrigger value="movies"><Film className="h-4 w-4 mr-1" /> Movies Scraper</TabsTrigger>
          <TabsTrigger value="series"><Tv className="h-4 w-4 mr-1" /> TV Series Scraper</TabsTrigger>
          <TabsTrigger value="missing">Missing Streams & Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="movies" className="mt-4"><MoviesScraper /></TabsContent>
        <TabsContent value="series" className="mt-4"><SeriesScraper /></TabsContent>
        <TabsContent value="missing" className="mt-4"><MissingStreamsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}