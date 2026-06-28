
-- Source type for streams
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'hls';
ALTER TABLE public.tv_channels ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'hls';
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'hls';

-- Ban flag
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

-- Admin can update any profile (existing policy only allows self)
DROP POLICY IF EXISTS "admins update any profile" ON public.profiles;
CREATE POLICY "admins update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Block banned users from sending DMs
DROP POLICY IF EXISTS "send dms" ON public.direct_messages;
CREATE POLICY "send dms" ON public.direct_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND NOT public.is_blocked(auth.uid(), recipient_id)
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_banned)
  );
