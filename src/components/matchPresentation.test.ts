import { describe, expect, it } from "vitest";
import type { Move } from "../game/types";
import type { ReactionEvent } from "../multiplayer/types";
import { getOnlineFooterStatus, hasMandatoryCaptureForTurn, reactionToastSide } from "./matchPresentation";

describe("apresentacao da partida online", () => {
  it("remove a dica fixa quando e a vez normal do jogador", () => {
    expect(
      getOnlineFooterStatus({
        outgoingDrawOffer: false,
        hasMandatoryCapture: false,
        isPlayerTurn: true,
        opponentName: "Denilma"
      })
    ).toBeNull();
  });

  it("mantem avisos uteis no rodape quando existe estado relevante", () => {
    expect(
      getOnlineFooterStatus({
        outgoingDrawOffer: false,
        hasMandatoryCapture: true,
        isPlayerTurn: true,
        opponentName: "Denilma"
      })
    ).toBe("Captura obrigatória disponível.");

    expect(
      getOnlineFooterStatus({
        outgoingDrawOffer: false,
        hasMandatoryCapture: false,
        isPlayerTurn: false,
        opponentName: "Denilma"
      })
    ).toBe("Vez de Denilma.");
  });

  it("detecta captura obrigatoria a partir das jogadas legais", () => {
    expect(hasMandatoryCaptureForTurn([makeMove({ captures: [] })])).toBe(false);
    expect(hasMandatoryCaptureForTurn([makeMove({ captures: [{ row: 4, col: 1 }] })])).toBe(true);
  });

  it("posiciona emote pelo jogador da sessao, independente da cor", () => {
    const ownReaction: ReactionEvent = { id: "own", sender: "black", value: "smile", sentAt: 1 };
    const opponentReaction: ReactionEvent = { id: "opponent", sender: "red", value: "clap", sentAt: 2 };

    expect(reactionToastSide(ownReaction, "black")).toBe("own");
    expect(reactionToastSide(opponentReaction, "black")).toBe("opponent");
  });
});

function makeMove(overrides: Partial<Move>): Move {
  return {
    pieceId: "red-5-0",
    from: { row: 5, col: 0 },
    to: { row: 4, col: 1 },
    steps: [{ from: { row: 5, col: 0 }, to: { row: 4, col: 1 } }],
    captures: [],
    ...overrides
  };
}
