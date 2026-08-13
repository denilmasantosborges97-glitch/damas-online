alter table public.rooms
  add column if not exists result_reason text,
  add column if not exists draw_offer_player text,
  add column if not exists draw_offer_created_at timestamptz,
  add column if not exists rematch_declined_by text;

alter table public.rooms
  drop constraint if exists rooms_result_reason_check,
  drop constraint if exists rooms_draw_offer_player_check,
  drop constraint if exists rooms_rematch_declined_by_check;

alter table public.rooms
  add constraint rooms_result_reason_check
  check (result_reason is null or result_reason in ('no_pieces', 'no_moves', 'resignation', 'draw_accepted', 'draw_rule', 'draw_auto', 'abandonment')),
  add constraint rooms_draw_offer_player_check
  check (draw_offer_player is null or draw_offer_player in ('red', 'black')),
  add constraint rooms_rematch_declined_by_check
  check (rematch_declined_by is null or rematch_declined_by in ('red', 'black'));

alter table public.room_players
  add column if not exists last_seen_at timestamptz not null default now();

drop function if exists public.create_room();
drop function if exists public.join_room(text);
drop function if exists public.request_rematch(uuid, uuid);

create or replace function public.create_room()
returns table (
  id uuid,
  code text,
  status text,
  board jsonb,
  current_player text,
  winner text,
  result_reason text,
  revision integer,
  draw_ply_count integer,
  draw_offer_player text,
  draw_offer_created_at timestamptz,
  rematch_red boolean,
  rematch_black boolean,
  rematch_declined_by text,
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
    created_room.id, created_room.code, created_room.status, created_room.board,
    created_room.current_player, created_room.winner, created_room.result_reason,
    created_room.revision, created_room.draw_ply_count, created_room.draw_offer_player,
    created_room.draw_offer_created_at, created_room.rematch_red, created_room.rematch_black,
    created_room.rematch_declined_by, created_token, 'red'::text;
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
  result_reason text,
  revision integer,
  draw_ply_count integer,
  draw_offer_player text,
  draw_offer_created_at timestamptz,
  rematch_red boolean,
  rematch_black boolean,
  rematch_declined_by text,
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
  select * into target_room from public.rooms where rooms.code = upper(trim(p_code)) for update;
  if target_room.id is null then raise exception 'Sala nao encontrada.'; end if;
  if exists (select 1 from public.room_players where room_id = target_room.id and room_players.player = 'black') then
    raise exception 'Esta sala ja tem dois jogadores.';
  end if;

  insert into public.room_players (room_id, player)
  values (target_room.id, 'black')
  returning room_players.player_token into joined_token;

  update public.rooms
  set status = 'playing', revision = rooms.revision + 1
  where rooms.id = target_room.id
  returning * into target_room;

  return query
  select
    target_room.id, target_room.code, target_room.status, target_room.board,
    target_room.current_player, target_room.winner, target_room.result_reason,
    target_room.revision, target_room.draw_ply_count, target_room.draw_offer_player,
    target_room.draw_offer_created_at, target_room.rematch_red, target_room.rematch_black,
    target_room.rematch_declined_by, joined_token, 'black'::text;
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
  result_reason text,
  revision integer,
  draw_ply_count integer,
  draw_offer_player text,
  draw_offer_created_at timestamptz,
  rematch_red boolean,
  rematch_black boolean,
  rematch_declined_by text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room public.rooms;
  requesting_player text;
begin
  select * into target_room from public.rooms where rooms.id = p_room_id for update;
  if target_room.id is null then raise exception 'Sala nao encontrada.'; end if;

  select room_players.player into requesting_player
  from public.room_players
  where room_players.room_id = p_room_id and room_players.player_token = p_player_token;

  if requesting_player is null then raise exception 'Jogador invalido.'; end if;
  if target_room.status not in ('finished', 'draw') then raise exception 'A partida ainda nao terminou.'; end if;

  if requesting_player = 'red' then
    update public.rooms set rematch_red = true, rematch_declined_by = null where rooms.id = p_room_id returning * into target_room;
  else
    update public.rooms set rematch_black = true, rematch_declined_by = null where rooms.id = p_room_id returning * into target_room;
  end if;

  if target_room.rematch_red and target_room.rematch_black then
    update public.rooms
    set status = 'playing', board = public.initial_checkers_board(), current_player = 'red',
      winner = null, result_reason = null, draw_ply_count = 0, draw_offer_player = null,
      draw_offer_created_at = null, rematch_red = false, rematch_black = false,
      rematch_declined_by = null, revision = rooms.revision + 1
    where rooms.id = p_room_id
    returning * into target_room;
  end if;

  return query select
    target_room.id, target_room.code, target_room.status, target_room.board,
    target_room.current_player, target_room.winner, target_room.result_reason,
    target_room.revision, target_room.draw_ply_count, target_room.draw_offer_player,
    target_room.draw_offer_created_at, target_room.rematch_red, target_room.rematch_black,
    target_room.rematch_declined_by;
end;
$$;

create or replace function public.resolve_room_player(p_room_id uuid, p_player_token uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select room_players.player
  from public.room_players
  where room_players.room_id = p_room_id
    and room_players.player_token = p_player_token;
$$;

create or replace function public.return_room(p_room_id uuid)
returns table (
  id uuid,
  code text,
  status text,
  board jsonb,
  current_player text,
  winner text,
  result_reason text,
  revision integer,
  draw_ply_count integer,
  draw_offer_player text,
  draw_offer_created_at timestamptz,
  rematch_red boolean,
  rematch_black boolean,
  rematch_declined_by text
)
language sql
security definer
set search_path = public
as $$
  select rooms.id, rooms.code, rooms.status, rooms.board, rooms.current_player,
    rooms.winner, rooms.result_reason, rooms.revision, rooms.draw_ply_count,
    rooms.draw_offer_player, rooms.draw_offer_created_at, rooms.rematch_red,
    rooms.rematch_black, rooms.rematch_declined_by
  from public.rooms
  where rooms.id = p_room_id;
$$;

create or replace function public.resign_room(p_room_id uuid, p_player_token uuid)
returns table (
  id uuid, code text, status text, board jsonb, current_player text, winner text,
  result_reason text, revision integer, draw_ply_count integer, draw_offer_player text,
  draw_offer_created_at timestamptz, rematch_red boolean, rematch_black boolean,
  rematch_declined_by text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room public.rooms;
  requesting_player text;
  winning_player text;
begin
  select * into target_room from public.rooms where rooms.id = p_room_id for update;
  requesting_player := public.resolve_room_player(p_room_id, p_player_token);
  if target_room.id is null then raise exception 'Sala nao encontrada.'; end if;
  if requesting_player is null then raise exception 'Jogador invalido.'; end if;
  if target_room.status <> 'playing' then raise exception 'A partida nao esta em andamento.'; end if;

  winning_player := case when requesting_player = 'red' then 'black' else 'red' end;
  update public.rooms
  set status = 'finished', winner = winning_player, result_reason = 'resignation',
    draw_offer_player = null, draw_offer_created_at = null, rematch_red = false,
    rematch_black = false, rematch_declined_by = null, revision = rooms.revision + 1
  where rooms.id = p_room_id;

  return query select * from public.return_room(p_room_id);
end;
$$;

create or replace function public.propose_draw(p_room_id uuid, p_player_token uuid)
returns table (
  id uuid, code text, status text, board jsonb, current_player text, winner text,
  result_reason text, revision integer, draw_ply_count integer, draw_offer_player text,
  draw_offer_created_at timestamptz, rematch_red boolean, rematch_black boolean,
  rematch_declined_by text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room public.rooms;
  requesting_player text;
begin
  select * into target_room from public.rooms where rooms.id = p_room_id for update;
  requesting_player := public.resolve_room_player(p_room_id, p_player_token);
  if target_room.id is null then raise exception 'Sala nao encontrada.'; end if;
  if requesting_player is null then raise exception 'Jogador invalido.'; end if;
  if target_room.status <> 'playing' then raise exception 'A partida nao esta em andamento.'; end if;
  if target_room.draw_offer_player is not null then raise exception 'Ja existe uma proposta de empate.'; end if;
  if target_room.draw_offer_created_at is not null and target_room.draw_offer_created_at > now() - interval '20 seconds' then
    raise exception 'Aguarde antes de propor empate novamente.';
  end if;

  update public.rooms
  set draw_offer_player = requesting_player, draw_offer_created_at = now(), revision = rooms.revision + 1
  where rooms.id = p_room_id;

  return query select * from public.return_room(p_room_id);
end;
$$;

create or replace function public.respond_draw(p_room_id uuid, p_player_token uuid, p_accept boolean)
returns table (
  id uuid, code text, status text, board jsonb, current_player text, winner text,
  result_reason text, revision integer, draw_ply_count integer, draw_offer_player text,
  draw_offer_created_at timestamptz, rematch_red boolean, rematch_black boolean,
  rematch_declined_by text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room public.rooms;
  requesting_player text;
begin
  select * into target_room from public.rooms where rooms.id = p_room_id for update;
  requesting_player := public.resolve_room_player(p_room_id, p_player_token);
  if target_room.id is null then raise exception 'Sala nao encontrada.'; end if;
  if requesting_player is null then raise exception 'Jogador invalido.'; end if;
  if target_room.status <> 'playing' then raise exception 'A partida nao esta em andamento.'; end if;
  if target_room.draw_offer_player is null then raise exception 'Nao ha proposta de empate ativa.'; end if;
  if target_room.draw_offer_player = requesting_player then raise exception 'Apenas o adversario pode responder.'; end if;

  if p_accept then
    update public.rooms
    set status = 'draw', winner = null, result_reason = 'draw_accepted',
      draw_offer_player = null, draw_offer_created_at = null, revision = rooms.revision + 1
    where rooms.id = p_room_id;
  else
    update public.rooms
    set draw_offer_player = null, draw_offer_created_at = now(), revision = rooms.revision + 1
    where rooms.id = p_room_id;
  end if;

  return query select * from public.return_room(p_room_id);
end;
$$;

create or replace function public.decline_rematch(p_room_id uuid, p_player_token uuid)
returns table (
  id uuid, code text, status text, board jsonb, current_player text, winner text,
  result_reason text, revision integer, draw_ply_count integer, draw_offer_player text,
  draw_offer_created_at timestamptz, rematch_red boolean, rematch_black boolean,
  rematch_declined_by text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room public.rooms;
  requesting_player text;
begin
  select * into target_room from public.rooms where rooms.id = p_room_id for update;
  requesting_player := public.resolve_room_player(p_room_id, p_player_token);
  if target_room.id is null then raise exception 'Sala nao encontrada.'; end if;
  if requesting_player is null then raise exception 'Jogador invalido.'; end if;
  if target_room.status not in ('finished', 'draw') then raise exception 'A partida ainda nao terminou.'; end if;

  update public.rooms
  set rematch_red = false, rematch_black = false, rematch_declined_by = requesting_player,
    revision = rooms.revision + 1
  where rooms.id = p_room_id;

  return query select * from public.return_room(p_room_id);
end;
$$;

create or replace function public.update_player_presence(p_room_id uuid, p_player_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.room_players
  set last_seen_at = now()
  where room_players.room_id = p_room_id and room_players.player_token = p_player_token;

  if not found then raise exception 'Jogador invalido.'; end if;
end;
$$;

create or replace function public.claim_abandonment(p_room_id uuid, p_player_token uuid)
returns table (
  id uuid, code text, status text, board jsonb, current_player text, winner text,
  result_reason text, revision integer, draw_ply_count integer, draw_offer_player text,
  draw_offer_created_at timestamptz, rematch_red boolean, rematch_black boolean,
  rematch_declined_by text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room public.rooms;
  requesting_player text;
  opponent_player text;
  opponent_last_seen timestamptz;
begin
  select * into target_room from public.rooms where rooms.id = p_room_id for update;
  requesting_player := public.resolve_room_player(p_room_id, p_player_token);
  if target_room.id is null then raise exception 'Sala nao encontrada.'; end if;
  if requesting_player is null then raise exception 'Jogador invalido.'; end if;
  if target_room.status <> 'playing' then raise exception 'A partida nao esta em andamento.'; end if;

  opponent_player := case when requesting_player = 'red' then 'black' else 'red' end;
  select room_players.last_seen_at into opponent_last_seen
  from public.room_players
  where room_players.room_id = p_room_id and room_players.player = opponent_player;

  if opponent_last_seen is null or opponent_last_seen > now() - interval '60 seconds' then
    raise exception 'O tempo de reconexao ainda nao acabou.';
  end if;

  update public.rooms
  set status = 'finished', winner = requesting_player, result_reason = 'abandonment',
    draw_offer_player = null, draw_offer_created_at = null, rematch_red = false,
    rematch_black = false, rematch_declined_by = null, revision = rooms.revision + 1
  where rooms.id = p_room_id;

  return query select * from public.return_room(p_room_id);
end;
$$;

grant execute on function public.create_room() to anon, authenticated;
grant execute on function public.join_room(text) to anon, authenticated;
grant execute on function public.request_rematch(uuid, uuid) to anon, authenticated;
grant execute on function public.resign_room(uuid, uuid) to anon, authenticated;
grant execute on function public.propose_draw(uuid, uuid) to anon, authenticated;
grant execute on function public.respond_draw(uuid, uuid, boolean) to anon, authenticated;
grant execute on function public.decline_rematch(uuid, uuid) to anon, authenticated;
grant execute on function public.update_player_presence(uuid, uuid) to anon, authenticated;
grant execute on function public.claim_abandonment(uuid, uuid) to anon, authenticated;
