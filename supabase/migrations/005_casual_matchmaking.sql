create table if not exists public.casual_matchmaking_queue (
  player_key uuid primary key,
  nickname text not null check (char_length(trim(nickname)) between 3 and 16),
  status text not null default 'waiting' check (status in ('waiting', 'matched')),
  room_id uuid references public.rooms(id) on delete set null,
  player text check (player in ('red', 'black')),
  created_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  matched_at timestamptz
);

create index if not exists casual_matchmaking_waiting_idx
on public.casual_matchmaking_queue (heartbeat_at, created_at)
where status = 'waiting';

alter table public.casual_matchmaking_queue enable row level security;

drop policy if exists "casual matchmaking queue is private" on public.casual_matchmaking_queue;
create policy "casual matchmaking queue is private"
on public.casual_matchmaking_queue
for all
to anon, authenticated
using (false)
with check (false);

drop function if exists public.enter_casual_queue(uuid, text);
drop function if exists public.cancel_casual_queue(uuid);

create or replace function public.enter_casual_queue(p_player_key uuid, p_nickname text)
returns table (
  queue_status text,
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
  current_entry public.casual_matchmaking_queue;
  opponent_entry public.casual_matchmaking_queue;
  target_room public.rooms;
  current_token uuid;
  current_assigned_player text;
  opponent_assigned_player text;
  random_byte integer;
  sanitized_nickname text;
begin
  if p_player_key is null then
    raise exception 'Jogador invalido.';
  end if;

  sanitized_nickname := trim(regexp_replace(coalesce(p_nickname, ''), '\s+', ' ', 'g'));
  if char_length(sanitized_nickname) < 3 or char_length(sanitized_nickname) > 16 then
    raise exception 'Apelido invalido.';
  end if;

  perform pg_advisory_xact_lock(hashtext('casual_matchmaking_v1'));

  delete from public.casual_matchmaking_queue
  where casual_matchmaking_queue.status = 'waiting'
    and casual_matchmaking_queue.heartbeat_at < now() - interval '30 seconds';

  select *
  into current_entry
  from public.casual_matchmaking_queue
  where player_key = p_player_key
  for update;

  if current_entry.status = 'matched' and current_entry.room_id is not null then
    select *
    into target_room
    from public.rooms
    where rooms.id = current_entry.room_id;

    if target_room.id is not null and target_room.status in ('waiting', 'playing') then
      select room_players.player_token
      into current_token
      from public.room_players
      where room_players.room_id = current_entry.room_id
        and room_players.player = current_entry.player;

      if current_token is not null then
        update public.casual_matchmaking_queue
        set heartbeat_at = now(), nickname = sanitized_nickname
        where player_key = p_player_key;

        return query
        select
          'matched'::text,
          target_room.id,
          target_room.code,
          target_room.status,
          target_room.board,
          target_room.current_player,
          target_room.winner,
          target_room.result_reason,
          target_room.revision,
          target_room.draw_ply_count,
          target_room.draw_offer_player,
          target_room.draw_offer_created_at,
          target_room.rematch_red,
          target_room.rematch_black,
          target_room.rematch_declined_by,
          current_token,
          current_entry.player;
        return;
      end if;
    end if;
  end if;

  insert into public.casual_matchmaking_queue (
    player_key,
    nickname,
    status,
    room_id,
    player,
    created_at,
    heartbeat_at,
    matched_at
  )
  values (
    p_player_key,
    sanitized_nickname,
    'waiting',
    null,
    null,
    now(),
    now(),
    null
  )
  on conflict (player_key) do update
  set
    nickname = excluded.nickname,
    status = 'waiting',
    room_id = null,
    player = null,
    created_at = case
      when casual_matchmaking_queue.status = 'waiting' then casual_matchmaking_queue.created_at
      else now()
    end,
    heartbeat_at = now(),
    matched_at = null
  returning * into current_entry;

  select *
  into opponent_entry
  from public.casual_matchmaking_queue
  where casual_matchmaking_queue.status = 'waiting'
    and casual_matchmaking_queue.player_key <> p_player_key
    and casual_matchmaking_queue.heartbeat_at >= now() - interval '30 seconds'
  order by created_at asc
  limit 1
  for update skip locked;

  if opponent_entry.player_key is null then
    return query
    select
      'waiting'::text,
      null::uuid,
      null::text,
      null::text,
      null::jsonb,
      null::text,
      null::text,
      null::text,
      null::integer,
      null::integer,
      null::text,
      null::timestamptz,
      null::boolean,
      null::boolean,
      null::text,
      null::uuid,
      null::text;
    return;
  end if;

  random_byte := get_byte(extensions.gen_random_bytes(1), 0);
  if random_byte % 2 = 0 then
    current_assigned_player := 'red';
    opponent_assigned_player := 'black';
  else
    current_assigned_player := 'black';
    opponent_assigned_player := 'red';
  end if;

  insert into public.rooms (code, status, board, current_player)
  values (public.make_room_code(), 'playing', public.initial_checkers_board(), 'red')
  returning * into target_room;

  insert into public.room_players (room_id, player)
  values (target_room.id, current_assigned_player)
  returning room_players.player_token into current_token;

  insert into public.room_players (room_id, player)
  values (target_room.id, opponent_assigned_player);

  update public.casual_matchmaking_queue
  set
    status = 'matched',
    room_id = target_room.id,
    player = current_assigned_player,
    heartbeat_at = now(),
    matched_at = now()
  where player_key = p_player_key;

  update public.casual_matchmaking_queue
  set
    status = 'matched',
    room_id = target_room.id,
    player = opponent_assigned_player,
    heartbeat_at = now(),
    matched_at = now()
  where player_key = opponent_entry.player_key;

  return query
  select
    'matched'::text,
    target_room.id,
    target_room.code,
    target_room.status,
    target_room.board,
    target_room.current_player,
    target_room.winner,
    target_room.result_reason,
    target_room.revision,
    target_room.draw_ply_count,
    target_room.draw_offer_player,
    target_room.draw_offer_created_at,
    target_room.rematch_red,
    target_room.rematch_black,
    target_room.rematch_declined_by,
    current_token,
    current_assigned_player;
end;
$$;

create or replace function public.cancel_casual_queue(p_player_key uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.casual_matchmaking_queue
  where casual_matchmaking_queue.player_key = p_player_key
    and casual_matchmaking_queue.status = 'waiting';
end;
$$;

grant execute on function public.enter_casual_queue(uuid, text) to anon, authenticated;
grant execute on function public.cancel_casual_queue(uuid) to anon, authenticated;
