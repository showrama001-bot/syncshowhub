import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Props = { movieId?: string; episodeId?: string; label?: string };

export function WatchlistButton({ movieId, episodeId, label }: Props) {
  const { user } = useAuth();
  const [saved, setSaved] = useState<string | null>(null);

  const targetColumn = episodeId ? "episode_id" : "movie_id";
  const targetId = episodeId ?? movieId ?? null;

  useEffect(() => {
    setSaved(null);
    if (!user || !targetId) return;
    supabase
      .from("watchlist")
      .select("id")
      .eq("user_id", user.id)
      .eq(targetColumn, targetId)
      .maybeSingle()
      .then(({ data }) => setSaved(data?.id ?? null));
  }, [user, targetColumn, targetId]);

  const toggle = async () => {
    if (!user) return toast.error("Sign in to save");
    if (!targetId) return;
    if (saved) {
      const { error } = await supabase.from("watchlist").delete().eq("id", saved);
      if (error) return toast.error(error.message);
      setSaved(null);
      toast.success("Removed from watchlist");
    } else {
      const { data, error } = await supabase
        .from("watchlist")
        .insert({
          user_id: user.id,
          content_kind: episodeId ? "episode" : "movie",
          movie_id: episodeId ? null : movieId!,
          episode_id: episodeId ?? null,
        })
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
      {saved ? "Saved" : label ?? "Watchlist"}
    </Button>
  );
}
