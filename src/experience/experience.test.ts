import { describe, expect, it } from "vitest";
import type { Board, Piece, Player, ResultReason } from "../game/types";
import type { DisconnectState, RoomSnapshot } from "../multiplayer/types";
import {
  canOfferDraw,
  formatPieceSummary,
  hasIncomingDrawOffer,
  hasIncomingRematchRequest,
  hasOutgoingDrawOffer,
  hasOutgoingRematchRequest,
  rematchDeclinedText,
  resultReasonText,
  resultTitle,
  summarizePieces
} from "./experience";

describe("experiencia da partida", () => {
  it("conta pecas e damas", () => {
    const room = roomWith([piece("red", 5, 0), piece("red", 0, 1, true), piece("black", 2, 1)]);

    expect(summarizePieces(room.board, "red")).toEqual({ pieces: 2, kings: 1 });
    expect(formatPieceSummary("Vermelhas", { pieces: 2, kings: 1 })).toBe("Vermelhas: 2 peças · 1 dama");
  });

  it("descreve vitoria, derrota e desistencia em portugues do Brasil", () => {
    const room = roomWith([], "red", "finished", "red", "resignation");

    expect(resultTitle(room, "red")).toBe("VITÓRIA");
    expect(resultTitle(room, "black")).toBe("DERROTA");
    expect(resultReasonText(room.resultReason, true)).toBe("Vitória por desistência.");
  });

  it("identifica empate aceito e recusado por oferta", () => {
    const offered = roomWith([], "red");
    offered.drawOfferPlayer = "red";
    offered.drawOfferCreatedAt = new Date(1_000).toISOString();

    expect(hasOutgoingDrawOffer(offered, "red")).toBe(true);
    expect(hasIncomingDrawOffer(offered, "black")).toBe(true);
    expect(canOfferDraw(offered, "black", 30_000)).toBe(false);

    offered.drawOfferPlayer = null;
    expect(canOfferDraw(offered, "black", 10_000)).toBe(false);
    expect(canOfferDraw(offered, "black", 25_000)).toBe(true);
  });

  it("identifica revanche aceita, aguardando resposta e recusada", () => {
    const room = roomWith([], "red", "finished", "red", "no_pieces");
    room.rematchRed = true;

    expect(hasOutgoingRematchRequest(room, "red")).toBe(true);
    expect(hasIncomingRematchRequest(room, "black")).toBe(true);

    room.rematchDeclinedBy = "black";
    expect(hasIncomingRematchRequest(room, "black")).toBe(false);
    expect(rematchDeclinedText(room, "red")).toBe("O adversário recusou a revanche.");
  });

  it("modela desconexao, reconexao e abandono apos tolerancia", () => {
    const disconnected: DisconnectState = { active: true, remainingSeconds: 60, reconnected: false };
    const reconnected: DisconnectState = { active: false, remainingSeconds: 60, reconnected: true };
    const abandoned = roomWith([], "red", "finished", "red", "abandonment");

    expect(disconnected.active).toBe(true);
    expect(reconnected.reconnected).toBe(true);
    expect(resultReasonText(abandoned.resultReason, true)).toBe("Vitória por abandono.");
  });
});

function roomWith(
  pieces: Piece[],
  currentPlayer: Player = "red",
  status: RoomSnapshot["status"] = "playing",
  winner: Player | null = null,
  resultReason: ResultReason | null = null
): RoomSnapshot {
  const board: Board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));

  for (const currentPiece of pieces) {
    const [, row, col] = currentPiece.id.split("-");
    board[Number(row)][Number(col)] = currentPiece;
  }

  return {
    id: "room-1",
    code: "ABCDE",
    status,
    board,
    currentPlayer,
    winner,
    resultReason,
    revision: 1,
    drawPlyCount: 0,
    drawOfferPlayer: null,
    drawOfferCreatedAt: null,
    rematchRed: false,
    rematchBlack: false,
    rematchDeclinedBy: null
  };
}

function piece(player: Player, row: number, col: number, king = false): Piece {
  return {
    id: `${player}-${row}-${col}`,
    player,
    king
  };
}
