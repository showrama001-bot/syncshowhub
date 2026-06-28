import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface Props {
  src: string;
  poster?: string;
  title?: string;
  onEnded?: () => void;
}

const AD_TRIGGER_SECONDS = 10;
const AD_LOCK_SECONDS = 10;

export const BunnyVideoPlayer = ({ src, poster, title, onEnded }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [adVisible, setAdVisible] = useState(false);
  const [adShown, setAdShown] = useState(false);
  const [countdown, setCountdown] = useState(AD_LOCK_SECONDS);

  // Reset on src change.
  useEffect(() => {
    setAdVisible(false);
    setAdShown(false);
    setCountdown(AD_LOCK_SECONDS);
  }, [src]);

  // Detect 10s of playback to trigger the ad.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      if (!adShown && video.currentTime >= AD_TRIGGER_SECONDS) {
        setAdShown(true);
        setAdVisible(true);
        setCountdown(AD_LOCK_SECONDS);
        try { video.pause(); } catch {}
      }
    };
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [adShown]);

  // Countdown while ad is visible.
  useEffect(() => {
    if (!adVisible) return;
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [adVisible, countdown]);

  const closeAd = () => {
    if (countdown > 0) return;
    setAdVisible(false);
    const v = videoRef.current;
    if (!v) return;
    // Some browsers (Firefox in restricted contexts) throw a synchronous
    // "Permission denied for function" when play() is invoked without a
    // direct user gesture. Wrap both branches so the overlay still closes.
    try {
      const p = v.play();
      if (p && typeof (p as any).catch === "function") (p as Promise<void>).catch(() => {});
    } catch {
      /* user can press the play button on the controls — overlay is gone */
    }
  };

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
      {adVisible && (
        <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-xl rounded-2xl border border-border/50 bg-gradient-to-br from-background to-card p-6 md:p-8 text-center shadow-neon">
            {countdown <= 0 ? (
              <button
                onClick={closeAd}
                aria-label="Close ad"
                className="absolute top-3 right-3 h-9 w-9 rounded-full bg-background/80 hover:bg-primary/20 border border-border/60 flex items-center justify-center transition"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <div className="absolute top-3 right-3 h-9 min-w-9 px-3 rounded-full bg-primary/15 border border-primary/40 text-primary text-sm font-semibold flex items-center justify-center">
                {countdown}s
              </div>
            )}
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Sponsored</div>
            <h3 className="font-display text-2xl md:text-3xl tracking-wider mb-3">
              Enjoying {title || "the show"}?
            </h3>
            <p className="text-sm md:text-base text-muted-foreground mb-6">
              Support the platform — your video will resume right after this short message.
            </p>
            <div className="aspect-video w-full rounded-xl bg-gradient-red/20 border border-primary/30 grid place-items-center text-primary/80 text-sm">
              Your ad here
            </div>
            <div className="mt-5 text-xs text-muted-foreground">
              {countdown > 0
                ? `You can skip this ad in ${countdown}s`
                : "You can now close this ad"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};