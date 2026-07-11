import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { validatePasswordStrength, PASSWORD_POLICY_MESSAGE } from "@/lib/passwordPolicy";

export default function ResetPassword() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase auto-handles recovery hash and emits a PASSWORD_RECOVERY event
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // If user already has a session from the link, allow update too
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pwErr = validatePasswordStrength(password);
    if (pwErr) return toast.error(pwErr);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. Please sign in.");
    await supabase.auth.signOut();
    nav("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-background">
      <div className="w-full max-w-md glass rounded-3xl p-8 shadow-card">
        <h1 className="font-display text-3xl tracking-widest neon-text mb-2 text-center">Reset Password</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          {ready ? "Enter your new password below." : "Verifying recovery link…"}
        </p>
        {ready && (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>New password</Label>
              <Input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="text-[11px] text-muted-foreground mt-1">{PASSWORD_POLICY_MESSAGE}</p>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gradient-red shadow-neon">
              Update password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}