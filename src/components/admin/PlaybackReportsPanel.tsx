import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, RefreshCw, Trash2, X, Loader2 } from "lucide-react";

type Row = {
  id: string;
  reporter_id: string;
  content_kind: "movie" | "episode" | "tv" | "match";
  content_id: string;
  content_title: string | null;
  issue: "not_loading" | "broken_link" | "wrong_subtitles" | "audio_sync" | "other";
  note: string | null;
  status: "open" | "fixed" | "dismissed";
  created_at: string;
  resolved_at: string | null;
};

const ISSUE_LABELS: Record<Row["issue"], string> = {
  not_loading: "Video Not Loading",
  broken_link: "Broken Link",
  wrong_subtitles: "Wrong Subtitles",
  audio_sync: "Audio Sync Issue",
  other: "Other",
};

const KIND_LABELS: Record<Row["content_kind"], string> = {
  movie: "Movie",
  episode: "Episode",
  tv: "TV Channel",
  match: "Match",
};

export default function PlaybackReportsPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("playback_reports" as any).select("*").order("created_at", { ascending: false });
    if (filter === "open") q = q.eq("status", "open");
    const { data, error } = await q;
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as any);
  };

  useEffect(() => { load(); }, [filter]);

  const setStatus = async (r: Row, status: "fixed" | "dismissed") => {
    setBusyId(r.id);
    const { error } = await supabase
      .from("playback_reports" as any)
      .update({ status, resolved_at: new Date().toISOString(), resolved_by: user?.id ?? null })
      .eq("id", r.id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(status === "fixed" ? "Marked as fixed" : "Dismissed");
    load();
  };

  const remove = async (r: Row) => {
    if (!confirm("Delete this report?")) return;
    setBusyId(r.id);
    const { error } = await supabase.from("playback_reports" as any).delete().eq("id", r.id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <AlertTriangle className="h-5 w-5 text-yellow-500" />
        <span className="font-medium">Playback Reports</span>
        <span className="text-xs text-muted-foreground">User-flagged playback issues across all content.</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant={filter === "open" ? "default" : "outline"} onClick={() => setFilter("open")}>Open</Button>
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading && (
        <div className="glass rounded-2xl p-6 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">No reports.</div>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="glass rounded-2xl p-4 space-y-3 border border-border/40">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{KIND_LABELS[r.content_kind]}</Badge>
                  <Badge variant="destructive">{ISSUE_LABELS[r.issue]}</Badge>
                  {r.status !== "open" && (
                    <Badge variant={r.status === "fixed" ? "default" : "secondary"}>{r.status}</Badge>
                  )}
                </div>
                <div className="mt-1 font-semibold truncate">{r.content_title ?? "(no title)"}</div>
                <div className="text-xs text-muted-foreground truncate">id: {r.content_id}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Reported {new Date(r.created_at).toLocaleString()}
                </div>
                {r.note && (
                  <p className="text-sm mt-2 p-2 rounded bg-background/40 border border-border/30 whitespace-pre-wrap">
                    {r.note}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
              {r.status !== "fixed" && (
                <Button size="sm" disabled={busyId === r.id} onClick={() => setStatus(r, "fixed")}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Fixed
                </Button>
              )}
              {r.status === "open" && (
                <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => setStatus(r, "dismissed")}>
                  <X className="h-4 w-4 mr-1" /> Dismiss
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-destructive" disabled={busyId === r.id} onClick={() => remove(r)}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}