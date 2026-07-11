import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Shield } from "lucide-react";

export default function AdminLogin() {
  const nav = useNavigate();
  const { user, loading, isAdmin } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && isAdmin) {
      nav("/admin/dashboard/hub-secure-2026", { replace: true });
    }
  }, [loading, isAdmin, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in first");
      nav("/auth");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-login", {
      body: { password },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Login failed");
      return;
    }
    toast.success("Admin access granted");
    // Verify the role was assigned, then navigate to /admin
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      toast.error("Admin role not assigned. Please try again.");
      return;
    }
    // Hard reload so AuthProvider re-fetches the role state
    window.location.replace("/admin/dashboard/hub-secure-2026");
  };

  if (loading) return null;

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-background">
      <form onSubmit={submit} className="glass rounded-3xl p-8 w-full max-w-md space-y-5 shadow-card">
        <div className="text-center space-y-2">
          <Shield className="h-10 w-10 mx-auto text-primary" />
          <h1 className="font-display text-2xl tracking-widest neon-text">ADMIN ACCESS</h1>
          <p className="text-sm text-muted-foreground">
            Enter the admin password to unlock the dashboard.
          </p>
          {!user && (
            <p className="text-xs text-primary">You must sign in first.</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Admin password</Label>
          <Input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <Button disabled={busy || !user} className="w-full bg-gradient-red shadow-neon">
          {busy ? "Verifying…" : "Unlock Admin"}
        </Button>
        <button
          type="button"
          onClick={() => nav("/")}
          className="w-full text-xs text-muted-foreground hover:text-primary"
        >
          ← Back to app
        </button>
      </form>
    </div>
  );
}