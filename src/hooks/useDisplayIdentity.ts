import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function emailLocalPart(email?: string | null) {
  if (!email) return "";
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

/** Returns a public-safe identity for the current user. Never exposes the email. */
export function useDisplayIdentity() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ username: string | null; display_name: string | null } | null>(null);

  useEffect(() => {
    if (!user) { setProfile(null); return; }
    supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile((data as any) ?? null));
  }, [user?.id]);

  const fallback = emailLocalPart(user?.email);
  const displayName = profile?.display_name || profile?.username || fallback || "Guest";
  const handle = profile?.username || fallback || "user";
  return { displayName, handle, username: profile?.username ?? null, displayNameOnly: profile?.display_name ?? null };
}