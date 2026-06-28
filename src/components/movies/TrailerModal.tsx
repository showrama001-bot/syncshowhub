import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function toYoutubeEmbed(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "");
      return `https://www.youtube.com/embed/${id}?autoplay=1`;
    }
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) return url;
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}?autoplay=1`;
    }
  } catch { /* noop */ }
  return url;
}

export function TrailerModal({
  open,
  onOpenChange,
  movieTitle,
  movieId,
  kind = "movie",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  movieTitle?: string | null;
  movieId?: string | null;
  kind?: "movie" | "series";
}) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmbedUrl(null);
    setNotFound(false);
    setLoading(true);
    (async () => {
      let q = supabase.from("trailers" as any).select("*").eq("kind", kind).limit(1);
      if (movieId) {
        q = kind === "series" ? q.eq("series_id", movieId) : q.eq("movie_id", movieId);
      } else if (movieTitle) {
        q = q.ilike("movie_title", movieTitle);
      }
      const { data } = await q.maybeSingle();
      setLoading(false);
      const ytUrl = (data as any)?.youtube_url;
      if (!ytUrl) { setNotFound(true); return; }
      setEmbedUrl(toYoutubeEmbed(ytUrl));
    })();
  }, [open, movieId, movieTitle, kind]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl glass border-primary/30">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider">
            Trailer{movieTitle ? ` — ${movieTitle}` : ""}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="aspect-video grid place-items-center text-muted-foreground">Loading…</div>
        ) : notFound || !embedUrl ? (
          <div className="aspect-video grid place-items-center text-muted-foreground text-sm">
            No trailer available yet.
          </div>
        ) : (
          <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
            <iframe
              key={embedUrl}
              src={embedUrl}
              title="Trailer"
              className="w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
