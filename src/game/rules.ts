import type { Board, GameState, Move, MoveStep, Piece, Player, Position } from "./types";

const BOARD_SIZE = 8;
const DRAW_KING_ONLY_PLY_LIMIT = 40;

const forwardByPlayer: Record<Player, number> = {
  red: -1,
  black: 1
};

const opponentOf: Record<Player, Player> = {
  red: "black",
  black: "red"
};

const diagonalDirections: Position[] = [
  { row: -1, col: -1 },
  { row: -1, col: 1 },
  { row: 1, col: -1 },
  { row: 1, col: 1 }
];

export function createInitialBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, (_, row) =>
    Array.from({ length: BOARD_SIZE }, (_, col): Piece | null => {
      if (!isDarkSquare({ row, col })) return null;

      if (row <= 2) {
        return { id: `black-${row}-${col}`, player: "black", king: false };
      }

      if (row >= 5) {
        return { id: `red-${row}-${col}`, player: "red", king: false };
      }

      return null;
    })
  );
}

export function createInitialGameState(status: GameState["status"] = "playing"): GameState {
  return {
    board: createInitialBoard(),
    currentPlayer: "red",
    status,
    winner: null,
    revision: 0,
    drawPlyCount: 0
  };
}

export function isDarkSquare(position: Position): boolean {
  return (position.row + position.col) % 2 === 1;
}

export function isInsideBoard(position: Position): boolean {
  return (
    position.row >= 0 &&
    position.row < BOARD_SIZE &&
    position.col >= 0 &&
    position.col < BOARD_SIZE
  );
}

export function getLegalMoves(state: GameState, player: Player = state.currentPlayer): Move[] {
  if (state.status !== "playing" || state.winner) return [];

  const captures = getAllCaptureMoves(state.board, player);
  if (captures.length > 0) return keepMajorityCaptures(captures);

  return getAllSimpleMoves(state.board, player);
}

export function getMovesForPiece(state: GameState, position: Position): Move[] {
  const piece = getPiece(state.board, position);
  if (!piece || piece.player !== state.currentPlayer) return [];

  return getLegalMoves(state).filter((move) => samePosition(move.from, position));
}

export function applyMove(state: GameState, requestedMove: Move): GameState {
  const legalMove = getLegalMoves(state).find((move) => sameMove(move, requestedMove));

  if (!legalMove) {
    throw new Error("Movimento ilegal.");
  }

  const nextBoard = cloneBoard(state.board);
  const piece = getPiece(nextBoard, legalMove.from);

  if (!piece) {
    throw new Error("A peca ja nao existe nessa casa.");
  }

  nextBoard[legalMove.from.row][legalMove.from.col] = null;

  for (const captured of legalMove.captures) {
    nextBoard[captured.row][captured.col] = null;
  }

  const promotedPiece = shouldPromote(piece, legalMove.to)
    ? { ...piece, king: true }
    : { ...piece };

  nextBoard[legalMove.to.row][legalMove.to.col] = promotedPiece;

  const nextPlayer = opponentOf[state.currentPlayer];
  const nextDrawPlyCount =
    piece.king && legalMove.captures.length === 0 ? state.drawPlyCount + 1 : 0;
  const candidateState: GameState = {
    board: nextBoard,
    currentPlayer: nextPlayer,
    status: "playing",
    winner: null,
    revision: state.revision + 1,
    drawPlyCount: nextDrawPlyCount
  };

  const opponentPieces = countPieces(nextBoard, nextPlayer);
  const opponentMoves = getLegalMoves(candidateState, nextPlayer);

  if (opponentPieces === 0 || opponentMoves.length === 0) {
    return {
      ...candidateState,
      currentPlayer: state.currentPlayer,
      status: "finished",
      winner: state.currentPlayer,
      drawPlyCount: 0
    };
  }

  if (nextDrawPlyCount >= DRAW_KING_ONLY_PLY_LIMIT) {
    return {
      ...candidateState,
      status: "draw",
      winner: null
    };
  }

  return candidateState;
}

export function validateGameState(state: GameState): string[] {
  const errors: string[] = [];
  const pieceIds = new Set<string>();
  const counts: Record<Player, number> = { red: 0, black: 0 };

  if (state.board.length !== BOARD_SIZE) {
    errors.push("O tabuleiro deve ter 8 linhas.");
    return errors;
  }

  state.board.forEach((row, rowIndex) => {
    if (row.length !== BOARD_SIZE) {
      errors.push(`A linha ${rowIndex + 1} deve ter 8 casas.`);
      return;
    }

    row.forEach((piece, colIndex) => {
      if (!piece) return;

      if (!isDarkSquare({ row: rowIndex, col: colIndex })) {
        errors.push("Ha uma peca numa casa clara.");
      }

      if (pieceIds.has(piece.id)) {
        errors.push(`ID de peca duplicado: ${piece.id}.`);
      }

      pieceIds.add(piece.id);
      counts[piece.player] += 1;
    });
  });

  if (counts.red > 12 || counts.black > 12) {
    errors.push("Ha mais pecas do que o permitido para um jogador.");
  }

  return errors;
}

export function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

export function sameMove(a: Move, b: Move): boolean {
  return (
    a.pieceId === b.pieceId &&
    samePosition(a.from, b.from) &&
    samePosition(a.to, b.to) &&
    samePositionList(a.captures, b.captures) &&
    a.steps.length === b.steps.length &&
    a.steps.every((step, index) => sameStep(step, b.steps[index]))
  );
}

