import { describe, expect, it } from "vitest";
import type { Move } from "../game/types";
import {
  CAPTURE_ANIMATION_STEP_MS,
  MOVE_ANIMATION_SETTLE_MS,
  MOVE_ANIMATION_STEP_MS,
  REDUCED_MOTION_LAST_MOVE_MS,
  getCaptureStepIndex,
  getMoveAnimationKey,
  getVisualMoveDuration,
  getVisualMoveSteps
} from "./moveAnimation";

describe("animacao visual de jogadas", () => {
  it("mantem uma jogada simples como um unico trecho", () => {
    const move = makeMove({
      steps: [{ from: { row: 5, col: 0 }, to: { row: 4, col: 1 } }]
    });

    expect(getVisualMoveSteps(move)).toEqual([
      { index: 0, from: { row: 5, col: 0 }, to: { row: 4, col: 1 } }
    ]);
    expect(getVisualMoveDuration(move, false)).toBe(MOVE_ANIMATION_STEP_MS + MOVE_ANIMATION_SETTLE_MS);
  });

  it("preserva capturas multiplas em ordem para animar trecho por trecho", () => {
    const move = makeMove({
      to: { row: 1, col: 4 },
      captures: [
        { row: 4, col: 1 },
        { row: 2, col: 3 }
      ],
      steps: [
        { from: { row: 5, col: 0 }, to: { row: 3, col: 2 }, captured: { row: 4, col: 1 } },
        { from: { row: 3, col: 2 }, to: { row: 1, col: 4 }, captured: { row: 2, col: 3 } }
      ]
    });

    const steps = getVisualMoveSteps(move);

    expect(steps.map((step) => step.to)).toEqual([
      { row: 3, col: 2 },
      { row: 1, col: 4 }
    ]);
    expect(getCaptureStepIndex(steps, { row: 2, col: 3 })).toBe(1);
    expect(getVisualMoveDuration(move, false)).toBe(CAPTURE_ANIMATION_STEP_MS * 2 + MOVE_ANIMATION_SETTLE_MS);
  });

  it("cria um trecho visual de fallback quando o feedback remoto nao tem caminho completo", () => {
    const move = makeMove({
      to: { row: 2, col: 3 },
      captures: [{ row: 3, col: 2 }],
      steps: []
    });

    expect(getVisualMoveSteps(move)).toEqual([
      {
        index: 0,
        from: { row: 5, col: 0 },
        to: { row: 2, col: 3 },
        captured: { row: 3, col: 2 }
      }
    ]);
  });

  it("usa duracao reduzida quando o jogador prefere menos movimento", () => {
    expect(getVisualMoveDuration(makeMove(), true)).toBe(REDUCED_MOTION_LAST_MOVE_MS);
  });

  it("gera chave estavel incluindo o caminho da jogada", () => {
    const move = makeMove({
      to: { row: 3, col: 2 },
      captures: [{ row: 4, col: 1 }],
      steps: [{ from: { row: 5, col: 0 }, to: { row: 3, col: 2 }, captured: { row: 4, col: 1 } }]
    });

    expect(getMoveAnimationKey(move)).toBe("red-5-0:5,0-3,2-4,1");
  });
});

function makeMove(overrides: Partial<Move> = {}): Move {
  return {
    pieceId: "red-5-0",
    from: { row: 5, col: 0 },
    to: { row: 4, col: 1 },
    captures: [],
    steps: [{ from: { row: 5, col: 0 }, to: { row: 4, col: 1 } }],
    ...overrides
  };
}
