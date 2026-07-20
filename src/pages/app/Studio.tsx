import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Radio, Upload, Search, Film, Loader2, Video, VideoOff, Mic, MicOff, StopCircle,
  AlertTriangle, CheckCircle2, Send, Volume2, VolumeX, Maximize2,
} from "lucide-react";
import { HostSoundboard, type AmbientState } from "@/components/studio/HostSoundboard";
import { ViewerAmbientSync } from "@/components/studio/ViewerAmbientSync";
import { InviteFriendsPanel } from "@/components/studio/InviteFriendsPanel";
import { uploadToStudioTelegram, STUDIO_TELEGRAM_MAX_BYTES } from "@/lib/studioTelegramUpload";

type Meta = {
  tmdb_id?: number; title?: string; description?: string;
  poster_url?: string | null; backdrop_url?: string | null;
  year?: number | null; genre?: string | null;
  duration_minutes?: number | null; rating?: number | null; imdb_rating?: number | null;
};

type ChatMsg = {
  id: string; user_id: string; body: string; created_at: string;
  display_name?: string;
};

/** /studio (host) and /live-stream?stream=... (viewer) share this component. */
export default function Studio() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  const [sp] = useSearchParams();
  const viewerMode = loc.pathname.startsWith("/live-stream");
  const streamIdParam = sp.get("stream");

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return viewerMode
    ? <ViewerView streamId={streamIdParam} />
    : <HostView userId={user.id} />;
}

/* ------------------------------ HOST VIEW ------------------------------- */

