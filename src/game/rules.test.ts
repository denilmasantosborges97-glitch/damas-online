import { describe, expect, it } from "vitest";
import { applyMove, createInitialGameState, getLegalMoves } from "./rules";
import type { Board, GameState, Piece, Player } from "./types";

describe("regras de damas", () => {
  it("permite movimento normal diagonal para a frente", () => {
    const state = createInitialGameState();
    const move = getLegalMoves(state).find((candidate) =>
      candidate.from.row === 5 &&
      candidate.from.col === 0 &&
      candidate.to.row === 4 &&
      candidate.to.col === 1
    );

    expect(move).toBeDefined();

    const next = applyMove(state, move!);
    expect(next.board[4][1]?.player).toBe("red");
    expect(next.board[5][0]).toBeNull();
  });

  it("rejeita movimento inválido", () => {
    const state = createInitialGameState();
    const invalidMove = {
      pieceId: "red-5-0",
      from: { row: 5, col: 0 },
      to: { row: 5, col: 2 },
      steps: [{ from: { row: 5, col: 0 }, to: { row: 5, col: 2 } }],
      captures: []
    };

    expect(() => applyMove(state, invalidMove)).toThrow("Movimento ilegal");
  });

  it("aplica captura e remove a peça adversária", () => {
    const state = makeState([
      piece("red", 5, 0),
      piece("black", 4, 1)
    ]);

    const move = getLegalMoves(state)[0];
    const next = applyMove(state, move);

    expect(move.captures).toEqual([{ row: 4, col: 1 }]);
    expect(next.board[3][2]?.player).toBe("red");
    expect(next.board[4][1]).toBeNull();
  });

  it("obriga captura quando existe alternativa simples", () => {
    const state = makeState([
      piece("red", 5, 0),
      piece("red", 5, 4),
      piece("black", 4, 1)
    ]);

    const moves = getLegalMoves(state);

    expect(moves).toHaveLength(1);
    expect(moves[0].captures).toEqual([{ row: 4, col: 1 }]);
  });

  it("permite capturas múltiplas na mesma jogada", () => {
    const state = makeState([
      piece("red", 5, 0),
      piece("black", 4, 1),
      piece("black", 2, 3)
    ]);

    const move = getLegalMoves(state)[0];
    const next = applyMove(state, move);

    expect(move.steps.map((step) => step.to)).toEqual([
      { row: 3, col: 2 },
      { row: 1, col: 4 }
    ]);
    expect(next.board[1][4]?.player).toBe("red");
    expect(next.board[4][1]).toBeNull();
    expect(next.board[2][3]).toBeNull();
  });

  it("promove uma peça a dama ao chegar ao fim", () => {
    const state = makeState([piece("red", 1, 2)]);
    const move = getLegalMoves(state).find((candidate) => candidate.to.row === 0);

    const next = applyMove(state, move!);

    expect(next.board[0][1]?.king || next.board[0][3]?.king).toBe(true);
  });

  it("alterna corretamente o turno", () => {
    const state = createInitialGameState();
    const next = applyMove(state, getLegalMoves(state)[0]);

    expect(next.currentPlayer).toBe("black");
  });

  it("deteta vitória quando o adversário fica sem peças", () => {
    const state = makeState([
      piece("red", 2, 1),
      piece("black", 1, 2)
    ]);

    const next = applyMove(state, getLegalMoves(state)[0]);

    expect(next.status).toBe("finished");
    expect(next.winner).toBe("red");
  });
});

function makeState(pieces: Piece[]): GameState {
  const board: Board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));

  for (const currentPiece of pieces) {
    const [, row, col] = currentPiece.id.split("-");
    board[Number(row)][Number(col)] = currentPiece;
  }

  return {
    board,
    currentPlayer: "red",
    status: "playing",
    winner: null,
    revision: 0
  };
}

function piece(player: Player, row: number, col: number, king = false): Piece {
  return {
    id: `${player}-${row}-${col}`,
    player,
    king
  };
}
