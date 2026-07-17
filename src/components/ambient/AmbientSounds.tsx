import { useEffect, useMemo, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Waves, Square } from "lucide-react";
import { useLocalPref } from "@/hooks/useLocalPref";

type SoundDef = { file: string; label: string };

const SOUNDS: SoundDef[] = [
  { file: "sound1.mp3", label: "Light Rain" },
  { file: "sound2.mp3", label: "Moderate Rain" },
  { file: "sound3.mp3", label: "Heavy Rain" },
  { file: "sound4.mp3", label: "Rain on Window" },
  { file: "sound5.mp3", label: "Rain Inside Car" },
  { file: "sound6.mp3", label: "Thunderstorm" },
  { file: "sound7.mp3", label: "Distant Thunder" },
  { file: "sound8.mp3", label: "Cozy Fireplace" },
  { file: "sound9.mp3", label: "Winter Wind" },
  { file: "sound10.mp3", label: "Ocean Waves" },
  { file: "sound11.mp3", label: "Night Forest" },
  { file: "sound12.mp3", label: "Quiet Cafe" },
  { file: "sound13.mp3", label: "Soft Drizzle" },
  { file: "sound14.mp3", label: "Snow Walking" },
  { file: "sound15.mp3", label: "White Noise" },
];

type State = Record<string, { on: boolean; vol: number }>;

const defaultState: State = SOUNDS.reduce((acc, s) => {
  acc[s.file] = { on: false, vol: 50 };
  return acc;
}, {} as State);

export function AmbientSounds() {
  const [state, setState] = useLocalPref<State>("ambient:v1", defaultState);
  const audiosRef = useRef<Record<string, HTMLAudioElement>>({});
  const [open, setOpen] = useState(false);

  const ensureAudio = (file: string) => {
    let a = audiosRef.current[file];
    if (!a) {
      a = new Audio(`/sounds/${file}`);
      a.loop = true;
      a.preload = "auto";
      audiosRef.current[file] = a;
    }
    return a;
  };

  // Sync audio elements with state
  useEffect(() => {
    for (const s of SOUNDS) {
      const st = state[s.file] ?? { on: false, vol: 50 };
      const existing = audiosRef.current[s.file];
      if (st.on) {
        const a = ensureAudio(s.file);
        a.volume = Math.max(0, Math.min(1, st.vol / 100));
        if (a.paused) {
          a.play().catch(() => {});
        }
      } else if (existing) {
        existing.pause();
      }
    }
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const a of Object.values(audiosRef.current)) {
        try { a.pause(); a.src = ""; } catch {}
      }
      audiosRef.current = {};
    };
  }, []);

  const activeCount = useMemo(
    () => SOUNDS.filter((s) => state[s.file]?.on).length,
    [state]
  );

  const toggle = (file: string, on: boolean) => {
    setState((prev) => ({ ...prev, [file]: { ...(prev[file] ?? { vol: 50 }), on } }));
  };
  const setVol = (file: string, vol: number) => {
    setState((prev) => ({ ...prev, [file]: { ...(prev[file] ?? { on: false }), vol } }));
  };
  const clearAll = () => {
    setState(() => {
      const next: State = {};
      for (const s of SOUNDS) next[s.file] = { on: false, vol: state[s.file]?.vol ?? 50 };
      return next;
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Ambient sounds"
          className="glass rounded-full hover:neon-border transition-all relative"
        >
          <Waves className={`h-5 w-5 ${activeCount > 0 ? "text-primary" : ""}`} />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-primary text-[10px] font-bold text-primary-foreground grid place-items-center shadow-neon">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[340px] p-0 border-border/50 bg-background/70 backdrop-blur-2xl shadow-neon"
      >
        <div className="flex items-center justify-between p-4 border-b border-border/40">
          <div>
            <div className="font-display text-sm tracking-widest neon-text">AMBIENT</div>
            <div className="text-[11px] text-muted-foreground">
              {activeCount} active · loops locally
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={clearAll}
            disabled={activeCount === 0}
            className="gap-1"
          >
            <Square className="h-3.5 w-3.5" /> Clear All
          </Button>
        </div>
        <ScrollArea className="h-[420px]">
          <div className="p-3 space-y-2">
            {SOUNDS.map((s) => {
              const st = state[s.file] ?? { on: false, vol: 50 };
              return (
                <div
                  key={s.file}
                  className={`rounded-xl border p-3 transition-all ${
                    st.on
                      ? "border-primary/50 bg-primary/5 shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
                      : "border-border/40 bg-secondary/30 hover:bg-secondary/50"
                  }`}
                >
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={st.on}
                      onCheckedChange={(v) => toggle(s.file, !!v)}
                    />
                    <span
                      className="flex-1 text-sm font-medium"
                    >
                      {s.label}
                    </span>
                    <span className="text-[10px] tabular-nums text-muted-foreground w-8 text-right">
                      {st.vol}%
                    </span>
                  </label>
                  <Slider
                    value={[st.vol]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(v) => setVol(s.file, v[0] ?? 0)}
                    disabled={!st.on}
                    className="mt-3"
                  />
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
