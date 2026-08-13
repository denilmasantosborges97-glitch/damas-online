export type Player = "red" | "black";
export type GameStatus = "waiting" | "playing" | "finished" | "draw";
export type Position = { row: number; col: number };
export type Piece = { id: string; player: Player; king: boolean };
export type Board = (Piece | null)[][];
export type MoveStep = { from: Position; to: Position; captured?: Position };
export type Move = { pieceId: string; from: Position; to: Position; steps: MoveStep[]; captures: Position[] };
export type GameState = {
  board: Board;
  currentPlayer: Player;
  status: GameStatus;
  winner: Player | null;
  revision: number;
  drawPlyCount: number;
};

const BOARD_SIZE = 8;
const DRAW_KING_ONLY_PLY_LIMIT = 40;

const directions = {
  red: -1,
  black: 1
} satisfies Record<Player, number>;

const opponents = {
  red: "black",
  black: "red"
} satisfies Record<Player, Player>;

const diagonalDirections: Position[] = [
  { row: -1, col: -1 },
  { row: -1, col: 1 },
  { row: 1, col: -1 },
  { row: 1, col: 1 }
];

export function getLegalMoves(state: GameState, player: Player = state.currentPlayer): Move[] {
  if (state.status !== "playing" || state.winner) return [];
  const captures = allCaptures(state.board, player);
  return captures.length > 0 ? keepMajorityCaptures(captures) : allSimpleMoves(state.board, player);
}

export function applyMove(state: GameState, requestedMove: Move): GameState {
  const legalMove = getLegalMoves(state).find((move) => sameMove(move, requestedMove));
  if (!legalMove) throw new Error("Movimento ilegal.");

  const board = cloneBoard(state.board);
  const piece = board[legalMove.from.row]?.[legalMove.from.col];
  if (!piece) throw new Error("A peca ja nao existe nessa casa.");

  board[legalMove.from.row][legalMove.from.col] = null;
  for (const captured of legalMove.captures) {
    board[captured.row][captured.col] = null;
  }

  board[legalMove.to.row][legalMove.to.col] =
    !piece.king && promotionRow(piece, legalMove.to) ? { ...piece, king: true } : { ...piece };

  const nextPlayer = opponents[state.currentPlayer];
  const drawPlyCount = piece.king && legalMove.captures.length === 0 ? state.drawPlyCount + 1 : 0;
  const next: GameState = {
    board,
    currentPlayer: nextPlayer,
    status: "playing",
    winner: null,
    revision: state.revision + 1,
    drawPlyCount
  };

  if (countPieces(board, nextPlayer) === 0 || getLegalMoves(next, nextPlayer).length === 0) {
    return { ...next, currentPlayer: state.currentPlayer, status: "finished", winner: state.currentPlayer, drawPlyCount: 0 };
  }

  if (drawPlyCount >= DRAW_KING_ONLY_PLY_LIMIT) {
    return { ...next, status: "draw", winner: null };
  }

  return next;
}

function allSimpleMoves(board: Board, player: Player): Move[] {
  const moves: Move[] = [];
  forEachPiece(board, player, (piece, from) => {
    if (piece.king) {
      moves.push(...kingSimpleMoves(board, piece, from));
      return;
    }

    for (const direction of manMoveDirections(piece)) {
      const to = add(from, direction);
      if (inside(to) && !board[to.row][to.col]) {
        moves.push({ pieceId: piece.id, from, to, steps: [{ from, to }], captures: [] });
      }
    }
  });
  return moves;
}

function kingSimpleMoves(board: Board, piece: Piece, from: Position): Move[] {
  const moves: Move[] = [];

  for (const direction of diagonalDirections) {
    let to = add(from, direction);

    while (inside(to) && !board[to.row][to.col]) {
      moves.push({ pieceId: piece.id, from, to, steps: [{ from, to }], captures: [] });
      to = add(to, direction);
    }
  }

  return moves;
}

function allCaptures(board: Board, player: Player): Move[] {
  const moves: Move[] = [];
  forEachPiece(board, player, (piece, from) => {
    moves.push(...captureSequences(board, piece, from, from, [], []));
  });
  return moves;
}

