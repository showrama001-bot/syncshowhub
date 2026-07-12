import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Trash2, Clock, Ban, X, RefreshCw, Flag } from "lucide-react";
import { getDeviceFingerprint } from "@/lib/deviceFingerprint";

type ReportRow = {
  id: string;
  movie_id: string;
  reporter_id: string;
  reason: string;
  status: string;
  created_at: string;
  movie?: { id: string; title: string; poster_url: string | null; created_by: string | null; stream_url: string | null; year: number | null } | null;
  uploader?: { id: string; display_name: string | null; username: string | null; is_banned: boolean; suspended_until: string | null; permanent_banned: boolean } | null;
  uploader_email?: string | null;
  violation_count?: number;
};

export default function AbuseReportsPanel() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"open" | "all">("open");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("movie_reports").select("*").order("created_at", { ascending: false });
    if (statusFilter === "open") q = q.eq("status", "open");
    const { data: reports, error } = await q;
    if (error) { toast.error(error.message); setLoading(false); return; }

    const movieIds = Array.from(new Set((reports ?? []).map((r) => r.movie_id)));
    const { data: movies } = movieIds.length
      ? await supabase.from("movies").select("id, title, poster_url, created_by, stream_url, year").in("id", movieIds)
      : { data: [] as any[] };

    const uploaderIds = Array.from(new Set((movies ?? []).map((m: any) => m.created_by).filter(Boolean)));
    const { data: baseProfiles } = uploaderIds.length
      ? await supabase.from("profiles").select("id, display_name, username").in("id", uploaderIds as string[])
      : { data: [] as any[] };
    const { data: banRows } = uploaderIds.length
      ? await supabase.rpc("admin_get_ban_status", { _ids: uploaderIds as string[] })
      : { data: [] as any[] };
    const banMap = new Map<string, any>((banRows ?? []).map((b: any) => [b.id, b]));
    const profiles = (baseProfiles ?? []).map((p: any) => ({
      ...p,
      is_banned: banMap.get(p.id)?.is_banned ?? false,
      suspended_until: banMap.get(p.id)?.suspended_until ?? null,
      permanent_banned: banMap.get(p.id)?.permanent_banned ?? false,
    }));

    const { data: violations } = uploaderIds.length
      ? await supabase.from("user_violations").select("user_id").in("user_id", uploaderIds as string[])
      : { data: [] as any[] };
    const counts: Record<string, number> = {};
    (violations ?? []).forEach((v: any) => { counts[v.user_id] = (counts[v.user_id] ?? 0) + 1; });

    const enriched: ReportRow[] = (reports ?? []).map((r: any) => {
      const movie = (movies ?? []).find((m: any) => m.id === r.movie_id) ?? null;
      const uploader = movie ? (profiles ?? []).find((p: any) => p.id === movie.created_by) ?? null : null;
      return {
        ...r,
        movie,
        uploader,
        violation_count: uploader ? counts[uploader.id] ?? 0 : 0,
      };
    });
    setRows(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter]);

  const act = async (report: ReportRow, action: "delete_movie" | "suspend_3d" | "permanent_ban" | "dismiss") => {
    if (action === "permanent_ban" && !confirm("Permanently ban this user and block their device? This is irreversible.")) return;
    if (action === "delete_movie" && !confirm("Delete this movie?")) return;
    setBusyId(report.id);
    const body: any = { report_id: report.id, action };
    if (action === "permanent_ban") body.device_fingerprint = getDeviceFingerprint();
    const { data, error } = await supabase.functions.invoke("admin-abuse-action", { body });
    setBusyId(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Action failed");
      return;
    }
    toast.success("Action applied");
    load();
  };

  const reasonLabel = (r: string) => r === "inappropriate" ? "Inappropriate / Spam" : "Wrong Video";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Flag className="h-5 w-5 text-primary" />
        <span className="font-medium">Abuse & Reports</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant={statusFilter === "open" ? "default" : "outline"} onClick={() => setStatusFilter("open")}>Open</Button>
          <Button size="sm" variant={statusFilter === "all" ? "default" : "outline"} onClick={() => setStatusFilter("all")}>All</Button>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {loading && <div className="glass rounded-2xl p-6 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}

      {!loading && rows.length === 0 && (
        <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">No reports.</div>
      )}

      <div className="space-y-3">
        {rows.map((r) => {
          const vc = r.violation_count ?? 0;
          const suggested = vc >= 2 ? "permanent_ban" : "suspend_3d";
          return (
            <div key={r.id} className="glass rounded-2xl p-4 space-y-3 border border-border/40">
              <div className="flex gap-4 flex-wrap">
                {r.movie?.poster_url && <img src={r.movie.poster_url} alt="" className="h-24 w-16 object-cover rounded" />}
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{r.movie?.title ?? "(movie deleted)"}</span>
                    {r.movie?.year && <span className="text-xs text-muted-foreground">{r.movie.year}</span>}
                    <Badge variant="destructive">{reasonLabel(r.reason)}</Badge>
                    {r.status !== "open" && <Badge variant="outline">{r.status}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Reported {new Date(r.created_at).toLocaleString()}
                  </div>
                  {r.movie?.stream_url && (
                    <a href={r.movie.stream_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline break-all">
                      {r.movie.stream_url}
                    </a>
                  )}
                  <div className="mt-2 text-sm">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Uploader</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {r.uploader?.display_name || r.uploader?.username || (r.movie?.created_by ?? "Unknown")}
                      </span>
                      <Badge variant="outline" className={vc >= 2 ? "border-destructive text-destructive" : ""}>
                        {vc} prior violation{vc === 1 ? "" : "s"}
                      </Badge>
                      {r.uploader?.permanent_banned && <Badge variant="destructive">permanently banned</Badge>}
                      {r.uploader?.suspended_until && new Date(r.uploader.suspended_until) > new Date() && (
                        <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                          suspended until {new Date(r.uploader.suspended_until).toLocaleDateString()}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">user id: {r.movie?.created_by}</div>
                  </div>
                </div>
              </div>

              {r.status === "open" && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
                  <Button size="sm" variant="destructive" disabled={busyId === r.id} onClick={() => act(r, "delete_movie")}>
                    <Trash2 className="h-4 w-4 mr-1" /> Delete Movie
                  </Button>
                  <Button size="sm" variant={suggested === "suspend_3d" ? "default" : "outline"} disabled={busyId === r.id} onClick={() => act(r, "suspend_3d")}>
                    <Clock className="h-4 w-4 mr-1" /> Suspend 3 Days
                  </Button>
                  <Button size="sm" variant={suggested === "permanent_ban" ? "destructive" : "outline"} disabled={busyId === r.id} onClick={() => act(r, "permanent_ban")}>
                    <Ban className="h-4 w-4 mr-1" /> Permanent Device Ban
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => act(r, "dismiss")}>
                    <X className="h-4 w-4 mr-1" /> Dismiss
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}