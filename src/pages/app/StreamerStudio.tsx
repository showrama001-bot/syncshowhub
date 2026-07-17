import { useEffect, useRef, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, Search, Loader2, Video, VideoOff, Mic, MicOff, Radio, ExternalLink } from "lucide-react";
import { uploadToStreamerTelegram, TELEGRAM_MAX_BYTES } from "@/lib/telegramUploadStreamer";

type Room = {
  id: string; username_slug: string; title: string; description: string | null;
  is_live: boolean; mode: string; current_video_url: string | null; current_video_title: string | null; current_poster: string | null;
};

export default function StreamerStudio() {
  const { user, loading, isApprovedStreamer } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);

  // TMDB
  const [query, setQuery] = useState("");
  const [tmdbBusy, setTmdbBusy] = useState(false);
  const [meta, setMeta] = useState<any>({});

  // Upload
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // WebRTC
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("streamer_rooms").select("*").eq("streamer_id", user.id).maybeSingle();
      setRoom((data as Room) ?? null);
    })();
  }, [user]);

  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isApprovedStreamer) return <Navigate to="/apply-streamer" replace />;

  const patchRoom = async (patch: Partial<Room>) => {
    if (!room) return;
    const { error } = await supabase.from("streamer_rooms").update(patch).eq("id", room.id);
    if (error) return toast.error(error.message);
    setRoom({ ...room, ...patch } as Room);
  };

  const fetchTmdb = async () => {
    if (!query.trim()) return toast.error("Enter a movie name");
    setTmdbBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("tmdb-fetch", { body: { query: query.trim(), kind: "movie" } });
      if (error) throw error;
      if (!data || (data as any).error) throw new Error((data as any)?.error || "Not found");
      setMeta(data);
      toast.success(`Loaded: ${(data as any).title}`);
    } catch (e: any) { toast.error(e?.message || "TMDB fetch failed"); }
    finally { setTmdbBusy(false); }
  };

  const uploadMovie = async () => {
    if (!meta.title) return toast.error("Fetch metadata first");
    if (!file) return toast.error("Choose a file");
    if (file.size > TELEGRAM_MAX_BYTES) return toast.error("Max 50 MB per file");
    setUploading(true); setProgress(0);
    try {
      const res = await uploadToStreamerTelegram(file, meta.title, (p) => setProgress(p));
      setProgress(100);
      const { error: insErr } = await supabase.from("streamer_uploads").insert({
        streamer_id: user.id,
        title: meta.title,
        tmdb_id: meta.tmdb_id ?? null,
        poster_url: meta.poster_url ?? null,
        backdrop_url: meta.backdrop_url ?? null,
        year: meta.year ?? null,
        genre: meta.genre ?? null,
        overview: meta.description ?? null,
        rating: meta.rating ?? null,
        stream_url: res.stream_url,
        telegram_file_id: res.file_id,
      });
      if (insErr) throw insErr;
      toast.success("Uploaded via Bot 2!");
      // Update room to broadcast the movie
      await patchRoom({
        is_live: true, mode: "upload",
        current_video_url: res.stream_url,
        current_video_title: meta.title,
        current_poster: meta.poster_url ?? null,
      });
      setFile(null); setMeta({}); setQuery(""); setProgress(0);
    } catch (e: any) { toast.error(e?.message || "Upload failed"); }
    finally { setUploading(false); }
  };

  const toggleCam = async () => {
    if (camOn) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setCamOn(false);
      await patchRoom({ is_live: false, mode: "offline" });
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: micOn });
      streamRef.current = s;
      if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}); }
      setCamOn(true);
      await patchRoom({ is_live: true, mode: "webrtc" });
      toast.success("Camera live (self-preview). Viewers see 'live' status.");
    } catch (e: any) { toast.error(e?.message || "Camera denied"); }
  };

  const toggleMic = () => {
    const next = !micOn;
    streamRef.current?.getAudioTracks().forEach(t => (t.enabled = next));
    setMicOn(next);
  };

  const goOffline = async () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamOn(false);
    await patchRoom({ is_live: false, mode: "offline", current_video_url: null });
    toast.success("Stream ended");
  };

  return (
    <div className="pt-20 px-4 md:px-8 max-w-4xl mx-auto pb-16">
      <header className="mb-6 flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-5xl tracking-wider neon-text flex items-center gap-3">
            <Radio className="h-8 w-8" /> Streamer Studio
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {room ? <>Your room: <Link className="text-primary underline" to={`/room/${room.username_slug}`}>/room/{room.username_slug} <ExternalLink className="inline h-3 w-3" /></Link></> : "Loading room…"}
          </p>
        </div>
        {room?.is_live && <Button variant="destructive" onClick={goOffline}>End stream</Button>}
      </header>

      <Tabs defaultValue="live">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="live">Live camera</TabsTrigger>
          <TabsTrigger value="upload">Upload movie</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-4 space-y-4">
          <div className="aspect-video bg-black rounded-xl overflow-hidden">
            <video ref={videoRef} className="w-full h-full" muted playsInline autoPlay />
          </div>
          <div className="flex gap-2">
            <Button onClick={toggleCam}>
              {camOn ? <VideoOff className="h-4 w-4 mr-2" /> : <Video className="h-4 w-4 mr-2" />}
              {camOn ? "Stop camera" : "Go live (camera + mic)"}
            </Button>
            <Button variant="secondary" onClick={toggleMic} disabled={!camOn}>
              {micOn ? <Mic className="h-4 w-4 mr-2" /> : <MicOff className="h-4 w-4 mr-2" />}
              {micOn ? "Mic on" : "Mic off"}
            </Button>
          </div>
          <div className="rounded-md border border-border/40 p-3 text-xs text-muted-foreground">
            <p><strong>OBS / RTMP:</strong> Coming soon — external RTMP ingest requires an upstream media server. For now, use the browser camera or upload a movie.</p>
          </div>
        </TabsContent>

        <TabsContent value="upload" className="mt-4 space-y-4">
          <section className="glass rounded-2xl p-6 space-y-4 border border-border/40">
            <div className="space-y-2">
              <Label>Movie name (TMDB)</Label>
              <div className="flex gap-2">
                <Input placeholder="e.g. Inception" value={query} onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), fetchTmdb())} disabled={tmdbBusy || uploading} />
                <Button onClick={fetchTmdb} disabled={tmdbBusy || uploading} type="button">
                  {tmdbBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="ml-2">Fetch</span>
                </Button>
              </div>
            </div>

            {meta.title && (
              <div className="rounded-xl border border-border/50 p-3 flex gap-4 bg-background/40">
                {meta.poster_url && <img src={meta.poster_url} alt={meta.title} className="w-24 rounded-md" />}
                <div className="flex-1 space-y-2">
                  <p className="font-semibold">{meta.title} <span className="text-muted-foreground text-sm">({meta.year ?? "—"})</span></p>
                  <p className="text-xs text-muted-foreground">{meta.genre}</p>
                  <Textarea rows={3} value={meta.description ?? ""} onChange={(e) => setMeta({ ...meta, description: e.target.value })} />
                </div>
              </div>
            )}

            <div>
              <Label>Video file (≤ 50 MB, MP4/MKV)</Label>
              <Input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={uploading} />
              {file && <p className="text-xs text-muted-foreground mt-1">{file.name} — {(file.size / (1024 * 1024)).toFixed(1)} MB</p>}
            </div>

            {uploading && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">Uploading via Bot 2… {progress}%</p>
              </div>
            )}

            <Button className="w-full" disabled={uploading || !meta.title || !file} onClick={uploadMovie}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload & broadcast to my room
            </Button>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}