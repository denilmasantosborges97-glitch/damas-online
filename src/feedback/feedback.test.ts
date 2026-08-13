import { describe, expect, it } from "vitest";
import type { Board, Piece, Player } from "../game/types";
import type { RoomSnapshot } from "../multiplayer/types";
import {
  canSendReaction,
  deriveMoveFeedback,
  getReactionCooldownRemaining,
  isReactionValue,
  normalizeFeedbackSettings,
  shouldShowTurnCue
} from "./feedback";

describe("feedback visual e interacao", () => {
  it("limita reacoes durante o cooldown", () => {
    expect(canSendReaction(3_000, null)).toBe(true);
    expect(canSendReaction(4_000, 3_000)).toBe(false);
    expect(canSendReaction(5_600, 3_000)).toBe(true);
    expect(getReactionCooldownRemaining(4_000, 3_000)).toBe(1_500);
  });

  it("aceita apenas reacoes predefinidas", () => {
    expect(isReactionValue("GG")).toBe(true);
    expect(isReactionValue("Boa jogada!")).toBe(true);
    expect(isReactionValue("mensagem livre")).toBe(false);
  });

  it("normaliza configuracoes de som, vibracao e reducao de movimento", () => {
    expect(normalizeFeedbackSettings({ soundEnabled: false }, true)).toEqual({
      soundEnabled: false,
      vibrationEnabled: true,
      reduceMotion: true
    });
  });

  it("decide quando deve mostrar o aviso de turno", () => {
    const previous = roomWith([piece("red", 5, 0), piece("black", 2, 1)], "black", 1);
    const current = roomWith([piece("red", 5, 0), piece("black", 2, 1)], "red", 2);

    expect(shouldShowTurnCue(previous, current, "red")).toBe(true);
    expect(shouldShowTurnCue(current, current, "red")).toBe(false);
    expect(shouldShowTurnCue(previous, current, "black")).toBe(false);
  });

  it("deriva origem, destino e captura a partir de estados confirmados da sala", () => {
    const previous = roomWith([piece("red", 5, 0), piece("black", 4, 1)], "red", 1);
    const current = roomWith([], "black", 2);
    current.board[3][2] = { id: "red-5-0", player: "red", king: false };
    const feedback = deriveMoveFeedback(previous, current);

    expect(feedback?.move.pieceId).toBe("red-5-0");
    expect(feedback?.move.from).toEqual({ row: 5, col: 0 });
    expect(feedback?.move.to).toEqual({ row: 3, col: 2 });
    expect(feedback?.move.captures).toEqual([{ row: 4, col: 1 }]);
  });
});

function roomWith(pieces: Piece[], currentPlayer: Player, revision: number): RoomSnapshot {
  const board: Board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));

  for (const currentPiece of pieces) {
    const [, row, col] = currentPiece.id.split("-");
    board[Number(row)][Number(col)] = currentPiece;
  }

  return {
    id: "room-1",
    code: "ABCDE",
    status: "playing",
    board,
    currentPlayer,
    winner: null,
    resultReason: null,
    revision,
    drawPlyCount: 0,
    drawOfferPlayer: null,
    drawOfferCreatedAt: null,
    rematchRed: false,
    rematchBlack: false,
    rematchDeclinedBy: null
  };
}

function piece(player: Player, row: number, col: number): Piece {
  return {
    id: `${player}-${row}-${col}`,
    player,
    king: false
  };
}
