import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Syringe, Loader2, CheckCircle2, XCircle } from "lucide-react";

type InjectBody = {
  tmdb_id: number;
  stream_url?: string;
  telegram_link?: string;
  season_number?: number;
  episode_number?: number;
};

type RowResult = { line: string; ok: boolean; detail: string };

async function inject(body: InjectBody): Promise<{ ok: boolean; detail: string }> {
  const { data, error } = await supabase.functions.invoke("inject-stream", { body });
  if (error) return { ok: false, detail: error.message };
  if (data?.ok) {
    const target = data.target === "episode" ? `S${body.season_number}E${body.episode_number}` : "movie";
    return {
      ok: true,
      detail: `${data.created ? "Created" : "Updated"} ${target} (${data.id?.slice(0, 8)}…) · ${data.sources ?? "?"} source(s)`,
    };
  }
  return { ok: false, detail: data?.error ?? "Unknown error" };
}

export default function StreamInjector() {
  // Single form
  const [tmdbId, setTmdbId] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [tgLink, setTgLink] = useState("");
  const [season, setSeason] = useState("");
  const [episode, setEpisode] = useState("");
  const [busy, setBusy] = useState(false);

  // Bulk
  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [results, setResults] = useState<RowResult[]>([]);

  const submitSingle = async () => {
    const id = Number(tmdbId);
    if (!id || id <= 0) return toast.error("Enter a valid TMDB ID");
    if (!streamUrl.trim() && !tgLink.trim()) return toast.error("Provide an m3u8/stream URL or a Telegram link");

    const body: InjectBody = { tmdb_id: id };
    if (streamUrl.trim()) body.stream_url = streamUrl.trim();
    if (tgLink.trim()) body.telegram_link = tgLink.trim();
    if (season.trim() && episode.trim()) {
      body.season_number = Number(season);
      body.episode_number = Number(episode);
    }

    setBusy(true);
    const res = await inject(body);
    setBusy(false);
    if (res.ok) {
      toast.success(res.detail);
      setStreamUrl("");
      setTgLink("");
    } else {
      toast.error(res.detail);
    }
  };

  const submitBulk = async () => {
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return toast.error("Paste at least one line");
    if (lines.length > 50) return toast.error("Max 50 lines per batch");

    setBulkBusy(true);
    setResults([]);
    const out: RowResult[] = [];
    for (const line of lines) {
      // Format: tmdb_id,url  OR  tmdb_id,season,episode,url
      const parts = line.split(/[,\t]/).map((p) => p.trim());
      let body: InjectBody | null = null;
      if (parts.length === 2 && /^\d+$/.test(parts[0]) && /^https?:\/\//.test(parts[1])) {
        body = { tmdb_id: Number(parts[0]), stream_url: parts[1] };
      } else if (
        parts.length === 4 &&
        /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1]) && /^\d+$/.test(parts[2]) &&
        /^https?:\/\//.test(parts[3])
      ) {
        body = {
          tmdb_id: Number(parts[0]),
          season_number: Number(parts[1]),
          episode_number: Number(parts[2]),
          stream_url: parts[3],
        };
      }
      if (!body) {
        out.push({ line, ok: false, detail: "Invalid format — use tmdb_id,url or tmdb_id,season,episode,url" });
      } else {
        const res = await inject(body);
        out.push({ line, ok: res.ok, detail: res.detail });
      }
      setResults([...out]);
    }
    setBulkBusy(false);
    const okCount = out.filter((r) => r.ok).length;
    toast[okCount === out.length ? "success" : "error"](`${okCount}/${out.length} injected successfully`);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl tracking-wider neon-text flex items-center gap-2">
          <Syringe className="h-6 w-6" /> Stream Injector
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Paste TMDB IDs and m3u8/stream links directly — movies, series, seasons and episodes are
          auto-created from TMDB metadata if missing. Sources are merged without duplicates.
        </p>
      </div>

      {/* Single inject */}
      <div className="rounded-xl border border-border bg-card/60 p-5 space-y-4">
        <h3 className="font-semibold">Single inject</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>TMDB ID *</Label>
            <Input value={tmdbId} onChange={(e) => setTmdbId(e.target.value)} placeholder="e.g. 550 (movie) or 1399 (series)" inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label>Stream URL (m3u8 / mp4)</Label>
            <Input value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} placeholder="https://…/file.m3u8" />
          </div>
          <div className="space-y-1.5">
            <Label>Telegram link (optional)</Label>
            <Input value={tgLink} onChange={(e) => setTgLink(e.target.value)} placeholder="https://t.me/…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Season (for series)</Label>
              <Input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="1" inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <Label>Episode</Label>
              <Input value={episode} onChange={(e) => setEpisode(e.target.value)} placeholder="3" inputMode="numeric" />
            </div>
          </div>
        </div>
        <Button onClick={submitSingle} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Syringe className="h-4 w-4 mr-2" />}
          Inject stream
        </Button>
      </div>

      {/* Bulk inject */}
      <div className="rounded-xl border border-border bg-card/60 p-5 space-y-4">
        <h3 className="font-semibold">Bulk inject</h3>
        <p className="text-xs text-muted-foreground">
          One per line: <code className="text-foreground">tmdb_id,stream_url</code> for movies, or{" "}
          <code className="text-foreground">tmdb_id,season,episode,stream_url</code> for episodes. Max 50 lines.
        </p>
        <Textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          rows={6}
          placeholder={"550,https://cdn.example.com/fight-club.m3u8\n1399,1,3,https://cdn.example.com/got-s01e03.m3u8"}
          className="font-mono text-xs"
        />
        <Button onClick={submitBulk} disabled={bulkBusy} variant="secondary">
          {bulkBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Syringe className="h-4 w-4 mr-2" />}
          Run batch
        </Button>

        {results.length > 0 && (
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {results.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs font-mono rounded-md bg-secondary/40 px-3 py-2">
                {r.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                )}
                <span className="truncate text-muted-foreground">{r.line}</span>
                <Badge variant={r.ok ? "default" : "destructive"} className="ml-auto shrink-0">
                  {r.detail}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
