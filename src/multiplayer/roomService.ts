import type { RealtimeChannel } from "@supabase/supabase-js";
import { validateGameState } from "../game/rules";
import type { GameState, Move, Player } from "../game/types";
import { supabase } from "./supabaseClient";
import type { PlayerSession, PresenceState, RoomRecord, RoomSnapshot } from "./types";

type RpcRoomResponse = RoomRecord & {
  player_token: string;
  player: Player;
};

export async function createRoom(): Promise<{ room: RoomSnapshot; session: PlayerSession }> {
  assertSupabase();

  const { data, error } = await supabase!.rpc("create_room");
  if (error) throw error;

  const row = firstRow<RpcRoomResponse>(data);
  return {
    room: roomFromRecord(row),
    session: {
      roomId: row.id,
      code: row.code,
      player: row.player,
      token: row.player_token
    }
  };
}

export async function joinRoom(code: string): Promise<{ room: RoomSnapshot; session: PlayerSession }> {
  assertSupabase();

  const { data, error } = await supabase!.rpc("join_room", { p_code: code.trim().toUpperCase() });
  if (error) throw error;

  const row = firstRow<RpcRoomResponse>(data);
  return {
    room: roomFromRecord(row),
    session: {
      roomId: row.id,
      code: row.code,
      player: row.player,
      token: row.player_token
    }
  };
}

export async function submitMove(session: PlayerSession, move: Move): Promise<RoomSnapshot> {
  assertSupabase();

  const { data, error } = await supabase!.functions.invoke("submit-move", {
    body: {
      roomId: session.roomId,
      playerToken: session.token,
      move
    }
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return roomFromRecord(data.room as RoomRecord);
}

export async function requestRematch(session: PlayerSession): Promise<RoomSnapshot> {
  assertSupabase();

  const { data, error } = await supabase!.rpc("request_rematch", {
    p_room_id: session.roomId,
    p_player_token: session.token
  });

  if (error) throw error;

  return roomFromRecord(firstRow<RoomRecord>(data));
}

export function subscribeToRoom(
  session: PlayerSession,
  onRoom: (room: RoomSnapshot) => void,
  onPresence: (presence: PresenceState) => void
): () => void {
  assertSupabase();

  const roomChannel = supabase!
    .channel(`room-db:${session.roomId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "rooms",
        filter: `id=eq.${session.roomId}`
      },
      (payload) => {
        onRoom(roomFromRecord(payload.new as RoomRecord));
      }
    )
    .subscribe();

  const presenceChannel = supabase!
    .channel(`room-presence:${session.roomId}`, {
      config: {
        presence: {
          key: session.token
        }
      }
    })
    .on("presence", { event: "sync" }, () => {
      onPresence(readPresence(presenceChannel, session.player));
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void presenceChannel.track({ player: session.player, onlineAt: new Date().toISOString() });
      }
    });

  return () => {
    void supabase!.removeChannel(roomChannel);
    void supabase!.removeChannel(presenceChannel);
  };
}

export function gameStateFromRoom(room: RoomSnapshot): GameState {
  return {
    board: room.board,
    currentPlayer: room.currentPlayer,
    status: room.status,
    winner: room.winner,
    revision: room.revision
  };
}

function roomFromRecord(record: RoomRecord): RoomSnapshot {
  const snapshot = {
    id: record.id,
    code: record.code,
    status: record.status,
    board: record.board,
    currentPlayer: record.current_player,
    winner: record.winner,
    revision: record.revision,
    rematchRed: record.rematch_red,
    rematchBlack: record.rematch_black
  };

  const errors = validateGameState(gameStateFromRoom(snapshot));
  if (errors.length > 0) {
    throw new Error(`Estado partilhado inválido: ${errors.join(" ")}`);
  }

  return snapshot;
}

function readPresence(channel: RealtimeChannel, viewer: Player): PresenceState {
  const values = Object.values(channel.presenceState()).flat() as Array<{ player?: Player }>;
  const connectedPlayers = Array.from(
    new Set(values.map((value) => value.player).filter((player): player is Player => player === "red" || player === "black"))
  );
  const opponent = viewer === "red" ? "black" : "red";

  return {
    connectedPlayers,
    opponentDisconnected: !connectedPlayers.includes(opponent)
  };
}

function firstRow<T>(data: unknown): T {
  if (Array.isArray(data)) return data[0] as T;
  return data as T;
}

function assertSupabase(): void {
  if (!supabase) {
    throw new Error("Configura o Supabase antes de usar salas online.");
  }
}
