import type { Board, GameStatus, Move, Player, ResultReason } from "../game/types";

export type RoomRecord = {
  id: string;
  code: string;
  status: GameStatus;
  board: Board;
  current_player: Player;
  winner: Player | null;
  result_reason?: ResultReason | null;
  revision: number;
  draw_ply_count?: number | null;
  draw_offer_player?: Player | null;
  draw_offer_created_at?: string | null;
  rematch_red: boolean;
  rematch_black: boolean;
  rematch_declined_by?: Player | null;
};

export type RoomSnapshot = {
  id: string;
  code: string;
  status: GameStatus;
  board: Board;
  currentPlayer: Player;
  winner: Player | null;
  resultReason: ResultReason | null;
  revision: number;
  drawPlyCount: number;
  drawOfferPlayer: Player | null;
  drawOfferCreatedAt: string | null;
  rematchRed: boolean;
  rematchBlack: boolean;
  rematchDeclinedBy: Player | null;
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

export type DisconnectState = {
  active: boolean;
  remainingSeconds: number;
  reconnected: boolean;
};

export type ReactionValue = "👍" | "👏" | "😮" | "GG" | "Boa jogada!";

export type ReactionEvent = {
  id: string;
  sender: Player;
  value: ReactionValue;
  sentAt: number;
};

export type MoveFeedbackEvent = {
  id: string;
  sender: Player;
  revision: number;
  move: Move;
};
