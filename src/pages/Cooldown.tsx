import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { getCooldownRemainingMs } from "@/lib/rateGuard";

function format(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function Cooldown() {
  const nav = useNavigate();
  const [remaining, setRemaining] = useState(getCooldownRemainingMs());

  useEffect(() => {
    const id = setInterval(() => {
      const rem = getCooldownRemainingMs();
      setRemaining(rem);
      if (rem <= 0) nav("/", { replace: true });
    }, 1000);
    return () => clearInterval(id);
  }, [nav]);

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-background">
      <div className="glass rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-card">
        <ShieldAlert className="h-12 w-12 mx-auto text-primary" />
        <h1 className="font-display text-2xl tracking-widest neon-text">TEMPORARY COOLDOWN</h1>
        <p className="text-sm text-muted-foreground">
          We detected unusual activity from this device. Access is paused for a few
          minutes to protect the platform.
        </p>
        <div className="font-mono text-4xl neon-text">{format(remaining)}</div>
        <p className="text-xs text-muted-foreground">
          You'll be redirected automatically when the cooldown ends.
        </p>
      </div>
    </div>
  );
}