import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, RefreshCw, ExternalLink, X } from "lucide-react";

type Report = {
  id: string;
  movie_id: string;
  reporter_id: string;
  server: "voe" | "streamtape" | "doodstream";
  note: string | null;
  status: "open" | "resolved" | "dismissed";
  created_at: string;
};

const SERVER_LABELS: Record<Report["server"], string> = {
  voe: "Server 1 — Voe.sx",
  streamtape: "Server 2 — Streamtape",
  doodstream: "Server 3 — DoodStream",
};

const COLUMN_MAP: Record<Report["server"], "voe_sx_url" | "streamtape_url" | "doodstream_url"> = {
  voe: "voe_sx_url",
  streamtape: "streamtape_url",
  doodstream: "doodstream_url",
};

export default function BrokenServerReportsPanel() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [movies, setMovies] = useState<Record<string, any>>({});
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: r } = await supabase
      .from("server_reports" as any)
      .select("*")
      .order("created_at", { ascending: false });
    const list = ((r ?? []) as unknown) as Report[];
    setReports(list);
    const ids = Array.from(new Set(list.map((x) => x.movie_id)));
    if (ids.length) {
      const { data: m } = await supabase
        .from("movies")
        .select("id,title,poster_url,voe_sx_url,streamtape_url,doodstream_url,stream_url")
        .in("id", ids);
      const map: Record<string, any> = {};
      (m ?? []).forEach((mv: any) => { map[mv.id] = mv; });
      setMovies(map);
    } else {
      setMovies({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateLink = async (report: Report) => {
    const newUrl = (editing[report.id] ?? "").trim();
    if (!newUrl) return toast.error("Enter a new embed URL");
    const col = COLUMN_MAP[report.server];
    const movie = movies[report.movie_id];
    const patch: any = { [col]: newUrl };
    // If this server was the primary stream_url, refresh it too.
    if (movie?.stream_url && movie[col] && movie.stream_url === movie[col]) {
      patch.stream_url = newUrl;
    }
    const { error } = await supabase.from("movies").update(patch).eq("id", report.movie_id);
    if (error) return toast.error(error.message);
    await resolve(report, "resolved");
    toast.success("Server link updated and report resolved");
  };

  const resolve = async (report: Report, status: "resolved" | "dismissed") => {
    const { error } = await supabase
      .from("server_reports" as any)
      .update({ status, resolved_at: new Date().toISOString(), resolved_by: user?.id ?? null })
      .eq("id", report.id);
    if (error) return toast.error(error.message);
    load();
  };

  const open = reports.filter((r) => r.status === "open");
  const closed = reports.filter((r) => r.status !== "open");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl tracking-wider flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" /> Broken Server Reports
          </h2>
          <p className="text-xs text-muted-foreground">
            Viewer-flagged broken playback. Replace the embed URL or dismiss.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <section className="glass rounded-2xl divide-y divide-border/30">
        <div className="p-3 text-xs uppercase tracking-wider text-muted-foreground">
          Open ({open.length})
        </div>
        {open.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">No open reports. 🎉</div>
        )}
        {open.map((rep) => {
          const movie = movies[rep.movie_id];
          const col = COLUMN_MAP[rep.server];
          const currentUrl = movie?.[col];
          return (
            <div key={rep.id} className="p-4 space-y-3">
              <div className="flex gap-3 items-start">
                {movie?.poster_url && (
                  <img src={movie.poster_url} alt="" className="h-16 w-12 object-cover rounded" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{movie?.title ?? "Unknown movie"}</span>
                    <Badge variant="destructive">{SERVER_LABELS[rep.server]}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Reported {new Date(rep.created_at).toLocaleString()}
                  </div>
                  {rep.note && (
                    <p className="text-sm mt-2 p-2 rounded bg-background/40 border border-border/30">
                      {rep.note}
                    </p>
                  )}
                  {currentUrl && (
                    <a
                      href={currentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary inline-flex items-center gap-1 mt-2 break-all"
                    >
                      Current: {currentUrl} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Input
                  placeholder="Paste new embed URL for this server…"
                  value={editing[rep.id] ?? ""}
                  onChange={(e) => setEditing({ ...editing, [rep.id]: e.target.value })}
                  className="flex-1 min-w-[220px]"
                />
                <Button size="sm" onClick={() => updateLink(rep)}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Update & Resolve
                </Button>
                <Button size="sm" variant="outline" onClick={() => resolve(rep, "resolved")}>
                  Mark resolved
                </Button>
                <Button size="sm" variant="ghost" onClick={() => resolve(rep, "dismissed")}>
                  <X className="h-4 w-4 mr-1" /> Dismiss
                </Button>
              </div>
            </div>
          );
        })}
      </section>

      {closed.length > 0 && (
        <section className="glass rounded-2xl divide-y divide-border/30">
          <div className="p-3 text-xs uppercase tracking-wider text-muted-foreground">
            History ({closed.length})
          </div>
          {closed.slice(0, 20).map((rep) => {
            const movie = movies[rep.movie_id];
            return (
              <div key={rep.id} className="p-3 text-sm flex items-center justify-between gap-2">
                <div className="truncate">
                  <span className="font-medium">{movie?.title ?? rep.movie_id}</span>{" "}
                  <span className="text-muted-foreground">— {SERVER_LABELS[rep.server]}</span>
                </div>
                <Badge variant={rep.status === "resolved" ? "default" : "outline"}>
                  {rep.status}
                </Badge>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}