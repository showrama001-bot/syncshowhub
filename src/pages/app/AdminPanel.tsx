import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, ShieldCheck } from "lucide-react";

type Row = {
  id: string; user_id: string; bio: string; desired_username: string; sample_link: string | null;
  status: string; review_notes: string | null; created_at: string;
  profiles?: { username: string | null; display_name: string | null } | null;
};

export default function AdminPanel() {
  const { loading, isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("streamer_applications")
      .select("*, profiles:user_id(username, display_name)")
      .order("created_at", { ascending: false });
    setRows((data as any) ?? []);
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const decide = async (id: string, status: "approved" | "rejected") => {
    setBusy(id);
    const { error } = await supabase.from("streamer_applications").update({
      status, review_notes: notes[id] || null,
    }).eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Approved" : "Rejected");
    load();
  };

  const pending = rows.filter(r => r.status === "pending");
  const reviewed = rows.filter(r => r.status !== "pending");

  return (
    <div className="pt-20 px-4 md:px-8 max-w-4xl mx-auto pb-16">
      <header className="mb-8">
        <h1 className="font-display text-3xl md:text-5xl tracking-wider neon-text flex items-center gap-3">
          <ShieldCheck className="h-8 w-8" /> Streamer Applications
        </h1>
      </header>

      <h2 className="text-lg font-semibold mb-3">Pending ({pending.length})</h2>
      <div className="space-y-3 mb-8">
        {pending.length === 0 && <p className="text-muted-foreground text-sm">No pending applications.</p>}
        {pending.map(r => (
          <div key={r.id} className="glass rounded-xl p-4 border border-border/40 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">@{r.desired_username}</p>
                <p className="text-xs text-muted-foreground">
                  {r.profiles?.display_name || r.profiles?.username || r.user_id.slice(0, 8)} · {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              <Badge variant="secondary">pending</Badge>
            </div>
            <p className="text-sm whitespace-pre-wrap">{r.bio}</p>
            {r.sample_link && (
              <a href={r.sample_link} target="_blank" rel="noreferrer" className="text-xs text-primary underline break-all">{r.sample_link}</a>
            )}
            <Textarea rows={2} placeholder="Optional review notes…"
              value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => decide(r.id, "approved")} disabled={busy === r.id}>
                <Check className="h-4 w-4 mr-1" /> Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => decide(r.id, "rejected")} disabled={busy === r.id}>
                <X className="h-4 w-4 mr-1" /> Reject
              </Button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold mb-3">Recently reviewed</h2>
      <div className="space-y-2">
        {reviewed.slice(0, 20).map(r => (
          <div key={r.id} className="flex justify-between items-center rounded-lg border border-border/30 p-3 text-sm">
            <span>@{r.desired_username}</span>
            <Badge variant={r.status === "approved" ? "default" : "destructive"}>{r.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}