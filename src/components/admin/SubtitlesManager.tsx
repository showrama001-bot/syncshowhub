import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Upload, Languages, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  SUBTITLE_LANGUAGES, SubtitleTrack, resolveSubtitleBlobUrl,
} from "@/lib/subtitles";

type Props = {
  /** DB row primary key */
  contentId: string;
  /** "movies" or "episodes" */
  table: "movies" | "episodes";
};

/**
 * Admin-only subtitle manager. Uploads .vtt / .srt files to the private
 * `subtitles` storage bucket and stores the { lang, label, path } entries
 * on the row's `subtitles` JSONB column.
 */
export function SubtitlesManager({ contentId, table }: Props) {
  const [tracks, setTracks] = useState<SubtitleTrack[]>([]);
  const [lang, setLang] = useState<string>("en");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from(table as any) as any)
      .select("subtitles").eq("id", contentId).maybeSingle();
    setTracks(Array.isArray(data?.subtitles) ? (data!.subtitles as SubtitleTrack[]) : []);
    setLoading(false);
  };
  useEffect(() => { if (contentId) load(); /* eslint-disable-next-line */ }, [contentId, table]);

  const persist = async (next: SubtitleTrack[]) => {
    const { error } = await (supabase.from(table as any) as any)
      .update({ subtitles: next }).eq("id", contentId);
    if (error) { toast.error(error.message); return false; }
    setTracks(next);
    return true;
  };

  const upload = async () => {
    if (!file) return toast.error("Choose a .vtt or .srt file");
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "vtt" && ext !== "srt") return toast.error("Only .vtt or .srt files are supported");
    setBusy(true);
    try {
      const path = `${table}/${contentId}/${lang}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("subtitles").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: ext === "vtt" ? "text/vtt" : "application/x-subrip",
      });
      if (upErr) throw upErr;
      const label = SUBTITLE_LANGUAGES.find((l) => l.code === lang)?.label.split(" (")[0] || lang.toUpperCase();
      const next: SubtitleTrack[] = [...tracks.filter((t) => t.lang !== lang), { lang, label, path }];
      const ok = await persist(next);
      if (ok) {
        toast.success(`Uploaded ${label} subtitles`);
        setFile(null);
      }
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: SubtitleTrack) => {
    if (!confirm(`Remove ${t.label} subtitles?`)) return;
    setBusy(true);
    await supabase.storage.from("subtitles").remove([t.path]).catch(() => {});
    const next = tracks.filter((x) => x.path !== t.path);
    await persist(next);
    setBusy(false);
  };

  const preview = async (t: SubtitleTrack) => {
    const url = await resolveSubtitleBlobUrl(t.path);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Could not open subtitle");
  };

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Languages className="h-4 w-4 text-primary" /> Manage Subtitles / Tracks
      </div>
      <p className="text-xs text-muted-foreground">
        Attach multiple subtitle tracks in different languages. Accepts <code>.vtt</code> and <code>.srt</code>.
      </p>

      {loading ? (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading tracks…
        </div>
      ) : tracks.length === 0 ? (
        <div className="text-xs text-muted-foreground">No subtitle tracks yet.</div>
      ) : (
        <ul className="divide-y divide-border/30 rounded-xl border border-border/40 overflow-hidden">
          {tracks.map((t) => (
            <li key={t.path} className="flex items-center gap-3 p-2.5 text-sm">
              <span className="inline-flex items-center justify-center min-w-[2.25rem] h-6 px-2 rounded bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider">
                {t.lang}
              </span>
              <div className="flex-1 min-w-0">
                <div className="truncate">{t.label}</div>
                <div className="text-[10px] text-muted-foreground truncate">{t.path}</div>
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={() => preview(t)} title="Preview">
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" onClick={() => remove(t)} disabled={busy} title="Delete">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid sm:grid-cols-[160px_1fr_auto] gap-2 items-center">
        <Select value={lang} onValueChange={setLang}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {SUBTITLE_LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="file"
          accept=".vtt,.srt,text/vtt,application/x-subrip"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={busy}
        />
        <Button type="button" onClick={upload} disabled={busy || !file} className="bg-gradient-red shadow-neon">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
          {busy ? "" : "Upload"}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Uploading a file for a language that already exists will replace the previous track.
      </p>
    </div>
  );
}