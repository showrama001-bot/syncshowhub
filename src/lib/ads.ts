import { supabase } from "@/integrations/supabase/client";

export interface BreakAd {
  id: string;
  url: string;
  title?: string | null;
  link?: string | null;
}

export interface AdConfig {
  master_enabled: boolean;

  // 1. External & banner ad networks
  network_enabled: boolean;
  global_scripts: string;
  header_banner_script: string;
  grid_banner_script: string;
  under_player_script: string;

  // 2. VIP premium spots
  vip_enabled: boolean;
  pause_banner_url: string | null;
  pause_banner_link: string | null;
  hero_banner_url: string | null;
  hero_banner_link: string | null;
  room_takeover_url: string | null;

  // 3. Timeline video ads
  timeline_enabled: boolean;
  preroll_url: string | null;
  preroll_link: string | null;
  postroll_url: string | null;
  postroll_link: string | null;
  skip_seconds: number;

  // 4. TV commercial break
  break_enabled: boolean;
  break_trigger_seconds: number;
  hook_image_url: string | null;
  hook_duration_seconds: number;
  break_queue: BreakAd[];
}

export const DEFAULT_AD_CONFIG: AdConfig = {
  master_enabled: true,
  network_enabled: true,
  global_scripts: "",
  header_banner_script: "",
  grid_banner_script: "",
  under_player_script: "",
  vip_enabled: true,
  pause_banner_url: null,
  pause_banner_link: null,
  hero_banner_url: null,
  hero_banner_link: null,
  room_takeover_url: null,
  timeline_enabled: true,
  preroll_url: null,
  preroll_link: null,
  postroll_url: null,
  postroll_link: null,
  skip_seconds: 5,
  break_enabled: false,
  break_trigger_seconds: 1800,
  hook_image_url: null,
  hook_duration_seconds: 5,
  break_queue: [],
};

export async function fetchAdConfig(): Promise<AdConfig> {
  const { data } = await (supabase.from("ad_system" as any).select("*").eq("id", 1).maybeSingle() as any);
  if (!data) return DEFAULT_AD_CONFIG;
  return {
    ...DEFAULT_AD_CONFIG,
    ...(data as any),
    break_queue: Array.isArray((data as any).break_queue) ? ((data as any).break_queue as BreakAd[]) : [],
  };
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
