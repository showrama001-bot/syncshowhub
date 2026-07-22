
ALTER TABLE public.ads_settings
  ADD COLUMN IF NOT EXISTS popup_click_threshold integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS midroll_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS midroll_time_seconds integer NOT NULL DEFAULT 900,
  ADD COLUMN IF NOT EXISTS midroll_skip_seconds integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS reels_ad_every integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS reels_ad_duration integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS section_banner_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reels_ads_enabled boolean NOT NULL DEFAULT true;
