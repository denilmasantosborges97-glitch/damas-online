import { describe, expect, it } from "vitest";
import { getPieceAsset } from "./pieceAssets";

describe("assets visuais das pecas", () => {
  it("usa imagens transparentes diferentes para pedras e damas", () => {
    expect(getPieceAsset({ player: "red", king: false }).src).toBe("/pieces/red-normal.png");
    expect(getPieceAsset({ player: "black", king: false }).src).toBe("/pieces/black-normal.png");
    expect(getPieceAsset({ player: "red", king: true }).src).toBe("/pieces/red-king.png");
    expect(getPieceAsset({ player: "black", king: true }).src).toBe("/pieces/black-king.png");
  });
});
