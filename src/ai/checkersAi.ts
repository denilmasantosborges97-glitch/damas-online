import { applyMove, getLegalMoves } from "../game/rules";
import type { GameState, Move, Piece, Player } from "../game/types";

export type AiDifficulty = "easy" | "medium" | "hard";
export type ColorChoice = "red" | "black" | "random";

const opponentOf: Record<Player, Player> = {
  red: "black",
  black: "red"
};

export function choosePlayerColor(choice: ColorChoice, rng = Math.random): Player {
  if (choice === "random") return rng() < 0.5 ? "red" : "black";
  return choice;
}

export function shouldComputerPlay(state: GameState, computerPlayer: Player): boolean {
  return state.status === "playing" && state.currentPlayer === computerPlayer;
}

export function chooseComputerMove(
  state: GameState,
  difficulty: AiDifficulty,
  computerPlayer: Player,
  rng = Math.random
): Move | null {
  if (!shouldComputerPlay(state, computerPlayer)) return null;

  const legalMoves = getLegalMoves(state, computerPlayer);
  if (legalMoves.length === 0) return null;

  if (difficulty === "easy") return pickRandom(legalMoves, rng);
  if (difficulty === "medium") return chooseByHeuristic(state, legalMoves, computerPlayer, rng);

  return chooseByMinimax(state, legalMoves, computerPlayer, rng);
}

function chooseByHeuristic(state: GameState, moves: Move[], computerPlayer: Player, rng: () => number): Move {
  return bestScoredMove(moves, rng, (move) => {
    const next = applyMove(state, move);
    const opponent = opponentOf[computerPlayer];
    const opponentCaptures = getLegalMoves(next, opponent).filter((candidate) => candidate.captures.length > 0);
    const maxOpponentCapture = Math.max(0, ...opponentCaptures.map((candidate) => candidate.captures.length));

    return (
      terminalScore(next, computerPlayer) +
      move.captures.length * 400 +
      promotionBonus(state, move) +
      evaluateState(next, computerPlayer) * 0.25 -
      maxOpponentCapture * 190
    );
  });
}

function chooseByMinimax(state: GameState, moves: Move[], computerPlayer: Player, rng: () => number): Move {
  const depth = moves.length > 12 ? 3 : 4;

  return bestScoredMove(moves, rng, (move) => {
    const next = applyMove(state, move);
    return minimax(next, depth - 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, computerPlayer);
  });
}

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  computerPlayer: Player
): number {
  if (depth === 0 || state.status !== "playing") {
    return terminalScore(state, computerPlayer) + evaluateState(state, computerPlayer);
  }

  const moves = orderMoves(getLegalMoves(state, state.currentPlayer));
  if (moves.length === 0) return terminalScore(state, computerPlayer) + evaluateState(state, computerPlayer);

  if (state.currentPlayer === computerPlayer) {
    let best = Number.NEGATIVE_INFINITY;
    let currentAlpha = alpha;

    for (const move of moves) {
      best = Math.max(best, minimax(applyMove(state, move), depth - 1, currentAlpha, beta, computerPlayer));
      currentAlpha = Math.max(currentAlpha, best);
      if (beta <= currentAlpha) break;
    }

    return best;
  }

  let best = Number.POSITIVE_INFINITY;
  let currentBeta = beta;

  for (const move of moves) {
    best = Math.min(best, minimax(applyMove(state, move), depth - 1, alpha, currentBeta, computerPlayer));
    currentBeta = Math.min(currentBeta, best);
    if (currentBeta <= alpha) break;
  }

  return best;
}

function bestScoredMove(moves: Move[], rng: () => number, score: (move: Move) => number): Move {
  let bestScore = Number.NEGATIVE_INFINITY;
  const bestMoves: Move[] = [];

  for (const move of moves) {
    const moveScore = score(move);
    if (moveScore > bestScore) {
      bestScore = moveScore;
      bestMoves.length = 0;
      bestMoves.push(move);
    } else if (moveScore === bestScore) {
      bestMoves.push(move);
    }
  }

  return pickRandom(bestMoves, rng);
}

function evaluateState(state: GameState, computerPlayer: Player): number {
  let score = 0;

  state.board.forEach((row, rowIndex) => {
    row.forEach((piece) => {
      if (!piece) return;

      const sign = piece.player === computerPlayer ? 1 : -1;
      const promotionDistance = piece.king ? 0 : distanceToPromotion(piece, rowIndex);
      score += sign * (piece.king ? 180 : 100);
      score += sign * (piece.king ? 18 : 22 - promotionDistance * 3);
      score += sign * centerBonus(rowIndex);
    });
  });

  score += getLegalMoves(state, computerPlayer).length * 2;
  score -= getLegalMoves(state, opponentOf[computerPlayer]).length * 2;

  return score;
}

function terminalScore(state: GameState, computerPlayer: Player): number {
  if (state.status === "draw") return 0;
  if (state.status === "finished") return state.winner === computerPlayer ? 100_000 : -100_000;
  return 0;
}

function promotionBonus(state: GameState, move: Move): number {
  const piece = state.board[move.from.row][move.from.col];
  if (!piece || piece.king) return 0;
  const promotionRow = piece.player === "red" ? 0 : 7;
  return move.to.row === promotionRow ? 140 : 0;
}

function distanceToPromotion(piece: Piece, row: number): number {
  return piece.player === "red" ? row : 7 - row;
}

function centerBonus(row: number): number {
  return row >= 2 && row <= 5 ? 4 : 0;
}

function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => b.captures.length - a.captures.length);
}

function pickRandom<T>(items: T[], rng: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}
