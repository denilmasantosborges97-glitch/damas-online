import type { Move } from "../game/types";
import type { PlayerSession, ReactionEvent } from "../multiplayer/types";

export type ReactionSlot = "own" | "opponent";

export type ReactionSlots = Record<ReactionSlot, ReactionEvent | null>;

export const emptyReactionSlots: ReactionSlots = {
  own: null,
  opponent: null
};

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

export function reactionToastSide(reaction: ReactionEvent, player: PlayerSession["player"]): ReactionSlot {
  return reaction.sender === player ? "own" : "opponent";
}

export function placeReactionInSlot(
  current: ReactionSlots,
  reaction: ReactionEvent,
  player: PlayerSession["player"]
): ReactionSlots {
  return {
    ...current,
    [reactionToastSide(reaction, player)]: reaction
  };
}
