import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Video, Upload, Radio, Copy } from "lucide-react";

// Simple WebRTC broadcast: the studio host publishes its camera/mic stream to
// a Supabase Realtime channel keyed by `studio:<username>`. Viewers on
// /room/:username create an RTCPeerConnection, receive the SDP offer from the
// host, and answer via the same channel. No auth, no approval.
export default function Studio() {
  const nav = useNavigate();
  const [username, setUsername] = useState(() => localStorage.getItem("studio_username") || "");
  const [live, setLive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const [file, setFile] = useState<File | null>(null);
  const [movieTitle, setMovieTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => () => stopLive(), []);

  const startLive = async () => {
    const name = username.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
    if (name.length < 3) return toast.error("Pick a username (3+ chars)");
    localStorage.setItem("studio_username", name);
    setUsername(name);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }

      const channel = supabase.channel(`studio:${name}`, { config: { broadcast: { self: false } } });
      channelRef.current = channel;

      channel.on("broadcast", { event: "viewer-join" }, async ({ payload }: any) => {
        const viewerId = payload.viewerId;
        const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        peersRef.current.set(viewerId, pc);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        pc.onicecandidate = (e) => {
          if (e.candidate) channel.send({ type: "broadcast", event: "host-ice", payload: { viewerId, candidate: e.candidate } });
        };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channel.send({ type: "broadcast", event: "host-offer", payload: { viewerId, sdp: offer } });
      });

      channel.on("broadcast", { event: "viewer-answer" }, async ({ payload }: any) => {
        const pc = peersRef.current.get(payload.viewerId);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      });

      channel.on("broadcast", { event: "viewer-ice" }, async ({ payload }: any) => {
        const pc = peersRef.current.get(payload.viewerId);
        if (pc && payload.candidate) {
          try { await pc.addIceCandidate(payload.candidate); } catch {}
        }
      });

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.send({ type: "broadcast", event: "host-live", payload: { username: name } });
          setLive(true);
          toast.success(`Live at /room/${name}`);
        }
      });
    } catch (e: any) {
      toast.error(e.message || "Camera access denied");
    }
  };

  const stopLive = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    if (channelRef.current) {
      try { channelRef.current.send({ type: "broadcast", event: "host-offline", payload: {} }); } catch {}
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setLive(false);
  };

  const uploadMovie = async () => {
    if (!file) return toast.error("Pick a video file");
    if (!movieTitle.trim()) return toast.error("Enter the movie title");
    if (file.size > 50 * 1024 * 1024) return toast.error("Max 50 MB per file (Telegram Bot API limit)");
    setUploading(true); setProgress(0);
    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      fd.append("title", movieTitle);
      fd.append("streamer", username);
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/streamer-upload`;
      const json = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
        xhr.upload.onprogress = (ev) => ev.lengthComputable && setProgress(Math.round((ev.loaded / ev.total) * 95));
        xhr.onload = () => {
          try {
            const j = JSON.parse(xhr.responseText || "{}");
            xhr.status >= 200 && xhr.status < 300 ? resolve(j) : reject(new Error(j.error || `HTTP ${xhr.status}`));
          } catch { reject(new Error("Bad response")); }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(fd);
      });
      setProgress(100);
      toast.success(`Published: ${json.meta?.title || movieTitle}`);
      setFile(null); setMovieTitle("");
      setTimeout(() => nav(`/play/movie/${json.movie_id}`), 800);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const roomUrl = username ? `${window.location.origin}/room/${username}` : "";

  return (
    <div className="pt-20 px-4 md:px-6 pb-12 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl tracking-wider neon-text flex items-center gap-2">
            <Radio className="h-7 w-7" /> Live Studio
          </h1>
          <p className="text-muted-foreground text-sm">Public studio — anyone can go live. No approval required.</p>
        </div>
        {live && (
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-red-500/90 text-white text-xs font-semibold animate-pulse">LIVE</span>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(roomUrl); toast.success("Room link copied"); }}>
              <Copy className="h-3 w-3 mr-1" /> Copy room link
            </Button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-border/50">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline />
            {!live && (
              <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                <div className="text-center">
                  <Video className="h-12 w-12 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Camera preview will appear here</p>
                </div>
              </div>
            )}
          </div>

          <Tabs defaultValue="live">
            <TabsList>
              <TabsTrigger value="live"><Radio className="h-4 w-4 mr-1" /> Go Live (Camera)</TabsTrigger>
              <TabsTrigger value="upload"><Upload className="h-4 w-4 mr-1" /> Upload Movie</TabsTrigger>
            </TabsList>

            <TabsContent value="live" className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label>Your streamer username</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. neo_bright" disabled={live} />
                <p className="text-xs text-muted-foreground">Viewers will find you at <code>/room/{username || "your-name"}</code></p>
              </div>
              {!live ? (
                <Button onClick={startLive} className="bg-gradient-red shadow-neon">Start streaming</Button>
              ) : (
                <Button variant="destructive" onClick={stopLive}>End stream</Button>
              )}
            </TabsContent>

            <TabsContent value="upload" className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label>Movie title (used for TMDB lookup)</Label>
                <Input value={movieTitle} onChange={(e) => setMovieTitle(e.target.value)} placeholder="e.g. Interstellar" />
              </div>
              <div className="space-y-2">
                <Label>Video file (max 50 MB)</Label>
                <Input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                {file && <p className="text-xs text-muted-foreground">{file.name} — {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
              </div>
              {uploading && (
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-red transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
              <Button onClick={uploadMovie} disabled={uploading} className="bg-gradient-red shadow-neon">
                {uploading ? `Uploading… ${progress}%` : "Upload & publish"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Metadata (poster, overview, genres, rating) is fetched automatically from TMDB after upload.
              </p>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="glass rounded-2xl p-4 h-fit">
          <h3 className="font-semibold mb-2">How it works</h3>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Pick a username and hit <b>Start streaming</b> to broadcast your camera/mic.</li>
            <li>Share <code>/room/{username || "your-name"}</code> — viewers see your live feed + chat instantly.</li>
            <li>Or switch to <b>Upload Movie</b> to publish a file to the public catalog with auto TMDB metadata.</li>
          </ol>
        </aside>
      </div>
    </div>
  );
}