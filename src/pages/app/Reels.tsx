import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PlayCircle, Film, X, Heart, MessageCircle, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAdsAssets, fetchAdsSettings, pickWeighted, type AdAsset } from "@/lib/ads";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

type Reel = {
  id: string;
  source_type: "trailer" | "upload";
  youtube_id: string | null;
  video_url: string | null;
  movie_id: string | null;
  title: string | null;
  poster_url: string | null;
};

const AD_EVERY = 4; // 1 ad every 4 reels (fits "3-5 swipes")

export default function Reels() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [ads, setAds] = useState<AdAsset[]>([]);
  const [adsOn, setAdsOn] = useState(true);
  const [index, setIndex] = useState(0);
  const [adGate, setAdGate] = useState<AdAsset | null>(null);
  const [adCountdown, setAdCountdown] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const targetId = searchParams.get("id");

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("reels" as any) as any)
        .select("*").order("created_at", { ascending: false }).limit(80);
      const list = (data || []) as Reel[];
      // If a specific reel is requested, ensure it's included and moved to the front.
      if (targetId) {
        let target = list.find((r) => r.id === targetId);
        if (!target) {
          const { data: one } = await (supabase.from("reels" as any) as any)
            .select("*").eq("id", targetId).maybeSingle();
          if (one) target = one as Reel;
        }
        if (target) {
          const rest = list.filter((r) => r.id !== target!.id);
          setReels([target, ...rest]);
        } else {
          setReels(list);
        }
      } else {
        setReels(list);
      }
      const [a, s] = await Promise.all([fetchAdsAssets(), fetchAdsSettings()]);
      setAds(a); setAdsOn(!!s.master_enabled);
    })();
  }, [targetId]);

  // Enforce ad on scroll transitions.
  const showAdIfNeeded = (nextIdx: number) => {
    if (!adsOn) return false;
    if (nextIdx > 0 && nextIdx % AD_EVERY === 0) {
      const ad = pickWeighted(ads, "interstitial") || pickWeighted(ads, "preroll");
      if (ad) {
        setAdGate(ad);
        setAdCountdown(6);
        return true;
      }
    }
    return false;
  };

  useEffect(() => {
    if (!adGate) return;
    if (adCountdown <= 0) return;
    const t = setTimeout(() => setAdCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [adGate, adCountdown]);

  // Snap-scroll observer to track active reel.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const h = el.clientHeight;
        const next = Math.round(el.scrollTop / h);
        if (next !== index) {
          const gated = showAdIfNeeded(next);
          if (!gated) setIndex(next);
          else {
            // Bounce back until user closes the ad
            el.scrollTo({ top: index * h, behavior: "smooth" });
          }
        }
        ticking = false;
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [index, ads, adsOn]);

  const scrollTo = (i: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: i * el.clientHeight, behavior: "smooth" });
    setIndex(i);
  };

  if (reels.length === 0) {
    return (
      <div className="pt-20 px-4 max-w-2xl mx-auto text-center">
        <h1 className="font-display text-3xl neon-text flex items-center gap-2 justify-center">
          <PlayCircle className="h-7 w-7" /> Reels
        </h1>
        <p className="text-muted-foreground text-sm mt-4">No reels yet. The admin can publish trailers and short clips from the Admin dashboard.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[100dvh] bg-black overflow-hidden">
      <div
        ref={containerRef}
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {reels.map((r, i) => (
          <ReelSlide key={r.id} reel={r} active={i === index && !adGate} />
        ))}
      </div>

      {adGate && (
        <div className="absolute inset-0 z-30 bg-black/95 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <span className="text-xs uppercase tracking-widest text-primary">Sponsored</span>
            <Button
              size="sm"
              variant={adCountdown > 0 ? "ghost" : "default"}
              disabled={adCountdown > 0}
              onClick={() => { setAdGate(null); scrollTo(index + 1); }}
              className={adCountdown > 0 ? "text-white/60" : "bg-white text-black"}
            >
              {adCountdown > 0 ? `Skip in ${adCountdown}s` : (<><X className="h-4 w-4 mr-1" /> Skip</>)}
            </Button>
          </div>
          <div className="flex-1 grid place-items-center px-4">
            {adGate.media_type === "video" && adGate.media_url ? (
              <video src={adGate.media_url} autoPlay muted playsInline className="max-h-full max-w-full" />
            ) : adGate.media_url ? (
              <a href={adGate.redirect_url || "#"} target="_blank" rel="noopener noreferrer sponsored" className="block max-h-full">
                <img src={adGate.media_url} alt={adGate.title || "ad"} className="max-h-full max-w-full" />
              </a>
            ) : (
              <div className="text-white/70 text-sm">{adGate.title || "Advertisement"}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ReelSlide({ reel, active }: { reel: Reel; active: boolean }) {
  const ytEmbed = reel.youtube_id
    ? `https://www.youtube.com/embed/${reel.youtube_id}?autoplay=${active ? 1 : 0}&mute=1&loop=1&playlist=${reel.youtube_id}&controls=0&modestbranding=1&playsinline=1`
    : null;
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(() => 20 + Math.floor(Math.random() * 400));

  const onShare = async () => {
    const url = `${window.location.origin}/reels?id=${reel.id}`;
    const title = reel.title || "Check out this reel";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied", description: "Share it with friends." });
      }
    } catch { /* user cancelled */ }
  };

  const onLike = () => {
    setLiked((v) => {
      setLikeCount((c) => c + (v ? -1 : 1));
      return !v;
    });
  };

  const onComment = () => {
    toast({ title: "Comments coming soon", description: "Reel comments will be enabled shortly." });
  };

  return (
    <section className="w-full h-[100dvh] snap-start relative flex items-center justify-center bg-black" style={{ scrollSnapAlign: "start" }}>
      {ytEmbed ? (
        <iframe
          key={active ? "on" : "off"}
          src={ytEmbed}
          className="w-full h-full"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          title={reel.title || "reel"}
        />
      ) : reel.video_url ? (
        <video
          src={reel.video_url}
          autoPlay={active}
          muted
          loop
          playsInline
          controls={false}
          controlsList="nodownload noremoteplayback noplaybackrate"
          disablePictureInPicture
          onContextMenu={(e) => e.preventDefault()}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="text-white/60">No source</div>
      )}

      {/* Right-side action rail */}
      <div className="absolute right-3 bottom-32 md:bottom-24 z-10 flex flex-col items-center gap-5">
        <button onClick={onLike} className="flex flex-col items-center text-white/90 hover:text-primary transition">
          <div className={`h-11 w-11 rounded-full grid place-items-center backdrop-blur bg-black/40 ${liked ? "text-red-500" : ""}`}>
            <Heart className="h-6 w-6" fill={liked ? "currentColor" : "none"} />
          </div>
          <span className="text-[11px] mt-1 drop-shadow">{likeCount}</span>
        </button>
        <button onClick={onComment} className="flex flex-col items-center text-white/90 hover:text-primary transition">
          <div className="h-11 w-11 rounded-full grid place-items-center backdrop-blur bg-black/40">
            <MessageCircle className="h-6 w-6" />
          </div>
          <span className="text-[11px] mt-1 drop-shadow">Comment</span>
        </button>
        <button onClick={onShare} className="flex flex-col items-center text-white/90 hover:text-primary transition">
          <div className="h-11 w-11 rounded-full grid place-items-center backdrop-blur bg-black/40">
            <Share2 className="h-6 w-6" />
          </div>
          <span className="text-[11px] mt-1 drop-shadow">Share</span>
        </button>
      </div>

      {/* Overlay UI */}
      <div className="absolute inset-x-0 bottom-0 p-4 pb-8 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
        <div className="text-white font-semibold text-lg drop-shadow">{reel.title || "Untitled"}</div>
        {reel.movie_id && (
          <Link
            to={`/movies/${reel.movie_id}`}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-red shadow-neon text-white text-sm font-semibold"
          >
            <Film className="h-4 w-4" /> Watch full movie
          </Link>
        )}
      </div>
    </section>
  );
}