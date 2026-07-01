import { useEffect, useRef } from "react";

interface Props {
  src: string;
  poster?: string;
  title?: string;
  onEnded?: () => void;
}

export const BunnyVideoPlayer = ({ src, poster, title: _title, onEnded }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Reset on src change (autoplay-safe, best-effort).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    try { v.load(); } catch {}
  }, [src]);

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-card player-shell">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        playsInline
        controlsList="nodownload noremoteplayback noplaybackrate"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        onEnded={onEnded}
        className="w-full h-full bg-black"
      />
      {/* Transparent overlay strip over the bottom-right of the controls bar
          to deter the kebab "Save video as" menu without blocking play/seek. */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 right-0 h-12 w-14 z-10 pointer-events-auto"
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};