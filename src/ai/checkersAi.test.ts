import { describe, expect, it } from "vitest";
import { applyMove, getLegalMoves } from "../game/rules";
import type { Board, GameState, Move, Piece, Player } from "../game/types";
import { chooseComputerMove, choosePlayerColor, shouldComputerPlay, type AiDifficulty } from "./checkersAi";

const difficulties: AiDifficulty[] = ["easy", "medium", "hard"];

describe("IA contra a maquina", () => {
  it.each(difficulties)("dificuldade %s retorna jogada valida", (difficulty) => {
    const state = makeState([piece("red", 5, 0), piece("black", 2, 1)], "red");
    const move = chooseComputerMove(state, difficulty, "red", fixedRandom);

    expect(move).toBeDefined();
    expect(getLegalMoves(state, "red").some((legal) => sameMove(legal, move!))).toBe(true);
  });

  it("nao joga depois da partida encerrada", () => {
    const state = makeState([piece("red", 5, 0)], "red", "finished", "red");

    expect(chooseComputerMove(state, "easy", "red")).toBeNull();
  });

  it("respeita captura obrigatoria", () => {
    const state = makeState([piece("red", 5, 0), piece("red", 5, 4), piece("black", 4, 1)], "red");
    const move = chooseComputerMove(state, "easy", "red", fixedRandom)!;

    expect(move.captures).toEqual([{ row: 4, col: 1 }]);
  });

  it("respeita lei da maioria", () => {
    const state = makeState([
      piece("red", 5, 0),
      piece("red", 5, 4),
      piece("black", 4, 1),
      piece("black", 2, 3),
      piece("black", 4, 5)
    ], "red");
    const move = chooseComputerMove(state, "medium", "red", fixedRandom)!;

    expect(move.captures).toHaveLength(2);
  });

  it("consegue capturar para tras", () => {
    const state = makeState([piece("red", 3, 2), piece("black", 4, 3)], "red");
    const move = chooseComputerMove(state, "easy", "red", fixedRandom)!;

    expect(move.to).toEqual({ row: 5, col: 4 });
    expect(move.captures).toEqual([{ row: 4, col: 3 }]);
  });

  it("movimenta dama corretamente", () => {
    const state = makeState([piece("red", 4, 3, true), piece("black", 7, 6)], "red");
    const move = chooseComputerMove(state, "hard", "red", fixedRandom)!;

    expect(move.from).toEqual({ row: 4, col: 3 });
    expect(getLegalMoves(state, "red").some((legal) => sameMove(legal, move))).toBe(true);
  });

  it("executa captura multipla", () => {
    const state = makeState([piece("red", 5, 0), piece("black", 4, 1), piece("black", 2, 3)], "red");
    const move = chooseComputerMove(state, "medium", "red", fixedRandom)!;

    expect(move.captures).toHaveLength(2);
  });

  it("reconhece vitoria ao escolher captura final", () => {
    const state = makeState([piece("red", 2, 1), piece("black", 1, 2)], "red");
    const move = chooseComputerMove(state, "hard", "red", fixedRandom)!;
    const next = applyMove(state, move);

    expect(next.status).toBe("finished");
    expect(next.winner).toBe("red");
  });

  it("jogador com pretas faz a maquina iniciar", () => {
    const state = makeState([piece("red", 5, 0), piece("black", 2, 1)], "red");

    expect(shouldComputerPlay(state, "red")).toBe(true);
    expect(shouldComputerPlay(state, "black")).toBe(false);
  });

  it("escolha aleatoria de cor funciona", () => {
    expect(choosePlayerColor("random", () => 0.2)).toBe("red");
    expect(choosePlayerColor("random", () => 0.8)).toBe("black");
  });

  it("medio prefere promocao obvia quando nao ha captura", () => {
    const state = makeState([piece("red", 1, 2), piece("red", 5, 0), piece("black", 6, 5)], "red");
    const move = chooseComputerMove(state, "medium", "red", fixedRandom)!;

    expect(move.to.row).toBe(0);
  });
});

function makeState(
  pieces: Piece[],
  currentPlayer: Player,
  status: GameState["status"] = "playing",
  winner: Player | null = null
): GameState {
  const board: Board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));

  for (const currentPiece of pieces) {
    const [, row, col] = currentPiece.id.split("-");
    board[Number(row)][Number(col)] = currentPiece;
  }

  return {
    board,
    currentPlayer,
    status,
    winner,
    resultReason: null,
    revision: 0,
    drawPlyCount: 0
  };
}

function piece(player: Player, row: number, col: number, king = false): Piece {
  return {
    id: `${player}-${row}-${col}`,
    player,
    king
  };
}

function fixedRandom(): number {
  return 0;
}

function sameMove(a: Move, b: Move): boolean {
  return (
    a.pieceId === b.pieceId &&
    a.from.row === b.from.row &&
    a.from.col === b.from.col &&
    a.to.row === b.to.row &&
    a.to.col === b.to.col &&
    a.captures.length === b.captures.length
  );
}
