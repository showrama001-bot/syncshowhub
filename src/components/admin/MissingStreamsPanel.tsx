import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Check, Trash2, RefreshCw, Link2, ThumbsUp } from "lucide-react";

type Sub = {
  id: string;
  movie_id: string;
  user_id: string;
  url: string;
  note: string | null;
  status: string;
  created_at: string;
};
type Row = {
  id: string;
  title: string;
  poster_url: string | null;
  tmdb_id: number | null;
  year: number | null;
  votes: number;
  submissions: Sub[];
};

export default function MissingStreamsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualUrl, setManualUrl] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data: movies } = await supabase
      .from("movies")
      .select("id,title,poster_url,tmdb_id,year")
      .eq("status", "missing_stream")
      .order("created_at", { ascending: false });
    const ids = (movies ?? []).map((m: any) => m.id);
    const [{ data: votes }, { data: subs }] = await Promise.all([
      ids.length
        ? supabase.from("missing_stream_votes").select("movie_id").in("movie_id", ids)
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabase.from("missing_stream_submissions").select("*").in("movie_id", ids).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const voteMap = new Map<string, number>();
    (votes ?? []).forEach((v: any) => voteMap.set(v.movie_id, (voteMap.get(v.movie_id) ?? 0) + 1));
    const subMap = new Map<string, Sub[]>();
    (subs ?? []).forEach((s: any) => {
      const arr = subMap.get(s.movie_id) ?? [];
      arr.push(s);
      subMap.set(s.movie_id, arr);
    });
    setRows(
      (movies ?? []).map((m: any) => ({
        ...m,
        votes: voteMap.get(m.id) ?? 0,
        submissions: subMap.get(m.id) ?? [],
      })),
    );
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const publishWith = async (movieId: string, url: string, subId?: string) => {
    if (!url.trim()) return toast.error("URL required");
    const isEmbed = /^https?:\/\/.+(vidsrc|embed|autoembed|multiembed)/i.test(url);
    const { error } = await supabase
      .from("movies")
      .update({
        stream_url: url.trim(),
        status: "published",
        source_type: isEmbed ? "iframe" : "hls",
      })
      .eq("id", movieId);
    if (error) return toast.error(error.message);
    if (subId) {
      await supabase.from("missing_stream_submissions").update({ status: "approved" }).eq("id", subId);
    }
    toast.success("Published — now visible in the main grid.");
    load();
  };

  const rejectSub = async (id: string) => {
    const { error } = await supabase.from("missing_stream_submissions").update({ status: "rejected" }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const removeMovie = async (id: string) => {
    if (!confirm("Delete this suggested movie entirely?")) return;
    const { error } = await supabase.from("movies").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Missing Streams & Reports</h3>
          <p className="text-xs text-muted-foreground">
            Movies the 5-provider auto-check could not find. They live in the public "Suggested Movies" tab where users can vote and submit links.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground glass rounded-2xl p-6">No missing streams. 🎉</div>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-4 flex flex-col md:flex-row gap-4">
              <div className="flex gap-3 md:w-[280px]">
                {r.poster_url ? (
                  <img src={r.poster_url} alt={r.title} className="w-20 h-28 object-cover rounded" />
                ) : (
                  <div className="w-20 h-28 bg-muted rounded" />
                )}
                <div className="space-y-1 text-sm">
                  <div className="font-semibold">{r.title}</div>
                  <div className="text-xs text-muted-foreground">{r.year ?? "—"} · TMDB {r.tmdb_id ?? "—"}</div>
                  <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                    <ThumbsUp className="h-3 w-3" /> {r.votes} votes
                  </Badge>
                  <Button variant="ghost" size="sm" className="text-destructive px-0" onClick={() => removeMovie(r.id)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Delete
                  </Button>
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Manual fix: paste .m3u8 / .mp4 / embed URL"
                    value={manualUrl[r.id] ?? ""}
                    onChange={(e) => setManualUrl((m) => ({ ...m, [r.id]: e.target.value }))}
                  />
                  <Button onClick={() => publishWith(r.id, manualUrl[r.id] ?? "")}>
                    <Check className="h-4 w-4 mr-1" /> Publish
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    User submissions ({r.submissions.length})
                  </div>
                  {r.submissions.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic">No submissions yet.</div>
                  ) : (
                    r.submissions.map((s) => (
                      <div key={s.id} className="rounded-md border border-border/40 p-2 text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          <Link2 className="h-3 w-3" />
                          <a href={s.url} target="_blank" rel="noreferrer" className="truncate flex-1 text-primary hover:underline">
                            {s.url}
                          </a>
                          <Badge variant={s.status === "approved" ? "default" : s.status === "rejected" ? "destructive" : "secondary"}>
                            {s.status}
                          </Badge>
                        </div>
                        {s.note && <p className="text-muted-foreground">{s.note}</p>}
                        {s.status === "pending" && (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => publishWith(r.id, s.url, s.id)}>
                              <Check className="h-3 w-3 mr-1" /> Approve & publish
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => rejectSub(s.id)}>
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}