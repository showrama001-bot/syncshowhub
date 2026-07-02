import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trash2, Upload, Youtube, Film } from "lucide-react";
import { toast } from "sonner";
import { uploadToTelegram } from "@/lib/telegramUpload";
import { MovieSearchPicker } from "./MovieSearchPicker";

type Reel = {
  id: string;
  source_type: "trailer" | "upload";
  youtube_id: string | null;
  video_url: string | null;
  movie_id: string | null;
  title: string | null;
  poster_url: string | null;
  created_at: string;
};

function ytIdFromAny(s: string): string | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export default function ReelsManager() {
  const { user } = useAuth();
  const [reels, setReels] = useState<Reel[]>([]);
  const [trailers, setTrailers] = useState<any[]>([]);
  const [movies, setMovies] = useState<{ id: string; title: string; poster_url: string | null }[]>([]);

  const [ytInput, setYtInput] = useState("");
  const [ytTitle, setYtTitle] = useState("");
  const [ytMovieId, setYtMovieId] = useState<string>("");

  const [file, setFile] = useState<File | null>(null);
  const [upTitle, setUpTitle] = useState("");
  const [upMovieId, setUpMovieId] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const [{ data: r }, { data: t }, { data: m }] = await Promise.all([
      (supabase.from("reels" as any) as any).select("*").order("created_at", { ascending: false }),
      (supabase.from("trailers" as any) as any).select("id, movie_title, youtube_url, movie_id").order("created_at", { ascending: false }).limit(50),
      supabase.from("movies").select("id, title, poster_url").order("title").limit(1000),
    ]);
    setReels((r || []) as any);
    setTrailers((t || []) as any);
    setMovies((m || []) as any);
  };
  useEffect(() => { load(); }, []);

  const addFromTrailer = async (tr: any) => {
    const id = ytIdFromAny(tr.youtube_url || "");
    if (!id) return toast.error("Trailer has no valid YouTube URL");
    const { error } = await (supabase.from("reels" as any) as any).insert({
      source_type: "trailer", youtube_id: id, title: tr.movie_title, poster_url: null,
      movie_id: tr.movie_id || null, created_by: user!.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Reel added from trailer");
    load();
  };

  const addYouTube = async () => {
    const id = ytIdFromAny(ytInput);
    if (!id) return toast.error("Provide a YouTube URL or 11-char video ID");
    const { error } = await (supabase.from("reels" as any) as any).insert({
      source_type: "trailer", youtube_id: id, title: ytTitle || null,
      movie_id: ytMovieId || null, created_by: user!.id,
    });
    if (error) return toast.error(error.message);
    setYtInput(""); setYtTitle(""); setYtMovieId("");
    toast.success("Reel added");
    load();
  };

  const uploadClip = async () => {
    if (!file) return toast.error("Pick a video file");
    setUploading(true);
    try {
      const { stream_url: url } = await uploadToTelegram(file, upTitle || file.name);
      const { error } = await (supabase.from("reels" as any) as any).insert({
        source_type: "upload", video_url: url, title: upTitle || file.name,
        movie_id: upMovieId || null, created_by: user!.id,
      });
      if (error) throw error;
      toast.success("Reel uploaded");
      setFile(null); setUpTitle(""); setUpMovieId("");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const del = async (id: string) => {
    await (supabase.from("reels" as any) as any).delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-xl tracking-wider mb-1 flex items-center gap-2">
          <Film className="h-5 w-5 text-primary" /> Reels manager
        </h3>
        <p className="text-xs text-muted-foreground">
          Publish vertical reels from your existing trailers or upload short clips from a PC.
          Every 4th swipe automatically triggers an interstitial ad on the Reels page.
        </p>
      </div>

      <Tabs defaultValue="trailer">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="trailer">Pull from trailers</TabsTrigger>
          <TabsTrigger value="youtube">Add YouTube ID</TabsTrigger>
          <TabsTrigger value="upload">Upload clip</TabsTrigger>
        </TabsList>

        <TabsContent value="trailer" className="pt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[380px] overflow-y-auto">
            {trailers.length === 0 && <p className="text-sm text-muted-foreground">No trailers yet — add some from the Trailers tab.</p>}
            {trailers.map((tr) => (
              <div key={tr.id} className="flex items-center gap-3 glass rounded-xl p-2">
                <div className="w-16 h-10 bg-black rounded overflow-hidden grid place-items-center">
                  <Youtube className="h-5 w-5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{tr.movie_title}</div>
                </div>
                <Button size="sm" className="bg-gradient-red" onClick={() => addFromTrailer(tr)}>Publish</Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="youtube" className="pt-3 space-y-2">
          <div className="space-y-1">
            <Label>YouTube URL or ID</Label>
            <Input value={ytInput} onChange={(e) => setYtInput(e.target.value)} placeholder="https://www.youtube.com/watch?v=… or 11-char ID" />
          </div>
          <div className="space-y-1">
            <Label>Title (optional)</Label>
            <Input value={ytTitle} onChange={(e) => setYtTitle(e.target.value)} />
          </div>
          <MovieSearchPicker
            label='Link to movie (for "Watch full movie" button)'
            items={movies}
            value={ytMovieId}
            onChange={(id) => setYtMovieId(id)}
          />
          <Button className="bg-gradient-red shadow-neon" onClick={addYouTube}>Add reel</Button>
        </TabsContent>

        <TabsContent value="upload" className="pt-3 space-y-2">
          <div className="space-y-1">
            <Label>MP4 / WebM file (≤50MB via Telegram pipeline)</Label>
            <Input type="file" accept="video/mp4,video/webm" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={upTitle} onChange={(e) => setUpTitle(e.target.value)} />
          </div>
          <MovieSearchPicker
            label='Link to movie (for "Watch full movie" button)'
            items={movies}
            value={upMovieId}
            onChange={(id) => setUpMovieId(id)}
          />
          <Button className="bg-gradient-red shadow-neon" onClick={uploadClip} disabled={uploading}>
            <Upload className="h-4 w-4 mr-1" /> {uploading ? "Uploading…" : "Upload reel"}
          </Button>
        </TabsContent>
      </Tabs>

      <div>
        <h4 className="font-semibold mb-2">Published reels ({reels.length})</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {reels.map((r) => (
            <div key={r.id} className="flex items-center gap-3 glass rounded-xl p-2">
              <div className="w-14 h-14 bg-black rounded overflow-hidden grid place-items-center">
                {r.source_type === "trailer"
                  ? <Youtube className="h-6 w-6 text-red-500" />
                  : <Film className="h-6 w-6 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.title || "(untitled)"}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {r.source_type === "trailer" ? `YT: ${r.youtube_id}` : (r.video_url || "").slice(0, 40)}
                  {r.movie_id ? " · linked" : ""}
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => del(r.id)} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {reels.length === 0 && <p className="text-sm text-muted-foreground col-span-2">No reels published yet.</p>}
        </div>
      </div>
    </div>
  );
}

