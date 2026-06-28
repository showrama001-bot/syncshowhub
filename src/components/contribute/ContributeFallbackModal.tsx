import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Sparkles, Tv2, Film } from "lucide-react";
import { Link } from "react-router-dom";
import { searchTmdbAny } from "@/lib/contribute";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** What the user just typed into the catalogue search bar. */
  query: string;
};

/**
 * When a catalogue search returns no results we pop this modal: it runs the
 * exact same query against TMDB (movies + series) and offers a one-click jump
 * into the contribute flow for whichever title the user meant.
 */
export function ContributeFallbackModal({ open, onOpenChange, query }: Props) {
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof searchTmdbAny>>>([]);

  useEffect(() => {
    if (!open || !query.trim()) return;
    setBusy(true);
    setRows([]);
    searchTmdbAny(query)
      .then(setRows)
      .finally(() => setBusy(false));
  }, [open, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display tracking-wider">
            <Sparkles className="h-5 w-5 text-primary" /> Not in the catalogue yet
          </DialogTitle>
          <DialogDescription>
            No results for <span className="text-foreground font-semibold">"{query}"</span>. Pick a match from TMDB and
            contribute it — series uploads jump straight to the next missing episode.
          </DialogDescription>
        </DialogHeader>

        {busy ? (
          <div className="py-10 flex items-center justify-center text-muted-foreground gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching TMDB…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-6 text-sm text-muted-foreground text-center">
            Nothing matched on TMDB either. Try a different spelling.
          </div>
        ) : (
          <ul className="space-y-2 max-h-[60vh] overflow-auto">
            {rows.map((r) => (
              <li key={`${r.kind}-${r.tmdb_id}`}>
                <Link
                  to={
                    r.kind === "series"
                      ? `/contribute?series_tmdb_id=${r.tmdb_id}`
                      : `/upload-share?movie_tmdb_id=${r.tmdb_id}`
                  }
                  onClick={() => onOpenChange(false)}
                  className="w-full flex gap-3 p-3 rounded-xl border border-border/40 hover:border-primary/60 hover:bg-primary/5 transition"
                >
                  {r.poster_url ? (
                    <img src={r.poster_url} alt="" loading="lazy" draggable={false}
                      className="w-12 h-16 object-cover rounded select-none pointer-events-none" />
                  ) : (
                    <div className="w-12 h-16 rounded bg-secondary grid place-items-center text-xs text-muted-foreground">N/A</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{r.title}</span>
                      <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 inline-flex items-center gap-1">
                        {r.kind === "series" ? <Tv2 className="h-3 w-3" /> : <Film className="h-3 w-3" />}
                        {r.kind}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">{r.year ?? "—"}</div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{r.description}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}