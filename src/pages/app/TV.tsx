import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tv } from "lucide-react";

const CATEGORIES = ["All", "News", "Sports", "Movies", "Kids", "Music", "Entertainment", "Documentary"];

export default function TV() {
  const [items, setItems] = useState<any[]>([]);
  const [activeCat, setActiveCat] = useState<string>("All");
  useEffect(() => {
    supabase.from("tv_channels").select("*").order("name").then(({ data }) => setItems(data ?? []));
  }, []);

  const availableCats = ["All", ...Array.from(
    new Set(items.map((c) => c.category).filter(Boolean) as string[])
  ).sort()];
  const cats = availableCats.length > 1 ? availableCats : CATEGORIES;
  const filtered = activeCat === "All" ? items : items.filter((c) => c.category === activeCat);

  return (
    <div className="px-6 md:px-12 pt-20 pb-16 max-w-7xl mx-auto">
      <h1 className="font-display text-3xl md:text-5xl tracking-wider neon-text mb-8">Live TV</h1>
      {items.length === 0 ? (
        <p className="text-muted-foreground">No channels yet.</p>
      ) : (
        <>
        <div className="flex flex-wrap gap-2 mb-6">
          {cats.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              className={`px-4 py-1.5 rounded-full text-sm border transition ${
                activeCat === cat
                  ? "bg-primary text-primary-foreground border-primary shadow-neon"
                  : "border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <p className="text-muted-foreground">No channels in this category.</p>
        ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filtered.map((c) => (
            <Link key={c.id} to={`/play/tv/${c.id}`} className="glass rounded-2xl p-4 hover:neon-border transition flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-xl bg-secondary grid place-items-center overflow-hidden">
                {c.logo_url ? <img src={c.logo_url} alt={c.name} className="w-full h-full object-contain" /> : <Tv className="w-7 h-7 text-primary" />}
              </div>
              <div className="text-center">
                <div className="font-semibold text-sm">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.country}</div>
                {c.category && <div className="text-[10px] text-primary/80 mt-0.5">{c.category}</div>}
              </div>
            </Link>
          ))}
        </div>
        )}
        </>
      )}
    </div>
  );
}