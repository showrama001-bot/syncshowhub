
-- Placement enum
DO $$ BEGIN
  CREATE TYPE public.ad_placement AS ENUM ('preroll','popup','banner_header','banner_grid','banner_under_player','interstitial');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Settings (singleton)
CREATE TABLE IF NOT EXISTS public.ads_settings (
  id int PRIMARY KEY DEFAULT 1,
  master_enabled boolean NOT NULL DEFAULT true,
  preroll_enabled boolean NOT NULL DEFAULT true,
  preroll_skip_seconds int NOT NULL DEFAULT 10,
  popup_enabled boolean NOT NULL DEFAULT true,
  popup_interval_seconds int NOT NULL DEFAULT 300,
  popup_duration_seconds int NOT NULL DEFAULT 15,
  antiadblock_enabled boolean NOT NULL DEFAULT true,
  interstitial_seconds int NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ads_settings_single CHECK (id = 1)
);

GRANT SELECT ON public.ads_settings TO anon, authenticated;
GRANT ALL ON public.ads_settings TO authenticated, service_role;
ALTER TABLE public.ads_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ads_settings_read_all" ON public.ads_settings FOR SELECT USING (true);
CREATE POLICY "ads_settings_admin_write" ON public.ads_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.ads_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TRIGGER ads_settings_touch BEFORE UPDATE ON public.ads_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Assets
CREATE TABLE IF NOT EXISTS public.ads_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement public.ad_placement NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('video','image')),
  media_url text NOT NULL,
  redirect_url text,
  title text,
  weight int NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ads_assets TO anon, authenticated;
GRANT ALL ON public.ads_assets TO authenticated, service_role;
ALTER TABLE public.ads_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ads_assets_read_active" ON public.ads_assets FOR SELECT USING (active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ads_assets_admin_write" ON public.ads_assets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER ads_assets_touch BEFORE UPDATE ON public.ads_assets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS ads_assets_placement_active_idx ON public.ads_assets(placement, active);
