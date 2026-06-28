import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function WatchlistButton({ movieId }: { movieId: string }) {
  const { user } = useAuth();
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("watchlist")
      .select("id")
      .eq("user_id", user.id)
      .eq("movie_id", movieId)
      .maybeSingle()
      .then(({ data }) => setSaved(data?.id ?? null));
  }, [user, movieId]);

  const toggle = async () => {
    if (!user) return toast.error("Sign in to save");
    if (saved) {
      const { error } = await supabase.from("watchlist").delete().eq("id", saved);
      if (error) return toast.error(error.message);
      setSaved(null);
      toast.success("Removed from watchlist");
    } else {
      const { data, error } = await supabase
        .from("watchlist")
        .insert({ user_id: user.id, movie_id: movieId })
        .select("id")
        .single();
      if (error) return toast.error(error.message);
      setSaved(data.id);
      toast.success("Added to watchlist");
    }
  };

  return (
    <Button onClick={toggle} variant="outline" className="glass">
      {saved ? <BookmarkCheck className="h-4 w-4 mr-2 text-primary" /> : <Bookmark className="h-4 w-4 mr-2" />}
      {saved ? "Saved" : "Watchlist"}
    </Button>
  );
}