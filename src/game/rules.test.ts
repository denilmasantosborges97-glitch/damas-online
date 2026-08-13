import { describe, expect, it } from "vitest";
import {
  applyMove as applyClientMove,
  createInitialGameState,
  getLegalMoves as getClientLegalMoves
} from "./rules";
import {
  applyMove as applyServerMove,
  getLegalMoves as getServerLegalMoves
} from "../../supabase/functions/_shared/checkers";
import type { Board, GameState, Move, Piece, Player, Position } from "./types";

const engines = [
  { name: "cliente", getLegalMoves: getClientLegalMoves, applyMove: applyClientMove },
  { name: "backend", getLegalMoves: getServerLegalMoves, applyMove: applyServerMove }
];

describe.each(engines)("regras de damas brasileiras - $name", ({ getLegalMoves, applyMove }) => {
  it("permite pedra andando uma casa para a frente", () => {
    const state = makeState([piece("red", 5, 0), piece("black", 6, 5)]);

    expect(moveTo(getLegalMoves(state), { row: 5, col: 0 }, { row: 4, col: 1 })).toBeDefined();
  });

  it("nao permite pedra andando normalmente para tras", () => {
    const state = makeState([piece("red", 4, 1), piece("black", 6, 5)]);

    expect(moveTo(getLegalMoves(state), { row: 4, col: 1 }, { row: 5, col: 0 })).toBeUndefined();
    expect(moveTo(getLegalMoves(state), { row: 4, col: 1 }, { row: 5, col: 2 })).toBeUndefined();
  });

  it("permite pedra capturando para a frente", () => {
    const state = makeState([piece("red", 5, 0), piece("black", 4, 1)]);
    const move = getLegalMoves(state)[0];
    const next = applyMove(state, move);

    expect(move.captures).toEqual([{ row: 4, col: 1 }]);
    expect(next.board[3][2]?.player).toBe("red");
    expect(next.board[4][1]).toBeNull();
  });

  it("permite pedra capturando para tras", () => {
    const state = makeState([piece("red", 3, 2), piece("black", 4, 3)]);
    const move = moveTo(getLegalMoves(state), { row: 3, col: 2 }, { row: 5, col: 4 });

    expect(move?.captures).toEqual([{ row: 4, col: 3 }]);
  });

  it("obriga captura quando existe alternativa simples", () => {
    const state = makeState([
      piece("red", 5, 0),
      piece("red", 5, 4),
      piece("black", 4, 1),
      piece("black", 6, 7)
    ]);
    const moves = getLegalMoves(state);

    expect(moves).toHaveLength(1);
    expect(moves[0].captures).toEqual([{ row: 4, col: 1 }]);
  });

  it("permite captura multipla com a mesma pedra", () => {
    const state = makeState([piece("red", 5, 0), piece("black", 4, 1), piece("black", 2, 3)]);
    const move = getLegalMoves(state)[0];
    const next = applyMove(state, move);

    expect(move.steps.map((step) => step.to)).toEqual([
      { row: 3, col: 2 },
      { row: 1, col: 4 }
    ]);
    expect(move.captures).toHaveLength(2);
    expect(next.board[1][4]?.player).toBe("red");
  });

  it("permite mudar de direcao numa captura multipla de pedra", () => {
    const state = makeState([piece("red", 5, 0), piece("black", 4, 1), piece("black", 4, 3)]);
    const move = getLegalMoves(state)[0];

    expect(move.steps.map((step) => step.to)).toEqual([
      { row: 3, col: 2 },
      { row: 5, col: 4 }
    ]);
    expect(move.captures).toEqual([
      { row: 4, col: 1 },
      { row: 4, col: 3 }
    ]);
  });

  it("aplica a lei da maioria usando a sequencia completa", () => {
    const state = makeState([
      piece("red", 5, 0),
      piece("red", 5, 4),
      piece("black", 4, 1),
      piece("black", 2, 3),
      piece("black", 4, 5)
    ]);
    const moves = getLegalMoves(state);

    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((move) => move.captures.length === 2)).toBe(true);
    expect(moves.every((move) => samePosition(move.from, { row: 5, col: 0 }))).toBe(true);
  });

  it("permite dama movendo uma casa", () => {
    const state = makeState([piece("red", 4, 3, true), piece("black", 7, 6)]);

    expect(moveTo(getLegalMoves(state), { row: 4, col: 3 }, { row: 3, col: 2 })).toBeDefined();
  });

  it("permite dama movendo varias casas na diagonal", () => {
    const state = makeState([piece("red", 4, 3, true), piece("black", 7, 6)]);

    expect(moveTo(getLegalMoves(state), { row: 4, col: 3 }, { row: 1, col: 0 })).toBeDefined();
  });

  it("nao permite dama atravessar peca bloqueando a diagonal", () => {
    const state = makeState([piece("red", 5, 0, true), piece("red", 4, 1), piece("black", 7, 6)]);

    expect(moveTo(getLegalMoves(state), { row: 5, col: 0 }, { row: 3, col: 2 })).toBeUndefined();
  });

  it("permite dama capturando a distancia", () => {
    const state = makeState([piece("red", 5, 0, true), piece("black", 3, 2), piece("black", 7, 6)]);
    const move = moveTo(getLegalMoves(state), { row: 5, col: 0 }, { row: 1, col: 4 });

    expect(move?.captures).toEqual([{ row: 3, col: 2 }]);
  });

  it("permite diferentes casas de pouso depois da captura da dama", () => {
    const state = makeState([piece("red", 5, 0, true), piece("black", 3, 2), piece("black", 7, 6)]);
    const landings = getLegalMoves(state)
      .filter((move) => samePosition(move.from, { row: 5, col: 0 }))
      .map((move) => move.to);

    expect(landings).toEqual(expect.arrayContaining([
      { row: 2, col: 3 },
      { row: 1, col: 4 },
      { row: 0, col: 5 }
    ]));
  });

  it("permite captura multipla da dama", () => {
    const state = makeState([
      piece("red", 5, 0, true),
      piece("black", 3, 2),
      piece("black", 3, 6)
    ]);
    const moves = getLegalMoves(state);

    expect(moves.some((move) => move.captures.length === 2 && samePosition(move.to, { row: 4, col: 7 }))).toBe(true);
  });

  it("aplica a lei da maioria envolvendo dama", () => {
    const state = makeState([
      piece("red", 5, 0, true),
      piece("red", 5, 6, true),
      piece("black", 3, 2),
      piece("black", 3, 6),
      piece("black", 4, 5)
    ]);
    const moves = getLegalMoves(state);

    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((move) => move.captures.length === 2)).toBe(true);
  });

  it("promove pedra ao terminar na ultima linha", () => {
    const state = makeState([piece("red", 1, 2), piece("black", 6, 5)]);
    const move = moveTo(getLegalMoves(state), { row: 1, col: 2 }, { row: 0, col: 1 })!;
    const next = applyMove(state, move);

    expect(next.board[0][1]?.king).toBe(true);
  });

  it("nao interrompe captura na linha de promocao quando a pedra ainda deve continuar", () => {
    const state = makeState([piece("red", 2, 1), piece("black", 1, 2), piece("black", 1, 4)]);
    const move = getLegalMoves(state)[0];
    const next = applyMove(state, move);

    expect(move.steps.map((step) => step.to)).toEqual([
      { row: 0, col: 3 },
      { row: 2, col: 5 }
    ]);
    expect(next.board[2][5]?.king).toBe(false);
  });

  it("deteta vitoria quando o adversario fica sem pecas", () => {
    const state = makeState([piece("red", 2, 1), piece("black", 1, 2)]);
    const next = applyMove(state, getLegalMoves(state)[0]);

    expect(next.status).toBe("finished");
    expect(next.winner).toBe("red");
    expect(next.resultReason).toBe("no_pieces");
  });

  it("deteta vitoria quando o adversario fica sem jogadas legais", () => {
    const state = makeState([piece("red", 4, 5, true), piece("black", 7, 0)]);
    const move = moveTo(getLegalMoves(state), { row: 4, col: 5 }, { row: 3, col: 4 })!;
    const next = applyMove(state, move);

    expect(next.status).toBe("finished");
    expect(next.winner).toBe("red");
    expect(next.resultReason).toBe("no_moves");
  });

  it("declara empate rapido em final 1 dama contra 1 dama apos 12 meios-lances sem captura", () => {
    const state = makeState([piece("red", 4, 3, true), piece("black", 7, 6, true)], "red", 11);
    const move = moveTo(getLegalMoves(state), { row: 4, col: 3 }, { row: 3, col: 2 })!;
    const next = applyMove(state, move);

    expect(next.status).toBe("draw");
    expect(next.winner).toBeNull();
    expect(next.resultReason).toBe("draw_auto");
  });

  it("declara empate geral apos 40 meios-lances consecutivos apenas com damas sem captura", () => {
    const state = makeState([piece("red", 4, 3, true), piece("red", 0, 7, true), piece("black", 7, 6, true)], "red", 39);
    const move = moveTo(getLegalMoves(state), { row: 4, col: 3 }, { row: 3, col: 2 })!;
    const next = applyMove(state, move);

    expect(next.status).toBe("draw");
    expect(next.winner).toBeNull();
    expect(next.resultReason).toBe("draw_rule");
    expect(getLegalMoves(next)).toHaveLength(0);
  });

  it("rejeita tentativa de jogada ilegal manipulada", () => {
    const state = makeState([piece("red", 4, 1), piece("black", 6, 5)]);
    const illegalMove: Move = {
      pieceId: "red-4-1",
      from: { row: 4, col: 1 },
      to: { row: 5, col: 0 },
      steps: [{ from: { row: 4, col: 1 }, to: { row: 5, col: 0 } }],
      captures: []
    };

    expect(() => applyMove(state, illegalMove)).toThrow("Movimento ilegal");
  });
});

describe("estado inicial", () => {
  it("cria o tabuleiro padrao com contador de empate zerado", () => {
    const state = createInitialGameState();

    expect(state.drawPlyCount).toBe(0);
    expect(state.resultReason).toBeNull();
    expect(state.status).toBe("playing");
  });
});

function makeState(pieces: Piece[], currentPlayer: Player = "red", drawPlyCount = 0): GameState {
  const board: Board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));

  for (const currentPiece of pieces) {
    const [, row, col] = currentPiece.id.split("-");
    board[Number(row)][Number(col)] = currentPiece;
  }

  return {
    board,
    currentPlayer,
    status: "playing",
    winner: null,
    resultReason: null,
    revision: 0,
    drawPlyCount
  };
}

function piece(player: Player, row: number, col: number, king = false): Piece {
  return {
    id: `${player}-${row}-${col}`,
    player,
    king
  };
}

function moveTo(moves: Move[], from: Position, to: Position): Move | undefined {
  return moves.find((move) => samePosition(move.from, from) && samePosition(move.to, to));
}

function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}
