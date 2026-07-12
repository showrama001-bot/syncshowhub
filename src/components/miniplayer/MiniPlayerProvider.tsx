import Hls from "hls.js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { Link } from "react-router-dom";
import { X, PictureInPicture2, Maximize2, Minus } from "lucide-react";
import { useLocalPref } from "@/hooks/useLocalPref";

export type MiniSource = {
  src: string;
  poster?: string;
  title?: string;
  /** deep link back to full page (e.g. /play/movie/123 or /watch/room/xxx) */
  href?: string;
  currentTime?: number;
  muted?: boolean;
};

type Ctx = {
  active: MiniSource | null;
  open: (s: MiniSource) => void;
  close: () => void;
  requestNativePip: () => Promise<void>;
};

const MiniCtx = createContext<Ctx | null>(null);

export function useMiniPlayer(): Ctx {
  const ctx = useContext(MiniCtx);
  if (!ctx) throw new Error("useMiniPlayer must be used within MiniPlayerProvider");
  return ctx;
}

export function MiniPlayerProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<MiniSource | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [collapsed, setCollapsed] = useLocalPref<boolean>("mini_collapsed", false);
  const [volume, setVolume] = useLocalPref<number>("mini_volume", 0.9);
  const [pos, setPos] = useLocalPref<{ x: number; y: number }>("mini_pos", { x: 24, y: 24 });

  const open = useCallback((s: MiniSource) => setActive(s), []);
  const close = useCallback(() => {
    const v = videoRef.current;
    if (v) { try { v.pause(); } catch {} v.srcObject = null; v.removeAttribute("src"); v.load(); }
    hlsRef.current?.destroy();
    hlsRef.current = null;
    setActive(null);
  }, []);

  // Attach source when active changes.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !active) return;
    hlsRef.current?.destroy();
    hlsRef.current = null;
    if (/\.m3u8(\?|$)/i.test(active.src) && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(active.src);
      hls.attachMedia(v);
      hlsRef.current = hls;
    } else {
      v.src = active.src;
    }
    v.volume = volume;
    v.muted = active.muted ?? false;
    const onLoaded = () => {
      if (active.currentTime && active.currentTime > 1) {
        try { v.currentTime = active.currentTime; } catch {}
      }
      v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    };
    v.addEventListener("loadedmetadata", onLoaded, { once: true });
    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
    };
  }, [active]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.volume = volume;
  }, [volume]);

  const requestNativePip = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      // @ts-ignore
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      // @ts-ignore
      else await v.requestPictureInPicture();
    } catch (e) {
      console.warn("[mini] PiP failed", e);
    }
  }, []);

  const ctxValue = useMemo<Ctx>(() => ({ active, open, close, requestNativePip }), [active, open, close, requestNativePip]);

  // Drag support
  const draggingRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = { startX: e.clientX, startY: e.clientY, ox: pos.x, oy: pos.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = draggingRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const maxX = window.innerWidth - 340;
    const maxY = window.innerHeight - 220;
    setPos({
      x: Math.min(Math.max(8, d.ox - dx), maxX),
      y: Math.min(Math.max(8, d.oy - dy), maxY),
    });
  };
  const onPointerUp = () => { draggingRef.current = null; };

  return (
    <MiniCtx.Provider value={ctxValue}>
      {children}
      {active && (
        <div
          className="fixed z-[70] shadow-2xl rounded-xl overflow-hidden border border-white/10 bg-black backdrop-blur"
          style={{
            right: pos.x,
            bottom: pos.y,
            width: collapsed ? 240 : 340,
          }}
        >
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="flex items-center gap-1 px-2 py-1 bg-black/85 text-white text-[11px] cursor-grab active:cursor-grabbing select-none"
          >
            <span className="flex-1 truncate font-semibold">{active.title || "Mini player"}</span>
            <button
              type="button"
              onClick={requestNativePip}
              className="p-1 rounded hover:bg-white/10"
              title="Native Picture-in-Picture"
            >
              <PictureInPicture2 className="h-3.5 w-3.5" />
            </button>
            {active.href && (
              <Link
                to={active.href}
                onClick={close}
                className="p-1 rounded hover:bg-white/10"
                title="Back to full player"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Link>
            )}
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="p-1 rounded hover:bg-white/10"
              title={collapsed ? "Expand" : "Collapse"}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={close}
              className="p-1 rounded hover:bg-white/10"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {!collapsed && (
            <video
              ref={videoRef}
              controls
              playsInline
              poster={active.poster}
              onVolumeChange={(e) => setVolume((e.currentTarget as HTMLVideoElement).volume)}
              className="w-full aspect-video bg-black"
            />
          )}
        </div>
      )}
    </MiniCtx.Provider>
  );
}

/** Small "Pop out" button that opens the given source in the mini-player. */
export function PopoutButton({ get, className }: { get: () => MiniSource | null; className?: string }) {
  const { open } = useMiniPlayer();
  return (
    <button
      type="button"
      onClick={() => { const s = get(); if (s) open(s); }}
      className={className ?? "px-2.5 py-1 rounded-full bg-black/70 text-white text-[11px] font-semibold border border-white/10 hover:bg-black/90 inline-flex items-center gap-1"}
      title="Pop out mini player"
    >
      <PictureInPicture2 className="h-3.5 w-3.5" /> Mini
    </button>
  );
}
