import { useEffect, useState, RefObject } from "react";
import { SkipForward } from "lucide-react";

interface Props {
  videoRef: RefObject<HTMLVideoElement>;
  introStart?: number | null;
  introEnd?: number | null;
}

/**
 * Floating "Skip Intro" pill shown while playback is inside the
 * [introStart, introEnd] window on the currently attached <video>.
 * Clicking jumps playback to `introEnd`.
 */
export function SkipIntroButton({ videoRef, introStart, introEnd }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || introStart == null || introEnd == null || introEnd <= introStart) return;
    const check = () => {
      const t = v.currentTime;
      setVisible(t >= introStart && t < introEnd);
    };
    check();
    v.addEventListener("timeupdate", check);
    return () => v.removeEventListener("timeupdate", check);
  }, [videoRef, introStart, introEnd]);

  if (!visible || introEnd == null) return null;

  return (
    <button
      type="button"
      onClick={() => {
        const v = videoRef.current;
        if (v && introEnd != null) v.currentTime = introEnd + 0.01;
      }}
      className="absolute bottom-16 right-4 z-30 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/80 hover:bg-primary text-white text-sm font-semibold border border-white/15 shadow-neon backdrop-blur animate-fade-in"
    >
      <SkipForward className="h-4 w-4" /> Skip Intro
    </button>
  );
}