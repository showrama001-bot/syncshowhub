import { useEffect, useRef, useState, ReactNode } from "react";
import { useAds } from "./AdsProvider";
import { ScriptSlot } from "./ScriptSlot";

/**
 * Wraps a content video. Plays a pre-roll ad first (if enabled + asset available),
 * then renders children. Skip button is hidden until countdown elapses.
 */
export const VideoAdPlayer = ({ children }: { children: ReactNode }) => {
  const { enabled, settings, pick } = useAds();
  const adRef = useRef<HTMLVideoElement>(null);
  const [ad] = useState(() => pick("preroll"));
  const [done, setDone] = useState(false);
  const [count, setCount] = useState(settings.preroll_skip_seconds);

  const adActive = enabled && settings.preroll_enabled && ad && !done;

  useEffect(() => {
    if (!adActive) return;
    setCount(settings.preroll_skip_seconds);
    const t = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          clearInterval(t);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [adActive, settings.preroll_skip_seconds]);

  if (!adActive) return <>{children}</>;

  const handleClick = () => {
    if (ad?.redirect_url) window.open(ad.redirect_url, "_blank", "noopener,noreferrer");
  };

  // Network script / VAST tag mode
  if (ad!.ad_mode === "script" && ad!.script_code) {
    return (
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-card">
        <ScriptSlot html={ad!.script_code} className="w-full h-full" />
        <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/70 text-xs uppercase tracking-widest text-yellow-300 border border-yellow-400/50">
          Ad
        </div>
        <div className="absolute bottom-4 right-4">
          {count > 0 ? (
            <div className="px-4 py-2 rounded-l-full bg-black/80 text-sm text-white border border-white/20">
              Skip in <span className="font-bold text-primary">{count}</span>s
            </div>
          ) : (
            <button
              onClick={() => setDone(true)}
              className="px-4 py-2 rounded-l-full bg-white text-black text-sm font-semibold hover:bg-primary hover:text-primary-foreground transition"
            >
              Skip Ad ▶
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-card">
      <video
        ref={adRef}
        src={ad!.media_url ?? undefined}
        autoPlay
        playsInline
        controls={false}
        onEnded={() => setDone(true)}
        onClick={handleClick}
        className="w-full h-full bg-black cursor-pointer"
      />
      <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/70 text-xs uppercase tracking-widest text-yellow-300 border border-yellow-400/50">
        Ad
      </div>
      <div className="absolute bottom-4 right-4">
        {count > 0 ? (
          <div className="px-4 py-2 rounded-l-full bg-black/80 text-sm text-white border border-white/20">
            Skip in <span className="font-bold text-primary">{count}</span>s
          </div>
        ) : (
          <button
            onClick={() => setDone(true)}
            className="px-4 py-2 rounded-l-full bg-white text-black text-sm font-semibold hover:bg-primary hover:text-primary-foreground transition"
          >
            Skip Ad ▶
          </button>
        )}
      </div>
    </div>
  );
};