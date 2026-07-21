import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Trash2, ChevronDown, ChevronRight, Film, Tv2, Loader2 } from "lucide-react";

type MovieRow = { id: string; title: string; year: number | null; poster_url: string | null };
type SeriesRow = { id: string; title: string; year: number | null; poster_url: string | null };
type SeasonRow = { id: string; series_id: string; season_number: number; title: string | null };
type EpisodeRow = { id: string; season_id: string; episode_number: number; title: string | null; stream_url: string | null };

export default function ContentSearchTab() {
  const [q, setQ] = useState("");
  const [movies, setMovies] = useState<MovieRow[]>([]);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, { seasons: SeasonRow[]; episodes: Record<string, EpisodeRow[]>; openSeasons: Set<string> }>>({});

  const search = async () => {
    setLoading(true);
    try {
      const term = q.trim();
      const like = term ? `%${term}%` : "%";
      const [m, s] = await Promise.all([
        supabase.from("movies").select("id,title,year,poster_url").ilike("title", like).order("title").limit(50),
        supabase.from("series").select("id,title,year,poster_url").ilike("title", like).order("title").limit(50),
      ]);
      setMovies((m.data as MovieRow[]) || []);
      setSeries((s.data as SeriesRow[]) || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { search(); }, []);

  const deleteMovie = async (id: string, title: string) => {
    if (!confirm(`Delete movie "${title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("movies").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Movie deleted");
    setMovies((prev) => prev.filter((m) => m.id !== id));
  };

  const toggleSeries = async (sid: string) => {
    if (expanded[sid]) {
      const next = { ...expanded };
      delete next[sid];
      setExpanded(next);
      return;
    }
    const { data } = await supabase
      .from("seasons")
      .select("id, series_id, season_number, title")
      .eq("series_id", sid)
      .order("season_number");
    setExpanded((prev) => ({
      ...prev,
      [sid]: { seasons: (data as SeasonRow[]) || [], episodes: {}, openSeasons: new Set() },
    }));
  };

  const toggleSeason = async (sid: string, seasonId: string) => {
    const branch = expanded[sid];
    if (!branch) return;
    const open = new Set(branch.openSeasons);
    if (open.has(seasonId)) {
      open.delete(seasonId);
      setExpanded({ ...expanded, [sid]: { ...branch, openSeasons: open } });
      return;
    }
    if (!branch.episodes[seasonId]) {
      const { data } = await supabase
        .from("episodes")
        .select("id, season_id, episode_number, title, stream_url")
        .eq("season_id", seasonId)
        .order("episode_number");
      branch.episodes[seasonId] = (data as EpisodeRow[]) || [];
    }
    open.add(seasonId);
    setExpanded({ ...expanded, [sid]: { ...branch, openSeasons: open } });
  };

  const deleteEpisode = async (sid: string, seasonId: string, epId: string, label: string) => {
    if (!confirm(`Delete episode "${label}"?`)) return;
    const { error } = await supabase.from("episodes").delete().eq("id", epId);
    if (error) return toast.error(error.message);
    toast.success("Episode deleted");
    const branch = expanded[sid];
    if (branch) {
      branch.episodes[seasonId] = (branch.episodes[seasonId] || []).filter((e) => e.id !== epId);
      setExpanded({ ...expanded, [sid]: { ...branch } });
    }
  };

  const deleteSeries = async (sid: string, title: string) => {
    if (!confirm(`Delete entire series "${title}" (all seasons & episodes)? This cannot be undone.`)) return;
    const { error } = await supabase.from("series").delete().eq("id", sid);
    if (error) return toast.error(error.message);
    toast.success("Series deleted");
    setSeries((prev) => prev.filter((s) => s.id !== sid));
    const next = { ...expanded };
    delete next[sid];
    setExpanded(next);
  };

  const empty = !loading && movies.length === 0 && series.length === 0;

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-4 flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search movies & series by title…"
          className="bg-transparent border-none focus-visible:ring-0"
        />
        <Button onClick={search} disabled={loading} size="sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </div>

      {empty && (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">No results.</div>
      )}

      {movies.length > 0 && (
        <section>
          <h3 className="font-display text-lg tracking-wider mb-3 flex items-center gap-2">
            <Film className="h-4 w-4 text-primary" /> Movies <Badge variant="outline">{movies.length}</Badge>
          </h3>
          <div className="grid gap-2">
            {movies.map((m) => (
              <div key={m.id} className="glass rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-14 rounded overflow-hidden bg-secondary/50 shrink-0">
                  {m.poster_url && <img src={m.poster_url} alt={m.title} className="w-full h-full object-cover" loading="lazy" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{m.title}</div>
                  <div className="text-xs text-muted-foreground">{m.year || "—"}</div>
                </div>
                <Button size="sm" variant="destructive" onClick={() => deleteMovie(m.id, m.title)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {series.length > 0 && (
        <section>
          <h3 className="font-display text-lg tracking-wider mb-3 flex items-center gap-2">
            <Tv2 className="h-4 w-4 text-primary" /> Series <Badge variant="outline">{series.length}</Badge>
          </h3>
          <div className="space-y-2">
            {series.map((s) => {
              const branch = expanded[s.id];
              return (
                <div key={s.id} className="glass rounded-xl overflow-hidden">
                  <div className="p-3 flex items-center gap-3">
                    <button onClick={() => toggleSeries(s.id)} className="text-muted-foreground hover:text-primary">
                      {branch ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="w-10 h-14 rounded overflow-hidden bg-secondary/50 shrink-0">
                      {s.poster_url && <img src={s.poster_url} alt={s.title} className="w-full h-full object-cover" loading="lazy" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{s.title}</div>
                      <div className="text-xs text-muted-foreground">{s.year || "—"}</div>
                    </div>
                    <Button size="sm" variant="destructive" onClick={() => deleteSeries(s.id, s.title)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {branch && (
                    <div className="border-t border-border/40 bg-background/40 p-3 space-y-2">
                      {branch.seasons.length === 0 && (
                        <div className="text-xs text-muted-foreground">No seasons.</div>
                      )}
                      {branch.seasons.map((se) => {
                        const open = branch.openSeasons.has(se.id);
                        const eps = branch.episodes[se.id] || [];
                        return (
                          <div key={se.id} className="rounded-lg border border-border/40">
                            <button
                              onClick={() => toggleSeason(s.id, se.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary/40"
                            >
                              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              <span className="font-medium">Season {se.season_number}</span>
                              <span className="text-xs text-muted-foreground truncate">{se.title || ""}</span>
                            </button>
                            {open && (
                              <div className="px-3 pb-3 space-y-1">
                                {eps.length === 0 && (
                                  <div className="text-xs text-muted-foreground">No episodes.</div>
                                )}
                                {eps.map((ep) => (
                                  <div key={ep.id} className="flex items-center gap-3 py-1.5 border-t border-border/30">
                                    <span className="text-xs w-10 text-muted-foreground">E{ep.episode_number}</span>
                                    <span className="flex-1 truncate text-sm">{ep.title || "—"}</span>
                                    {ep.stream_url && <Badge variant="outline" className="text-[10px]">stream</Badge>}
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => deleteEpisode(s.id, se.id, ep.id, `S${se.season_number}E${ep.episode_number}`)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}