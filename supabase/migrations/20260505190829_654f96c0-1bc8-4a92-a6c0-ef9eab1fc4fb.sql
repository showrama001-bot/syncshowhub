
-- ROLES
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "view own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admins manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles viewable by authenticated" on public.profiles for select to authenticated using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid());
create policy "users insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- MOVIES
create table public.movies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  poster_url text,
  backdrop_url text,
  stream_url text not null,
  genre text,
  year int,
  duration_minutes int,
  rating numeric,
  featured boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.movies enable row level security;
create policy "movies readable" on public.movies for select to authenticated using (true);
create policy "admins write movies" on public.movies for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- TV CHANNELS
create table public.tv_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  m3u_url text not null,
  country text,
  category text,
  logo_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.tv_channels enable row level security;
create policy "tv readable" on public.tv_channels for select to authenticated using (true);
create policy "admins write tv" on public.tv_channels for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- MATCHES
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  league text,
  home_team text not null,
  away_team text not null,
  home_logo text,
  away_logo text,
  home_score int default 0,
  away_score int default 0,
  status text not null default 'scheduled',
  kickoff_at timestamptz not null,
  stream_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.matches enable row level security;
create policy "matches readable" on public.matches for select to authenticated using (true);
create policy "admins write matches" on public.matches for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- BLOCKS
create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);
alter table public.blocks enable row level security;
create policy "view own blocks" on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy "create own blocks" on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy "delete own blocks" on public.blocks for delete to authenticated using (blocker_id = auth.uid());

create or replace function public.is_blocked(_a uuid, _b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = _a and blocked_id = _b) or (blocker_id = _b and blocked_id = _a)
  )
$$;

-- DMs
create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.direct_messages enable row level security;
create policy "view own dms" on public.direct_messages for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "send dms" on public.direct_messages for insert to authenticated with check (
  sender_id = auth.uid() and not public.is_blocked(auth.uid(), recipient_id)
);
create policy "update own dms" on public.direct_messages for update to authenticated using (recipient_id = auth.uid());

alter publication supabase_realtime add table public.direct_messages;
alter table public.direct_messages replica identity full;

-- REPORTS
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete cascade,
  reported_message_id uuid references public.direct_messages(id) on delete cascade,
  reason text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "create reports" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "view own reports" on public.reports for select to authenticated using (reporter_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admins update reports" on public.reports for update to authenticated using (public.has_role(auth.uid(),'admin'));
