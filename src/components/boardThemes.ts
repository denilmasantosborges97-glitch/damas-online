import type { CSSProperties } from "react";

export type BoardThemeId =
  | "madeira"
  | "abismo"
  | "ametista"
  | "atlantida"
  | "azul-safira"
  | "celestial"
  | "cristal"
  | "doces"
  | "egito"
  | "esmeralda"
  | "floresta"
  | "galaxia"
  | "gelo"
  | "lava"
  | "medieval"
  | "pedra"
  | "tempestade";

export type BoardTheme = {
  id: BoardThemeId;
  label: string;
  src: string;
  inset: {
    left: string;
    right: string;
    top: string;
    bottom: string;
  };
  adjusted?: boolean;
};

export const DEFAULT_BOARD_THEME_ID: BoardThemeId = "madeira";

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: "madeira",
    label: "Madeira",
    src: "/boards/wood-board.png",
    inset: { left: "7.94%", right: "8.17%", top: "8.13%", bottom: "8.69%" }
  },
  {
    id: "abismo",
    label: "Abismo",
    src: "/boards/tabuleiro-abismo.png",
    inset: { left: "14.25%", right: "13.08%", top: "12.72%", bottom: "13.60%" },
    adjusted: true
  },
  {
    id: "ametista",
    label: "Ametista",
    src: "/boards/tabuleiro-ametista.png",
    inset: { left: "7.74%", right: "8.13%", top: "8.37%", bottom: "7.42%" },
    adjusted: true
  },
  {
    id: "atlantida",
    label: "Atlântida",
    src: "/boards/tabuleiro-atlantida.png",
    inset: { left: "10.29%", right: "9.97%", top: "9.41%", bottom: "10.21%" },
    adjusted: true
  },
  {
    id: "azul-safira",
    label: "Azul safira",
    src: "/boards/tabuleiro-azul-safira.png",
    inset: { left: "7.66%", right: "7.66%", top: "8.21%", bottom: "8.21%" },
    adjusted: true
  },
  {
    id: "celestial",
    label: "Celestial",
    src: "/boards/tabuleiro-celestial.png",
    inset: { left: "13.00%", right: "11.96%", top: "11.88%", bottom: "13.88%" },
    adjusted: true
  },
  {
    id: "cristal",
    label: "Cristal",
    src: "/boards/tabuleiro-cristal.png",
    inset: { left: "10.53%", right: "10.37%", top: "9.73%", bottom: "9.97%" },
    adjusted: true
  },
  {
    id: "doces",
    label: "Doces",
    src: "/boards/tabuleiro-doces.png",
    inset: { left: "13.56%", right: "13.40%", top: "13.64%", bottom: "14.59%" },
    adjusted: true
  },
  {
    id: "egito",
    label: "Egito",
    src: "/boards/tabuleiro-egito.png",
    inset: { left: "10.29%", right: "10.29%", top: "10.05%", bottom: "9.97%" },
    adjusted: true
  },
  {
    id: "esmeralda",
    label: "Esmeralda",
    src: "/boards/tabuleiro-esmeralda.png",
    inset: { left: "7.34%", right: "7.89%", top: "8.93%", bottom: "7.74%" },
    adjusted: true
  },
  {
    id: "floresta",
    label: "Floresta",
    src: "/boards/tabuleiro-floresta.png",
    inset: { left: "10.69%", right: "10.53%", top: "10.13%", bottom: "10.13%" },
    adjusted: true
  },
  {
    id: "galaxia",
    label: "Galáxia",
    src: "/boards/tabuleiro-galaxia.png",
    inset: { left: "10.45%", right: "10.53%", top: "9.81%", bottom: "9.89%" },
    adjusted: true
  },
  {
    id: "gelo",
    label: "Gelo",
    src: "/boards/tabuleiro-gelo.png",
    inset: { left: "10.45%", right: "10.45%", top: "9.81%", bottom: "10.93%" },
    adjusted: true
  },
  {
    id: "lava",
    label: "Lava",
    src: "/boards/tabuleiro-madeira.png",
    inset: { left: "7.97%", right: "8.13%", top: "8.85%", bottom: "7.89%" },
    adjusted: true
  },
  {
    id: "medieval",
    label: "Medieval",
    src: "/boards/tabuleiro-medieval.png",
    inset: { left: "11.80%", right: "11.56%", top: "12.28%", bottom: "11.24%" },
    adjusted: true
  },
  {
    id: "pedra",
    label: "Pedra",
    src: "/boards/tabuleiro-pedra.png",
    inset: { left: "8.37%", right: "8.21%", top: "8.61%", bottom: "7.34%" },
    adjusted: true
  },
  {
    id: "tempestade",
    label: "Tempestade",
    src: "/boards/tabuleiro-tempestade.png",
    inset: { left: "10.85%", right: "10.69%", top: "10.69%", bottom: "10.53%" },
    adjusted: true
  }
];

export function getBoardTheme(id: string | null | undefined): BoardTheme {
  return BOARD_THEMES.find((theme) => theme.id === id) ?? BOARD_THEMES[0];
}

export function getBoardThemeStyle(theme: BoardTheme): CSSProperties {
  return {
    "--board-image": `url("${theme.src}")`,
    "--board-grid-left": theme.inset.left,
    "--board-grid-right": theme.inset.right,
    "--board-grid-top": theme.inset.top,
    "--board-grid-bottom": theme.inset.bottom
  } as CSSProperties;
}
