import { useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Play, Pause, Waves } from "lucide-react";

const POINTERS = import.meta.glob<{ url: string }>(
  "../../../public/sounds/*.mp3.asset.json",
  { eager: true, import: "default" },
);
const urlFor = (file: string): string | undefined => {
  const entry = Object.entries(POINTERS).find(([p]) => p.endsWith(`/${file}.asset.json`));
  return entry?.[1]?.url;
};

const LABELS: Record<string, string> = {
  "sound1.mp3": "Light Rain", "sound2.mp3": "Moderate Rain", "sound3.mp3": "Heavy Rain",
  "sound4.mp3": "Rain on Window", "sound6.mp3": "Thunderstorm", "sound7.mp3": "Distant Thunder",
  "sound8.mp3": "Cozy Fireplace", "sound9.mp3": "Winter Wind", "sound10.mp3": "Ocean Waves",
  "sound11.mp3": "Night Forest", "sound12.mp3": "Quiet Cafe", "sound13.mp3": "Soft Drizzle",
  "sound14.mp3": "Snow Walking", "sound15.mp3": "White Noise", "sound16.mp3": "Gentle Breeze",
  "sound17.mp3": "Deep Ambience",
};
const SOUNDS = Object.entries(LABELS)
  .map(([file, label]) => ({ file, label, url: urlFor(file)! }))
  .filter((s) => !!s.url);

export type AmbientTrackState = { on: boolean; vol: number };
export type AmbientState = Record<string, AmbientTrackState>;

export function HostSoundboard({
  streamId,
  state,
  onChange,
}: {
  streamId: string;
  state: AmbientState;
  onChange: (next: AmbientState) => void;
}) {
  const audiosRef = useRef<Record<string, HTMLAudioElement>>({});
  const pushTimer = useRef<number | null>(null);

  // Local playback for the host.
  useEffect(() => {
    for (const s of SOUNDS) {
      const st = state[s.file] ?? { on: false, vol: 50 };
      let a = audiosRef.current[s.file];
      if (st.on) {
        if (!a) { a = new Audio(s.url); a.loop = true; audiosRef.current[s.file] = a; }
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

  const push = (next: AmbientState) => {
    onChange(next);
    if (pushTimer.current) window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(async () => {
      await (supabase.from("studio_streams" as any) as any)
        .update({ ambient_state: next })
        .eq("id", streamId);
    }, 150);
  };

  const toggle = (file: string) => {
    const cur = state[file] ?? { on: false, vol: 50 };
    push({ ...state, [file]: { ...cur, on: !cur.on } });
  };
  const setVol = (file: string, vol: number) => {
    const cur = state[file] ?? { on: false, vol: 50 };
    push({ ...state, [file]: { ...cur, vol } });
  };

  const activeCount = useMemo(
    () => SOUNDS.filter((s) => state[s.file]?.on).length,
    [state],
  );

  return (
    <div className="glass rounded-2xl p-4 border border-border/40">
      <div className="flex items-center gap-2 mb-3">
        <Waves className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm tracking-widest neon-text">HOST SOUNDBOARD</h3>
        <span className="ml-auto text-[11px] text-muted-foreground">{activeCount} active · synced live</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[360px] overflow-auto pr-1">
        {SOUNDS.map((s) => {
          const st = state[s.file] ?? { on: false, vol: 50 };
          return (
            <div key={s.file}
              className={`rounded-lg border p-2 transition-all ${st.on ? "border-primary/50 bg-primary/5" : "border-border/40 bg-secondary/30"}`}>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggle(s.file)}>
                  {st.on ? <Pause className="h-3.5 w-3.5 text-primary" /> : <Play className="h-3.5 w-3.5" />}
                </Button>
                <span className="text-xs font-medium flex-1 truncate">{s.label}</span>
                <span className="text-[10px] tabular-nums text-muted-foreground w-8 text-right">{st.vol}%</span>
              </div>
              <Slider value={[st.vol]} min={0} max={100} step={1}
                onValueChange={(v) => setVol(s.file, v[0] ?? 0)}
                disabled={!st.on} className="mt-2" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { SOUNDS as AMBIENT_SOUNDS };