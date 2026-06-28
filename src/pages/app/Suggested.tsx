import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, ThumbsUp, Link2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Movie = {
  id: string;
  title: string;
  poster_url: string | null;
  year: number | null;
  genre: string | null;
  description: string | null;
  tmdb_id: number | null;
};

export default function Suggested() {
  const { user } = useAuth();
  const [items, setItems] = useState<Movie[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [subCounts, setSubCounts] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Movie | null>(null);
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitNote, setSubmitNote] = useState("");

  const load = async () => {
    const { data: movies } = await supabase
      .from("movies")
      .select("id,title,poster_url,year,genre,description,tmdb_id")
      .eq("status", "missing_stream")
      .order("created_at", { ascending: false });
    const list = (movies ?? []) as Movie[];
    setItems(list);
    const ids = list.map((m) => m.id);
    if (!ids.length) return;
    const [{ data: votes }, { data: mine }, { data: subs }] = await Promise.all([
      supabase.from("missing_stream_votes").select("movie_id").in("movie_id", ids),
      user
        ? supabase.from("missing_stream_votes").select("movie_id").in("movie_id", ids).eq("user_id", user.id)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("missing_stream_submissions").select("movie_id").in("movie_id", ids),
    ]);
    const vc: Record<string, number> = {};
    (votes ?? []).forEach((v: any) => { vc[v.movie_id] = (vc[v.movie_id] ?? 0) + 1; });
    setVoteCounts(vc);
    setMyVotes(new Set((mine ?? []).map((v: any) => v.movie_id)));
    const sc: Record<string, number> = {};
    (subs ?? []).forEach((s: any) => { sc[s.movie_id] = (sc[s.movie_id] ?? 0) + 1; });
    setSubCounts(sc);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((m) => m.title.toLowerCase().includes(needle));
  }, [items, q]);

  const toggleVote = async (m: Movie) => {
    if (!user) return toast.error("Sign in to vote");
    if (myVotes.has(m.id)) {
      const { error } = await supabase.from("missing_stream_votes").delete().eq("movie_id", m.id).eq("user_id", user.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("missing_stream_votes").insert({ movie_id: m.id, user_id: user.id });
      if (error) return toast.error(error.message);
    }
    load();
  };

  const submitStream = async () => {
    if (!open || !user) return;
    if (!/^https?:\/\//i.test(submitUrl.trim())) return toast.error("Enter a valid http(s) URL");
    const { error } = await supabase.from("missing_stream_submissions").insert({
      movie_id: open.id,
      user_id: user.id,
      url: submitUrl.trim(),
      note: submitNote.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Thanks! Your link is pending admin review.");
    setSubmitUrl(""); setSubmitNote(""); setOpen(null); load();
  };

  return (
    <div className="px-6 md:px-12 pt-20 pb-16 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="font-display text-3xl md:text-5xl tracking-wider neon-text flex items-center gap-3">
            <Sparkles className="h-7 w-7 text-primary" /> Suggested Movies
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Titles we couldn't auto-find on any provider yet. Vote them up or submit a working stream to help.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search suggested titles…" className="pl-9 glass border-border/50" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground">No suggested titles yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((m) => (
            <div key={m.id} className="group glass rounded-2xl overflow-hidden hover:neon-border transition flex flex-col">
              <div className="aspect-[2/3] bg-secondary overflow-hidden relative">
                {m.poster_url ? (
                  <img src={m.poster_url} alt={m.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition" />
                ) : (
                  <div className="w-full h-full grid place-items-center font-display text-primary/60">{m.title.slice(0, 2)}</div>
                )}
                <Badge className="absolute top-2 right-2 bg-yellow-500/90 text-black border-0">Missing stream</Badge>
              </div>
              <div className="p-3 flex-1 flex flex-col gap-2">
                <div>
                  <div className="font-semibold truncate">{m.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{m.year} {m.genre ? `· ${m.genre}` : ""}</div>
                </div>
                <div className="flex gap-2 mt-auto">
                  <Button
                    size="sm"
                    variant={myVotes.has(m.id) ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => toggleVote(m)}
                  >
                    <ThumbsUp className="h-3 w-3 mr-1" /> {voteCounts[m.id] ?? 0}
                  </Button>
                  <Dialog open={open?.id === m.id} onOpenChange={(v) => !v && setOpen(null)}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setOpen(m)}>
                        <Link2 className="h-3 w-3 mr-1" /> {subCounts[m.id] ?? 0}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Submit a stream for "{m.title}"</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <Input
                          placeholder="https://.../master.m3u8 or direct .mp4"
                          value={submitUrl}
                          onChange={(e) => setSubmitUrl(e.target.value)}
                        />
                        <Textarea
                          placeholder="Optional note (source, quality, language…)"
                          value={submitNote}
                          onChange={(e) => setSubmitNote(e.target.value)}
                        />
                        <Button onClick={submitStream} className="w-full">
                          <Send className="h-4 w-4 mr-1" /> Send to admin for review
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}