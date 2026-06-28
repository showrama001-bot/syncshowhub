import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function MovieComments({ movieId }: { movieId: string }) {
  const { user, isAdmin } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [content, setContent] = useState("");
  const [rating, setRating] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data: cs } = await supabase
      .from("movie_comments")
      .select("*")
      .eq("movie_id", movieId)
      .order("created_at", { ascending: false });
    const ids = Array.from(new Set((cs ?? []).map((c) => c.user_id)));
    let profiles: Record<string, any> = {};
    if (ids.length) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", ids);
      (ps ?? []).forEach((p) => (profiles[p.id] = p));
    }
    setComments((cs ?? []).map((c) => ({ ...c, profile: profiles[c.user_id] })));
  };
  useEffect(() => { load(); }, [movieId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error("Sign in to comment");
    if (!content.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("movie_comments").insert({
      user_id: user.id,
      movie_id: movieId,
      content: content.trim().slice(0, 1000),
      rating: rating > 0 ? rating : null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setContent("");
    setRating(0);
    load();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("movie_comments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const avg = comments.filter((c) => c.rating).reduce((a, c, _, arr) => a + c.rating / arr.length, 0);

  return (
    <div className="mt-10 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl md:text-2xl tracking-wider">Reviews</h2>
        {avg > 0 && (
          <div className="flex items-center gap-1 text-sm">
            <Star className="h-4 w-4 fill-primary text-primary" />
            <span className="font-semibold">{avg.toFixed(1)}</span>
            <span className="text-muted-foreground">/ 10 · {comments.filter((c) => c.rating).length} ratings</span>
          </div>
        )}
      </div>

      {user && (
        <form onSubmit={submit} className="glass rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-muted-foreground mr-2">Your rating:</span>
            {[1,2,3,4,5,6,7,8,9,10].map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setRating(n === rating ? 0 : n)}
                className="p-0.5"
                aria-label={`Rate ${n}`}
              >
                <Star className={`h-4 w-4 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </button>
            ))}
            {rating > 0 && <span className="text-xs ml-2 text-primary">{rating}/10</span>}
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your thoughts (max 1000 characters)…"
            maxLength={1000}
            className="bg-secondary/30"
          />
          <div className="flex justify-end">
            <Button disabled={busy} className="bg-gradient-red shadow-neon">Post review</Button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground">No reviews yet. Be the first!</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-8 w-8 rounded-full bg-primary/20 grid place-items-center text-xs font-semibold text-primary">
                  {(c.profile?.display_name || c.profile?.username || "?").slice(0,1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {c.profile?.display_name || c.profile?.username || "User"}
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {c.rating && (
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                    <span>{c.rating}/10</span>
                  </div>
                )}
                {(user?.id === c.user_id || isAdmin) && (
                  <Button size="icon" variant="ghost" onClick={() => del(c.id)} className="h-7 w-7">
                    <Trash2 className="h-3.5 w-3.5 text-primary" />
                  </Button>
                )}
              </div>
            </div>
            <p className="text-sm whitespace-pre-wrap">{c.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}