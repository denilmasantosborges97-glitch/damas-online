import type { Player } from "../game/types";

export type PlayerNames = Partial<Record<Player, string>>;

const colorLabels: Record<Player, string> = {
  red: "Vermelhas",
  black: "Pretas"
};

export function colorLabel(player: Player): string {
  return colorLabels[player];
}

export function playerColorLine(name: string, player: Player): string {
  return `${name} · ${colorLabel(player)}`;
}

export function playerNameFor(player: Player, names: PlayerNames, fallback: string): string {
  return names[player]?.trim() || fallback;
}

export function victoryTitleFor(winner: Player | null, names: PlayerNames): string {
  if (!winner) return "Partida encerrada";
  return `Vitória de ${playerNameFor(winner, names, winner === "red" ? "Vermelhas" : "Pretas")}`;
}