function HostView({ userId }: { userId: string }) {
  const [mode, setMode] = useState<"obs" | "upload">("obs");
  const [streamId, setStreamId] = useState<string | null>(null);
  const [streamRow, setStreamRow] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [rtmpKey, setRtmpKey] = useState("");
  const [rtmpUrl] = useState("rtmp://ingest.syncshow.live/live");
  const [showKey, setShowKey] = useState(false);
  const [ambient, setAmbient] = useState<AmbientState>({});

  // Load an existing live stream owned by the user (resume).
  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("studio_streams" as any) as any)
        .select("*")
        .eq("host_id", userId).eq("status", "live")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (data) {
        setStreamRow(data);
        setStreamId(data.id);
        setTitle(data.title);
        setAmbient((data.ambient_state as AmbientState) || {});
        setMode(data.mode === "upload" ? "upload" : "obs");
      }
    })();
  }, [userId]);

  const goLive = useCallback(async (opts: { mode: "obs" | "upload"; stream_url?: string | null; title: string; poster_url?: string | null; tmdb_id?: number | null; }) => {
    if (opts.title.trim().length < 3) { toast.error("Give your stream a title"); return null; }
    const { data, error } = await (supabase.from("studio_streams" as any) as any)
      .insert({
        host_id: userId,
        title: opts.title.trim(),
        mode: opts.mode,
        stream_url: opts.stream_url ?? null,
        poster_url: opts.poster_url ?? null,
        tmdb_id: opts.tmdb_id ?? null,
        status: "live",
      })
      .select("*").maybeSingle();
    if (error || !data) { toast.error(error?.message || "Could not start stream"); return null; }
    setStreamRow(data); setStreamId(data.id);
    toast.success("You're live!");
    // Generate a fresh RTMP key for OBS mode.
    if (opts.mode === "obs") setRtmpKey(`sk_${data.id.replace(/-/g, "").slice(0, 24)}`);
    return data;
  }, [userId]);

  const endLive = async () => {
    if (!streamId) return;
    await (supabase.from("studio_streams" as any) as any)
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", streamId);
    // Stop all ambient audio server-side too.
    setStreamRow(null); setStreamId(null); setAmbient({});
    toast("Stream ended");
  };

  return (
    <div className="pt-20 pb-16 px-4 md:px-8 max-w-[1400px] mx-auto">
      <header className="mb-6 flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl md:text-5xl tracking-wider neon-text flex items-center gap-3">
            <Radio className="h-7 w-7 text-red-500" /> Live Control Center
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {streamId ? "You're live — controls below sync to every viewer in real time." : "Configure your stream, then hit Go Live."}
          </p>
        </div>
        {streamId && (
          <div className="ml-auto flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-red-500/90 text-white text-xs font-semibold animate-pulse">LIVE</span>
            <Button variant="destructive" size="sm" onClick={endLive}>
              <StopCircle className="h-4 w-4 mr-1" /> End stream
            </Button>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Player + controls */}
        <div className="space-y-4">
          <PlayerStage streamRow={streamRow} isHost />

          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="obs" disabled={!!streamId && streamRow?.mode !== "obs"}>
                <Radio className="h-4 w-4 mr-2" /> Live Stream (OBS)
              </TabsTrigger>
              <TabsTrigger value="upload" disabled={!!streamId && streamRow?.mode !== "upload"}>
                <Film className="h-4 w-4 mr-2" /> Upload & Stream Movie
              </TabsTrigger>
            </TabsList>

            <TabsContent value="obs" className="mt-4">
              <ObsPanel
                streamId={streamId} title={title} setTitle={setTitle}
                rtmpUrl={rtmpUrl} rtmpKey={rtmpKey} showKey={showKey} setShowKey={setShowKey}
                onGoLive={() => goLive({ mode: "obs", title })}
              />
            </TabsContent>

            <TabsContent value="upload" className="mt-4">
              <UploadPanel
                streamId={streamId}
                onGoLiveWithFile={async ({ file, meta, isSeries, season, episode }) => {
                  if (isSeries && meta.tmdb_id) {
                    // Duplicate episode guard.
                    const { data: series } = await supabase.from("series")
                      .select("id").eq("tmdb_id", meta.tmdb_id).maybeSingle();
                    if (series?.id) {
                      const { data: eps } = await (supabase.from("episodes" as any) as any)
                        .select("season_number, episode_number")
                        .eq("series_id", series.id);
                      const exists = (eps || []).some((e: any) => e.season_number === season && e.episode_number === episode);
                      if (exists) {
                        const maxEp = Math.max(0, ...((eps || []).filter((e: any) => e.season_number === season).map((e: any) => e.episode_number)));
                        toast.error(`This episode already exists in the library! You left off at Episode ${maxEp}, please upload the next episode.`);
                        return;
                      }
                    }
                  } else if (!isSeries && meta.tmdb_id) {
                    const { data: dup } = await supabase.from("movies").select("id,title").eq("tmdb_id", meta.tmdb_id).maybeSingle();
                    if (dup) { toast.error(`"${dup.title}" already exists in the library.`); return; }
                  }
                  // Upload to Telegram, then create the live stream pointing at the resulting URL.
                  const res = await uploadToStudioTelegram(file, meta.title || "Studio upload");
                  const streamRow = await goLive({
                    mode: "upload", title: meta.title || title || "Live movie",
                    stream_url: res.stream_url, poster_url: meta.poster_url ?? null, tmdb_id: meta.tmdb_id ?? null,
                  });
                  // Publish movie to the global catalog so it appears on Home + Movies immediately.
                  if (streamRow && !isSeries && meta.title) {
                    const { error: movErr } = await supabase.from("movies").insert({
                      title: meta.title,
                      description: meta.description ?? null,
                      poster_url: meta.poster_url ?? null,
                      backdrop_url: meta.backdrop_url ?? meta.poster_url ?? null,
                      stream_url: res.stream_url,
                      stream_sources: [{ url: res.stream_url, source_type: "hls", label: "Studio" }] as any,
                      source_type: "hls",
                      genre: meta.genre ?? null,
                      year: meta.year ?? null,
                      duration_minutes: meta.duration_minutes ?? null,
                      rating: meta.rating ?? null,
                      imdb_rating: meta.imdb_rating ?? null,
                      tmdb_id: meta.tmdb_id ?? null,
                      created_by: userId,
                      status: "published",
                      is_admin_upload: false,
                      provider: "studio",
                    } as any);
                    if (movErr) toast.error(`Movie catalog insert failed: ${movErr.message}`);
                    else toast.success("Movie published to catalog");
                  }
                }}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar: soundboard + invite + chat (host-only chat participation) */}
        <aside className="space-y-4">
          {streamId ? (
            <>
              <HostSoundboard streamId={streamId} state={ambient} onChange={setAmbient} />
              <InviteFriendsPanel streamId={streamId} />
              <StudioChatPanel streamId={streamId} />
            </>
          ) : (
            <div className="glass rounded-2xl p-6 border border-border/40 text-center text-sm text-muted-foreground">
              Go live to unlock the host soundboard, friend invites, and live chat.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------ OBS panel ------------------------------- */

function ObsPanel({
  streamId, title, setTitle, rtmpUrl, rtmpKey, showKey, setShowKey, onGoLive,
}: {
  streamId: string | null; title: string; setTitle: (v: string) => void;
  rtmpUrl: string; rtmpKey: string; showKey: boolean; setShowKey: (v: boolean) => void;
  onGoLive: () => void;
}) {
  const masked = rtmpKey ? "•".repeat(Math.max(8, rtmpKey.length - 4)) + rtmpKey.slice(-4) : "";
  return (
    <section className="glass rounded-2xl p-6 border border-border/40 space-y-4">
      <div>
        <Label>Stream title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Late-night sci-fi hangout" />
      </div>
      {streamId && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">RTMP URL</Label>
            <Input readOnly value={rtmpUrl} onFocus={(e) => e.currentTarget.select()} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Stream key (host only)</Label>
            <div className="flex gap-2">
              <Input readOnly type={showKey ? "text" : "password"} value={showKey ? rtmpKey : masked} />
              <Button type="button" variant="outline" onClick={() => setShowKey(!showKey)}>{showKey ? "Hide" : "Show"}</Button>
            </div>
          </div>
        </div>
      )}
      {!streamId && (
        <Button className="w-full bg-gradient-red shadow-neon" onClick={onGoLive}>
          <Radio className="h-4 w-4 mr-2" /> Go Live
        </Button>
      )}
    </section>
  );
}

/* --------------------------- Upload panel ------------------------------- */

function UploadPanel({
  streamId, onGoLiveWithFile,
}: {
  streamId: string | null;
  onGoLiveWithFile: (args: { file: File; meta: Meta; isSeries: boolean; season: number; episode: number }) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [tmdbBusy, setTmdbBusy] = useState(false);
  const [meta, setMeta] = useState<Meta>({});
  const [isSeries, setIsSeries] = useState(false);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dropHover, setDropHover] = useState(false);
  const [dupWarn, setDupWarn] = useState<string | null>(null);

  const fetchTmdb = async () => {
    if (!query.trim()) return toast.error("Enter a title first");
    setTmdbBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("tmdb-fetch", {
        body: { query: query.trim(), kind: isSeries ? "series" : "movie" },
      });
      if (error) throw error;
      if (!data || (data as any).error) throw new Error((data as any)?.error || "Not found");
      setMeta(data as Meta);
      toast.success(`Loaded: ${(data as Meta).title}`);
    } catch (e: any) {
      toast.error(e?.message || "TMDB fetch failed");
    } finally { setTmdbBusy(false); }
  };

  // Live duplicate check as user types season/episode.
  useEffect(() => {
    setDupWarn(null);
    if (!isSeries || !meta.tmdb_id) return;
    let cancelled = false;
    (async () => {
      const { data: series } = await supabase.from("series").select("id").eq("tmdb_id", meta.tmdb_id).maybeSingle();
      if (!series?.id) return;
      const { data: eps } = await (supabase.from("episodes" as any) as any)
        .select("season_number, episode_number").eq("series_id", series.id);
      if (cancelled) return;
      const exists = (eps || []).some((e: any) => e.season_number === season && e.episode_number === episode);
      if (exists) {
        const maxEp = Math.max(0, ...((eps || []).filter((e: any) => e.season_number === season).map((e: any) => e.episode_number)));
        setDupWarn(`Season ${season} · Episode ${episode} already exists. Last uploaded: E${maxEp}. Please pick the next one.`);
      }
    })();
    return () => { cancelled = true; };
  }, [isSeries, meta.tmdb_id, season, episode]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDropHover(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const canGo = !!file && !!meta.title && !dupWarn && !busy && !streamId;

  const run = async () => {
    if (!file || !meta.title) return;
    if (file.size > STUDIO_TELEGRAM_MAX_BYTES) {
      return toast.error(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB. Telegram limit is 50 MB.`);
    }
    setBusy(true); setProgress(0);
    try {
      await onGoLiveWithFile({ file, meta, isSeries, season, episode });
      setProgress(100);
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass rounded-2xl p-6 border border-border/40 space-y-4">
      <div className="flex items-center gap-3">
        <Label className="text-xs text-muted-foreground m-0">Kind</Label>
        <div className="flex gap-2">
          {(["movie", "series"] as const).map((k) => (
            <button key={k} type="button"
              onClick={() => setIsSeries(k === "series")}
              className={`px-3 py-1.5 rounded-full text-xs border ${((k === "series") === isSeries) ? "bg-primary/20 border-primary text-primary" : "border-border/50"}`}>
              {k === "series" ? "Series / Episode" : "Movie"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>TMDB search</Label>
        <div className="flex gap-2">
          <Input placeholder={isSeries ? "e.g. Breaking Bad" : "e.g. Inception"} value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), fetchTmdb())}
            disabled={tmdbBusy || busy} />
          <Button onClick={fetchTmdb} disabled={tmdbBusy || busy} type="button">
            {tmdbBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="ml-2">Fetch</span>
          </Button>
        </div>
      </div>

      {meta.title && (
        <div className="rounded-xl border border-border/50 p-3 flex gap-3 bg-background/40">
          {meta.poster_url && <img src={meta.poster_url} alt="" className="w-20 rounded" />}
          <div className="flex-1 text-sm">
            <div className="font-semibold">{meta.title} {meta.year ? <span className="text-muted-foreground">({meta.year})</span> : null}</div>
            <div className="text-xs text-muted-foreground line-clamp-3 mt-1">{meta.description}</div>
          </div>
        </div>
      )}

      {isSeries && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Season</Label>
            <Input type="number" min={1} value={season} onChange={(e) => setSeason(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Episode</Label>
            <Input type="number" min={1} value={episode} onChange={(e) => setEpisode(Math.max(1, Number(e.target.value) || 1))} />
          </div>
        </div>
      )}

      {dupWarn && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/60 bg-red-500/10 p-3 text-sm text-red-200">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{dupWarn}</span>
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDropHover(true); }}
        onDragLeave={() => setDropHover(false)}
        onDrop={onDrop}
        className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${dropHover ? "border-primary bg-primary/5" : "border-border/60"}`}
      >
        <Upload className="h-6 w-6 mx-auto text-primary mb-2" />
        <p className="text-sm">Drop an MP4/MKV file here</p>
        <p className="text-xs text-muted-foreground">or</p>
        <label className="inline-block mt-2">
          <input type="file" accept="video/*" className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={busy} />
          <span className="px-3 py-1.5 rounded-full glass hover:neon-border text-sm cursor-pointer">Choose file</span>
        </label>
        {file && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1 justify-center">
            <CheckCircle2 className="h-3 w-3 text-primary" /> {file.name} — {(file.size / 1024 / 1024).toFixed(1)} MB
          </p>
        )}
      </div>

      {busy && <Progress value={progress} />}

      <Button className="w-full bg-gradient-red shadow-neon" disabled={!canGo} onClick={run}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Radio className="h-4 w-4 mr-2" />}
        Upload & Go Live
      </Button>
    </section>
  );
}

/* ------------------------------ Player stage ---------------------------- */

function PlayerStage({ streamRow, viewerOnly, isHost }: { streamRow: any; viewerOnly?: boolean; isHost?: boolean }) {
  const src: string | null = streamRow?.stream_url || null;
  const streamId: string | null = streamRow?.id || null;
  const mode: "obs" | "upload" = streamRow?.mode === "upload" ? "upload" : "obs";
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [pos, setPos] = useState({ x: 16, y: 16 });
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const camRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const syncChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const suppressRef = useRef(false);
  const lastRemoteRef = useRef<{ action: "play" | "pause"; time: number; at: number } | null>(null);
  const [viewerMuted, setViewerMuted] = useState(true);

  const unmuteViewer = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    if (v.volume < 0.1) v.volume = 1;
    setViewerMuted(false);
    v.play().catch(() => {});
  };
  const muteViewer = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    setViewerMuted(true);
  };
  const viewerFullscreen = () => {
    const v = videoRef.current as any;
    if (!v) return;
    (v.requestFullscreen || v.webkitEnterFullscreen)?.call(v);
  };

  useEffect(() => {
    if (!src || !videoRef.current) return;
    const v = videoRef.current;
    const isHls = /\.m3u8($|\?)/i.test(src);
    if (isHls) {
      // Dynamic import to keep bundle light.
      let hls: any;
      import("hls.js").then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          hls = new Hls();
          hls.loadSource(src); hls.attachMedia(v);
        } else { v.src = src; }
      });
      return () => { try { hls?.destroy(); } catch {} };
    }
    v.src = src;
  }, [src]);

  // Host <-> viewer playback sync via Supabase Realtime broadcast.
  useEffect(() => {
    if (!streamId) return;
    const ch = supabase.channel(`studio-playback:${streamId}`, { config: { broadcast: { self: false } } });
    syncChannelRef.current = ch;
    const applyRemote = (p: any) => {
      const v = videoRef.current;
      if (!v || !p) return;
      suppressRef.current = true;
      try {
        if (typeof p.time === "number" && Math.abs(v.currentTime - p.time) > 1.2) {
          v.currentTime = p.time;
        }
        if (p.action === "play") v.play().catch(() => {});
        else if (p.action === "pause") v.pause();
        if (p.action === "play" || p.action === "pause") {
          lastRemoteRef.current = { action: p.action, time: typeof p.time === "number" ? p.time : v.currentTime, at: Date.now() };
        }
      } finally {
        setTimeout(() => { suppressRef.current = false; }, 250);
      }
    };
    if (!isHost) {
      ch.on("broadcast", { event: "state" }, ({ payload }) => applyRemote(payload));
    } else {
      ch.on("broadcast", { event: "sync-req" }, () => {
        const v = videoRef.current;
        if (!v) return;
        ch.send({ type: "broadcast", event: "state", payload: {
          action: v.paused ? "pause" : "play", time: v.currentTime,
        }});
      });
    }
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED" && !isHost) {
        ch.send({ type: "broadcast", event: "sync-req", payload: {} });
      }
    });
    return () => { supabase.removeChannel(ch); syncChannelRef.current = null; };
  }, [streamId, isHost]);

  // Host emits state changes; viewer requests re-sync if it drifts.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !streamId) return;
    if (isHost) {
      const emit = (action: "play" | "pause") => {
        if (suppressRef.current) return;
        syncChannelRef.current?.send({ type: "broadcast", event: "state", payload: { action, time: v.currentTime }});
      };
      const onPlay = () => emit("play");
      const onPause = () => emit("pause");
      const onSeeked = () => emit(v.paused ? "pause" : "play");
      v.addEventListener("play", onPlay);
      v.addEventListener("pause", onPause);
      v.addEventListener("seeked", onSeeked);
      const hb = setInterval(() => emit(v.paused ? "pause" : "play"), 4000);
      return () => {
        v.removeEventListener("play", onPlay);
        v.removeEventListener("pause", onPause);
        v.removeEventListener("seeked", onSeeked);
        clearInterval(hb);
      };
    } else {
      // Force-sync: any viewer-side play/pause/seek attempt is immediately
      // overridden by the last remote state and a fresh sync-req.
      const snapBack = () => {
        if (suppressRef.current) return;
        const last = lastRemoteRef.current;
        if (last) {
          suppressRef.current = true;
          const projected = last.action === "play" ? last.time + (Date.now() - last.at) / 1000 : last.time;
          try {
            if (Math.abs(v.currentTime - projected) > 0.75) v.currentTime = projected;
            if (last.action === "play") v.play().catch(() => {});
            else v.pause();
          } finally {
            setTimeout(() => { suppressRef.current = false; }, 250);
          }
        }
        syncChannelRef.current?.send({ type: "broadcast", event: "sync-req", payload: {} });
      };
      v.addEventListener("seeking", snapBack);
      v.addEventListener("pause", snapBack);
      v.addEventListener("ratechange", () => { if (v.playbackRate !== 1) v.playbackRate = 1; });
      return () => {
        v.removeEventListener("seeking", snapBack);
        v.removeEventListener("pause", snapBack);
      };
    }
  }, [streamId, isHost, src]);

  const requestCam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = s;
      if (camRef.current) { camRef.current.srcObject = s; camRef.current.play().catch(() => {}); }
      setCamOn(true); setMicOn(true);
    } catch { toast.error("Camera/mic denied"); }
  };
  const stopCam = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false); setMicOn(false);
  };
  const toggleMic = () => {
    const s = streamRef.current;
    if (!s) return;
    const track = s.getAudioTracks()[0]; if (!track) return;
    track.enabled = !track.enabled; setMicOn(track.enabled);
  };
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  const onDragStart = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPos({ x: e.clientX - dragRef.current.dx, y: e.clientY - dragRef.current.dy });
  };
  const onDragEnd = () => { dragRef.current = null; };

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black aspect-video shadow-card">
      {src ? (
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          controls={isHost}
          controlsList={isHost ? undefined : "nodownload noplaybackrate noremoteplayback"}
          disablePictureInPicture={!isHost}
          onContextMenu={(e) => { if (!isHost) e.preventDefault(); }}
          playsInline
          autoPlay
          muted
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground">
          <div className="text-center">
            <Radio className="h-10 w-10 mx-auto mb-2 opacity-60" />
            <div className="font-display tracking-widest text-sm">
              {streamId && mode === "obs"
                ? (isHost ? "READY — POINT OBS AT THE RTMP URL" : "HOST IS LIVE VIA OBS · WAITING FOR INGEST")
                : "WAITING FOR SIGNAL"}
            </div>
          </div>
        </div>
      )}
      {!isHost && src && (
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 text-white text-[10px] uppercase tracking-widest flex items-center gap-1.5 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Locked to host {mode === "upload" ? "· VOD" : "· LIVE"}
        </div>
      )}

      {/* Viewer audio controls (browser blocks autoplay with sound; require a click to unmute) */}
      {!isHost && src && (
        <>
          {viewerMuted && (
            <button
              onClick={unmuteViewer}
              className="absolute inset-0 grid place-items-center bg-black/40 hover:bg-black/50 transition-colors"
              aria-label="Tap to unmute"
            >
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground font-semibold shadow-neon">
                <VolumeX className="h-5 w-5" />
                Tap to unmute
              </div>
            </button>
          )}
          <div className="absolute bottom-3 left-3 flex gap-2">
            <Button size="sm" variant="secondary" onClick={viewerMuted ? unmuteViewer : muteViewer}
              aria-label={viewerMuted ? "Unmute" : "Mute"}>
              {viewerMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="secondary" onClick={viewerFullscreen} aria-label="Fullscreen">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {/* Webcam PiP (host only) */}
      {!viewerOnly && camOn && (
        <div
          onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd}
          style={{ left: pos.x, top: pos.y }}
          className="absolute h-28 w-28 rounded-full overflow-hidden border-2 border-primary shadow-neon cursor-grab active:cursor-grabbing"
        >
          <video ref={camRef} muted playsInline className="w-full h-full object-cover" />
        </div>
      )}

      {/* Host controls overlay */}
      {!viewerOnly && (
        <div className="absolute bottom-3 right-3 flex gap-2">
          {!camOn ? (
            <Button size="sm" variant="secondary" onClick={requestCam}><Video className="h-4 w-4 mr-1" /> Camera</Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={toggleMic}>
                {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="destructive" onClick={stopCam}><VideoOff className="h-4 w-4 mr-1" /> Stop</Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Chat panel ------------------------------ */

function StudioChatPanel({ streamId, viewerOnly }: { streamId: string; viewerOnly?: boolean }) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [body, setBody] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const enrich = async (ids: string[]) => {
    const need = ids.filter((id) => !names[id]);
    if (need.length === 0) return;
    const { data } = await supabase.from("profiles").select("id, display_name, username").in("id", need);
    setNames((prev) => {
      const next = { ...prev };
      (data || []).forEach((p: any) => { next[p.id] = p.display_name || p.username || "User"; });
      return next;
    });
  };

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("studio_chat_messages" as any) as any)
        .select("*").eq("stream_id", streamId).order("created_at", { ascending: true }).limit(200);
      setMsgs((data as ChatMsg[]) || []);
      enrich((data || []).map((m: any) => m.user_id));
    })();
    const ch = supabase
      .channel(`studio-chat:${streamId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "studio_chat_messages", filter: `stream_id=eq.${streamId}` },
        (payload) => {
          const m = payload.new as ChatMsg;
          setMsgs((prev) => [...prev, m]);
          enrich([m.user_id]);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [streamId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);

  const send = async () => {
    const text = body.trim().slice(0, 500);
    if (!text || !user) return;
    setBody("");
    const { error } = await (supabase.from("studio_chat_messages" as any) as any)
      .insert({ stream_id: streamId, user_id: user.id, body: text });
    if (error) toast.error(error.message);
  };

  return (
    <div className={`glass rounded-2xl border border-border/40 flex flex-col ${viewerOnly ? "h-[70vh]" : "h-[420px]"}`}>
      <div className="p-3 border-b border-border/40 font-display text-sm tracking-widest neon-text">LIVE CHAT</div>
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-2 text-sm">
        {msgs.length === 0 && <p className="text-xs text-muted-foreground">Say hi to the room…</p>}
        {msgs.map((m) => (
          <div key={m.id} className="rounded-lg bg-secondary/30 px-2 py-1">
            <span className="text-primary font-semibold text-xs mr-2">{names[m.user_id] || "…"}</span>
            <span className="break-words">{m.body}</span>
          </div>
        ))}
      </div>
      <div className="p-2 border-t border-border/40 flex gap-2">
        <Input value={body} onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), send())}
          placeholder="Message the stream…" maxLength={500} />
        <Button size="icon" onClick={send} className="bg-gradient-red shadow-neon"><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

/* ------------------------------ VIEWER VIEW ----------------------------- */

function ViewerView({ streamId }: { streamId: string | null }) {
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!streamId) { setLoading(false); return; }
    let alive = true;
    (async () => {
      const { data } = await (supabase.from("studio_streams" as any) as any)
        .select("*").eq("id", streamId).maybeSingle();
      if (!alive) return;
      setRow(data); setLoading(false);
    })();
    const ch = supabase
      .channel(`studio-stream:${streamId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "studio_streams", filter: `id=eq.${streamId}` },
        (payload) => setRow(payload.new))
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [streamId]);

  const ambient = useMemo<AmbientState>(() => (row?.ambient_state as AmbientState) || {}, [row]);

  if (loading) return <div className="pt-24 text-center text-muted-foreground">Loading stream…</div>;
  if (!row) return <div className="pt-24 text-center text-muted-foreground">Stream not found.</div>;
  if (row.status !== "live") {
    return (
      <div className="pt-24 text-center">
        <div className="glass rounded-2xl inline-block px-6 py-8">
          <div className="font-display text-xl tracking-widest neon-text mb-2">STREAM ENDED</div>
          <p className="text-sm text-muted-foreground">Thanks for tuning in.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 pb-16 px-4 md:px-8 max-w-[1400px] mx-auto">
      <ViewerAmbientSync state={ambient} />
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-red-500/90 text-white text-xs font-semibold animate-pulse">LIVE</span>
          <h1 className="font-display text-2xl md:text-3xl tracking-wider">{row.title}</h1>
        </div>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <PlayerStage streamRow={row} viewerOnly isHost={false} />
        <aside className="space-y-4">
          <StudioChatPanel streamId={row.id} viewerOnly />
        </aside>
      </div>
    </div>
  );
}