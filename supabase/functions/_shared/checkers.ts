export type Player = "red" | "black";
export type GameStatus = "waiting" | "playing" | "finished";
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
};

const directions = {
  red: -1,
  black: 1
} satisfies Record<Player, number>;

const opponents = {
  red: "black",
  black: "red"
} satisfies Record<Player, Player>;

export function getLegalMoves(state: GameState, player: Player = state.currentPlayer): Move[] {
  if (state.status !== "playing" || state.winner) return [];
  const captures = allCaptures(state.board, player);
  return captures.length > 0 ? captures : allSimpleMoves(state.board, player);
}

export function applyMove(state: GameState, requestedMove: Move): GameState {
  const legalMove = getLegalMoves(state).find((move) => sameMove(move, requestedMove));
  if (!legalMove) throw new Error("Movimento ilegal.");

  const board = cloneBoard(state.board);
  const piece = board[legalMove.from.row]?.[legalMove.from.col];
  if (!piece) throw new Error("A peça já não existe nessa casa.");

  board[legalMove.from.row][legalMove.from.col] = null;
  for (const captured of legalMove.captures) {
    board[captured.row][captured.col] = null;
  }

  board[legalMove.to.row][legalMove.to.col] =
    !piece.king && promotionRow(piece, legalMove.to) ? { ...piece, king: true } : { ...piece };

  const nextPlayer = opponents[state.currentPlayer];
  const next: GameState = {
    board,
    currentPlayer: nextPlayer,
    status: "playing",
    winner: null,
    revision: state.revision + 1
  };

  if (countPieces(board, nextPlayer) === 0 || getLegalMoves(next, nextPlayer).length === 0) {
    return { ...next, currentPlayer: state.currentPlayer, status: "finished", winner: state.currentPlayer };
  }

  return next;
}

function allSimpleMoves(board: Board, player: Player): Move[] {
  const moves: Move[] = [];
  forEachPiece(board, player, (piece, from) => {
    for (const direction of moveDirections(piece)) {
      const to = { row: from.row + direction.row, col: from.col + direction.col };
      if (inside(to) && !board[to.row][to.col]) {
        moves.push({ pieceId: piece.id, from, to, steps: [{ from, to }], captures: [] });
      }
    }
  });
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

  for (const direction of moveDirections(piece)) {
    const captured = { row: from.row + direction.row, col: from.col + direction.col };
    const landing = { row: from.row + direction.row * 2, col: from.col + direction.col * 2 };
    const jumped = board[captured.row]?.[captured.col];

    if (!inside(captured) || !inside(landing) || !jumped || jumped.player === piece.player || board[landing.row][landing.col]) {
      continue;
    }

    const nextBoard = cloneBoard(board);
    nextBoard[from.row][from.col] = null;
    nextBoard[captured.row][captured.col] = null;
    nextBoard[landing.row][landing.col] = { ...piece };

    const nextSteps = [...steps, { from, to: landing, captured }];
    const nextCaptures = [...captures, captured];

    if (!piece.king && promotionRow(piece, landing)) {
      moves.push({ pieceId: piece.id, from: origin, to: landing, steps: nextSteps, captures: nextCaptures });
      continue;
    }

    const continuations = captureSequences(nextBoard, piece, origin, landing, nextSteps, nextCaptures);
    moves.push(
      ...(continuations.length
        ? continuations
        : [{ pieceId: piece.id, from: origin, to: landing, steps: nextSteps, captures: nextCaptures }])
    );
  }

  return moves;
}

function moveDirections(piece: Piece): Position[] {
  if (piece.king) {
    return [
      { row: -1, col: -1 },
      { row: -1, col: 1 },
      { row: 1, col: -1 },
      { row: 1, col: 1 }
    ];
  }
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
    a.steps.length === b.steps.length &&
    a.steps.every((step, index) => samePosition(step.to, b.steps[index].to))
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
  return position.row >= 0 && position.row < 8 && position.col >= 0 && position.col < 8;
}

function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

function countPieces(board: Board, player: Player): number {
  return board.flat().filter((piece) => piece?.player === player).length;
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}
