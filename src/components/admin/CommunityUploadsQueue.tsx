import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CheckCircle2, Trash2, Play, RefreshCw, Clock, XCircle, Tv2, Film } from "lucide-react";
import { fetchTmdbDetails } from "@/lib/contribute";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Row = {
  id: string;
  uploader_id: string;
  tmdb_id: number | null;
  series_tmdb_id: number | null;
  kind: "movie" | "episode";
  season_number: number | null;
  episode_number: number | null;
  episode_title: string | null;
  title: string;
  description: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  year: number | null;
  genre: string | null;
  category: string | null;
  duration_minutes: number | null;
  rating: number | null;
  imdb_rating: number | null;
  stream_url: string;
  telegram_file_id: string | null;
  source_type: string | null;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
};

export default function CommunityUploadsQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<Row | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("community_uploads" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows(((data as any) ?? []) as Row[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  const approve = async (r: Row) => {
    setBusyId(r.id);
    try {
      if (r.kind === "episode") {
        await approveEpisode(r);
        return;
      }
      // Duplicate guard against the live movies table.
      if (r.tmdb_id) {
        const { data: dup } = await supabase
          .from("movies")
          .select("id")
          .eq("tmdb_id", r.tmdb_id)
          .maybeSingle();
        if (dup) throw new Error("A movie with this TMDB id already exists in the library.");
      }

      const { data: ins, error: insErr } = await supabase
        .from("movies")
        .insert({
          title: r.title,
          description: r.description,
          poster_url: r.poster_url,
          backdrop_url: r.backdrop_url,
          year: r.year,
          genre: r.genre,
          category: r.category,
          duration_minutes: r.duration_minutes,
          rating: r.rating,
          imdb_rating: r.imdb_rating,
          tmdb_id: r.tmdb_id,
          stream_url: r.stream_url,
          source_type: r.source_type ?? "mp4",
          created_by: r.uploader_id,
          is_admin_upload: false,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      const { error: updErr } = await supabase
        .from("community_uploads" as any)
        .update({
          status: "approved",
          review_note: note || null,
          reviewed_at: new Date().toISOString(),
          published_movie_id: ins!.id,
        })
        .eq("id", r.id);
      if (updErr) throw updErr;

      toast.success(`"${r.title}" is now live site-wide.`);
      setNote("");
      setPreview(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Approve failed");
    } finally {
      setBusyId(null);
    }
  };

  // Publish an episode contribution: ensure series + season exist, then
  // upsert the episode with the contributed stream_url.
  const approveEpisode = async (r: Row) => {
    if (!r.series_tmdb_id || r.season_number == null || r.episode_number == null) {
      throw new Error("Episode row is missing series/season/episode numbers.");
    }
    // 1. Ensure the parent series row exists.
    let seriesId: string | null = null;
    {
      const { data: existing } = await (supabase.from("series" as any) as any)
        .select("id").eq("tmdb_id", r.series_tmdb_id).maybeSingle();
      if (existing) seriesId = existing.id;
    }
    if (!seriesId) {
      // Pull rich metadata from TMDB so the new series row isn't bare.
      const meta = await fetchTmdbDetails(r.series_tmdb_id, "series");
      const { data: ins, error } = await (supabase.from("series" as any) as any)
        .insert({
          tmdb_id: r.series_tmdb_id,
          title: meta?.title ?? r.title,
          description: meta?.description ?? r.description,
          poster_url: meta?.poster_url ?? r.poster_url,
          backdrop_url: meta?.backdrop_url ?? r.backdrop_url,
          year: meta?.year ?? r.year,
          genre: meta?.genre ?? r.genre,
          created_by: r.uploader_id,
        }).select("id").single();
      if (error) throw error;
      seriesId = ins.id;
    }
    // 2. Ensure the season row exists.
    let seasonId: string | null = null;
    {
      const { data: existing } = await (supabase.from("seasons" as any) as any)
        .select("id").eq("series_id", seriesId).eq("season_number", r.season_number).maybeSingle();
      if (existing) seasonId = existing.id;
    }
    if (!seasonId) {
      const { data: ins, error } = await (supabase.from("seasons" as any) as any)
        .insert({ series_id: seriesId, season_number: r.season_number, title: `Season ${r.season_number}` })
        .select("id").single();
      if (error) throw error;
      seasonId = ins.id;
    }
    // 3. Upsert the episode itself.
    let episodeId: string;
    {
      const { data: existing } = await (supabase.from("episodes" as any) as any)
        .select("id").eq("season_id", seasonId).eq("episode_number", r.episode_number).maybeSingle();
      if (existing) {
        const { error } = await (supabase.from("episodes" as any) as any)
          .update({ stream_url: r.stream_url, title: r.episode_title ?? `Episode ${r.episode_number}` })
          .eq("id", existing.id);
        if (error) throw error;
        episodeId = existing.id;
      } else {
        const { data: ins, error } = await (supabase.from("episodes" as any) as any)
          .insert({
            season_id: seasonId,
            episode_number: r.episode_number,
            title: r.episode_title ?? `Episode ${r.episode_number}`,
            stream_url: r.stream_url,
          }).select("id").single();
        if (error) throw error;
        episodeId = ins.id;
      }
    }
    // 4. Mark community upload approved.
    const { error: updErr } = await supabase
      .from("community_uploads" as any)
      .update({
        status: "approved",
        review_note: note || null,
        reviewed_at: new Date().toISOString(),
        published_episode_id: episodeId,
      } as any)
      .eq("id", r.id);
    if (updErr) throw updErr;
    toast.success(`${r.title} S${r.season_number}E${r.episode_number} is now live.`);
    setNote("");
    setPreview(null);
    load();
  };

  const reject = async (r: Row) => {
    setBusyId(r.id);
    try {
      const { error } = await supabase
        .from("community_uploads" as any)
        .update({
          status: "rejected",
          review_note: note || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", r.id);
      if (error) throw error;
      toast.success("Rejected");
      setNote("");
      setPreview(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Reject failed");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (r: Row) => {
    if (!confirm(`Delete "${r.title}"? This cannot be undone.`)) return;
    setBusyId(r.id);
    try {
      const { error } = await supabase.from("community_uploads" as any).delete().eq("id", r.id);
      if (error) throw error;
      toast.success("Deleted");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {(["pending", "approved", "rejected", "all"] as const).map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s)}
          >
            {s[0].toUpperCase() + s.slice(1)}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No uploads in this view.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-3 glass rounded-xl p-3 border border-border/40"
            >
              {r.poster_url && (
                <img
                  src={r.poster_url}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className="w-12 h-16 rounded object-cover select-none pointer-events-none"
                />
              )}
              <div className="flex-1 min-w-[200px]">
                <div className="font-medium truncate">
                  <span className="inline-flex items-center gap-1 mr-2 text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
                    {r.kind === "episode" ? <><Tv2 className="h-3 w-3" /> EP</> : <><Film className="h-3 w-3" /> MOV</>}
                  </span>
                  {r.title}
                  {r.year ? <span className="text-muted-foreground"> ({r.year})</span> : null}
                  {r.kind === "episode" && r.season_number != null && r.episode_number != null && (
                    <span className="text-muted-foreground"> · S{r.season_number}E{r.episode_number}{r.episode_title ? ` — ${r.episode_title}` : ""}</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()} · {r.source_type}
                </div>
              </div>
              <StatusBadge status={r.status} />
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={() => { setPreview(r); setNote(r.review_note ?? ""); }}>
                  <Play className="h-4 w-4 mr-1" /> Review
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(r)}
                  disabled={busyId === r.id}
                >
                  <Trash2 className="h-4 w-4 text-rose-400" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-4">
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-black relative">
                <video
                  src={preview.stream_url}
                  controls
                  className="w-full h-full"
                  controlsList="nodownload noremoteplayback"
                  disablePictureInPicture
                />
                <div className="absolute inset-0 pointer-events-none" />
              </div>
              <p className="text-sm text-muted-foreground">{preview.description}</p>
              <Input
                placeholder="Review note (optional, visible to uploader)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => reject(preview)}
                  disabled={busyId === preview.id}
                >
                  <XCircle className="h-4 w-4 mr-1" /> Reject
                </Button>
                <Button onClick={() => approve(preview)} disabled={busyId === preview.id}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Approve &amp; Publish
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: Row["status"] }) {
  if (status === "approved")
    return (
      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40">
        <XCircle className="h-3 w-3 mr-1" /> Rejected
      </Badge>
    );
  return (
    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">
      <Clock className="h-3 w-3 mr-1" /> Pending
    </Badge>
  );
}