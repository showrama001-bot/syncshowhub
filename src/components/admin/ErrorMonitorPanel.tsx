import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, RefreshCw, Trash2, Loader2, ChevronDown, ChevronRight } from "lucide-react";

type Row = {
  id: string;
  created_at: string;
  user_id: string | null;
  level: "error" | "warn" | "info";
  area: "player" | "admin" | "app";
  source: string;
  message: string;
  stack: string | null;
  route: string | null;
  user_agent: string | null;
  status_code: number | null;
  request_url: string | null;
  context: any;
  resolved: boolean;
};

const RANGES = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 } as const;
type RangeKey = keyof typeof RANGES;

export default function ErrorMonitorPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<RangeKey>("24h");
  const [area, setArea] = useState<"all" | "player" | "admin" | "app">("all");
  const [status, setStatus] = useState<"open" | "all">("open");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - RANGES[range] * 3600_000).toISOString();
    let q = supabase
      .from("client_error_logs" as any)
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(300);
    if (area !== "all") q = q.eq("area", area);
    if (status === "open") q = q.eq("resolved", false);
    const { data, error } = await q;
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as any);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range, area, status]);

  // Live alerting: new errors surface as toasts while the panel is open.
  useEffect(() => {
    const ch = supabase
      .channel("client-error-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "client_error_logs" }, (p: any) => {
        const r = p.new as Row;
        setRows((prev) => [r, ...prev].slice(0, 300));
        if (r.level === "error") {
          toast.error(`New ${r.area} error`, { description: r.message.slice(0, 120) });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const player = rows.filter((r) => r.area === "player").length;
    const admin = rows.filter((r) => r.area === "admin").length;
    const network = rows.filter((r) => r.source === "network").length;
    return { total, player, admin, network };
  }, [rows]);

  const resolve = async (r: Row) => {
    setBusy(r.id);
    const { error } = await supabase
      .from("client_error_logs" as any)
      .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: user?.id ?? null })
      .eq("id", r.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    setRows((prev) => (status === "open" ? prev.filter((x) => x.id !== r.id) : prev.map((x) => x.id === r.id ? { ...x, resolved: true } : x)));
  };

  const remove = async (r: Row) => {
    setBusy(r.id);
    const { error } = await supabase.from("client_error_logs" as any).delete().eq("id", r.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    setRows((prev) => prev.filter((x) => x.id !== r.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <SelectTrigger className="w-36 glass"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
        <Select value={area} onValueChange={(v) => setArea(v as any)}>
          <SelectTrigger className="w-36 glass"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All areas</SelectItem>
            <SelectItem value="player">Player</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="app">App</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as any)}>
          <SelectTrigger className="w-36 glass"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Unresolved</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="glass" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total events", value: stats.total },
          { label: "Player errors", value: stats.player },
          { label: "Admin errors", value: stats.admin },
          { label: "Failed requests", value: stats.network },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl p-4">
            <div className="text-2xl font-semibold">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center text-muted-foreground text-sm">
          No errors recorded for this filter. 🎉
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="glass rounded-xl p-3">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  className="mt-0.5 text-muted-foreground"
                  onClick={() => setOpen(open === r.id ? null : r.id)}
                  aria-label="Toggle details"
                >
                  {open === r.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant={r.level === "error" ? "destructive" : "secondary"} className="uppercase text-[10px]">
                      {r.level}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] uppercase">{r.area}</Badge>
                    <span className="text-[11px] text-muted-foreground">{r.source}</span>
                    {r.status_code != null && (
                      <span className="text-[11px] text-muted-foreground">· HTTP {r.status_code}</span>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      · {new Date(r.created_at).toLocaleString()}
                    </span>
                    {r.resolved && <Badge className="text-[10px]">resolved</Badge>}
                  </div>
                  <div className="text-sm break-words flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500 mt-0.5" />
                    <span>{r.message}</span>
                  </div>
                  {r.route && <div className="text-[11px] text-muted-foreground mt-1">route: {r.route}</div>}
                  {open === r.id && (
                    <div className="mt-3 space-y-2 text-[11px] text-muted-foreground">
                      {r.request_url && <div className="break-all">URL: {r.request_url}</div>}
                      {r.user_agent && <div className="break-all">UA: {r.user_agent}</div>}
                      {r.stack && (
                        <pre className="whitespace-pre-wrap break-all bg-secondary/40 rounded p-2 max-h-48 overflow-auto">
                          {r.stack}
                        </pre>
                      )}
                      {r.context && (
                        <pre className="whitespace-pre-wrap break-all bg-secondary/40 rounded p-2 max-h-48 overflow-auto">
                          {JSON.stringify(r.context, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!r.resolved && (
                    <Button size="sm" variant="outline" className="glass" disabled={busy === r.id} onClick={() => resolve(r)}>
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="glass" disabled={busy === r.id} onClick={() => remove(r)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
