import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HlsPlayer } from "@/components/streaming/HlsPlayer";
import { Radio, Loader2 } from "lucide-react";

type ActiveStream = {
  id: number;
  movie_id: string | null;
  title: string | null;
  poster_url: string | null;
  stream_url: string | null;
  status: string;
  updated_at: string;
};

export default function LiveStream() {
  const [active, setActive] = useState<ActiveStream | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchBanner, setSwitchBanner] = useState(false);
  const prevUrlRef = useRef<string | null>(null);
  const bannerTimer = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("active_stream").select("*").eq("id", 1).maybeSingle();
      const row = (data as any) ?? null;
      setActive(row);
      prevUrlRef.current = row?.stream_url ?? null;
      setLoading(false);
    })();

    const channel = supabase
      .channel("active_stream_viewer")
      .on("postgres_changes", { event: "*", schema: "public", table: "active_stream" }, (payload) => {
        const next = (payload.new as any) ?? null;
        if (!next) return;
        // Show a transition banner when host flips to switching, or when the URL changes.
        if (next.status === "switching" || next.stream_url !== prevUrlRef.current) {
          setSwitchBanner(true);
          if (bannerTimer.current) window.clearTimeout(bannerTimer.current);
          bannerTimer.current = window.setTimeout(() => setSwitchBanner(false), 2500);
        }
        prevUrlRef.current = next.stream_url ?? null;
        setActive(next);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (bannerTimer.current) window.clearTimeout(bannerTimer.current);
    };
  }, []);

  const isLive = active?.status === "live" && !!active?.stream_url;

  return (
    <div className="pt-20 px-4 md:px-6 max-w-6xl mx-auto pb-16">
      <div className="flex items-center gap-3 mb-4">
        <Radio className="h-6 w-6 text-red-500" />
        <div>
          <h1 className="font-display text-2xl md:text-3xl tracking-wider">Live Stream</h1>
          <div className="text-xs text-muted-foreground flex gap-2 items-center">
            {isLive ? (
              <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-semibold">● LIVE</span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-secondary/40 text-muted-foreground font-semibold">Offline</span>
            )}
            {active?.title && <span className="truncate">{active.title}</span>}
          </div>
        </div>
      </div>

      <div className="relative">
        {loading ? (
          <div className="aspect-video glass rounded-2xl grid place-items-center text-muted-foreground">Loading…</div>
        ) : isLive ? (
          <HlsPlayer
            key={active!.stream_url!}
            src={active!.stream_url!}
            poster={active!.poster_url ?? undefined}
          />
        ) : (
          <div className="aspect-video glass rounded-2xl grid place-items-center text-muted-foreground">
            The host is offline. Please check back soon.
          </div>
        )}

        {switchBanner && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-black/80 backdrop-blur border border-yellow-500/40 text-yellow-300 text-sm font-medium inline-flex items-center gap-2 shadow-neon">
            <Loader2 className="h-4 w-4 animate-spin" />
            Host is switching the movie…
          </div>
        )}
      </div>
    </div>
  );
}