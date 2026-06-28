-- Friend system + room invites
CREATE TYPE public.friendship_status AS ENUM ('pending','accepted','declined','blocked');

CREATE TABLE public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own friendships" ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "create friendship requests" ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "respond to friendship" ON public.friendships FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id OR auth.uid() = requester_id)
  WITH CHECK (auth.uid() = addressee_id OR auth.uid() = requester_id);
CREATE POLICY "delete own friendship" ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE TRIGGER friendships_touch BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;

-- Room invites
CREATE TABLE public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.watch_rooms(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_invites TO authenticated;
GRANT ALL ON public.room_invites TO service_role;
ALTER TABLE public.room_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own invites" ON public.room_invites FOR SELECT TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY "create invites" ON public.room_invites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user);
CREATE POLICY "respond invites" ON public.room_invites FOR UPDATE TO authenticated
  USING (auth.uid() = to_user OR auth.uid() = from_user)
  WITH CHECK (auth.uid() = to_user OR auth.uid() = from_user);
CREATE POLICY "delete invites" ON public.room_invites FOR DELETE TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);

ALTER PUBLICATION supabase_realtime ADD TABLE public.room_invites;

-- Storage RLS for avatars bucket (bucket will be created via tool)
CREATE POLICY "Avatars are publicly readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
