create extension if not exists pgcrypto;

create or replace function public.initial_checkers_board()
returns jsonb
language sql
immutable
as $$
  with board_rows as (
    select
      row_index,
      jsonb_agg(
        case
          when (row_index + col_index) % 2 = 1 and row_index <= 2 then
            jsonb_build_object('id', 'black-' || row_index || '-' || col_index, 'player', 'black', 'king', false)
          when (row_index + col_index) % 2 = 1 and row_index >= 5 then
            jsonb_build_object('id', 'red-' || row_index || '-' || col_index, 'player', 'red', 'king', false)
          else
            'null'::jsonb
        end
        order by col_index
      ) as cells
    from generate_series(0, 7) as row_index
    cross join generate_series(0, 7) as col_index
    group by row_index
  )
  select jsonb_agg(cells order by row_index)
  from board_rows;
$$;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{5}$'),
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  board jsonb not null default public.initial_checkers_board(),
  current_player text not null default 'red' check (current_player in ('red', 'black')),
  winner text check (winner in ('red', 'black')),
  revision integer not null default 0,
  rematch_red boolean not null default false,
  rematch_black boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_players (
  room_id uuid not null references public.rooms(id) on delete cascade,
  player text not null check (player in ('red', 'black')),
  player_token uuid not null default gen_random_uuid(),
  joined_at timestamptz not null default now(),
  primary key (room_id, player),
  unique (player_token)
);

create index if not exists rooms_code_idx on public.rooms (code);
create index if not exists room_players_token_idx on public.room_players (player_token);

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;

drop policy if exists "rooms can be read by clients" on public.rooms;
create policy "rooms can be read by clients"
on public.rooms
for select
to anon, authenticated
using (true);

drop policy if exists "rooms cannot be inserted directly" on public.rooms;
create policy "rooms cannot be inserted directly"
on public.rooms
for insert
to anon, authenticated
with check (false);

drop policy if exists "rooms cannot be updated directly" on public.rooms;
create policy "rooms cannot be updated directly"
on public.rooms
for update
to anon, authenticated
using (false)
with check (false);

drop policy if exists "rooms cannot be deleted directly" on public.rooms;
create policy "rooms cannot be deleted directly"
on public.rooms
for delete
to anon, authenticated
using (false);

drop policy if exists "room players are private" on public.room_players;
create policy "room players are private"
on public.room_players
for all
to anon, authenticated
using (false)
with check (false);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rooms_touch_updated_at on public.rooms;
create trigger rooms_touch_updated_at
before update on public.rooms
for each row
execute function public.touch_updated_at();

create or replace function public.make_room_code()
returns text
language plpgsql
volatile
as $$
declare
  generated_code text;
begin
  loop
    generated_code := upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 5));
    exit when not exists (select 1 from public.rooms where code = generated_code);
  end loop;

  return generated_code;
end;
$$;

create or replace function public.create_room()
returns table (
  id uuid,
  code text,
  status text,
  board jsonb,
  current_player text,
  winner text,
  revision integer,
  rematch_red boolean,
  rematch_black boolean,
  player_token uuid,
  player text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  created_room public.rooms;
  created_token uuid;
begin
  insert into public.rooms (code, status, board, current_player)
  values (public.make_room_code(), 'waiting', public.initial_checkers_board(), 'red')
  returning * into created_room;

  insert into public.room_players (room_id, player)
  values (created_room.id, 'red')
  returning room_players.player_token into created_token;

  return query
  select
    created_room.id,
    created_room.code,
    created_room.status,
    created_room.board,
    created_room.current_player,
    created_room.winner,
    created_room.revision,
    created_room.rematch_red,
    created_room.rematch_black,
    created_token,
    'red'::text;
end;
$$;

create or replace function public.join_room(p_code text)
returns table (
  id uuid,
  code text,
  status text,
  board jsonb,
  current_player text,
  winner text,
  revision integer,
  rematch_red boolean,
  rematch_black boolean,
  player_token uuid,
  player text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room public.rooms;
  joined_token uuid;
begin
  select *
  into target_room
  from public.rooms
  where rooms.code = upper(trim(p_code))
  for update;

  if target_room.id is null then
    raise exception 'Sala não encontrada.';
  end if;

  if exists (select 1 from public.room_players where room_id = target_room.id and room_players.player = 'black') then
    raise exception 'Esta sala já tem dois jogadores.';
  end if;

  insert into public.room_players (room_id, player)
  values (target_room.id, 'black')
  returning room_players.player_token into joined_token;

  update public.rooms
  set
    status = 'playing',
    revision = rooms.revision + 1
  where rooms.id = target_room.id
  returning * into target_room;

  return query
  select
    target_room.id,
    target_room.code,
    target_room.status,
    target_room.board,
    target_room.current_player,
    target_room.winner,
    target_room.revision,
    target_room.rematch_red,
    target_room.rematch_black,
    joined_token,
    'black'::text;
end;
$$;

create or replace function public.request_rematch(p_room_id uuid, p_player_token uuid)
returns table (
  id uuid,
  code text,
  status text,
  board jsonb,
  current_player text,
  winner text,
  revision integer,
  rematch_red boolean,
  rematch_black boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room public.rooms;
  requesting_player text;
begin
  select *
  into target_room
  from public.rooms
  where rooms.id = p_room_id
  for update;

  if target_room.id is null then
    raise exception 'Sala não encontrada.';
  end if;

  select room_players.player
  into requesting_player
  from public.room_players
  where room_players.room_id = p_room_id
    and room_players.player_token = p_player_token;

  if requesting_player = 'red' then
    update public.rooms set rematch_red = true where rooms.id = p_room_id returning * into target_room;
  elsif requesting_player = 'black' then
    update public.rooms set rematch_black = true where rooms.id = p_room_id returning * into target_room;
  else
    raise exception 'Jogador inválido.';
  end if;

  if target_room.rematch_red and target_room.rematch_black then
    update public.rooms
    set
      status = 'playing',
      board = public.initial_checkers_board(),
      current_player = 'red',
      winner = null,
      rematch_red = false,
      rematch_black = false,
      revision = rooms.revision + 1
    where rooms.id = p_room_id
    returning * into target_room;
  end if;

  return query
  select
    target_room.id,
    target_room.code,
    target_room.status,
    target_room.board,
    target_room.current_player,
    target_room.winner,
    target_room.revision,
    target_room.rematch_red,
    target_room.rematch_black;
end;
$$;

grant execute on function public.create_room() to anon, authenticated;
grant execute on function public.join_room(text) to anon, authenticated;
grant execute on function public.request_rematch(uuid, uuid) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.rooms;
exception
  when duplicate_object then null;
end;
$$;
