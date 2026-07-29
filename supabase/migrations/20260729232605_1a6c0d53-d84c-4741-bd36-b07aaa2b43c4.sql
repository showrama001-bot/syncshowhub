-- 1. Membership table
CREATE TABLE IF NOT EXISTS public.room_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_participants TO authenticated;
GRANT ALL ON public.room_participants TO service_role;

ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

-- 2. Helpers (security definer, private schema, no recursion)
CREATE OR REPLACE FUNCTION private.is_room_participant(_room_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.room_participants rp
    WHERE rp.room_id = _room_id AND rp.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION private.is_room_owner(_room_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.watch_rooms wr WHERE wr.id = _room_id AND wr.host_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.streamer_rooms sr WHERE sr.id = _room_id AND sr.streamer_id = _user_id)
  )
$$;

-- Chat visibility: author, participant, room owner, or admin. Nothing else.
CREATE OR REPLACE FUNCTION private.can_read_room_chat(_room_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    private.is_room_participant(_room_id, _user_id)
    OR private.is_room_owner(_room_id, _user_id)
    OR private.has_role(_user_id, 'admin'::app_role)
  )
$$;

REVOKE EXECUTE ON FUNCTION private.is_room_participant(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.is_room_owner(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.can_read_room_chat(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 3. room_participants policies
DROP POLICY IF EXISTS rp_select ON public.room_participants;
CREATE POLICY rp_select ON public.room_participants FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR private.is_room_owner(room_id, auth.uid())
  OR private.is_room_participant(room_id, auth.uid())
  OR private.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS rp_insert ON public.room_participants;
CREATE POLICY rp_insert ON public.room_participants FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND NOT EXISTS (
    SELECT 1 FROM public.room_kicks k WHERE k.room_id = room_participants.room_id AND k.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS rp_update ON public.room_participants;
CREATE POLICY rp_update ON public.room_participants FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS rp_delete ON public.room_participants;
CREATE POLICY rp_delete ON public.room_participants FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR private.is_room_owner(room_id, auth.uid())
  OR private.has_role(auth.uid(), 'admin'::app_role)
);

-- 4. Lock down chat reads/sends to actual participants
DROP POLICY IF EXISTS chat_read ON public.room_chat_messages;
CREATE POLICY chat_read ON public.room_chat_messages FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR private.can_read_room_chat(room_id, auth.uid())
);

DROP POLICY IF EXISTS chat_send ON public.room_chat_messages;
CREATE POLICY chat_send ON public.room_chat_messages FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    private.is_room_participant(room_id, auth.uid())
    OR private.is_room_owner(room_id, auth.uid())
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.room_kicks k WHERE k.room_id = room_chat_messages.room_id AND k.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS chat_delete ON public.room_chat_messages;
CREATE POLICY chat_delete ON public.room_chat_messages FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR private.is_room_owner(room_id, auth.uid())
  OR private.has_role(auth.uid(), 'admin'::app_role)
);