function captureSequences(
  board: Board,
  piece: Piece,
  origin: Position,
  from: Position,
  steps: MoveStep[],
  captures: Position[]
): Move[] {
  const moves: Move[] = [];
  const options = piece.king ? kingCaptureOptions(board, piece, from) : manCaptureOptions(board, piece, from);

  for (const option of options) {
    const nextBoard = cloneBoard(board);
    nextBoard[from.row][from.col] = null;
    nextBoard[option.captured.row][option.captured.col] = null;
    nextBoard[option.to.row][option.to.col] = { ...piece };

    const nextSteps = [...steps, { from, to: option.to, captured: option.captured }];
    const nextCaptures = [...captures, option.captured];
    const continuations = captureSequences(nextBoard, piece, origin, option.to, nextSteps, nextCaptures);

    moves.push(
      ...(continuations.length
        ? continuations
        : [{ pieceId: piece.id, from: origin, to: option.to, steps: nextSteps, captures: nextCaptures }])
    );
  }

  return moves;
}

function manCaptureOptions(board: Board, piece: Piece, from: Position): Array<{ to: Position; captured: Position }> {
  const options: Array<{ to: Position; captured: Position }> = [];

  for (const direction of diagonalDirections) {
    const captured = add(from, direction);
    const landing = add(captured, direction);
    const jumped = board[captured.row]?.[captured.col];

    if (inside(captured) && inside(landing) && jumped && jumped.player !== piece.player && !board[landing.row][landing.col]) {
      options.push({ to: landing, captured });
    }
  }

  return options;
}

function kingCaptureOptions(board: Board, piece: Piece, from: Position): Array<{ to: Position; captured: Position }> {
  const options: Array<{ to: Position; captured: Position }> = [];

  for (const direction of diagonalDirections) {
    let cursor = add(from, direction);
    while (inside(cursor) && !board[cursor.row][cursor.col]) {
      cursor = add(cursor, direction);
    }

    if (!inside(cursor)) continue;

    const jumped = board[cursor.row][cursor.col];
    if (!jumped || jumped.player === piece.player) continue;

    let landing = add(cursor, direction);
    while (inside(landing) && !board[landing.row][landing.col]) {
      options.push({ to: landing, captured: cursor });
      landing = add(landing, direction);
    }
  }

  return options;
}

function keepMajorityCaptures(moves: Move[]): Move[] {
  const maxCaptures = Math.max(...moves.map((move) => move.captures.length));
  return moves.filter((move) => move.captures.length === maxCaptures);
}

function manMoveDirections(piece: Piece): Position[] {
  const forward = directions[piece.player];
  return [
    { row: forward, col: -1 },
    { row: forward, col: 1 }
  ];
}

function sameMove(a: Move, b: Move): boolean {
  return (
    a.pieceId === b.pieceId &&
    samePosition(a.from, b.from) &&
    samePosition(a.to, b.to) &&
    samePositionList(a.captures, b.captures) &&
    a.steps.length === b.steps.length &&
    a.steps.every((step, index) => sameStep(step, b.steps[index]))
  );
}

function forEachPiece(board: Board, player: Player, callback: (piece: Piece, position: Position) => void): void {
  board.forEach((row, rowIndex) => {
    row.forEach((piece, colIndex) => {
      if (piece?.player === player) callback(piece, { row: rowIndex, col: colIndex });
    });
  });
}

function promotionRow(piece: Piece, position: Position): boolean {
  return (piece.player === "red" && position.row === 0) || (piece.player === "black" && position.row === 7);
}

function inside(position: Position): boolean {
  return position.row >= 0 && position.row < BOARD_SIZE && position.col >= 0 && position.col < BOARD_SIZE;
}

function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

function sameStep(a: MoveStep, b: MoveStep): boolean {
  if (!samePosition(a.from, b.from) || !samePosition(a.to, b.to)) return false;
  if (!a.captured && !b.captured) return true;
  if (!a.captured || !b.captured) return false;
  return samePosition(a.captured, b.captured);
}

function samePositionList(a: Position[], b: Position[]): boolean {
  return a.length === b.length && a.every((position, index) => samePosition(position, b[index]));
}

function countPieces(board: Board, player: Player): number {
  return board.flat().filter((piece) => piece?.player === player).length;
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

function add(position: Position, direction: Position): Position {
  return {
    row: position.row + direction.row,
    col: position.col + direction.col
  };
}
