import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useAds } from "@/components/ads/AdsProvider";
import { GridBanner } from "@/components/ads/GridBanner";
import { ArrowLeft, ExternalLink } from "lucide-react";

export default function RedirectPage() {
  const [params] = useSearchParams();
  const target = params.get("to") || "";
  const { enabled } = useAds();
  const wait = enabled ? 5 : 0;
  const [count, setCount] = useState(wait);

  useEffect(() => {
    setCount(wait);
    if (wait <= 0) return;
    const t = setInterval(() => setCount((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [wait]);

  const valid = /^https?:\/\//i.test(target);

  return (
    <div className="min-h-screen bg-background text-foreground pt-20 px-4 md:px-8 max-w-3xl mx-auto pb-16">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to SyncShow
      </Link>
      <h1 className="font-display text-2xl md:text-4xl tracking-wider mb-6 neon-text">Redirecting…</h1>

      <div className="mb-6"><GridBanner /></div>

      <div className="glass rounded-2xl p-6 md:p-10 text-center border border-border/40">
        {!valid ? (
          <p className="text-destructive">Invalid destination URL.</p>
        ) : count > 0 ? (
          <>
            <p className="text-sm text-muted-foreground mb-3">Your link is being prepared…</p>
            <div className="text-6xl font-display neon-text mb-3">{count}</div>
            <p className="text-xs text-muted-foreground">Please wait while we secure your destination.</p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">Your link is ready.</p>
            <a
              href={target}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-red text-white font-semibold shadow-neon hover:opacity-90 transition"
            >
              Continue to destination <ExternalLink className="h-4 w-4" />
            </a>
            <p className="text-xs text-muted-foreground mt-3 break-all">{target}</p>
          </>
        )}
      </div>

      <div className="mt-6"><GridBanner /></div>
    </div>
  );
}