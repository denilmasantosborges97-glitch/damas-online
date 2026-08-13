export type Player = "red" | "black";

export type GameStatus = "waiting" | "playing" | "finished";

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
  revision: number;
};
