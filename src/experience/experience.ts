import type { Board, Player, ResultReason } from "../game/types";
import type { RoomSnapshot } from "../multiplayer/types";

export const DRAW_OFFER_COOLDOWN_MS = 20_000;

export type PieceSummary = {
  pieces: number;
  kings: number;
};

export function summarizePieces(board: Board, player: Player): PieceSummary {
  const playerPieces = board.flat().filter((piece) => piece?.player === player);
  return {
    pieces: playerPieces.length,
    kings: playerPieces.filter((piece) => piece?.king).length
  };
}

export function formatPieceSummary(label: string, summary: PieceSummary): string {
  const pieceText = summary.pieces === 1 ? "peça" : "peças";
  const kingText = summary.kings === 1 ? "dama" : "damas";
  return `${label}: ${summary.pieces} ${pieceText} · ${summary.kings} ${kingText}`;
}

export function resultTitle(room: RoomSnapshot, player: Player): "VITÓRIA" | "DERROTA" | "EMPATE" | null {
  if (room.status === "draw") return "EMPATE";
  if (room.status !== "finished" || !room.winner) return null;
  return room.winner === player ? "VITÓRIA" : "DERROTA";
}

export function resultReasonText(reason: ResultReason | null, didWin: boolean): string {
  switch (reason) {
    case "no_pieces":
      return didWin ? "Seu adversário ficou sem peças." : "Você ficou sem peças.";
    case "no_moves":
      return didWin ? "Seu adversário ficou sem movimentos." : "Você ficou sem movimentos.";
    case "resignation":
      return didWin ? "Vitória por desistência." : "Você desistiu da partida.";
    case "draw_accepted":
      return "Partida encerrada em empate.";
    case "draw_auto":
      return "Empate automático: final 1 dama contra 1 dama sem captura por 12 meios-lances.";
    case "draw_rule":
      return "Partida encerrada pela regra de empate.";
    case "abandonment":
      return didWin ? "Vitória por abandono." : "Derrota por abandono.";
    default:
      return didWin ? "Partida encerrada com vitória." : "Partida encerrada.";
  }
}

export function canOfferDraw(room: RoomSnapshot, player: Player, now = Date.now()): boolean {
  if (room.status !== "playing") return false;
  if (room.drawOfferPlayer) return false;
  if (!room.drawOfferCreatedAt) return true;

  const createdAt = new Date(room.drawOfferCreatedAt).getTime();
  return Number.isNaN(createdAt) || now - createdAt >= DRAW_OFFER_COOLDOWN_MS;
}

export function hasIncomingDrawOffer(room: RoomSnapshot, player: Player): boolean {
  return room.status === "playing" && Boolean(room.drawOfferPlayer && room.drawOfferPlayer !== player);
}

export function hasOutgoingDrawOffer(room: RoomSnapshot, player: Player): boolean {
  return room.status === "playing" && room.drawOfferPlayer === player;
}

export function hasIncomingRematchRequest(room: RoomSnapshot, player: Player): boolean {
  if (room.status !== "finished" && room.status !== "draw") return false;
  if (room.rematchDeclinedBy) return false;
  return player === "red" ? room.rematchBlack && !room.rematchRed : room.rematchRed && !room.rematchBlack;
}

export function hasOutgoingRematchRequest(room: RoomSnapshot, player: Player): boolean {
  if (room.status !== "finished" && room.status !== "draw") return false;
  if (room.rematchDeclinedBy) return false;
  return player === "red" ? room.rematchRed && !room.rematchBlack : room.rematchBlack && !room.rematchRed;
}

export function canRequestRematch(room: RoomSnapshot, player: Player): boolean {
  if (room.status !== "finished" && room.status !== "draw") return false;
  if (room.rematchDeclinedBy) return false;
  return !hasIncomingRematchRequest(room, player) && !hasOutgoingRematchRequest(room, player);
}

export function rematchDeclinedText(room: RoomSnapshot, player: Player): string | null {
  if (!room.rematchDeclinedBy) return null;
  return room.rematchDeclinedBy === player ? "Revanche recusada." : "Seu adversário recusou a revanche.";
}

export function wasRematchAccepted(previous: RoomSnapshot | null, current: RoomSnapshot): boolean {
  if (!previous) return false;
  if (previous.status !== "finished" && previous.status !== "draw") return false;
  if (current.status !== "playing") return false;
  if (current.revision <= previous.revision) return false;
  return (previous.rematchRed || previous.rematchBlack) && !current.rematchRed && !current.rematchBlack && !current.rematchDeclinedBy;
}

export function shouldShowCasualPostRematchActions(matchMode: "friend" | "casual" | undefined, room: RoomSnapshot): boolean {
  return matchMode === "casual" && Boolean(room.rematchDeclinedBy) && (room.status === "finished" || room.status === "draw");
}
