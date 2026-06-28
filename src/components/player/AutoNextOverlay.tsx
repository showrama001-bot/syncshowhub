import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, X } from "lucide-react";

export function AutoNextOverlay({
  nextTitle,
  onPlayNext,
  onCancel,
  seconds = 5,
}: {
  nextTitle: string;
  onPlayNext: () => void;
  onCancel: () => void;
  seconds?: number;
}) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds, nextTitle]);

  useEffect(() => {
    if (remaining <= 0) {
      onPlayNext();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="absolute inset-0 z-30 flex items-end md:items-center justify-center p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
      <div className="w-full max-w-md rounded-2xl border border-border/50 bg-background/90 backdrop-blur p-5 shadow-neon">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Up next</div>
        <h3 className="font-display text-xl tracking-wider mt-1 truncate">{nextTitle}</h3>
        <div className="mt-3 text-sm text-muted-foreground">
          Next episode starting in <span className="text-primary font-semibold">{remaining}</span>…
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
          <div
            className="h-full bg-gradient-red transition-all duration-1000"
            style={{ width: `${((seconds - remaining) / seconds) * 100}%` }}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm" className="flex-1 bg-gradient-red shadow-neon" onClick={onPlayNext}>
            <Play className="h-4 w-4 mr-1" /> Play now
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}