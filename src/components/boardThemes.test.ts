import { describe, expect, it } from "vitest";
import { BOARD_THEMES, DEFAULT_BOARD_THEME_ID, getBoardTheme, getBoardThemeStyle } from "./boardThemes";

describe("temas visuais do tabuleiro", () => {
  it("cadastra o tabuleiro madeira e todos os temas anexados", () => {
    expect(BOARD_THEMES.map((theme) => theme.id)).toEqual([
      "madeira",
      "abismo",
      "ametista",
      "atlantida",
      "azul-safira",
      "celestial",
      "cristal",
      "doces",
      "egito",
      "esmeralda",
      "floresta",
      "galaxia",
      "gelo",
      "lava",
      "medieval",
      "pedra",
      "tempestade"
    ]);
  });

  it("mantem ids e imagens unicos", () => {
    const ids = new Set(BOARD_THEMES.map((theme) => theme.id));
    const sources = new Set(BOARD_THEMES.map((theme) => theme.src));

    expect(ids.size).toBe(BOARD_THEMES.length);
    expect(sources.size).toBe(BOARD_THEMES.length);
  });

  it("usa o tema madeira como padrao e fallback", () => {
    expect(DEFAULT_BOARD_THEME_ID).toBe("madeira");
    expect(getBoardTheme(null).id).toBe("madeira");
    expect(getBoardTheme("inexistente").id).toBe("madeira");
  });

  it("mantem madeira e lava como temas distintos", () => {
    expect(getBoardTheme("madeira")).toMatchObject({
      label: "Madeira",
      src: "/boards/wood-board.png"
    });
    expect(getBoardTheme("lava")).toMatchObject({
      label: "Lava",
      src: "/boards/tabuleiro-madeira.png"
    });
  });

  it("gera variaveis CSS para imagem e alinhamento da grade logica", () => {
    const style = getBoardThemeStyle(getBoardTheme("doces"));

    expect(style).toMatchObject({
      "--board-image": 'url("/boards/tabuleiro-doces.png")',
      "--board-grid-left": "13.56%",
      "--board-grid-right": "13.40%",
      "--board-grid-top": "13.64%",
      "--board-grid-bottom": "14.59%"
    });
  });

  it("marca temas que precisam de alinhamento individual", () => {
    const adjustedThemes = BOARD_THEMES.filter((theme) => theme.adjusted).map((theme) => theme.id);

    expect(adjustedThemes).toContain("abismo");
    expect(adjustedThemes).toContain("doces");
    expect(adjustedThemes.length).toBe(BOARD_THEMES.length - 1);
  });

  it("aplica alinhamento proprio corrigido para o tema abismo", () => {
    const style = getBoardThemeStyle(getBoardTheme("abismo"));

    expect(style).toMatchObject({
      "--board-grid-left": "14.25%",
      "--board-grid-right": "13.08%",
      "--board-grid-top": "12.72%",
      "--board-grid-bottom": "13.60%"
    });
  });
});
