import { useEffect, useRef, useState, ReactNode } from "react";
import { useAds } from "./AdsProvider";
import { ScriptSlot } from "./ScriptSlot";

/**
 * Wraps a content video. Plays a pre-roll ad first (if enabled + asset available),
 * then renders children. Also overlays a mid-roll ad after a configurable amount
 * of content playback time. Skip buttons are hidden until the countdowns elapse.
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

  if (!adActive) return <MidRollWrapper>{children}</MidRollWrapper>;

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

/**
 * Renders the content and overlays a mid-roll ad after `midroll_time_seconds`
 * of wall-clock time has passed since the content began. Fires at most once
 * per mount, so a full watch triggers a single mid-roll — matching how the
 * admin control is described ("Mid-Roll ... configurable Skip Timer").
 */
const MidRollWrapper = ({ children }: { children: ReactNode }) => {
  const { enabled, settings, pick } = useAds();
  const [ad] = useState(() => (enabled && settings.midroll_enabled ? pick("midroll") : null));
  const [visible, setVisible] = useState(false);
  const [firedOnce, setFiredOnce] = useState(false);
  const [skip, setSkip] = useState(settings.midroll_skip_seconds);

  useEffect(() => {
    if (!enabled || !settings.midroll_enabled || !ad || firedOnce) return;
    const delay = Math.max(15, settings.midroll_time_seconds) * 1000;
    const t = setTimeout(() => {
      setVisible(true);
      setFiredOnce(true);
      setSkip(settings.midroll_skip_seconds);
    }, delay);
    return () => clearTimeout(t);
  }, [enabled, settings.midroll_enabled, settings.midroll_time_seconds, settings.midroll_skip_seconds, ad, firedOnce]);

  useEffect(() => {
    if (!visible || skip <= 0) return;
    const t = setTimeout(() => setSkip((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [visible, skip]);

  const handleClick = () => {
    if (ad?.redirect_url) window.open(ad.redirect_url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative">
      {children}
      {visible && ad && (
        <div className="absolute inset-0 z-30 bg-black rounded-2xl overflow-hidden">
          {ad.ad_mode === "script" && ad.script_code ? (
            <ScriptSlot html={ad.script_code} className="w-full h-full" />
          ) : ad.media_type === "video" && ad.media_url ? (
            <video
              src={ad.media_url}
              autoPlay
              playsInline
              controls={false}
              onEnded={() => setVisible(false)}
              onClick={handleClick}
              className="w-full h-full bg-black cursor-pointer"
            />
          ) : ad.media_url ? (
            <img
              src={ad.media_url}
              alt={ad.title ?? "Ad"}
              onClick={handleClick}
              className="w-full h-full object-cover cursor-pointer"
            />
          ) : null}
          <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/70 text-xs uppercase tracking-widest text-yellow-300 border border-yellow-400/50">
            Mid-roll Ad
          </div>
          <div className="absolute bottom-4 right-4">
            {skip > 0 ? (
              <div className="px-4 py-2 rounded-l-full bg-black/80 text-sm text-white border border-white/20">
                Skip in <span className="font-bold text-primary">{skip}</span>s
              </div>
            ) : (
              <button
                onClick={() => setVisible(false)}
                className="px-4 py-2 rounded-l-full bg-white text-black text-sm font-semibold hover:bg-primary hover:text-primary-foreground transition"
              >
                Skip Ad ▶
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};