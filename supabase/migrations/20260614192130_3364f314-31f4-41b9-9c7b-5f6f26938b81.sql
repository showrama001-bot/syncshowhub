
ALTER TABLE public.ads_assets
  ADD COLUMN IF NOT EXISTS ad_mode text NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS script_code text,
  ALTER COLUMN media_url DROP NOT NULL;

ALTER TABLE public.ads_assets
  DROP CONSTRAINT IF EXISTS ads_assets_ad_mode_check;
ALTER TABLE public.ads_assets
  ADD CONSTRAINT ads_assets_ad_mode_check CHECK (ad_mode IN ('direct','script'));

ALTER TABLE public.ads_settings
  ADD COLUMN IF NOT EXISTS global_scripts text DEFAULT '',
  ADD COLUMN IF NOT EXISTS antiadblock_message text DEFAULT 'We rely on ads to keep SyncShow free. Please disable your ad blocker and reload the page to continue watching.';
