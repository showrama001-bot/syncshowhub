import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Search, Film, Loader2, Send, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useEffect } from "react";

const MAX_BYTES = 50 * 1024 * 1024;

type TmdbResult = {
  tmdb_id?: number;
  title?: string;
  description?: string;
  poster_url?: string | null;
  backdrop_url?: string | null;
  year?: number | null;
  genre?: string | null;
  category?: string | null;
  duration_minutes?: number | null;
  rating?: number | null;
  imdb_rating?: number | null;
};

type MyUpload = {
  id: string;
  title: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  review_note: string | null;
  poster_url: string | null;
};

export default function UploadShare() {
  const { user, loading } = useAuth();

  const [query, setQuery] = useState("");
  const [tmdbBusy, setTmdbBusy] = useState(false);
  const [meta, setMeta] = useState<TmdbResult>({});

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [mine, setMine] = useState<MyUpload[]>([]);

  const loadMine = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("community_uploads" as any)
      .select("id, title, status, created_at, review_note, poster_url")
      .eq("uploader_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setMine((data as any) ?? []);
  };
  useEffect(() => { loadMine(); }, [user?.id]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const fetchTmdb = async () => {
    if (!query.trim()) return toast.error("Type a movie name first");
    setTmdbBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("tmdb-fetch", {
        body: { query: query.trim(), kind: "movie" },
      });
      if (error) throw error;
      if (!data || (data as any).error) throw new Error((data as any)?.error || "Not found");
      setMeta(data as TmdbResult);
      toast.success(`Loaded: ${(data as TmdbResult).title}`);
    } catch (e: any) {
      toast.error(e?.message || "TMDB fetch failed");
    } finally {
      setTmdbBusy(false);
    }
  };

  const uploadAndShare = async () => {
    if (!meta.title) return toast.error("Pick a movie from TMDB first");
    if (!file) return toast.error("Choose a video file");
    if (file.size > MAX_BYTES) {
      return toast.error(
        `File is ${(file.size / 1024 / 1024).toFixed(1)} MB. Current free Telegram tier limit is 50 MB. Please compress the file.`,
      );
    }

    setUploading(true);
    setProgress(0);
    try {
      // Upload through our edge function using XHR so we can show progress.
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess.session?.access_token;
      if (!accessToken) throw new Error("Not signed in");

      const fd = new FormData();
      fd.append("file", file, file.name);
      fd.append("caption", `${meta.title}${meta.year ? ` (${meta.year})` : ""} — community upload`);

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-upload`;
      const result = await new Promise<{ stream_url: string; file_id: string }>(
        (resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", url);
          xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
          xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 95));
          };
          xhr.onload = () => {
            try {
              const j = JSON.parse(xhr.responseText || "{}");
              if (xhr.status >= 200 && xhr.status < 300 && j.stream_url) resolve(j);
              else reject(new Error(j?.error || `Upload failed (${xhr.status})`));
            } catch (e) {
              reject(new Error("Bad response from upload service"));
            }
          };
          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.send(fd);
        },
      );

      setProgress(98);

      const { error: insErr } = await supabase.from("community_uploads" as any).insert({
        uploader_id: user.id,
        tmdb_id: meta.tmdb_id ?? null,
        title: meta.title!,
        description: meta.description ?? null,
        poster_url: meta.poster_url ?? null,
        backdrop_url: meta.backdrop_url ?? null,
        year: meta.year ?? null,
        genre: meta.genre ?? null,
        category: meta.category ?? null,
        duration_minutes: meta.duration_minutes ?? null,
        rating: meta.rating ?? null,
        imdb_rating: meta.imdb_rating ?? null,
        stream_url: result.stream_url,
        telegram_file_id: result.file_id,
        source_type: "mp4",
        status: "pending",
      });
      if (insErr) throw insErr;

      setProgress(100);
      toast.success("Submitted! An admin will review it shortly.");
      setFile(null);
      setMeta({});
      setQuery("");
      setProgress(0);
      loadMine();
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="pt-20 px-4 md:px-8 max-w-3xl mx-auto pb-16">
      <header className="mb-8">
        <h1 className="font-display text-3xl md:text-5xl tracking-wider neon-text flex items-center gap-3">
          <Film className="h-8 w-8" /> Upload &amp; Share
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          Pick a movie from TMDB, attach your file, and submit. After admin approval it goes live for everyone.
        </p>
      </header>

      <section className="glass rounded-2xl p-6 space-y-6 border border-border/40">
        <div className="space-y-2">
          <Label>1. Find the movie on TMDB</Label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Interstellar"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), fetchTmdb())}
              disabled={tmdbBusy || uploading}
            />
            <Button onClick={fetchTmdb} disabled={tmdbBusy || uploading} type="button">
              {tmdbBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Search</span>
            </Button>
          </div>
        </div>

        {meta.title && (
          <div className="rounded-xl border border-border/50 p-4 flex gap-4 bg-background/40">
            {meta.poster_url && (
              <img
                src={meta.poster_url}
                alt={meta.title}
                loading="lazy"
                className="w-24 rounded-md select-none pointer-events-none"
                draggable={false}
              />
            )}
            <div className="flex-1 space-y-1">
              <div className="font-display text-xl">{meta.title}</div>
              <div className="text-xs text-muted-foreground">
                {meta.year ?? "—"} · {meta.genre ?? "—"}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3">{meta.description}</p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>2. Attach your video file</Label>
          <Input
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={uploading}
          />
          {file && (
            <p className="text-xs text-muted-foreground">
              {file.name} — {(file.size / (1024 * 1024)).toFixed(1)} MB
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Free tier limit: 50 MB per file. For larger files, the premium worker will be enabled soon.
          </p>
        </div>

        {uploading && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground">
              {progress < 95
                ? `Uploading to Telegram… ${progress}%`
                : progress < 100
                ? "Saving…"
                : "Done"}
            </p>
          </div>
        )}

        <Button
          className="w-full"
          onClick={uploadAndShare}
          disabled={uploading || !meta.title || !file}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Upload &amp; Share
        </Button>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl mb-3">Your submissions</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">No submissions yet.</p>
        ) : (
          <ul className="space-y-3">
            {mine.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 glass rounded-xl p-3 border border-border/40"
              >
                {m.poster_url && (
                  <img
                    src={m.poster_url}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="w-10 h-14 object-cover rounded select-none pointer-events-none"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{m.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                  {m.review_note && (
                    <div className="text-xs text-amber-400 mt-0.5">Note: {m.review_note}</div>
                  )}
                </div>
                <StatusBadge status={m.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: MyUpload["status"] }) {
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