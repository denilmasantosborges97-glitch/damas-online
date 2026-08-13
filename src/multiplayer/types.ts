import type { Board, GameStatus, Player } from "../game/types";

export type RoomRecord = {
  id: string;
  code: string;
  status: GameStatus;
  board: Board;
  current_player: Player;
  winner: Player | null;
  revision: number;
  draw_ply_count?: number | null;
  rematch_red: boolean;
  rematch_black: boolean;
};

export type RoomSnapshot = {
  id: string;
  code: string;
  status: GameStatus;
  board: Board;
  currentPlayer: Player;
  winner: Player | null;
  revision: number;
  drawPlyCount: number;
  rematchRed: boolean;
  rematchBlack: boolean;
};

export type PlayerSession = {
  roomId: string;
  code: string;
  player: Player;
  token: string;
};

export type PresenceState = {
  connectedPlayers: Player[];
  opponentDisconnected: boolean;
};
