import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Radio, Users } from "lucide-react";

type Story =
  | { kind: "studio"; id: string; title: string; poster: string | null; host_name: string; count: number }
  | { kind: "room"; id: string; title: string; poster: string | null; host_name: string; count: number };

export function LiveStoriesRail() {
  const [stories, setStories] = useState<Story[]>([]);
  const navigate = useNavigate();

  const load = async () => {
    const [{ data: studios }, { data: rooms }] = await Promise.all([
      (supabase.from("studio_streams" as any) as any)
        .select("id, title, host_id, poster_url, viewer_count")
        .eq("status", "live")
        .order("created_at", { ascending: false })
        .limit(20),
      (supabase.from("watch_rooms" as any) as any)
        .select("id, title, host_id, poster_url, participant_count, status, visibility")
        .eq("visibility", "public")
        .eq("status", "live")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    const ids = Array.from(new Set([...(studios || []), ...(rooms || [])].map((r: any) => r.host_id)));
    let names: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name, username").in("id", ids);
      (profs || []).forEach((p: any) => { names[p.id] = p.display_name || p.username || "Host"; });
    }
    const out: Story[] = [
      ...((studios || []) as any[]).map((s) => ({
        kind: "studio" as const, id: s.id, title: s.title, poster: s.poster_url,
        host_name: names[s.host_id] || "Host", count: s.viewer_count || 0,
      })),
      ...((rooms || []) as any[]).map((r) => ({
        kind: "room" as const, id: r.id, title: r.title, poster: r.poster_url,
        host_name: names[r.host_id] || "Host", count: r.participant_count || 0,
      })),
    ];
    setStories(out);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("stories-rail")
      .on("postgres_changes", { event: "*", schema: "public", table: "studio_streams" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "watch_rooms" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (stories.length === 0) return null;

  const openStory = (s: Story) => {
    if (s.kind === "studio") navigate(`/live-stream?stream=${s.id}`);
    else navigate(`/watch/${s.id}`);
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        <h2 className="uppercase tracking-[0.3em] text-xs text-muted-foreground">Live now</h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x">
        {stories.map((s) => (
          <button
            key={`${s.kind}-${s.id}`}
            onClick={() => openStory(s)}
            className="group snap-start flex flex-col items-center gap-2 shrink-0 w-20 focus:outline-none"
          >
            <span className="relative inline-flex">
              <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-red-500 via-pink-500 to-primary animate-pulse blur-[2px] opacity-80" />
              <span className="absolute -inset-0.5 rounded-full ring-2 ring-red-500/70 animate-pulse" />
              <span className="relative block h-16 w-16 rounded-full overflow-hidden bg-secondary/60 border-2 border-background">
                {s.poster ? (
                  <img src={s.poster} alt={s.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform" loading="lazy" />
                ) : (
                  <span className="w-full h-full grid place-items-center text-muted-foreground">
                    <Radio className="h-5 w-5" />
                  </span>
                )}
              </span>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-[1px] rounded-full bg-red-500 text-[9px] font-bold uppercase tracking-wider text-white shadow">
                Live
              </span>
            </span>
            <span className="text-[11px] truncate max-w-[80px] text-center leading-tight">{s.host_name}</span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> {s.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}