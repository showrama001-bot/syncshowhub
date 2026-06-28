import { supabase } from "@/integrations/supabase/client";

export type AdPlacement =
  | "preroll"
  | "popup"
  | "banner_header"
  | "banner_grid"
  | "banner_under_player"
  | "interstitial";

export interface AdAsset {
  id: string;
  placement: AdPlacement;
  media_type: "video" | "image";
  media_url: string | null;
  ad_mode: "direct" | "script";
  script_code: string | null;
  redirect_url: string | null;
  title: string | null;
  weight: number;
  active: boolean;
}

export interface AdsSettings {
  master_enabled: boolean;
  preroll_enabled: boolean;
  preroll_skip_seconds: number;
  popup_enabled: boolean;
  popup_interval_seconds: number;
  popup_duration_seconds: number;
  antiadblock_enabled: boolean;
  interstitial_seconds: number;
  global_scripts: string;
  antiadblock_message: string;
}

export const DEFAULT_SETTINGS: AdsSettings = {
  master_enabled: true,
  preroll_enabled: true,
  preroll_skip_seconds: 10,
  popup_enabled: true,
  popup_interval_seconds: 300,
  popup_duration_seconds: 15,
  antiadblock_enabled: true,
  interstitial_seconds: 10,
  global_scripts: "",
  antiadblock_message:
    "We rely on ads to keep SyncShow free. Please disable your ad blocker and reload the page to continue watching.",
};

export async function fetchAdsSettings(): Promise<AdsSettings> {
  const { data } = await (supabase.from("ads_settings" as any).select("*").eq("id", 1).maybeSingle() as any);
  return (data as AdsSettings) ?? DEFAULT_SETTINGS;
}

export async function fetchAdsAssets(): Promise<AdAsset[]> {
  const { data } = await (supabase
    .from("ads_assets" as any)
    .select("*")
    .eq("active", true) as any);
  return (data as AdAsset[]) ?? [];
}

export function pickWeighted(assets: AdAsset[], placement: AdPlacement): AdAsset | null {
  const pool = assets.filter((a) => a.placement === placement && a.active);
  if (!pool.length) return null;
  const total = pool.reduce((s, a) => s + Math.max(1, a.weight || 1), 0);
  let r = Math.random() * total;
  for (const a of pool) {
    r -= Math.max(1, a.weight || 1);
    if (r <= 0) return a;
  }
  return pool[0];
}