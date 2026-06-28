import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Bookmark, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Watchlist() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("watchlist")
      .select("id, movie:movies(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, [user]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("watchlist").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed from watchlist");
    load();
  };

  return (
    <div className="px-6 md:px-12 pt-20 pb-16 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Bookmark className="h-7 w-7 text-primary" />
        <h1 className="font-display text-3xl md:text-5xl tracking-wider neon-text">My Watchlist</h1>
      </div>
      {items.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          Your watchlist is empty. Browse <Link to="/movies" className="text-primary hover:underline">Movies</Link> and tap the bookmark to save.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map((it) => {
            const m = it.movie;
            if (!m) return null;
            return (
              <div key={it.id} className="group glass rounded-2xl overflow-hidden hover:neon-border transition relative">
                <Link to={`/play/movie/${m.id}`}>
                  <div className="aspect-[2/3] bg-secondary overflow-hidden">
                    {m.poster_url ? (
                      <img src={m.poster_url} alt={m.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition" />
                    ) : (
                      <div className="w-full h-full grid place-items-center font-display text-primary/60">{m.title.slice(0, 2)}</div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-semibold truncate">{m.title}</div>
                    <div className="text-xs text-muted-foreground">{m.year} {m.category && `· ${m.category}`}</div>
                  </div>
                </Link>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(it.id)}
                  className="absolute top-2 right-2 h-8 w-8 bg-background/60 backdrop-blur hover:bg-primary/20"
                >
                  <Trash2 className="h-4 w-4 text-primary" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}