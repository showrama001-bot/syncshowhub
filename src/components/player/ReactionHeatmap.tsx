import { useEffect, useRef, useState, RefObject } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  channelKey: string;
  videoRef: RefObject<HTMLVideoElement>;
  /** Number of buckets across the timeline. */
  buckets?: number;
}

/**
 * Thin heatmap strip rendered just above the native video controls.
 * Subscribes to the same `reactions:<channelKey>` broadcast channel
 * used by FloatingReactions, and buckets reactions by the current
 * video playback time when the reaction is received.
 */
export function ReactionHeatmap({ channelKey, videoRef, buckets = 80 }: Props) {
  const [counts, setCounts] = useState<number[]>(() => new Array(buckets).fill(0));
  const durationRef = useRef(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => { durationRef.current = v.duration || 0; };
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("durationchange", onMeta);
    onMeta();
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("durationchange", onMeta);
    };
  }, [videoRef]);

  useEffect(() => {
    const record = () => {
      const v = videoRef.current;
      const dur = durationRef.current;
      if (!v || !dur || !isFinite(dur)) return;
      const idx = Math.min(buckets - 1, Math.max(0, Math.floor((v.currentTime / dur) * buckets)));
      setCounts((c) => {
        const next = c.slice();
        next[idx] = next[idx] + 1;
        return next;
      });
    };
    // Local reactions (from this viewer) — listen on window custom event.
    const onLocal = () => record();
    window.addEventListener("floating-reaction", onLocal);

    const ch = supabase.channel(`reactions:${channelKey}`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "emoji" }, () => record());
    ch.subscribe();
    return () => {
      window.removeEventListener("floating-reaction", onLocal);
      supabase.removeChannel(ch);
    };
  }, [channelKey, videoRef, buckets]);

  const max = Math.max(1, ...counts);
  return (
    <div
      className="absolute left-2 right-2 bottom-[52px] h-1.5 z-10 pointer-events-none flex gap-[1px] rounded-full overflow-hidden opacity-80"
      aria-hidden="true"
    >
      {counts.map((c, i) => {
        const h = c / max;
        const alpha = 0.15 + h * 0.75;
        const bg = h === 0
          ? "transparent"
          : `linear-gradient(to top, hsl(var(--primary) / ${alpha}), hsl(0 90% 60% / ${alpha}))`;
        return (
          <span
            key={i}
            className="flex-1"
            style={{ background: bg }}
          />
        );
      })}
    </div>
  );
}