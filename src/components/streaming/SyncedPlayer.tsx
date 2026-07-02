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

  // Attach source (HLS or native).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    let hls: Hls | null = null;
    if (/\.m3u8(\?|$)/i.test(src) && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(v);
    } else {
      v.src = src;
    }
    try { v.load(); } catch {}
    return () => { hls?.destroy(); };
  }, [src]);

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

    // Guest asks for current state on join.
    ch.on("broadcast", { event: "sync-req" }, () => {
      if (!isHost) return;
      const v = videoRef.current;
      if (!v) return;
      ch.send({ type: "broadcast", event: "state", payload: {
        action: v.paused ? "pause" : "play", time: v.currentTime,
      }});
    });

    ch.subscribe((status) => {
      if (status === "SUBSCRIBED" && !isHost) {
        ch.send({ type: "broadcast", event: "sync-req", payload: {} });
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