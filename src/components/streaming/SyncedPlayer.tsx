import { useEffect, useRef } from "react";
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
        if (payload.action === "play") v.play().catch(() => {});
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

  // Guests can't seek/play/pause independently.
  const guestGuard = (e: React.SyntheticEvent) => {
    if (!isHost) e.preventDefault();
  };

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-card player-shell">
      <video
        ref={videoRef}
        poster={poster}
        controls={isHost}
        playsInline
        controlsList="nodownload noremoteplayback noplaybackrate"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        onClick={guestGuard}
        className="w-full h-full bg-black"
      />
      {!isHost && (
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] uppercase tracking-widest">
          Synced with host
        </div>
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