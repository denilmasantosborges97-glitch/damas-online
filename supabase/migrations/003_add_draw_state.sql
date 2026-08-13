alter table public.rooms
  add column if not exists draw_ply_count integer not null default 0;

alter table public.rooms
  drop constraint if exists rooms_status_check;

alter table public.rooms
  add constraint rooms_status_check
  check (status in ('waiting', 'playing', 'finished', 'draw'));

drop function if exists public.create_room();

create or replace function public.create_room()
returns table (
  id uuid,
  code text,
  status text,
  board jsonb,
  current_player text,
  winner text,
  revision integer,
  draw_ply_count integer,
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
    created_room.draw_ply_count,
    created_room.rematch_red,
    created_room.rematch_black,
    created_token,
    'red'::text;
end;
$$;

drop function if exists public.join_room(text);

create or replace function public.join_room(p_code text)
returns table (
  id uuid,
  code text,
  status text,
  board jsonb,
  current_player text,
  winner text,
  revision integer,
  draw_ply_count integer,
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
    raise exception 'Sala nao encontrada.';
  end if;

  if exists (select 1 from public.room_players where room_id = target_room.id and room_players.player = 'black') then
    raise exception 'Esta sala ja tem dois jogadores.';
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
    target_room.draw_ply_count,
    target_room.rematch_red,
    target_room.rematch_black,
    joined_token,
    'black'::text;
end;
$$;

drop function if exists public.request_rematch(uuid, uuid);

create or replace function public.request_rematch(p_room_id uuid, p_player_token uuid)
returns table (
  id uuid,
  code text,
  status text,
  board jsonb,
  current_player text,
  winner text,
  revision integer,
  draw_ply_count integer,
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
    raise exception 'Sala nao encontrada.';
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
    raise exception 'Jogador invalido.';
  end if;

  if target_room.rematch_red and target_room.rematch_black then
    update public.rooms
    set
      status = 'playing',
      board = public.initial_checkers_board(),
      current_player = 'red',
      winner = null,
      draw_ply_count = 0,
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
    target_room.draw_ply_count,
    target_room.rematch_red,
    target_room.rematch_black;
end;
$$;

grant execute on function public.create_room() to anon, authenticated;
grant execute on function public.join_room(text) to anon, authenticated;
grant execute on function public.request_rematch(uuid, uuid) to anon, authenticated;
