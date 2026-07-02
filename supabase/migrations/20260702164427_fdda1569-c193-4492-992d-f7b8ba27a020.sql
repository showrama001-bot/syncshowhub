ALTER TABLE public.feed_posts
  ADD COLUMN IF NOT EXISTS attachment_kind TEXT,
  ADD COLUMN IF NOT EXISTS attachment_id UUID,
  ADD COLUMN IF NOT EXISTS attachment_title TEXT,
  ADD COLUMN IF NOT EXISTS attachment_thumb TEXT;