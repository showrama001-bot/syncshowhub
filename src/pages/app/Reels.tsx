import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PlayCircle, Film, Heart, MessageCircle, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

export default function Reels() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [index, setIndex] = useState(0);
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
    })();
  }, [targetId]);

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
        if (next !== index) setIndex(next);
        ticking = false;
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [index]);

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
          <ReelSlide key={r.id} reel={r} active={i === index} />
        ))}
      </div>

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