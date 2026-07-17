import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Radio } from "lucide-react";

type App = { id: string; status: string; bio: string; desired_username: string; sample_link: string | null; review_notes: string | null; created_at: string };

export default function ApplyStreamer() {
  const { user, loading, isApprovedStreamer } = useAuth();
  const [bio, setBio] = useState("");
  const [username, setUsername] = useState("");
  const [sample, setSample] = useState("");
  const [existing, setExisting] = useState<App | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("streamer_applications")
        .select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      setExisting((data as any) ?? null);
      setChecking(false);
    })();
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (isApprovedStreamer) return <Navigate to="/studio" replace />;

  const submit = async () => {
    if (bio.trim().length < 20) return toast.error("Tell us a bit more (min 20 chars)");
    if (!/^[a-zA-Z0-9_-]{3,24}$/.test(username)) return toast.error("Username: 3-24 chars, letters/numbers/_-");
    setBusy(true);
    const { error } = await supabase.from("streamer_applications").insert({
      user_id: user.id, bio: bio.trim(), desired_username: username.trim(), sample_link: sample.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Application submitted!");
    const { data } = await supabase.from("streamer_applications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    setExisting((data as any) ?? null);
  };

  return (
    <div className="pt-20 px-4 md:px-8 max-w-2xl mx-auto pb-16">
      <header className="mb-8">
        <h1 className="font-display text-3xl md:text-5xl tracking-wider neon-text flex items-center gap-3">
          <Radio className="h-8 w-8" /> Become a Streamer
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          Apply for streamer status. An admin will review and approve your application.
        </p>
      </header>

      {checking ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : existing && existing.status !== "rejected" ? (
        <section className="glass rounded-2xl p-6 space-y-3 border border-border/40">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge variant={existing.status === "approved" ? "default" : "secondary"}>{existing.status}</Badge>
          </div>
          <div><span className="text-xs text-muted-foreground">Desired username</span><p>@{existing.desired_username}</p></div>
          <div><span className="text-xs text-muted-foreground">Bio</span><p className="whitespace-pre-wrap">{existing.bio}</p></div>
          {existing.status === "pending" && <p className="text-sm text-muted-foreground">You'll be notified once reviewed.</p>}
        </section>
      ) : (
        <section className="glass rounded-2xl p-6 space-y-4 border border-border/40">
          {existing?.status === "rejected" && existing.review_notes && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              Previous application rejected: {existing.review_notes}
            </div>
          )}
          <div>
            <Label>Desired streamer username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. nightowl" />
            <p className="text-xs text-muted-foreground mt-1">Your public room URL: /room/{username || "your-name"}</p>
          </div>
          <div>
            <Label>About you & what you'll stream</Label>
            <Textarea rows={5} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about your streams…" />
          </div>
          <div>
            <Label>Sample link (optional)</Label>
            <Input value={sample} onChange={(e) => setSample(e.target.value)} placeholder="https://..." />
          </div>
          <Button onClick={submit} disabled={busy} className="w-full">
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Submit application
          </Button>
        </section>
      )}
    </div>
  );
}