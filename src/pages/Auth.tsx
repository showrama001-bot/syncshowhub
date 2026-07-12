import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import heroBg from "@/assets/hero-bg.jpg";
import {
  validatePasswordStrength,
  PASSWORD_POLICY_MESSAGE,
  getLoginLockRemainingMs,
  recordLoginFailure,
  resetLoginFailures,
  formatLockoutMessage,
} from "@/lib/passwordPolicy";

export default function Auth() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const rawNext = params.get("next") ?? "";
  const safeNext = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "";
  const { user, isAdmin, roleLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    if (user && !roleLoading) {
      if (safeNext) {
        window.location.href = safeNext;
      } else {
        nav(isAdmin ? "/admin/dashboard/hub-secure-2026" : "/", { replace: true });
      }
    }
  }, [user, isAdmin, roleLoading, nav, safeNext]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const lockMs = getLoginLockRemainingMs();
    if (lockMs > 0) {
      toast.error(formatLockoutMessage(lockMs));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const { locked, remainingMs } = recordLoginFailure();
      if (locked) return toast.error(formatLockoutMessage(remainingMs));
      return toast.error(error.message);
    }
    resetLoginFailures();
    toast.success("Welcome back!");
    // redirect handled by useEffect based on isAdmin
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const pwErr = validatePasswordStrength(password);
    if (pwErr) return toast.error(pwErr);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`,
        data: { username, display_name: username },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email to verify your account before signing in.");
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (error) return toast.error(error.message);
    toast.success("If that email exists, a reset link was sent.");
    setForgotOpen(false);
  };

  const google = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: safeNext
        ? `${window.location.origin}/auth?next=${encodeURIComponent(safeNext)}`
        : window.location.origin,
    });
    if (result.error) {
      setLoading(false);
      toast.error("Google sign-in failed");
    }
  };

  return (
    <div className="min-h-screen relative grid place-items-center px-4 overflow-hidden">
      <img
        src={heroBg}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-70"
      />
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="relative w-full max-w-md glass rounded-3xl p-8 shadow-card animate-float-up">
        <h1 className="font-display text-4xl text-center tracking-widest neon-text animate-flicker mb-1">
          SYNCSHOW
        </h1>
        <p className="text-center text-muted-foreground text-sm mb-6">
          Stream. Sync. Share.
        </p>
        <Tabs defaultValue="signin">
          <TabsList className="grid grid-cols-2 w-full bg-secondary/50">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <form onSubmit={signIn} className="space-y-4 mt-4">
              <div>
                <Label>Email</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gradient-red shadow-neon">
                Sign in
              </Button>
              <div className="text-center">
                <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
                  <DialogTrigger asChild>
                    <button type="button" className="text-xs text-primary hover:underline">Forgot password?</button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Reset your password</DialogTitle></DialogHeader>
                    <form onSubmit={sendReset} className="space-y-3">
                      <Label>Email</Label>
                      <Input type="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="you@example.com" />
                      <Button type="submit" disabled={forgotLoading} className="w-full bg-gradient-red shadow-neon">Send reset link</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={signUp} className="space-y-4 mt-4">
              <div>
                <Label>Username</Label>
                <Input required value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                <p className="text-[11px] text-muted-foreground mt-1">{PASSWORD_POLICY_MESSAGE}</p>
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gradient-red shadow-neon">
                Create account
              </Button>
            </form>
          </TabsContent>
        </Tabs>
        <div className="my-5 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-px bg-border flex-1" /> OR <div className="h-px bg-border flex-1" />
        </div>
        <Button variant="outline" onClick={google} disabled={loading} className="w-full glass">
          Continue with Google
        </Button>
      </div>
    </div>
  );
}