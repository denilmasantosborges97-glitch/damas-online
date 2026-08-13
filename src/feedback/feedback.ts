import type { Move, Player, Position } from "../game/types";
import type { ReactionValue, RoomSnapshot } from "../multiplayer/types";

export const REACTION_OPTIONS: ReactionValue[] = ["👍", "👏", "😮", "GG", "Boa jogada!"];
export const REACTION_COOLDOWN_MS = 2500;

export type FeedbackSettings = {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  reduceMotion: boolean;
};

export type DerivedMoveFeedback = {
  move: Move;
  capturedCount: number;
};

export function createDefaultFeedbackSettings(prefersReducedMotion: boolean): FeedbackSettings {
  return {
    soundEnabled: true,
    vibrationEnabled: true,
    reduceMotion: prefersReducedMotion
  };
}

export function normalizeFeedbackSettings(
  value: Partial<FeedbackSettings> | null | undefined,
  prefersReducedMotion: boolean
): FeedbackSettings {
  const defaults = createDefaultFeedbackSettings(prefersReducedMotion);

  return {
    soundEnabled: typeof value?.soundEnabled === "boolean" ? value.soundEnabled : defaults.soundEnabled,
    vibrationEnabled:
      typeof value?.vibrationEnabled === "boolean" ? value.vibrationEnabled : defaults.vibrationEnabled,
    reduceMotion: typeof value?.reduceMotion === "boolean" ? value.reduceMotion : defaults.reduceMotion
  };
}

export function canSendReaction(now: number, lastSentAt: number | null, cooldownMs = REACTION_COOLDOWN_MS): boolean {
  return lastSentAt === null || now - lastSentAt >= cooldownMs;
}

export function getReactionCooldownRemaining(
  now: number,
  lastSentAt: number | null,
  cooldownMs = REACTION_COOLDOWN_MS
): number {
  if (lastSentAt === null) return 0;
  return Math.max(0, cooldownMs - (now - lastSentAt));
}

export function isReactionValue(value: unknown): value is ReactionValue {
  return typeof value === "string" && REACTION_OPTIONS.includes(value as ReactionValue);
}

export function shouldShowTurnCue(
  previous: RoomSnapshot | null,
  current: RoomSnapshot,
  player: Player
): boolean {
  if (current.status !== "playing" || current.currentPlayer !== player) return false;
  return !previous || previous.currentPlayer !== player || previous.status !== "playing";
}

export function deriveMoveFeedback(previous: RoomSnapshot | null, current: RoomSnapshot): DerivedMoveFeedback | null {
  if (!previous || current.revision === previous.revision || previous.board === current.board) return null;

  const moved = findMovedPiece(previous, current);
  if (!moved) return null;

  const captures = findRemovedOpponentPieces(previous, current, moved.player, moved.from);
  const move: Move = {
    pieceId: moved.pieceId,
    from: moved.from,
    to: moved.to,
    steps: [{ from: moved.from, to: moved.to, captured: captures[0] }],
    captures
  };

  return {
    move,
    capturedCount: captures.length
  };
}

function findMovedPiece(
  previous: RoomSnapshot,
  current: RoomSnapshot
): { pieceId: string; player: Player; from: Position; to: Position } | null {
  for (let row = 0; row < previous.board.length; row += 1) {
    for (let col = 0; col < previous.board[row].length; col += 1) {
      const previousPiece = previous.board[row][col];
      if (!previousPiece) continue;

      const currentPosition = findPieceById(current, previousPiece.id);
      if (!currentPosition) continue;

      const from = { row, col };
      if (samePosition(from, currentPosition)) continue;

      return {
        pieceId: previousPiece.id,
        player: previousPiece.player,
        from,
        to: currentPosition
      };
    }
  }

  return null;
}

function findRemovedOpponentPieces(
  previous: RoomSnapshot,
  current: RoomSnapshot,
  movingPlayer: Player,
  from: Position
): Position[] {
  const captures: Position[] = [];

  for (let row = 0; row < previous.board.length; row += 1) {
    for (let col = 0; col < previous.board[row].length; col += 1) {
      const previousPiece = previous.board[row][col];
      if (!previousPiece || previousPiece.player === movingPlayer) continue;
      if (samePosition(from, { row, col })) continue;

      if (!findPieceById(current, previousPiece.id)) {
        captures.push({ row, col });
      }
    }
  }

  return captures;
}

function findPieceById(room: RoomSnapshot, pieceId: string): Position | null {
  for (let row = 0; row < room.board.length; row += 1) {
    for (let col = 0; col < room.board[row].length; col += 1) {
      if (room.board[row][col]?.id === pieceId) return { row, col };
    }
  }

  return null;
}

function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}
