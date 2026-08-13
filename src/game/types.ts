export type Player = "red" | "black";

export type GameStatus = "waiting" | "playing" | "finished" | "draw";

export type ResultReason =
  | "no_pieces"
  | "no_moves"
  | "resignation"
  | "draw_accepted"
  | "draw_rule"
  | "draw_auto"
  | "abandonment";

export type Position = {
  row: number;
  col: number;
};

export type Piece = {
  id: string;
  player: Player;
  king: boolean;
};

export type Board = (Piece | null)[][];

export type MoveStep = {
  from: Position;
  to: Position;
  captured?: Position;
};

export type Move = {
  pieceId: string;
  from: Position;
  to: Position;
  steps: MoveStep[];
  captures: Position[];
};

export type GameState = {
  board: Board;
  currentPlayer: Player;
  status: GameStatus;
  winner: Player | null;
  resultReason: ResultReason | null;
  revision: number;
  drawPlyCount: number;
};
