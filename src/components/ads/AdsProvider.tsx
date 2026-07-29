import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdConfig, DEFAULT_AD_CONFIG, fetchAdConfig } from "@/lib/ads";

interface Ctx {
  config: AdConfig;
  enabled: boolean;
  refresh: () => Promise<void>;
}

const AdsCtx = createContext<Ctx | null>(null);

export const AdsProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<AdConfig>(DEFAULT_AD_CONFIG);

  const refresh = useCallback(async () => {
    setConfig(await fetchAdConfig());
  }, []);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("ad-system-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "ad_system" }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refresh]);

  const value = useMemo<Ctx>(
    () => ({ config, enabled: config.master_enabled, refresh }),
    [config, refresh],
  );

  return <AdsCtx.Provider value={value}>{children}</AdsCtx.Provider>;
};

export const useAds = () => {
  const ctx = useContext(AdsCtx);
  if (!ctx) throw new Error("useAds must be used within AdsProvider");
  return ctx;
};