function getAllSimpleMoves(board: Board, player: Player): Move[] {
  const moves: Move[] = [];

  forEachPiece(board, player, (piece, from) => {
    if (piece.king) {
      moves.push(...getKingSimpleMoves(board, piece, from));
      return;
    }

    for (const direction of manMovementDirections(piece)) {
      const to = add(from, direction);

      if (isInsideBoard(to) && !getPiece(board, to)) {
        moves.push({
          pieceId: piece.id,
          from,
          to,
          steps: [{ from, to }],
          captures: []
        });
      }
    }
  });

  return moves;
}

function getKingSimpleMoves(board: Board, piece: Piece, from: Position): Move[] {
  const moves: Move[] = [];

  for (const direction of diagonalDirections) {
    let to = add(from, direction);

    while (isInsideBoard(to) && !getPiece(board, to)) {
      moves.push({
        pieceId: piece.id,
        from,
        to,
        steps: [{ from, to }],
        captures: []
      });
      to = add(to, direction);
    }
  }

  return moves;
}

function getAllCaptureMoves(board: Board, player: Player): Move[] {
  const moves: Move[] = [];

  forEachPiece(board, player, (piece, from) => {
    moves.push(...getCaptureSequences(board, piece, from, from, [], []));
  });

  return moves;
}

function getCaptureSequences(
  board: Board,
  piece: Piece,
  origin: Position,
  from: Position,
  previousSteps: MoveStep[],
  previousCaptures: Position[]
): Move[] {
  const moves: Move[] = [];
  const options = piece.king
    ? getKingCaptureOptions(board, piece, from)
    : getManCaptureOptions(board, piece, from);

  for (const option of options) {
    const nextBoard = cloneBoard(board);
    nextBoard[from.row][from.col] = null;
    nextBoard[option.captured.row][option.captured.col] = null;
    nextBoard[option.to.row][option.to.col] = { ...piece };

    const nextSteps = [...previousSteps, { from, to: option.to, captured: option.captured }];
    const nextCaptures = [...previousCaptures, option.captured];
    const continuations = getCaptureSequences(
      nextBoard,
      piece,
      origin,
      option.to,
      nextSteps,
      nextCaptures
    );

    if (continuations.length > 0) {
      moves.push(...continuations);
    } else {
      moves.push(toMove(piece, origin, option.to, nextSteps, nextCaptures));
    }
  }

  return moves;
}

function getManCaptureOptions(
  board: Board,
  piece: Piece,
  from: Position
): Array<{ to: Position; captured: Position }> {
  const options: Array<{ to: Position; captured: Position }> = [];

  for (const direction of diagonalDirections) {
    const captured = add(from, direction);
    const landing = add(captured, direction);
    const capturedPiece = getPiece(board, captured);

    if (
      isInsideBoard(captured) &&
      isInsideBoard(landing) &&
      capturedPiece &&
      capturedPiece.player !== piece.player &&
      !getPiece(board, landing)
    ) {
      options.push({ to: landing, captured });
    }
  }

  return options;
}

function getKingCaptureOptions(
  board: Board,
  piece: Piece,
  from: Position
): Array<{ to: Position; captured: Position }> {
  const options: Array<{ to: Position; captured: Position }> = [];

  for (const direction of diagonalDirections) {
    let cursor = add(from, direction);

    while (isInsideBoard(cursor) && !getPiece(board, cursor)) {
      cursor = add(cursor, direction);
    }

    if (!isInsideBoard(cursor)) continue;

    const capturedPiece = getPiece(board, cursor);
    if (!capturedPiece || capturedPiece.player === piece.player) continue;

    let landing = add(cursor, direction);
    while (isInsideBoard(landing) && !getPiece(board, landing)) {
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

function manMovementDirections(piece: Piece): Position[] {
  const forward = forwardByPlayer[piece.player];
  return [
    { row: forward, col: -1 },
    { row: forward, col: 1 }
  ];
}

function shouldPromote(piece: Piece, position: Position): boolean {
  return !piece.king && isPromotionRow(piece, position);
}

function isPromotionRow(piece: Piece, position: Position): boolean {
  return (piece.player === "red" && position.row === 0) || (piece.player === "black" && position.row === 7);
}

function toMove(
  piece: Piece,
  origin: Position,
  destination: Position,
  steps: MoveStep[],
  captures: Position[]
): Move {
  return {
    pieceId: piece.id,
    from: origin,
    to: destination,
    steps,
    captures
  };
}

function forEachPiece(
  board: Board,
  player: Player,
  callback: (piece: Piece, position: Position) => void
): void {
  board.forEach((row, rowIndex) => {
    row.forEach((piece, colIndex) => {
      if (piece?.player === player) {
        callback(piece, { row: rowIndex, col: colIndex });
      }
    });
  });
}

function getPiece(board: Board, position: Position): Piece | null {
  if (!isInsideBoard(position)) return null;
  return board[position.row][position.col];
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

function sameStep(a: MoveStep, b: MoveStep): boolean {
  if (!samePosition(a.from, b.from) || !samePosition(a.to, b.to)) return false;
  if (!a.captured && !b.captured) return true;
  if (!a.captured || !b.captured) return false;
  return samePosition(a.captured, b.captured);
}

function samePositionList(a: Position[], b: Position[]): boolean {
  return a.length === b.length && a.every((position, index) => samePosition(position, b[index]));
}
