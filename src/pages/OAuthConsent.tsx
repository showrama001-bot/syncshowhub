import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

function isSafeNext(path: string) {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const anyAuth = (supabase.auth as any).oauth;
      if (!anyAuth?.getAuthorizationDetails) {
        setError("OAuth authorization API is unavailable in this build.");
        return;
      }
      const { data, error: err } = await anyAuth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (err) return setError(err.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) { window.location.href = immediate; return; }
      setDetails(data);
    })();
    return () => { active = false; };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const anyAuth = (supabase.auth as any).oauth;
    const { data, error: err } = approve
      ? await anyAuth.approveAuthorization(authorizationId)
      : await anyAuth.denyAuthorization(authorizationId);
    if (err) { setBusy(false); return setError(err.message); }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); return setError("No redirect returned by the authorization server."); }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="glass rounded-2xl p-6 max-w-md w-full">
          <h1 className="font-display text-2xl mb-2">Authorization error</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }
  if (!details) {
    return (
      <main className="min-h-screen grid place-items-center p-6 text-muted-foreground">
        Loading authorization…
      </main>
    );
  }
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="glass rounded-2xl p-6 max-w-md w-full space-y-4">
        <h1 className="font-display text-2xl">
          Connect {details.client?.name ?? "an app"} to SyncShow
        </h1>
        <p className="text-sm text-muted-foreground">
          {details.client?.name ?? "This client"} is requesting access to act as you on SyncShow.
        </p>
        <div className="flex gap-3 pt-2">
          <Button disabled={busy} className="flex-1 bg-gradient-red shadow-neon" onClick={() => decide(true)}>Approve</Button>
          <Button disabled={busy} variant="outline" className="flex-1" onClick={() => decide(false)}>Deny</Button>
        </div>
      </div>
    </main>
  );
}

export { isSafeNext };