import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, Search, Film, Loader2 } from "lucide-react";
import { isDeviceBanned } from "@/lib/deviceFingerprint";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Bunny CDN uploads are now proxied through the `bunny-upload` edge function,
// which holds the storage AccessKey as a server-side secret.

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

export default function UploadMovie() {
  const { user, loading } = useAuth();

  const [query, setQuery] = useState("");
  const [tmdbBusy, setTmdbBusy] = useState(false);
  const [meta, setMeta] = useState<TmdbResult>({});

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sourceMode, setSourceMode] = useState<"upload" | "url">("upload");
  const [directUrl, setDirectUrl] = useState("");

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const fetchTmdb = async () => {
    if (!query.trim()) {
      toast.error("Enter a movie name first");
      return;
    }
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

  const uploadAndSave = async () => {
    if (!meta.title) return toast.error("Fetch movie details first");
    if (sourceMode === "upload" && !file) return toast.error("Choose a video file");
    if (sourceMode === "url" && !directUrl.trim()) return toast.error("Paste a direct video URL");
    if (sourceMode === "url" && !/^https?:\/\//i.test(directUrl.trim())) {
      return toast.error("URL must start with http(s)://");
    }

    setUploading(true);
    setProgress(0);
    try {
      // Block suspended / banned users.
      const { data: prof } = await supabase
        .from("profiles")
        .select("suspended_until, permanent_banned, is_banned")
        .eq("id", user.id)
        .maybeSingle();
      if (prof?.permanent_banned || prof?.is_banned) throw new Error("Your account is banned from uploading.");
      if (prof?.suspended_until && new Date(prof.suspended_until) > new Date()) {
        throw new Error(`Account suspended until ${new Date(prof.suspended_until).toLocaleString()}`);
      }
      if (await isDeviceBanned(supabase)) throw new Error("This device is banned from uploading.");

      // Prevent duplicate uploads by TMDB id.
      if (meta.tmdb_id) {
        const { data: dup } = await supabase
          .from("movies")
          .select("id, title")
          .eq("tmdb_id", meta.tmdb_id)
          .maybeSingle();
        if (dup) throw new Error(`This content already exists! ("${dup.title}")`);
      }

      let finalUrl: string;
      if (sourceMode === "upload" && file) {
        setProgress(10);
        const fd = new FormData();
        fd.append("file", file, file.name);
        const { data: up, error: upErr } = await supabase.functions.invoke("bunny-upload", { body: fd });
        if (upErr) throw new Error(upErr.message || "Bunny upload failed");
        if (!up?.url) throw new Error("Bunny upload failed");
        finalUrl = up.url as string;
        setProgress(100);
      } else {
        finalUrl = directUrl.trim();
        setProgress(100);
      }

      // 3. Save to movies table — store every embed URL we got.
      const { error: insErr } = await supabase.from("movies").insert({
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
        tmdb_id: meta.tmdb_id ?? null,
        stream_url: finalUrl,
        voe_sx_url: null,
        streamtape_url: null,
        doodstream_url: null,
        source_type: "mp4",
        created_by: user.id,
        is_admin_upload: false,
      });
      if (insErr) throw insErr;

      toast.success(sourceMode === "upload" ? "Uploaded to Bunny.net CDN" : "Movie saved with direct URL");
      setFile(null);
      setDirectUrl("");
      setMeta({});
      setQuery("");
      setProgress(0);
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
          <Film className="h-8 w-8" /> Upload Movie
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          Fetch movie details from TMDB and upload your video directly to Bunny.net CDN.
        </p>
      </header>

      <section className="glass rounded-2xl p-6 space-y-6 border border-border/40">
        <div className="space-y-2">
          <Label>1. Movie name</Label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Inception"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), fetchTmdb())}
              disabled={tmdbBusy || uploading}
            />
            <Button onClick={fetchTmdb} disabled={tmdbBusy || uploading} type="button">
              {tmdbBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Fetch</span>
            </Button>
          </div>
        </div>

        {meta.title && (
          <div className="rounded-xl border border-border/50 p-4 flex gap-4 bg-background/40">
            {meta.poster_url && (
              <img src={meta.poster_url} alt={meta.title} className="w-24 rounded-md" />
            )}
            <div className="flex-1 space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Title</Label>
                <Input
                  value={meta.title ?? ""}
                  onChange={(e) => setMeta({ ...meta, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Year</Label>
                  <Input
                    type="number"
                    value={meta.year ?? ""}
                    onChange={(e) => setMeta({ ...meta, year: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Genre</Label>
                  <Input
                    value={meta.genre ?? ""}
                    onChange={(e) => setMeta({ ...meta, genre: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <Textarea
                  rows={3}
                  value={meta.description ?? ""}
                  onChange={(e) => setMeta({ ...meta, description: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>2. Video source</Label>
          <Tabs value={sourceMode} onValueChange={(v) => setSourceMode(v as "upload" | "url")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="upload" disabled={uploading}>Upload to Bunny.net</TabsTrigger>
              <TabsTrigger value="url" disabled={uploading}>Direct video URL</TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="space-y-2 pt-3">
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
            </TabsContent>
            <TabsContent value="url" className="space-y-2 pt-3">
              <Input
                type="url"
                placeholder="https://example.com/video.mp4"
                value={directUrl}
                onChange={(e) => setDirectUrl(e.target.value)}
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground">
                Paste a direct .mp4 / .m3u8 URL hosted anywhere.
              </p>
            </TabsContent>
          </Tabs>
        </div>

        {uploading && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground">
              {sourceMode === "upload"
                ? (progress < 100 ? `Uploading to Bunny.net… ${progress}%` : "Finalizing…")
                : "Saving…"}
            </p>
          </div>
        )}

        <Button
          className="w-full"
          onClick={uploadAndSave}
          disabled={
            uploading ||
            !meta.title ||
            (sourceMode === "upload" ? !file : !directUrl.trim())
          }
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          Upload & Save
        </Button>
      </section>
    </div>
  );
}