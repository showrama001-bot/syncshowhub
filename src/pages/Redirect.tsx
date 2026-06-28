import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useAds } from "@/components/ads/AdsProvider";
import { ArrowLeft, ExternalLink } from "lucide-react";

export default function RedirectPage() {
  const [params] = useSearchParams();
  const target = params.get("to") || "";
  const { settings, pick, enabled } = useAds();
  const wait = enabled ? settings.interstitial_seconds : 0;
  const [count, setCount] = useState(wait);
  const topAd = useMemo(() => pick("interstitial") || pick("banner_grid"), [pick]);
  const bottomAd = useMemo(() => pick("interstitial") || pick("banner_grid"), [pick]);

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

      {topAd && (
        <a href={topAd.redirect_url || "#"} target="_blank" rel="noopener noreferrer" className="block mb-6">
          {topAd.media_type === "image" ? (
            <img src={topAd.media_url} alt="" className="w-full max-h-40 object-cover rounded-xl border border-border/40" />
          ) : (
            <video src={topAd.media_url} autoPlay muted loop playsInline className="w-full max-h-60 object-cover rounded-xl border border-border/40" />
          )}
        </a>
      )}

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

      {bottomAd && (
        <a href={bottomAd.redirect_url || "#"} target="_blank" rel="noopener noreferrer" className="block mt-6">
          {bottomAd.media_type === "image" ? (
            <img src={bottomAd.media_url} alt="" className="w-full max-h-40 object-cover rounded-xl border border-border/40" />
          ) : (
            <video src={bottomAd.media_url} autoPlay muted loop playsInline className="w-full max-h-60 object-cover rounded-xl border border-border/40" />
          )}
        </a>
      )}
    </div>
  );
}