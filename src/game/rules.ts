import type { Board, GameState, Move, MoveStep, Piece, Player, Position } from "./types";

const BOARD_SIZE = 8;

const forwardByPlayer: Record<Player, number> = {
  red: -1,
  black: 1
};

const opponentOf: Record<Player, Player> = {
  red: "black",
  black: "red"
};

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
    revision: 0
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
  if (captures.length > 0) return captures;

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
    throw new Error("A peça já não existe nessa casa.");
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
  const candidateState: GameState = {
    board: nextBoard,
    currentPlayer: nextPlayer,
    status: "playing",
    winner: null,
    revision: state.revision + 1
  };

  const opponentPieces = countPieces(nextBoard, nextPlayer);
  const opponentMoves = getLegalMoves(candidateState, nextPlayer);

  if (opponentPieces === 0 || opponentMoves.length === 0) {
    return {
      ...candidateState,
      currentPlayer: state.currentPlayer,
      status: "finished",
      winner: state.currentPlayer
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
        errors.push("Há uma peça numa casa clara.");
      }

      if (pieceIds.has(piece.id)) {
        errors.push(`ID de peça duplicado: ${piece.id}.`);
      }

      pieceIds.add(piece.id);
      counts[piece.player] += 1;
    });
  });

  if (counts.red > 12 || counts.black > 12) {
    errors.push("Há mais peças do que o permitido para um jogador.");
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
    a.steps.length === b.steps.length &&
    a.steps.every((step, index) => samePosition(step.to, b.steps[index].to))
  );
}

function getAllSimpleMoves(board: Board, player: Player): Move[] {
  const moves: Move[] = [];

  forEachPiece(board, player, (piece, from) => {
    for (const direction of movementDirections(piece)) {
      const to = { row: from.row + direction.row, col: from.col + direction.col };

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

  for (const direction of captureDirections(piece)) {
    const captured = { row: from.row + direction.row, col: from.col + direction.col };
    const landing = { row: from.row + direction.row * 2, col: from.col + direction.col * 2 };
    const capturedPiece = getPiece(board, captured);

    if (
      !isInsideBoard(captured) ||
      !isInsideBoard(landing) ||
      !capturedPiece ||
      capturedPiece.player === piece.player ||
      getPiece(board, landing)
    ) {
      continue;
    }

    const nextBoard = cloneBoard(board);
    nextBoard[from.row][from.col] = null;
    nextBoard[captured.row][captured.col] = null;
    nextBoard[landing.row][landing.col] = { ...piece };

    const nextSteps = [...previousSteps, { from, to: landing, captured }];
    const nextCaptures = [...previousCaptures, captured];

    if (!piece.king && isPromotionRow(piece, landing)) {
      moves.push(toMove(piece, origin, landing, nextSteps, nextCaptures));
      continue;
    }

    const continuations = getCaptureSequences(
      nextBoard,
      piece,
      origin,
      landing,
      nextSteps,
      nextCaptures
    );

    if (continuations.length > 0) {
      moves.push(...continuations);
    } else {
      moves.push(toMove(piece, origin, landing, nextSteps, nextCaptures));
    }
  }

  return moves;
}

function movementDirections(piece: Piece): Position[] {
  if (piece.king) {
    return [
      { row: -1, col: -1 },
      { row: -1, col: 1 },
      { row: 1, col: -1 },
      { row: 1, col: 1 }
    ];
  }

  const forward = forwardByPlayer[piece.player];
  return [
    { row: forward, col: -1 },
    { row: forward, col: 1 }
  ];
}

function captureDirections(piece: Piece): Position[] {
  return movementDirections(piece);
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
