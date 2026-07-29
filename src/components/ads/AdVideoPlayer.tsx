import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useAds } from "./AdsProvider";

type Stage = "idle" | "preroll" | "hook" | "break" | "postroll";

/**
 * Wraps a video player and drives the whole ad timeline:
 *  - Pre-roll video ad before the movie starts
 *  - VIP pause banner while the movie is paused
 *  - TV commercial break at the configured trigger time
 *    (static hook image -> sequential ad queue -> resume at the exact second)
 *  - Post-roll video ad when the movie ends
 * Only applies to native <video> players (iframe embeds are left untouched).
 */
export const AdPlayerShell = ({ children }: { children: ReactNode }) => {
  const { enabled, config } = useAds();
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const adRef = useRef<HTMLVideoElement>(null);
  const resumeAtRef = useRef(0);
  const breakDoneRef = useRef(false);

  const [stage, setStage] = useState<Stage>("idle");
  const [queueIdx, setQueueIdx] = useState(0);
  const [skipLeft, setSkipLeft] = useState(0);
  const [hookLeft, setHookLeft] = useState(0);
  const [paused, setPaused] = useState(false);

  const timeline = enabled && config.timeline_enabled;
  const hasPre = Boolean(timeline && config.preroll_url);
  const hasPost = Boolean(timeline && config.postroll_url);
  const queue = enabled && config.break_enabled ? config.break_queue.filter((a) => a?.url) : [];

  // Locate the underlying <video> element rendered by the child player.
  useEffect(() => {
    const find = () => {
      const v = hostRef.current?.querySelector("video") as HTMLVideoElement | null;
      if (v && v !== videoRef.current) videoRef.current = v;
      return Boolean(videoRef.current);
    };
    if (find()) return;
    const t = setInterval(() => {
      if (find()) clearInterval(t);
    }, 400);
    return () => clearInterval(t);
  }, [children]);

  const resumeContent = useCallback((at?: number) => {
    const v = videoRef.current;
    if (!v) return;
    if (typeof at === "number" && Number.isFinite(at)) {
      try {
        v.currentTime = at;
      } catch {
        /* ignore seek errors */
      }
    }
    void v.play().catch(() => undefined);
  }, []);

  // Attach content-video listeners: pause banner, break trigger, post-roll.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPause = () => setPaused(true);
    const onPlay = () => setPaused(false);

    const onTime = () => {
      if (stage !== "idle" || breakDoneRef.current || !queue.length) return;
      if (v.currentTime >= Math.max(5, config.break_trigger_seconds)) {
        breakDoneRef.current = true;
        resumeAtRef.current = v.currentTime;
        v.pause();
        setQueueIdx(0);
        if (config.hook_image_url) {
          setHookLeft(Math.max(1, config.hook_duration_seconds || 5));
          setStage("hook");
        } else {
          setStage("break");
        }
      }
    };

    const onEnded = () => {
      if (stage !== "idle") return;
      if (hasPost) {
        setSkipLeft(Math.max(0, config.skip_seconds || 0));
        setStage("postroll");
      }
    };

    v.addEventListener("pause", onPause);
    v.addEventListener("play", onPlay);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("pause", onPause);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnded);
    };
  }, [stage, queue.length, config.break_trigger_seconds, config.hook_image_url, config.hook_duration_seconds, config.skip_seconds, hasPost, videoRef.current]);

  // Kick off the pre-roll once, before the content is allowed to play.
  useEffect(() => {
    if (!hasPre) return;
    setStage("preroll");
    setSkipLeft(Math.max(0, config.skip_seconds || 0));
    const v = videoRef.current;
    if (v) v.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPre]);

  // Skip countdown for pre-roll / post-roll.
  useEffect(() => {
    if ((stage !== "preroll" && stage !== "postroll") || skipLeft <= 0) return;
    const t = setTimeout(() => setSkipLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, skipLeft]);

  // Static hook image countdown, then roll the queue.
  useEffect(() => {
    if (stage !== "hook") return;
    if (hookLeft <= 0) {
      setStage("break");
      return;
    }
    const t = setTimeout(() => setHookLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, hookLeft]);

  const finishPreroll = () => {
    setStage("idle");
    resumeContent();
  };

  const nextBreakAd = () => {
    if (queueIdx + 1 < queue.length) {
      setQueueIdx((i) => i + 1);
    } else {
      setStage("idle");
      resumeContent(resumeAtRef.current);
    }
  };

  const openLink = (link?: string | null) => {
    if (link) window.open(`/redirect?to=${encodeURIComponent(link)}`, "_blank", "noopener,noreferrer");
  };

  const overlayBadge = (label: string) => (
    <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/70 text-xs uppercase tracking-widest text-yellow-300 border border-yellow-400/50">
      {label}
    </div>
  );

  const skipControl = (onSkip: () => void) => (
    <div className="absolute bottom-4 right-4">
      {skipLeft > 0 ? (
        <div className="px-4 py-2 rounded-l-full bg-black/80 text-sm text-white border border-white/20">
          Skip in <span className="font-bold text-primary">{skipLeft}</span>s
        </div>
      ) : (
        <button
          onClick={onSkip}
          className="px-4 py-2 rounded-l-full bg-white text-black text-sm font-semibold hover:bg-primary hover:text-primary-foreground transition"
        >
          Skip Ad ▶
        </button>
      )}
    </div>
  );

  const showPauseBanner =
    enabled && config.vip_enabled && Boolean(config.pause_banner_url) && paused && stage === "idle";

  return (
    <div ref={hostRef} className="relative">
      {children}

      {showPauseBanner && (
        <div className="absolute inset-0 z-30 grid place-items-center pointer-events-none">
          <div className="pointer-events-auto relative max-w-[80%] rounded-2xl overflow-hidden border border-primary/40 shadow-neon">
            <img
              src={config.pause_banner_url!}
              alt="Sponsored"
              onClick={() => openLink(config.pause_banner_link)}
              className={config.pause_banner_link ? "cursor-pointer w-full" : "w-full"}
            />
            {overlayBadge("Ad")}
          </div>
        </div>
      )}

      {stage === "preroll" && config.preroll_url && (
        <div className="absolute inset-0 z-40 bg-black rounded-2xl overflow-hidden">
          <video
            ref={adRef}
            src={config.preroll_url}
            autoPlay
            playsInline
            onEnded={finishPreroll}
            onClick={() => openLink(config.preroll_link)}
            className="w-full h-full bg-black cursor-pointer"
          />
          {overlayBadge("Ad")}
          {skipControl(finishPreroll)}
        </div>
      )}

      {stage === "hook" && (
        <div className="absolute inset-0 z-40 bg-black rounded-2xl overflow-hidden grid place-items-center">
          {config.hook_image_url && (
            <img src={config.hook_image_url} alt="Commercial break" className="w-full h-full object-contain" />
          )}
          {overlayBadge("Commercial Break")}
          <div className="absolute bottom-4 right-4 px-4 py-2 rounded-l-full bg-black/80 text-sm text-white border border-white/20">
            Back in <span className="font-bold text-primary">{hookLeft}</span>s
          </div>
        </div>
      )}

      {stage === "break" && queue[queueIdx] && (
        <div className="absolute inset-0 z-40 bg-black rounded-2xl overflow-hidden">
          <video
            key={queue[queueIdx].id ?? queueIdx}
            src={queue[queueIdx].url}
            autoPlay
            playsInline
            onEnded={nextBreakAd}
            onError={nextBreakAd}
            onClick={() => openLink(queue[queueIdx].link)}
            className="w-full h-full bg-black cursor-pointer"
          />
          {overlayBadge(`Ad ${queueIdx + 1} / ${queue.length}`)}
        </div>
      )}

      {stage === "postroll" && config.postroll_url && (
        <div className="absolute inset-0 z-40 bg-black rounded-2xl overflow-hidden">
          <video
            src={config.postroll_url}
            autoPlay
            playsInline
            onEnded={() => setStage("idle")}
            onClick={() => openLink(config.postroll_link)}
            className="w-full h-full bg-black cursor-pointer"
          />
          {overlayBadge("Ad")}
          {skipControl(() => setStage("idle"))}
        </div>
      )}
    </div>
  );
};
