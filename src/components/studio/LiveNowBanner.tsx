import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Radio, X } from "lucide-react";

type LiveStream = { id: string; title: string; host_id: string; poster_url: string | null };

export function LiveNowBanner() {
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [hostNames, setHostNames] = useState<Record<string, string>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem("live_banner_dismissed") || "[]")); }
    catch { return new Set(); }
  });

  const load = async () => {
    const { data } = await (supabase.from("studio_streams" as any) as any)
      .select("id, title, host_id, poster_url")
      .eq("status", "live")
      .order("created_at", { ascending: false })
      .limit(3);
    const rows = (data as LiveStream[]) || [];
    setStreams(rows);
    const ids = rows.map((r) => r.host_id);
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name, username").in("id", ids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { map[p.id] = p.display_name || p.username || "Host"; });
      setHostNames(map);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("live-streams-banner")
      .on("postgres_changes", { event: "*", schema: "public", table: "studio_streams" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const dismiss = (id: string) => {
    const next = new Set(dismissed); next.add(id);
    setDismissed(next);
    sessionStorage.setItem("live_banner_dismissed", JSON.stringify(Array.from(next)));
  };

  const visible = streams.filter((s) => !dismissed.has(s.id));
  if (visible.length === 0) return null;
  return (
    <div className="sticky top-0 z-40 space-y-1 px-3 pt-2">
      {visible.map((s) => (
        <div key={s.id}
          className="flex items-center gap-3 rounded-full glass border border-primary/40 px-4 py-1.5 shadow-neon animate-pulse-slow">
          <Radio className="h-4 w-4 text-red-500 animate-pulse" />
          <span className="text-xs md:text-sm">
            <span className="font-semibold text-primary">{hostNames[s.host_id] || "Someone"}</span>
            <span className="text-muted-foreground"> is LIVE — </span>
            <span className="font-semibold">{s.title}</span>
          </span>
          <Link
            to={`/live-stream?stream=${s.id}`}
            className="ml-auto text-xs font-semibold px-3 py-1 rounded-full bg-gradient-red shadow-neon">
            Watch now
          </Link>
          <button aria-label="Dismiss" onClick={() => dismiss(s.id)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}