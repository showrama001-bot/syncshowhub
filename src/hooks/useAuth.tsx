import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isDeviceBanned } from "@/lib/deviceFingerprint";
import { toast } from "sonner";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  roleLoading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  roleLoading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setRoleLoading(true);
        setTimeout(async () => {
          // Enforce bans / suspensions
          const banned = await enforceBan(s.user.id);
          if (banned) return;
          const { data } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", s.user.id)
            .eq("role", "admin")
            .maybeSingle();
          setIsAdmin(!!data);
          setRoleLoading(false);
        }, 0);
      } else {
        setIsAdmin(false);
        setRoleLoading(false);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        const banned = await enforceBan(data.session.user.id);
        if (banned) { setLoading(false); return; }
        const { data: r } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.session.user.id)
          .eq("role", "admin")
          .maybeSingle();
        setIsAdmin(!!r);
        setRoleLoading(false);
      } else {
        setRoleLoading(false);
      }
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Returns true if user was signed out due to a ban/suspension.
  const enforceBan = async (userId: string): Promise<boolean> => {
    try {
      const { data: rows } = await supabase.rpc("get_my_ban_status");
      const prof = Array.isArray(rows) ? rows[0] : rows;
      if (prof?.permanent_banned) {
        toast.error("Your account has been permanently banned.");
        await supabase.auth.signOut();
        return true;
      }
      if (prof?.suspended_until && new Date(prof.suspended_until) > new Date()) {
        toast.error(`Account suspended until ${new Date(prof.suspended_until).toLocaleString()}`);
        await supabase.auth.signOut();
        return true;
      }
      if (await isDeviceBanned(supabase)) {
        toast.error("This device has been banned.");
        await supabase.auth.signOut();
        return true;
      }
    } catch {}
    return false;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ user: session?.user ?? null, session, loading, isAdmin, roleLoading, signOut }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);