import { useEffect, useRef } from "react";
import { AMBIENT_SOUNDS, type AmbientState } from "./HostSoundboard";

/** Plays ambient tracks in the browser mirroring the host's ambient_state. */
export function ViewerAmbientSync({ state }: { state: AmbientState | null | undefined }) {
  const audiosRef = useRef<Record<string, HTMLAudioElement>>({});

  useEffect(() => {
    const s = state || {};
    for (const t of AMBIENT_SOUNDS) {
      const st = s[t.file] ?? { on: false, vol: 50 };
      let a = audiosRef.current[t.file];
      if (st.on) {
        if (!a) { a = new Audio(t.url); a.loop = true; audiosRef.current[t.file] = a; }
        a.volume = Math.max(0, Math.min(1, st.vol / 100));
        if (a.paused) a.play().catch(() => {});
      } else if (a) {
        a.pause();
      }
    }
  }, [state]);

  useEffect(() => () => {
    for (const a of Object.values(audiosRef.current)) { try { a.pause(); a.src = ""; } catch {} }
    audiosRef.current = {};
  }, []);

  return null;
}