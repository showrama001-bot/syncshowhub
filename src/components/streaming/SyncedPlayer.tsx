import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  roomId: string;
  src: string;
  poster?: string;
  isHost: boolean;
}

/**
 * Native HTML5 player synchronized across a Watch Together room via a
 * Supabase Realtime broadcast channel. Host is authoritative — guests apply
 * events with drift correction.
 */
export function SyncedPlayer({ roomId, src, poster, isHost }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const suppressRef = useRef(false); // ignore events we just applied
  const [needsTap, setNeedsTap] = useState(false); // guest autoplay blocked
  const [muted, setMuted] = useState(!isHost); // guests start muted so autoplay works
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [retryNonce, setRetryNonce] = useState(0);
  const [readyCount, setReadyCount] = useState(1);
  const [totalCount, setTotalCount] = useState(1);
  const viewerIdRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random())
  );
  const readyPeersRef = useRef<Set<string>>(new Set());
  const srcTokenRef = useRef<string>("");

  // Attach source (HLS or native).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    let hls: Hls | null = null;
    if (/\.m3u8(\?|$)/i.test(src) && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(v);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data?.fatal) setStatus("failed");
      });
    } else {
      v.src = src;
    }
    try { v.load(); } catch {}
    // Reset ready state on every source switch and announce loading.
    setStatus("loading");
    srcTokenRef.current = src;
    readyPeersRef.current = new Set([viewerIdRef.current]);
    setReadyCount(1);
    channelRef.current?.send({
      type: "broadcast",
      event: "viewer-loading",
      payload: { viewerId: viewerIdRef.current, src },
    });
    // Auto-start playback on channel/content switch so all viewers resume
    // together. Guests fall back to muted autoplay if the browser blocks it.
    const startPlayback = () => {
      v.play().catch(() => {
        if (!isHost) {
          v.muted = true;
          setMuted(true);
          v.play().catch(() => setNeedsTap(true));
        }
      });
    };
    const onCanPlay = () => {
      startPlayback();
      setStatus("ready");
      readyPeersRef.current.add(viewerIdRef.current);
      setReadyCount(readyPeersRef.current.size);
      channelRef.current?.send({
        type: "broadcast",
        event: "viewer-ready",
        payload: { viewerId: viewerIdRef.current, src },
      });
    };
    const onError = () => setStatus("failed");
    v.addEventListener("canplay", onCanPlay, { once: true });
    v.addEventListener("error", onError);
    // Playback timeout: 15s to reach canplay, else mark failed.
    const timeoutId = window.setTimeout(() => {
      if (v.readyState < 3) setStatus((s) => (s === "ready" ? s : "failed"));
    }, 15000);
    return () => {
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("error", onError);
      window.clearTimeout(timeoutId);
      hls?.destroy();
    };
  }, [src, isHost, retryNonce]);

  // Realtime sync channel.
  useEffect(() => {
    if (!roomId) return;
    const ch = supabase.channel(`sync:${roomId}`, { config: { broadcast: { self: false } } });
    channelRef.current = ch;

    const apply = (payload: any) => {
      const v = videoRef.current;
      if (!v || !payload) return;
      suppressRef.current = true;
      try {
        if (typeof payload.time === "number") {
          const drift = Math.abs(v.currentTime - payload.time);
          if (drift > 1.2) v.currentTime = payload.time;
        }
        if (payload.action === "play") {
          v.play().catch(() => {
            // Autoplay blocked — try muted, then surface tap-to-play if still blocked.
            if (!isHost) {
              v.muted = true;
              setMuted(true);
              v.play().catch(() => setNeedsTap(true));
            }
          });
        }
        else if (payload.action === "pause") v.pause();
      } finally {
        setTimeout(() => { suppressRef.current = false; }, 250);
      }
    };

    ch.on("broadcast", { event: "state" }, ({ payload }) => apply(payload));

    // Track per-viewer readiness so everyone can see the sync status.
    ch.on("broadcast", { event: "viewer-loading" }, ({ payload }) => {
      if (!payload?.viewerId) return;
      if (payload.src && srcTokenRef.current && payload.src !== srcTokenRef.current) return;
      readyPeersRef.current.delete(payload.viewerId);
      setReadyCount(readyPeersRef.current.size);
    });
    ch.on("broadcast", { event: "viewer-ready" }, ({ payload }) => {
      if (!payload?.viewerId) return;
      if (payload.src && srcTokenRef.current && payload.src !== srcTokenRef.current) return;
      readyPeersRef.current.add(payload.viewerId);
      setReadyCount(readyPeersRef.current.size);
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      setTotalCount(Math.max(1, Object.keys(state).length));
    });

    // Guest asks for current state on join.
    ch.on("broadcast", { event: "sync-req" }, () => {
      if (!isHost) return;
      const v = videoRef.current;
      if (!v) return;
      ch.send({ type: "broadcast", event: "state", payload: {
        action: v.paused ? "pause" : "play", time: v.currentTime,
      }});
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED" && !isHost) {
        ch.send({ type: "broadcast", event: "sync-req", payload: {} });
      }
      if (status === "SUBSCRIBED") {
        try {
          await ch.track({ viewerId: viewerIdRef.current, at: Date.now() });
        } catch {}
      }
    });

    return () => { supabase.removeChannel(ch); };
  }, [roomId, isHost]);

  // Host emits state changes.
  useEffect(() => {
    if (!isHost) return;
    const v = videoRef.current;
    const ch = channelRef.current;
    if (!v || !ch) return;
    const emit = (action: string) => {
      if (suppressRef.current) return;
      ch.send({ type: "broadcast", event: "state", payload: { action, time: v.currentTime }});
    };
    const onPlay = () => emit("play");
    const onPause = () => emit("pause");
    const onSeeked = () => emit(v.paused ? "pause" : "play");
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("seeked", onSeeked);
    // Heartbeat every 5s so guests self-correct drift.
    const hb = setInterval(() => emit(v.paused ? "pause" : "play"), 5000);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("seeked", onSeeked);
      clearInterval(hb);
    };
  }, [isHost, src]);

  // Guest tap: satisfies user-gesture requirement so playback (and unmuting) works.
  const handleGuestTap = () => {
    const v = videoRef.current;
    if (!v) return;
    v.play().then(() => setNeedsTap(false)).catch(() => {});
  };
  const unmute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    setMuted(false);
    v.play().catch(() => {});
  };

  const retry = () => {
    setStatus("loading");
    setRetryNonce((n) => n + 1);
  };

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-card player-shell">
      <video
        ref={videoRef}
        poster={poster}
        controls={isHost}
        playsInline
        muted={muted}
        controlsList="nodownload noremoteplayback noplaybackrate"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        onClick={isHost ? undefined : handleGuestTap}
        className="w-full h-full bg-black"
      />
      {/* Sync status badge — visible to everyone */}
      <div
        className={`absolute top-2 right-2 z-30 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest flex items-center gap-1.5 backdrop-blur ${
          status === "loading"
            ? "bg-amber-500/25 text-amber-200 border border-amber-400/40"
            : status === "failed"
            ? "bg-red-500/25 text-red-200 border border-red-400/40"
            : "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40"
        }`}
        aria-live="polite"
      >
        {status === "loading" ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" />
            Loading channel… {readyCount}/{totalCount} ready
          </>
        ) : status === "failed" ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-red-300" />
            Stream failed
          </>
        ) : readyCount < totalCount ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" />
            Waiting for viewers… {readyCount}/{totalCount} ready
          </>
        ) : (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            In sync · {totalCount} watching
          </>
        )}
      </div>
      {status === "loading" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 pointer-events-none">
          <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-black/70 border border-white/10 text-white text-sm">
            <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            {isHost ? "Loading new channel…" : "Host switched channel — loading…"}
          </div>
        </div>
      )}
      {status === "failed" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/80 text-center p-4">
          <div className="text-white font-semibold">Stream failed to load</div>
          <div className="text-xs text-white/70 max-w-xs">
            The live stream didn't respond in time. Retry, or ask the host to switch to a different channel.
          </div>
          <button
            type="button"
            onClick={retry}
            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-neon hover:opacity-90"
          >
            Retry playback
          </button>
        </div>
      )}
      {!isHost && (
        <>
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] uppercase tracking-widest">
            Synced with host
          </div>
          {needsTap && (
            <button
              type="button"
              onClick={handleGuestTap}
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 text-white"
            >
              <span className="px-4 py-2 rounded-full bg-primary/90 text-sm font-semibold shadow-neon">
                Tap to join playback
              </span>
            </button>
          )}
          {!needsTap && muted && (
            <button
              type="button"
              onClick={unmute}
              className="absolute bottom-3 left-3 z-20 px-3 py-1.5 rounded-full bg-black/70 text-white text-xs font-semibold hover:bg-black/85"
            >
              🔇 Tap to unmute
            </button>
          )}
        </>
      )}
      <div
        aria-hidden="true"
        className="absolute bottom-0 right-0 h-12 w-14 z-10 pointer-events-auto"
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}