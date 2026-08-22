create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  avatar_id text,
  region_code text,
  preferences jsonb not null default '{}'::jsonb,
  future_progression jsonb not null default jsonb_build_object(
    'ranked', jsonb_build_object(
      'enabled', false,
      'rating', null,
      'rank', null,
      'wins', 0,
      'losses', 0,
      'draws', 0
    ),
    'coins', 0,
    'equipped_board', 'madeira'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_profiles_nickname_length check (char_length(nickname) between 3 and 16),
  constraint player_profiles_nickname_format check (nickname ~ '^[[:alnum:] _-]+$'),
  constraint player_profiles_preferences_object check (jsonb_typeof(preferences) = 'object'),
  constraint player_profiles_progression_object check (jsonb_typeof(future_progression) = 'object')
);

create unique index if not exists player_profiles_nickname_unique_idx
  on public.player_profiles (lower(nickname));

create or replace function public.set_player_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists player_profiles_set_updated_at on public.player_profiles;
create trigger player_profiles_set_updated_at
before update on public.player_profiles
for each row
execute function public.set_player_profiles_updated_at();

alter table public.player_profiles enable row level security;

drop policy if exists "player_profiles_select_own" on public.player_profiles;
create policy "player_profiles_select_own"
on public.player_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "player_profiles_insert_own" on public.player_profiles;
create policy "player_profiles_insert_own"
on public.player_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "player_profiles_update_own" on public.player_profiles;
create policy "player_profiles_update_own"
on public.player_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.upsert_own_player_profile(
  p_nickname text,
  p_avatar_id text default null,
  p_preferences jsonb default '{}'::jsonb
)
returns public.player_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.player_profiles;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.player_profiles (user_id, nickname, avatar_id, preferences)
  values (auth.uid(), trim(regexp_replace(p_nickname, '\s+', ' ', 'g')), p_avatar_id, coalesce(p_preferences, '{}'::jsonb))
  on conflict (user_id)
  do update set
    nickname = excluded.nickname,
    avatar_id = excluded.avatar_id,
    preferences = excluded.preferences
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on public.player_profiles from anon, authenticated;
grant select on public.player_profiles to authenticated;
revoke all on function public.upsert_own_player_profile(text, text, jsonb) from public;
revoke execute on function public.upsert_own_player_profile(text, text, jsonb) from anon;
grant execute on function public.upsert_own_player_profile(text, text, jsonb) to authenticated;
