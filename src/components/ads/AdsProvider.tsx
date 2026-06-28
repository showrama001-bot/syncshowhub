import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdAsset, AdsSettings, DEFAULT_SETTINGS, fetchAdsAssets, fetchAdsSettings, pickWeighted, AdPlacement } from "@/lib/ads";

interface Ctx {
  settings: AdsSettings;
  assets: AdAsset[];
  enabled: boolean;
  pick: (placement: AdPlacement) => AdAsset | null;
  refresh: () => Promise<void>;
}

const AdsCtx = createContext<Ctx | null>(null);

export const AdsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<AdsSettings>(DEFAULT_SETTINGS);
  const [assets, setAssets] = useState<AdAsset[]>([]);

  const refresh = useCallback(async () => {
    const [s, a] = await Promise.all([fetchAdsSettings(), fetchAdsAssets()]);
    setSettings(s);
    setAssets(a);
  }, []);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("ads-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "ads_settings" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "ads_assets" }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refresh]);

  const value = useMemo<Ctx>(
    () => ({
      settings,
      assets,
      enabled: settings.master_enabled,
      pick: (p) => pickWeighted(assets, p),
      refresh,
    }),
    [settings, assets, refresh],
  );

  return <AdsCtx.Provider value={value}>{children}</AdsCtx.Provider>;
};

export const useAds = () => {
  const ctx = useContext(AdsCtx);
  if (!ctx) throw new Error("useAds must be used within AdsProvider");
  return ctx;
};