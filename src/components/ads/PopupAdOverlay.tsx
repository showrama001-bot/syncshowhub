import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAds } from "./AdsProvider";
import { ScriptSlot } from "./ScriptSlot";

export const PopupAdOverlay = () => {
  const { enabled, settings, pick } = useAds();
  const [open, setOpen] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [ad, setAd] = useState(() => pick("popup"));

  // schedule popups
  useEffect(() => {
    if (!enabled || !settings.popup_enabled) return;
    const interval = setInterval(() => {
      const next = pick("popup");
      if (!next) return;
      setAd(next);
      setCountdown(settings.popup_duration_seconds);
      setOpen(true);
    }, Math.max(15, settings.popup_interval_seconds) * 1000);
    return () => clearInterval(interval);
  }, [enabled, settings.popup_enabled, settings.popup_interval_seconds, settings.popup_duration_seconds, pick]);

  // countdown
  useEffect(() => {
    if (!open || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [open, countdown]);

  if (!open || !ad) return null;

  const close = () => {
    if (countdown > 0) return;
    setOpen(false);
  };

  const handleClick = () => {
    if (ad.redirect_url) window.open(ad.redirect_url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl rounded-2xl overflow-hidden border border-primary/30 shadow-neon bg-card">
        <div className="absolute top-3 left-3 z-10 px-3 py-1 rounded-full bg-black/70 text-xs uppercase tracking-widest text-yellow-300 border border-yellow-400/50">
          Sponsored
        </div>
        {countdown > 0 ? (
          <div className="absolute top-3 right-3 z-10 h-9 min-w-9 px-3 rounded-full bg-primary/20 border border-primary/40 text-primary text-sm font-semibold flex items-center justify-center">
            {countdown}s
          </div>
        ) : (
          <button
            onClick={close}
            aria-label="Close ad"
            className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-background/80 hover:bg-primary/20 border border-border/60 flex items-center justify-center transition"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {ad.ad_mode === "script" && ad.script_code ? (
          <ScriptSlot html={ad.script_code} className="w-full aspect-video bg-black flex items-center justify-center" />
        ) : ad.media_type === "video" && ad.media_url ? (
          <video
            src={ad.media_url}
            autoPlay
            playsInline
            muted={false}
            controls={false}
            onClick={handleClick}
            className="w-full aspect-video bg-black cursor-pointer"
          />
        ) : ad.media_url ? (
          <img
            src={ad.media_url}
            alt={ad.title ?? "Ad"}
            onClick={handleClick}
            className="w-full aspect-video object-cover cursor-pointer bg-black"
          />
        ) : null}
      </div>
    </div>
  );
};