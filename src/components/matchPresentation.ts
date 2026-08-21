import type { Move } from "../game/types";
import type { PlayerSession, ReactionEvent } from "../multiplayer/types";

type OnlineFooterStatusInput = {
  outgoingDrawOffer: boolean;
  hasMandatoryCapture: boolean;
  isPlayerTurn: boolean;
  opponentName: string;
};

export function getOnlineFooterStatus({
  outgoingDrawOffer,
  hasMandatoryCapture,
  isPlayerTurn,
  opponentName
}: OnlineFooterStatusInput): string | null {
  if (outgoingDrawOffer) return `Aguardando resposta de ${opponentName}...`;
  if (hasMandatoryCapture && isPlayerTurn) return "Captura obrigatória disponível.";
  if (!isPlayerTurn) return `Vez de ${opponentName}.`;
  return null;
}

export function hasMandatoryCaptureForTurn(legalMoves: Move[]): boolean {
  return legalMoves.some((move) => move.captures.length > 0);
}

export function reactionToastSide(reaction: ReactionEvent, player: PlayerSession["player"]): "own" | "opponent" {
  return reaction.sender === player ? "own" : "opponent";
}
