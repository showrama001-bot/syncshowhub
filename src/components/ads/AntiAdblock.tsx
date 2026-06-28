import { useEffect, useState } from "react";
import { useAds } from "./AdsProvider";

export const AntiAdblock = () => {
  const { settings, enabled } = useAds();
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!enabled || !settings.antiadblock_enabled) {
      setBlocked(false);
      return;
    }
    const test = document.createElement("div");
    test.className = "adsbox ad-banner ads ad ad-placement carbon-ads";
    test.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:2px;height:2px;";
    test.innerHTML = "&nbsp;";
    document.body.appendChild(test);
    const check = () => {
      const hidden =
        test.offsetParent === null ||
        test.offsetHeight === 0 ||
        test.clientHeight === 0 ||
        getComputedStyle(test).display === "none" ||
        getComputedStyle(test).visibility === "hidden";
      setBlocked(hidden);
    };
    const timer = setTimeout(check, 600);
    const interval = setInterval(check, 5000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      test.remove();
    };
  }, [enabled, settings.antiadblock_enabled]);

  if (!blocked) return null;

  return (
    <div className="fixed inset-0 z-[200] backdrop-blur-xl bg-background/80 flex items-center justify-center p-6">
      <div className="max-w-md text-center rounded-2xl border border-primary/40 bg-card p-8 shadow-neon">
        <div className="text-5xl mb-4">🛡️</div>
        <h2 className="font-display text-2xl tracking-wider mb-3 neon-text">AdBlocker Detected</h2>
        <p className="text-muted-foreground text-sm mb-4">
          {settings.antiadblock_message || "We rely on ads to keep SyncShow free. Please disable your ad blocker and reload the page to continue watching."}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2 rounded-full bg-gradient-red text-white font-semibold shadow-neon hover:opacity-90 transition"
        >
          I've disabled it — Reload
        </button>
      </div>
    </div>
  );
};