import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Copy, Eye, EyeOff, Send, Radio, Users, Video, Settings,
  Search, UploadCloud, Film, Loader2, CheckCircle2, X, Sparkles,
  Camera, CameraOff, Play, Pause, Volume2, AlertTriangle, Tv,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Lock } from "lucide-react";
import { useLocation } from "react-router-dom";
import { publishLocalMovie, publishLocalLiveRoom } from "@/lib/localLibrary";

const RTMP_URL = "rtmp://stream.syncshow.com/live";
const STREAM_KEY = "sk_live_9c031ce6_4948_4dea_9e93_627de32828b1";
const REACTIONS = ["🔥", "😂", "😮", "❤️", "👏", "🎉", "💯", "😢"] as const;

type ChatMsg = { id: string; user: string; text: string; color: string };
type TmdbHit = {
  tmdb_id: number;
  title: string;
  year: number | null;
  genre: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  description?: string | null;
};

const MOCK_HITS: TmdbHit[] = [
  { tmdb_id: 27205, title: "Inception", year: 2010, genre: "Action, Sci-Fi", poster_url: "https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg", backdrop_url: null },
  { tmdb_id: 155, title: "The Dark Knight", year: 2008, genre: "Action, Crime, Drama", poster_url: "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg", backdrop_url: null },
  { tmdb_id: 157336, title: "Interstellar", year: 2014, genre: "Adventure, Drama, Sci-Fi", poster_url: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg", backdrop_url: null },
  { tmdb_id: 603, title: "The Matrix", year: 1999, genre: "Action, Sci-Fi", poster_url: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg", backdrop_url: null },
];

const seedChat: ChatMsg[] = [
  { id: "1", user: "NovaKing", text: "yo the stream looks 🔥", color: "text-primary" },
  { id: "2", user: "Zara_88", text: "quality is insane 👏", color: "text-emerald-400" },
  { id: "3", user: "Dr_Neon", text: "who's the host?", color: "text-sky-400" },
  { id: "4", user: "PixelWolf", text: "GG 🎉", color: "text-amber-400" },
  { id: "5", user: "Luma", text: "turn up the mic pls", color: "text-fuchsia-400" },
];

// --- Ambient sound pointers (local playback) ---
const AMBIENT_POINTERS = import.meta.glob<{ url: string }>(
  "../../../public/sounds/*.mp3.asset.json",
  { eager: true, import: "default" }
);
const ambientUrlFor = (file: string): string | undefined => {
  const entry = Object.entries(AMBIENT_POINTERS).find(([p]) => p.endsWith(`/${file}.asset.json`));
  return entry?.[1]?.url;
};
const AMBIENT_TRACKS: { file: string; label: string; url?: string }[] = [
  { file: "sound1.mp3", label: "Rain" },
  { file: "sound8.mp3", label: "Cinema Lounge" },
  { file: "sound11.mp3", label: "Night Forest" },
  { file: "sound10.mp3", label: "Ocean Waves" },
].map((t) => ({ ...t, url: ambientUrlFor(t.file) })).filter((t) => t.url);

// Simulated library — for duplicate-episode check.
const EXISTING_EPISODES: Record<string, { season: number; episode: number }[]> = {
  // key = lowercase title
  "stranger things": [{ season: 1, episode: 1 }, { season: 1, episode: 2 }],
  "breaking bad": [{ season: 1, episode: 1 }],
};

export default function Studio() {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const isViewerRoute = location.pathname === "/live-stream";
  // Host = verified streamer (admin role). Query flag ?host=1 also allowed for host-preview.
  const isHost = !isViewerRoute && (isAdmin || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("host") === "1"));
  const [showKey, setShowKey] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>(seedChat);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"live" | "upload">("live");

  // Upload state
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<TmdbHit[]>([]);
  const [picked, setPicked] = useState<TmdbHit | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [done, setDone] = useState(false);
  const canPublish = Boolean(picked && file && !publishing);
  const fileSize = useMemo(
    () => (file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : ""),
    [file],
  );

  // Local playback
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setVideoUrl(null); return; }
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Webcam PiP
  const [camOn, setCamOn] = useState(false);
  const camVideoRef = useRef<HTMLVideoElement | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const [camPos, setCamPos] = useState({ x: 16, y: 16 });
  const dragRef = useRef<{ dx: number; dy: number; active: boolean }>({ dx: 0, dy: 0, active: false });

  const toggleCam = async () => {
    if (camOn) {
      camStreamRef.current?.getTracks().forEach((t) => t.stop());
      camStreamRef.current = null;
      setCamOn(false);
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      camStreamRef.current = s;
      setCamOn(true);
      setTimeout(() => {
        if (camVideoRef.current) {
          camVideoRef.current.srcObject = s;
          camVideoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      toast.error("Camera/mic permission denied");
    }
  };
  useEffect(() => () => camStreamRef.current?.getTracks().forEach((t) => t.stop()), []);

  const onCamPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { dx: e.clientX - camPos.x, dy: e.clientY - camPos.y, active: true };
  };
  const onCamPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    setCamPos({ x: Math.max(0, e.clientX - dragRef.current.dx), y: Math.max(0, e.clientY - dragRef.current.dy) });
  };
  const onCamPointerUp = () => { dragRef.current.active = false; };

  // Series / Episode duplicate check
  const [contentKind, setContentKind] = useState<"movie" | "series">("movie");
  const [season, setSeason] = useState("1");
  const [episode, setEpisode] = useState("1");
  const dupeInfo = useMemo(() => {
    if (contentKind !== "series" || !picked) return null;
    const existing = EXISTING_EPISODES[picked.title.toLowerCase()] ?? [];
    const s = parseInt(season) || 0;
    const ep = parseInt(episode) || 0;
    const hit = existing.find((x) => x.season === s && x.episode === ep);
    if (!hit) return null;
    const nextEp = Math.max(...existing.filter((x) => x.season === s).map((x) => x.episode)) + 1;
    return { season: s, episode: ep, nextEp };
  }, [contentKind, picked, season, episode]);
  useEffect(() => {
    if (dupeInfo) {
      toast.error(
        `This episode already exists! You left off at Episode ${dupeInfo.nextEp - 1} — please upload Episode ${dupeInfo.nextEp}.`,
        { id: "dupe-ep" }
      );
    }
  }, [dupeInfo]);

  // Ambient sounds
  const [ambient, setAmbient] = useState<Record<string, { on: boolean; vol: number }>>(
    () => Object.fromEntries(AMBIENT_TRACKS.map((t) => [t.file, { on: false, vol: 40 }]))
  );
  const ambientAudios = useRef<Record<string, HTMLAudioElement>>({});
  useEffect(() => {
    for (const t of AMBIENT_TRACKS) {
      const st = ambient[t.file];
      let a = ambientAudios.current[t.file];
      if (st.on) {
        if (!a) {
          a = new Audio(t.url);
          a.loop = true;
          ambientAudios.current[t.file] = a;
        }
        a.volume = st.vol / 100;
        if (a.paused) a.play().catch(() => {});
      } else if (a) {
        a.pause();
      }
    }
  }, [ambient]);
  useEffect(() => () => {
    Object.values(ambientAudios.current).forEach((a) => { try { a.pause(); a.src = ""; } catch {} });
  }, []);

  const searchTmdb = async () => {
    const q = query.trim();
    if (!q) return toast.error("Type a movie name first");
    setSearching(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("tmdb-fetch", {
        body: { query: q, kind: "movie" },
      });
      if (error || !data || (data as any).error) throw new Error("no live");
      const d = data as any;
      setResults([
        { tmdb_id: d.tmdb_id, title: d.title, year: d.year, genre: d.genre, poster_url: d.poster_url, backdrop_url: d.backdrop_url, description: d.description },
        ...MOCK_HITS.filter((m) => m.title.toLowerCase().includes(q.toLowerCase())).slice(0, 5),
      ]);
    } catch {
      const filtered = MOCK_HITS.filter((m) => m.title.toLowerCase().includes(q.toLowerCase()));
      setResults(filtered.length ? filtered : MOCK_HITS);
    } finally {
      setSearching(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }, []);

  const publish = async () => {
    if (!picked || !file) return;
    setPublishing(true);
    await new Promise((r) => setTimeout(r, 1200));
    // Add to /movies library
    publishLocalMovie({
      id: `local-${picked.tmdb_id}`,
      tmdb_id: picked.tmdb_id,
      title: picked.title,
      year: picked.year,
      genre: picked.genre,
      poster_url: picked.poster_url,
      category: picked.genre?.split(",")[0]?.trim() || null,
    });
    // Add a live room card pointing to /live-stream
    publishLocalLiveRoom({
      id: `studio-${picked.tmdb_id}-${Date.now()}`,
      title: picked.title,
      host_id: "studio-host",
      content_title: picked.title,
      poster_url: picked.poster_url,
      participant_count: 1,
    });
    setPublishing(false);
    setDone(true);
    toast.success(`"${picked.title}" published to your library`);
  };

  const resetUpload = () => {
    setPicked(null);
    setFile(null);
    setDone(false);
    setResults([]);
    setQuery("");
  };

  const copy = async (val: string, label: string) => {
    if (!isHost) {
      toast.error("Only the host can copy stream credentials");
      return;
    }
    try {
      await navigator.clipboard.writeText(val);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setMessages((m) => [
      ...m,
      { id: `${Date.now()}`, user: "You", text: t, color: "text-primary" },
    ]);
    setDraft("");
  };

  return (
    <div className="min-h-screen bg-background text-foreground pt-16 pb-10 px-4 md:px-8">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-red grid place-items-center shadow-neon">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl md:text-3xl neon-text tracking-wider">
                {isViewerRoute ? "LIVE STREAM" : "LIVE STUDIO"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {isViewerRoute ? "You're watching the host live" : "Broadcast in real-time to your audience"}
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Server connected</span>
            {isHost && (
              <a href="/live-stream" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded-lg glass border border-border/60 hover:text-primary hover:border-primary/40 transition-colors">
                <Tv className="w-3.5 h-3.5" /> Viewer view
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* LEFT: Player + Settings */}
          <div className="space-y-6 min-w-0">
            {/* MODE SWITCHER — host only */}
            {isHost ? (
            <div className="inline-flex p-1 rounded-xl glass border border-border/60 gap-1">
              <button
                onClick={() => setMode("live")}
                className={`px-4 py-2 rounded-lg text-sm font-display tracking-wider transition-all flex items-center gap-2 ${
                  mode === "live"
                    ? "bg-gradient-red text-white shadow-neon"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Radio className="w-4 h-4" /> LIVE STREAM (OBS)
              </button>
              <button
                onClick={() => setMode("upload")}
                className={`px-4 py-2 rounded-lg text-sm font-display tracking-wider transition-all flex items-center gap-2 ${
                  mode === "upload"
                    ? "bg-gradient-red text-white shadow-neon"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <UploadCloud className="w-4 h-4" /> UPLOAD & STREAM MOVIE
              </button>
            </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl glass border border-border/60 text-xs text-muted-foreground">
                <Lock className="w-3.5 h-3.5 text-primary" /> Viewer mode — host controls are hidden
              </div>
            )}

            {/* Player */}
            <Card className="relative overflow-hidden aspect-video bg-black border-border/60 shadow-card">
              {/* Ambient gradient */}
              <div className="absolute inset-0 bg-gradient-hero" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.25),transparent_60%)]" />

              {/* Local video source */}
              {videoUrl && (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  autoPlay
                  controls
                  playsInline
                  className="absolute inset-0 w-full h-full object-contain bg-black z-[1]"
                />
              )}

              {/* Center placeholder (only when no video) */}
              {!videoUrl && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-20 h-20 rounded-full glass grid place-items-center neon-border animate-pulse-glow">
                      <Video className="w-9 h-9 text-primary" />
                    </div>
                    <div className="font-display text-lg tracking-widest text-foreground/80">
                      WAITING FOR SIGNAL
                    </div>
                    <div className="text-xs text-muted-foreground max-w-xs">
                      {isViewerRoute
                        ? "Waiting for the host to start streaming…"
                        : "Configure OBS with your RTMP URL and Stream Key below, or upload a movie file."}
                    </div>
                  </div>
                </div>
              )}

              {/* Webcam PiP overlay (draggable) */}
              {camOn && (
                <div
                  onPointerDown={onCamPointerDown}
                  onPointerMove={onCamPointerMove}
                  onPointerUp={onCamPointerUp}
                  style={{ left: camPos.x, top: camPos.y }}
                  className="absolute z-[3] w-32 h-32 rounded-full overflow-hidden border-2 border-primary/70 shadow-neon cursor-grab active:cursor-grabbing bg-black"
                >
                  <video
                    ref={camVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover pointer-events-none"
                  />
                </div>
              )}

              {/* LIVE badge */}
              <div className="absolute top-4 left-4 z-[2] flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/90 backdrop-blur-sm shadow-neon">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                </span>
                <span className="font-display text-xs font-bold text-white tracking-widest">
                  LIVE
                </span>
              </div>

              {/* Viewer counter */}
              <div className="absolute top-4 right-4 z-[2] flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-white/10">
                <Users className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium tabular-nums">1,245 watching</span>
              </div>

              {/* Bottom bar */}
              <div className="absolute bottom-0 inset-x-0 z-[2] p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between pointer-events-none">
                <div className="text-sm">
                  <div className="font-semibold">{picked?.title ?? "My First Livestream"}</div>
                  <div className="text-xs text-muted-foreground">{videoUrl ? "Playing locally" : "Starting soon…"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/10 text-muted-foreground uppercase tracking-wider">
                    1080p · 60fps
                  </div>
                </div>
              </div>
            </Card>

            {/* Webcam toggle — host only */}
            {isHost && (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={toggleCam}
                  variant={camOn ? "default" : "outline"}
                  className={camOn ? "bg-gradient-red shadow-neon" : ""}
                >
                  {camOn ? <><CameraOff className="w-4 h-4 mr-2" /> Stop Camera & Mic</> : <><Camera className="w-4 h-4 mr-2" /> Toggle Web Camera & Mic</>}
                </Button>
                {camOn && <span className="text-xs text-muted-foreground">Drag the circular preview on the player to reposition</span>}
              </div>
            )}

            {/* Stream Settings (LIVE) */}
            {isHost && mode === "live" && (
            <Card className="p-4 md:p-6 bg-card/60 backdrop-blur border-border/60">
              <Tabs defaultValue="stream">
                <TabsList className="bg-secondary/40">
                  <TabsTrigger value="stream" className="gap-2">
                    <Settings className="w-4 h-4" /> Stream Settings
                  </TabsTrigger>
                  <TabsTrigger value="info">Stream Info</TabsTrigger>
                </TabsList>

                <TabsContent value="stream" className="mt-5 space-y-5">
                  <div className="text-xs text-muted-foreground">
                    Paste these values into OBS → Settings → Stream to connect.
                  </div>

                  {/* RTMP URL */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      RTMP Server URL
                    </label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={RTMP_URL}
                        className="font-mono text-sm bg-background/60"
                      />
                      <Button
                        variant="secondary"
                        onClick={() => copy(RTMP_URL, "RTMP URL")}
                        className="shrink-0"
                      >
                        <Copy className="w-4 h-4 mr-2" /> Copy
                      </Button>
                    </div>
                  </div>

                  {/* Stream Key */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Stream Key <span className="text-primary">(keep private)</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          readOnly
                          type={showKey ? "text" : "password"}
                          value={STREAM_KEY}
                          className="font-mono text-sm bg-background/60 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey((s) => !s)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={showKey ? "Hide key" : "Show key"}
                        >
                          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <Button
                        onClick={() => copy(STREAM_KEY, "Stream key")}
                        className="shrink-0 bg-gradient-red hover:opacity-90 shadow-neon"
                      >
                        <Copy className="w-4 h-4 mr-2" /> Copy
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Never share your stream key. Rotate it if you suspect it's compromised.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="info" className="mt-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Bitrate", value: "6000 kbps" },
                      { label: "Resolution", value: "1920×1080" },
                      { label: "FPS", value: "60" },
                      { label: "Codec", value: "H.264" },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg glass p-3">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {s.label}
                        </div>
                        <div className="font-display text-lg neon-text">{s.value}</div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
            )}

            {/* UPLOAD & STREAM MOVIE */}
            {isHost && mode === "upload" && (
              <div className="space-y-6">
                {/* TMDB SEARCH */}
                <Card className="p-5 md:p-6 bg-card/60 backdrop-blur border-border/60">
                  <label className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" /> Search Movie on TMDB
                  </label>
                  {/* Content kind toggle */}
                  <div className="inline-flex p-1 mb-3 rounded-lg glass border border-border/60 gap-1">
                    {(["movie", "series"] as const).map((k) => (
                      <button
                        key={k}
                        onClick={() => setContentKind(k)}
                        className={`px-3 py-1.5 rounded-md text-xs font-display tracking-wider transition-all ${
                          contentKind === k ? "bg-gradient-red text-white shadow-neon" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {k === "movie" ? "MOVIE" : "SERIES / EPISODE"}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. Inception, Interstellar…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchTmdb())}
                      className="bg-background/60"
                    />
                    <Button onClick={searchTmdb} disabled={searching} className="min-w-[110px] bg-gradient-red shadow-neon">
                      {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      <span className="ml-2">Search</span>
                    </Button>
                  </div>

                  {contentKind === "series" && (
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div>
                        <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Season</label>
                        <Input type="number" min={1} value={season} onChange={(e) => setSeason(e.target.value)} className="bg-background/60" />
                      </div>
                      <div>
                        <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Episode</label>
                        <Input type="number" min={1} value={episode} onChange={(e) => setEpisode(e.target.value)} className="bg-background/60" />
                      </div>
                      {dupeInfo && (
                        <div className="col-span-2 flex items-start gap-3 p-3 rounded-lg border border-destructive/60 bg-destructive/10 text-destructive">
                          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                          <div className="text-xs leading-relaxed">
                            <strong className="block font-display tracking-wider text-sm">EPISODE ALREADY EXISTS</strong>
                            S{dupeInfo.season}·E{dupeInfo.episode} is already in the library. You left off at Episode {dupeInfo.nextEp - 1} — please upload Episode {dupeInfo.nextEp}.
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {results.length > 0 && !picked && (
                    <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {results.map((r) => (
                        <button
                          key={r.tmdb_id}
                          onClick={() => setPicked(r)}
                          className="group text-left rounded-xl overflow-hidden border border-border/50 bg-background/40 hover:border-primary/60 hover:shadow-neon transition-all"
                        >
                          <div className="aspect-[2/3] bg-muted/30 overflow-hidden">
                            {r.poster_url ? (
                              <img src={r.poster_url} alt={r.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                <Film className="h-8 w-8" />
                              </div>
                            )}
                          </div>
                          <div className="p-2">
                            <p className="text-xs font-medium line-clamp-1">{r.title}</p>
                            <p className="text-[10px] text-muted-foreground">{r.year ?? "—"}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </Card>

                {/* PREVIEW CARD */}
                {picked && (
                  <Card className="p-5 md:p-6 border-primary/40 bg-gradient-to-br from-card/70 to-primary/5 backdrop-blur-xl shadow-neon">
                    <div className="flex justify-between items-start mb-4">
                      <Badge variant="outline" className="border-primary/50 text-primary">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Selected from TMDB
                      </Badge>
                      <Button size="icon" variant="ghost" onClick={() => setPicked(null)} className="h-8 w-8">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-col md:flex-row gap-5">
                      <div className="w-32 md:w-40 flex-shrink-0 aspect-[2/3] rounded-lg overflow-hidden border border-border/50 bg-muted/30">
                        {picked.poster_url ? (
                          <img src={picked.poster_url} alt={picked.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <Film className="h-10 w-10" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-2 min-w-0">
                        <h2 className="font-display text-2xl tracking-wide neon-text">{picked.title}</h2>
                        <div className="flex flex-wrap gap-2">
                          {picked.year && <Badge variant="secondary">{picked.year}</Badge>}
                          {picked.genre?.split(",").map((g) => (
                            <Badge key={g} variant="outline" className="border-border/60">{g.trim()}</Badge>
                          ))}
                        </div>
                        {picked.description && (
                          <p className="text-sm text-muted-foreground line-clamp-4">{picked.description}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground/70">TMDB ID: {picked.tmdb_id}</p>
                      </div>
                    </div>
                  </Card>
                )}

                {/* FILE UPLOADER */}
                <Card className="p-5 md:p-6 bg-card/60 backdrop-blur border-border/60">
                  <label className="text-sm font-medium mb-3 flex items-center gap-2">
                    <UploadCloud className="h-4 w-4 text-primary" /> Upload Video File from Device
                  </label>
                  <label
                    onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={onDrop}
                    className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-all py-10 px-6 text-center ${
                      drag ? "border-primary bg-primary/10 shadow-neon" : "border-border/60 bg-background/30 hover:border-primary/60 hover:bg-primary/5"
                    }`}
                  >
                    <input
                      type="file"
                      accept="video/mp4,video/x-matroska,video/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                    <div className="h-14 w-14 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center">
                      <UploadCloud className="h-7 w-7 text-primary" />
                    </div>
                    {file ? (
                      <>
                        <p className="font-medium text-sm">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{fileSize} · Ready to publish</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium">Drag & drop your movie file here</p>
                        <p className="text-xs text-muted-foreground">MP4 · MKV · MOV — or click to browse</p>
                      </>
                    )}
                  </label>
                  {file && (
                    <div className="mt-3 flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                        <X className="h-3 w-3 mr-1" /> Remove file
                      </Button>
                    </div>
                  )}
                </Card>

                {/* AMBIENT AUDIO EFFECTS */}
                <Card className="p-5 md:p-6 bg-card/60 backdrop-blur border-border/60">
                  <label className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-primary" /> Ambient Audio Effects
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {AMBIENT_TRACKS.map((t) => {
                      const st = ambient[t.file];
                      return (
                        <div key={t.file} className={`rounded-xl p-3 border transition-all ${st.on ? "border-primary/50 bg-primary/5 shadow-[0_0_20px_hsl(var(--primary)/0.15)]" : "border-border/50 bg-background/30"}`}>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-sm font-medium">{t.label}</span>
                            <Button
                              size="icon"
                              variant={st.on ? "default" : "outline"}
                              onClick={() => setAmbient((a) => ({ ...a, [t.file]: { ...a[t.file], on: !a[t.file].on } }))}
                              className={`h-8 w-8 ${st.on ? "bg-gradient-red shadow-neon" : ""}`}
                              aria-label={st.on ? "Pause" : "Play"}
                            >
                              {st.on ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </Button>
                          </div>
                          <Slider
                            value={[st.vol]}
                            min={0}
                            max={100}
                            step={1}
                            onValueChange={(v) => setAmbient((a) => ({ ...a, [t.file]: { ...a[t.file], vol: v[0] ?? 0 } }))}
                            disabled={!st.on}
                          />
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* SUBMIT */}
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    {picked && file
                      ? "Everything looks good — hit publish to add this to your library."
                      : "Pick a TMDB match and attach a video file to enable publishing."}
                  </p>
                  <div className="flex gap-2">
                    {done && (
                      <Button variant="outline" onClick={resetUpload}>Upload another</Button>
                    )}
                    <Button
                      size="lg"
                      disabled={!canPublish}
                      onClick={publish}
                      className="min-w-[220px] bg-gradient-red shadow-neon"
                    >
                      {publishing ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Publishing…</>
                      ) : done ? (
                        <><CheckCircle2 className="h-4 w-4 mr-2" /> Published</>
                      ) : (
                        <><UploadCloud className="h-4 w-4 mr-2" /> Publish to My Library</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Chat */}
          <Card className="flex flex-col bg-card/60 backdrop-blur border-border/60 h-[720px] lg:sticky lg:top-20 overflow-hidden">
            <div className="p-4 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <h2 className="font-display tracking-wider text-sm">LIVE CHAT</h2>
              </div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                1,245 online
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
              {messages.map((m) => (
                <div key={m.id} className="text-sm leading-snug animate-float-up">
                  <span className={`font-semibold mr-2 ${m.color}`}>{m.user}</span>
                  <span className="text-foreground/90">{m.text}</span>
                </div>
              ))}
            </div>

            {/* Reactions bar */}
            <div className="px-3 py-2 border-t border-border/60 flex items-center gap-1 overflow-x-auto scrollbar-hide">
              {REACTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => send(e)}
                  className="text-xl hover:scale-125 transition-transform shrink-0 px-1"
                  title={`React ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
              className="p-3 border-t border-border/60 flex items-center gap-2"
            >
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Say something…"
                className="bg-background/60"
                maxLength={240}
              />
              <Button
                type="submit"
                size="icon"
                className="bg-gradient-red shadow-neon shrink-0"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}