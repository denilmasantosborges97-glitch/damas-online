import type { Piece } from "../game/types";

type PieceVisual = Pick<Piece, "player" | "king">;

type PieceAsset = {
  src: string;
  label: string;
};

const PIECE_ASSETS: Record<string, PieceAsset> = {
  "red-normal": {
    src: "/pieces/red-normal.png",
    label: "peça vermelha"
  },
  "black-normal": {
    src: "/pieces/black-normal.png",
    label: "peça preta"
  },
  "red-king": {
    src: "/pieces/red-king.png",
    label: "dama vermelha"
  },
  "black-king": {
    src: "/pieces/black-king.png",
    label: "dama preta"
  }
};

export function getPieceAsset(piece: PieceVisual): PieceAsset {
  return PIECE_ASSETS[`${piece.player}-${piece.king ? "king" : "normal"}`];
}
