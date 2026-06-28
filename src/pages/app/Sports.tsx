import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export default function Sports() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("matches").select("*").order("kickoff_at", { ascending: true }).then(({ data }) => setItems(data ?? []));
  }, []);
  return (
    <div className="px-6 md:px-12 pt-20 pb-16 max-w-5xl mx-auto">
      <h1 className="font-display text-3xl md:text-5xl tracking-wider neon-text mb-8">Sports</h1>
      {items.length === 0 ? (
        <p className="text-muted-foreground">No matches scheduled.</p>
      ) : (
        <div className="space-y-3">
          {items.map((m) => {
            const live = m.status === "live";
            return (
              <Link key={m.id} to={`/play/match/${m.id}`} className="glass rounded-2xl p-5 hover:neon-border transition flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">
                    {m.league} {live && <span className="ml-2 text-primary animate-pulse">● LIVE</span>}
                  </div>
                  <div className="mt-2 flex items-center gap-3 font-semibold">
                    <span>{m.home_team}</span>
                    <span className="text-primary text-xl font-display">{m.home_score} - {m.away_score}</span>
                    <span>{m.away_team}</span>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {format(new Date(m.kickoff_at), "EEE, HH:mm")}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}