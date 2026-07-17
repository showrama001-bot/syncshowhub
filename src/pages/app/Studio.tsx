import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HlsPlayer } from "@/components/streaming/HlsPlayer";
import { toast } from "sonner";
import { Radio, Search, Play, Loader2, PowerOff } from "lucide-react";
import { Link } from "react-router-dom";

type Movie = {
  id: string;
  title: string;
  poster_url: string | null;
  stream_url: string | null;
  stream_sources: any;
  year: number | null;
};

type ActiveStream = {
  id: number;
  movie_id: string | null;
  title: string | null;
  poster_url: string | null;
  stream_url: string | null;
  status: string;
  updated_at: string;
};

function firstStreamUrl(m: Movie): string | null {
  if (Array.isArray(m.stream_sources) && m.stream_sources.length > 0) {
    const s = m.stream_sources.find((x: any) => x?.url);
    if (s?.url) return s.url as string;
  }
  return m.stream_url ?? null;
}

export default function Studio() {
  const { user, isAdmin, roleLoading } = useAuth();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ActiveStream | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  // Load movies
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("movies")
        .select("id, title, poster_url, stream_url, stream_sources, year")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(200);
      setMovies((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  // Load + subscribe active_stream
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("active_stream").select("*").eq("id", 1).maybeSingle();
      setActive((data as any) ?? null);
    })();
    const channel = supabase
      .channel("active_stream_studio")
      .on("postgres_changes", { event: "*", schema: "public", table: "active_stream" }, (payload) => {
        setActive((payload.new as any) ?? null);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const switchTo = async (m: Movie) => {
    if (!isAdmin) {
      toast.error("Only admins can control the broadcast.");
      return;
    }
    const url = firstStreamUrl(m);
    if (!url) {
      toast.error("This movie has no stream URL.");
      return;
    }
    setSwitchingId(m.id);
    // Mark as switching so viewers can display a transition banner.
    await supabase
      .from("active_stream")
      .update({ status: "switching" })
      .eq("id", 1);
    // Small delay to let viewers see the transition, then apply the new source.
    await new Promise((r) => setTimeout(r, 400));
    const { error } = await supabase
      .from("active_stream")
      .update({
        movie_id: m.id,
        title: m.title,
        poster_url: m.poster_url,
        stream_url: url,
        status: "live",
        host_id: user?.id ?? null,
      })
      .eq("id", 1);
    setSwitchingId(null);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Now broadcasting: ${m.title}`);
    }
  };

  const goOffline = async () => {
    if (!isAdmin) return;
    await supabase
      .from("active_stream")
      .update({ status: "offline", stream_url: null, movie_id: null, title: null, poster_url: null })
      .eq("id", 1);
    toast.message("Broadcast ended.");
  };

  const filtered = movies.filter((m) => m.title?.toLowerCase().includes(query.toLowerCase()));

  if (roleLoading) {
    return <div className="pt-24 px-6 text-muted-foreground">Loading…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="pt-24 px-6 max-w-2xl mx-auto text-center">
        <h1 className="font-display text-2xl mb-2">Studio</h1>
        <p className="text-muted-foreground mb-6">Only hosts can access broadcast controls.</p>
        <Link to="/live-stream">
          <Button className="bg-gradient-red shadow-neon">Go to Live Stream</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-20 px-4 md:px-6 max-w-[1600px] mx-auto pb-16">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Radio className="h-6 w-6 text-red-500" />
          <h1 className="font-display text-2xl md:text-3xl tracking-wider">Live Broadcast Controller</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/live-stream" className="text-sm text-muted-foreground hover:text-primary">
            View as viewer →
          </Link>
          {active?.status !== "offline" && (
            <Button variant="outline" size="sm" onClick={goOffline}>
              <PowerOff className="h-4 w-4 mr-1" /> End broadcast
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
        {/* Preview */}
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-sm">
            {active?.status === "live" && (
              <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-semibold">● LIVE</span>
            )}
            {active?.status === "switching" && (
              <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 font-semibold inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Live — Switching…
              </span>
            )}
            {active?.status === "offline" && (
              <span className="px-2 py-0.5 rounded-full bg-secondary/40 text-muted-foreground font-semibold">Offline</span>
            )}
            {active?.title && <span className="text-muted-foreground truncate">{active.title}</span>}
          </div>
          {active?.stream_url && active.status !== "offline" ? (
            <HlsPlayer key={active.stream_url} src={active.stream_url} poster={active.poster_url ?? undefined} />
          ) : (
            <div className="aspect-video glass rounded-2xl grid place-items-center text-muted-foreground">
              Pick a movie from the Media Library to go live.
            </div>
          )}
        </div>

        {/* Media Library */}
        <aside className="glass rounded-2xl p-3 lg:h-[calc(100vh-160px)] flex flex-col">
          <h2 className="font-display text-lg mb-2 px-1">Media Library</h2>
          <div className="relative mb-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search movies…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {loading && <div className="text-sm text-muted-foreground p-2">Loading…</div>}
            {!loading && filtered.length === 0 && (
              <div className="text-sm text-muted-foreground p-2">No movies found.</div>
            )}
            {filtered.map((m) => {
              const isActive = active?.movie_id === m.id;
              const hasUrl = !!firstStreamUrl(m);
              return (
                <div
                  key={m.id}
                  className={`flex gap-2 p-2 rounded-lg border transition ${
                    isActive ? "border-primary bg-primary/10 shadow-neon" : "border-border/40 hover:border-primary/50"
                  }`}
                >
                  {m.poster_url ? (
                    <img src={m.poster_url} alt="" className="w-12 h-16 object-cover rounded" loading="lazy" />
                  ) : (
                    <div className="w-12 h-16 rounded bg-secondary/40" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.title}</div>
                    <div className="text-xs text-muted-foreground">{m.year ?? ""}</div>
                    <Button
                      size="sm"
                      variant={isActive ? "outline" : "default"}
                      disabled={!hasUrl || switchingId === m.id || isActive}
                      onClick={() => switchTo(m)}
                      className={!isActive ? "bg-gradient-red shadow-neon mt-1 h-7 text-xs" : "mt-1 h-7 text-xs"}
                    >
                      {switchingId === m.id ? (
                        <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Switching…</>
                      ) : isActive ? (
                        "On air"
                      ) : !hasUrl ? (
                        "No stream URL"
                      ) : (
                        <><Play className="h-3 w-3 mr-1" /> Switch to this Movie</>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}