import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { shouldIncrementUnread } from "../chat/chat";
import { useChatSettings } from "../chat/useChatSettings";
import { deriveMoveFeedback, getReactionAsset, shouldShowTurnCue } from "../feedback/feedback";
import { useFeedbackEffects } from "../feedback/useFeedbackEffects";
import { useFeedbackSettings } from "../feedback/useFeedbackSettings";
import type { Move, Position } from "../game/types";
import { canUseWebShare, createRoomInviteLink, shareRoomInvite } from "../multiplayer/inviteLink";
import {
  canOfferDraw,
  canRequestRematch,
  formatPieceSummary,
  hasIncomingDrawOffer,
  hasIncomingRematchRequest,
  hasOutgoingDrawOffer,
  hasOutgoingRematchRequest,
  rematchDeclinedText,
  resultReasonText,
  resultTitle,
  shouldShowCasualPostRematchActions,
  summarizePieces,
  wasRematchAccepted
} from "../experience/experience";
import { playerNameFor, victoryTitleFor, type PlayerNames } from "../playerIdentity/playerLabels";
import type {
  ChatEvent,
  DisconnectState,
  MoveFeedbackEvent,
  PlayerSession,
  PresenceState,
  ReactionEvent,
  ReactionValue,
  RoomSnapshot
} from "../multiplayer/types";
import { FeedbackSettingsButton } from "./FeedbackSettingsButton";
import { ChatPanel } from "./ChatPanel";
import { GameBoard } from "./GameBoard";
import {
  emptyReactionSlots,
  getOnlineFooterStatus,
  hasMandatoryCaptureForTurn,
  placeReactionInSlot,
  reactionToastSide,
  type ReactionSlot,
  type ReactionSlots
} from "./matchPresentation";
import { getVisualMoveDuration } from "./moveAnimation";
import { PlayerIdentityStrip } from "./PlayerIdentityStrip";
import { ReactionControls } from "./ReactionControls";

type GameScreenProps = {
  room: RoomSnapshot;
  session: PlayerSession;
  playerName: string;
  presence: PresenceState;
  disconnect: DisconnectState;
  legalMoves: Move[];
  reactionEvent: ReactionEvent | null;
  moveFeedbackEvent: MoveFeedbackEvent | null;
  chatMessages: ChatEvent[];
  reactionCooldownUntil: number;
  busy: boolean;
  error: string | null;
  onMove: (move: Move) => void;
  onReaction: (reaction: ReactionValue) => boolean;
  onChatMessage: (text: string) => { ok: true } | { ok: false; message: string };
  onRematch: () => void;
  onDeclineRematch: () => void;
  onResign: () => void;
  onProposeDraw: () => void;
  onRespondDraw: (accept: boolean) => void;
  onLeave: () => void;
  onBackToMenu: () => void;
  onFindNewOpponent: () => void;
};

export function GameScreen({
  room,
  session,
  playerName,
  presence,
  disconnect,
  legalMoves,
  reactionEvent,
  moveFeedbackEvent,
  chatMessages,
  reactionCooldownUntil,
  busy,
  error,
  onMove,
  onReaction,
  onChatMessage,
  onRematch,
  onDeclineRematch,
  onResign,
  onProposeDraw,
  onRespondDraw,
  onLeave,
  onBackToMenu,
  onFindNewOpponent
}: GameScreenProps) {
  const [selected, setSelected] = useState<Position | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [showTurnCue, setShowTurnCue] = useState(false);
  const [showReconnectCue, setShowReconnectCue] = useState(false);
  const [showRematchAcceptedCue, setShowRematchAcceptedCue] = useState(false);
  const [activeReactions, setActiveReactions] = useState<ReactionSlots>(emptyReactionSlots);
  const [confirmResign, setConfirmResign] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const previousRoom = useRef<RoomSnapshot | null>(null);
  const handledFeedback = useRef(new Set<string>());
  const handledChatMessages = useRef(new Set<string>());
  const lastMoveTimer = useRef<number | null>(null);
  const turnCueTimer = useRef<number | null>(null);
  const reactionTimers = useRef<Record<ReactionSlot, number | null>>({ own: null, opponent: null });
  const reconnectTimer = useRef<number | null>(null);
  const rematchAcceptedTimer = useRef<number | null>(null);
  const { muted: chatMuted, setMuted: setChatMuted } = useChatSettings();
  const { settings, setSoundEnabled, setVibrationEnabled, setReduceMotion } = useFeedbackSettings();
  const { playMoveSound, playCaptureSound, vibrateTurn, vibrateCapture } = useFeedbackEffects(
    settings.soundEnabled,
    settings.vibrationEnabled
  );
  const opponent = session.player === "red" ? "black" : "red";
  const playerNames: PlayerNames = {
    ...presence.playerNames,
    [session.player]: playerName
  };
  const redName = playerNameFor("red", playerNames, session.player === "red" ? playerName : "Adversário");
  const blackName = playerNameFor("black", playerNames, session.player === "black" ? playerName : "Adversário");
  const opponentName = playerNameFor(opponent, playerNames, "Adversário");

  const triggerMoveFeedback = useCallback(
    (move: Move, key: string) => {
      if (handledFeedback.current.has(key)) return;

      handledFeedback.current.add(key);
      setLastMove(move);

      if (move.captures.length > 0) {
        playCaptureSound();
        vibrateCapture();
      } else {
        playMoveSound();
      }

      if (lastMoveTimer.current) window.clearTimeout(lastMoveTimer.current);
      lastMoveTimer.current = window.setTimeout(() => setLastMove(null), getVisualMoveDuration(move, settings.reduceMotion));
    },
    [playCaptureSound, playMoveSound, settings.reduceMotion, vibrateCapture]
  );

  const statusText = useMemo(() => {
    if (room.status === "waiting") return "Aguardando adversário";
    if (room.status === "draw") return "Partida empatada";
    if (room.winner) return room.winner === session.player ? "Você venceu" : `${playerNameFor(room.winner, playerNames, "Adversário")} venceu`;
    if (disconnect.active) return "Partida pausada";
    if (room.currentPlayer === session.player) return "Sua vez";
    return `Vez de ${opponentName}`;
  }, [disconnect.active, opponentName, playerNames, room.currentPlayer, room.status, room.winner, session.player]);

  const redSummary = summarizePieces(room.board, "red");
  const blackSummary = summarizePieces(room.board, "black");
  const incomingDrawOffer = hasIncomingDrawOffer(room, session.player);
  const outgoingDrawOffer = hasOutgoingDrawOffer(room, session.player);
  const incomingRematch = hasIncomingRematchRequest(room, session.player);
  const outgoingRematch = hasOutgoingRematchRequest(room, session.player);
  const canAskRematch = canRequestRematch(room, session.player);
  const declinedText = rematchDeclinedText(room, session.player);
  const showCasualPostRematchActions = shouldShowCasualPostRematchActions(session.matchMode, room);
  const footerStatus = getOnlineFooterStatus({
    outgoingDrawOffer,
    hasMandatoryCapture: hasMandatoryCaptureForTurn(legalMoves),
    isPlayerTurn: room.currentPlayer === session.player,
    opponentName
  });
  const finalTitle = resultTitle(room, session.player);
  const didWin = room.winner === session.player;
  const finalReason = room.status === "draw" || room.status === "finished"
    ? resultReasonText(room.resultReason, didWin)
    : null;
  const finalModalTitle = room.status === "finished" ? victoryTitleFor(room.winner, playerNames) : finalTitle;
  const finalModalVisible = Boolean(finalTitle && finalReason && !incomingRematch && !incomingDrawOffer && !confirmResign && !disconnect.active);

  useEffect(() => {
    if (chatOpen) {
      for (const message of chatMessages) {
        handledChatMessages.current.add(message.id);
      }
      setUnreadChatCount(0);
      return;
    }

    let incoming = 0;
    for (const message of chatMessages) {
      if (handledChatMessages.current.has(message.id)) continue;

      handledChatMessages.current.add(message.id);
      if (shouldIncrementUnread({ isChatOpen: chatOpen, muted: chatMuted, message, viewer: session.player })) {
        incoming += 1;
      }
    }

    if (incoming > 0) {
      setUnreadChatCount((current) => Math.min(9, current + incoming));
    }
  }, [chatMessages, chatMuted, chatOpen, session.player]);

  useEffect(() => {
    const previous = previousRoom.current;

    if (shouldShowTurnCue(previous, room, session.player)) {
      setShowTurnCue(true);
      vibrateTurn();

      if (turnCueTimer.current) window.clearTimeout(turnCueTimer.current);
      turnCueTimer.current = window.setTimeout(() => setShowTurnCue(false), settings.reduceMotion ? 700 : 1500);
    }

    const derived = deriveMoveFeedback(previous, room);
    if (derived) triggerMoveFeedback(derived.move, `move-${room.revision}`);

    if (wasRematchAccepted(previous, room)) {
      setShowRematchAcceptedCue(true);
      if (rematchAcceptedTimer.current) window.clearTimeout(rematchAcceptedTimer.current);
      rematchAcceptedTimer.current = window.setTimeout(() => setShowRematchAcceptedCue(false), settings.reduceMotion ? 700 : 1600);
    }

    previousRoom.current = room;
  }, [room, session.player, settings.reduceMotion, triggerMoveFeedback, vibrateTurn]);

  useEffect(() => {
    if (!moveFeedbackEvent || moveFeedbackEvent.revision !== room.revision) return;
    triggerMoveFeedback(moveFeedbackEvent.move, `move-${moveFeedbackEvent.revision}`);
  }, [moveFeedbackEvent, room.revision, triggerMoveFeedback]);

  useEffect(() => {
    if (!reactionEvent) return;

    const slot = reactionToastSide(reactionEvent, session.player);
    setActiveReactions((current) => placeReactionInSlot(current, reactionEvent, session.player));

    if (reactionTimers.current[slot]) window.clearTimeout(reactionTimers.current[slot]!);
    reactionTimers.current[slot] = window.setTimeout(() => {
      setActiveReactions((current) => {
        if (current[slot]?.id !== reactionEvent.id) return current;
        return { ...current, [slot]: null };
      });
      reactionTimers.current[slot] = null;
    }, 3300);
  }, [reactionEvent, session.player]);

  useEffect(() => {
    if (!disconnect.reconnected) return;

    setShowReconnectCue(true);
    if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
    reconnectTimer.current = window.setTimeout(() => setShowReconnectCue(false), 1800);
  }, [disconnect.reconnected]);

  useEffect(() => {
    return () => {
      if (lastMoveTimer.current) window.clearTimeout(lastMoveTimer.current);
      if (turnCueTimer.current) window.clearTimeout(turnCueTimer.current);
      if (reactionTimers.current.own) window.clearTimeout(reactionTimers.current.own);
      if (reactionTimers.current.opponent) window.clearTimeout(reactionTimers.current.opponent);
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      if (rematchAcceptedTimer.current) window.clearTimeout(rematchAcceptedTimer.current);
    };
  }, []);

  function confirmResignation() {
    setConfirmResign(false);
    onResign();
  }

  async function shareInvite() {
    setShareMessage(null);

    try {
      const result = await shareRoomInvite(createRoomInviteLink(room.code));
      if (result.status === "copied") setShareMessage("Link copiado!");
      if (result.status === "shared") setShareMessage("Convite pronto para compartilhar.");
      if (result.status === "unsupported") setShareMessage(result.message);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareMessage("Não foi possível compartilhar agora.");
    }
  }

  return (
    <main className={`game-screen ${settings.reduceMotion ? "reduce-motion" : ""}`}>
      {showTurnCue && (
        <div className="turn-cue" role="status">
          SUA VEZ
        </div>
      )}
      {showReconnectCue && (
        <div className="center-toast" role="status">
          Adversário reconectado
        </div>
      )}
      {showRematchAcceptedCue && (
        <div className="center-toast" role="status">
          Revanche aceita. Nova partida!
        </div>
      )}
      {renderReactionToast("opponent", activeReactions.opponent)}
      {renderReactionToast("own", activeReactions.own)}

      <header className={`game-header ${room.status === "playing" && room.currentPlayer === session.player ? "your-turn" : ""}`}>
        <div>
          <p className="eyebrow">Sala {room.code}</p>
          <h1>{statusText}</h1>
        </div>
        <div className="game-tools">
          <FeedbackSettingsButton
            settings={settings}
            onSoundChange={setSoundEnabled}
            onVibrationChange={setVibrationEnabled}
            onReduceMotionChange={setReduceMotion}
          />
          <button className="icon-button chat-toggle" type="button" onClick={() => setChatOpen(true)} aria-label="Abrir chat">
            💬 Chat
            {unreadChatCount > 0 && <span className="chat-unread-badge">{unreadChatCount}</span>}
          </button>
          <button className="icon-button" type="button" onClick={onLeave} aria-label="Sair da sala">
            Sair
          </button>
        </div>
      </header>

      <PlayerIdentityStrip
        redName={redName}
        blackName={blackName}
        currentPlayer={room.status === "playing" ? room.currentPlayer : undefined}
        extra={
          busy
            ? "Sincronizando..."
            : room.status === "waiting"
              ? "Compartilhe o código para começar."
              : room.status === "playing" && !disconnect.active && presence.opponentDisconnected
                ? `Reconectando ${opponentName}...`
                : null
        }
      />

      {room.status === "waiting" && (
        <section className="waiting-panel">
          <strong>Sala: {room.code}</strong>
          <span>Compartilhe o código da sala com quem vai jogar com você.</span>
          <button className="primary-button share-room-button" type="button" onClick={shareInvite}>
            {canUseWebShare() ? "Compartilhar sala" : "Copiar link"}
          </button>
          {shareMessage && <span className="share-confirmation">{shareMessage}</span>}
        </section>
      )}

      <section className="piece-counter" aria-label="Contador de peças">
        <span>{formatPieceSummary("Vermelhas", redSummary)}</span>
        <span>{formatPieceSummary("Pretas", blackSummary)}</span>
      </section>

      <GameBoard
        gameState={{
          board: room.board,
          currentPlayer: room.currentPlayer,
          status: room.status,
          winner: room.winner,
          resultReason: room.resultReason,
          revision: room.revision,
          drawPlyCount: room.drawPlyCount
        }}
        viewer={session.player}
        selected={selected}
        legalMoves={legalMoves}
        lastMove={lastMove}
        reduceMotion={settings.reduceMotion}
        disabled={busy || disconnect.active || room.status !== "playing" || room.currentPlayer !== session.player}
        onSelect={setSelected}
        onMove={onMove}
      />

      <footer className="game-footer online-game-footer">
        {room.status === "playing" ? (
          <>
            <div className={`match-status ${footerStatus ? "" : "empty"}`}>
              {footerStatus}
            </div>
            <div className="match-actions">
              <button className="ghost-button compact-action match-action-button" type="button" disabled={busy || !canOfferDraw(room, session.player)} onClick={onProposeDraw}>
                Propor empate
              </button>
              <button className="ghost-button compact-action match-action-button danger" type="button" disabled={busy} onClick={() => setConfirmResign(true)}>
                Desistir
              </button>
              <ReactionControls cooldownUntil={reactionCooldownUntil} onReaction={onReaction} />
            </div>
          </>
        ) : (
          <div className="turn-help">{declinedText ?? (outgoingRematch ? "Aguardando resposta do adversário..." : "Partida encerrada.")}</div>
        )}
      </footer>

      {disconnect.active && (
        <CenterModal title={`${opponentName} desconectou`}>
          <p>Aguardando reconexão...</p>
          <strong>{disconnect.remainingSeconds}s</strong>
        </CenterModal>
      )}

      {incomingDrawOffer && (
        <CenterModal title={`${opponentName} propôs empate.`}>
          <div className="modal-actions">
            <button className="primary-button compact" type="button" disabled={busy} onClick={() => onRespondDraw(true)}>
              Aceitar
            </button>
            <button className="ghost-button compact" type="button" disabled={busy} onClick={() => onRespondDraw(false)}>
              Recusar
            </button>
          </div>
        </CenterModal>
      )}

      {incomingRematch && (
        <CenterModal title={`${opponentName} pediu revanche.`}>
          <div className="modal-actions">
            <button className="primary-button compact" type="button" disabled={busy} onClick={onRematch}>
              Aceitar
            </button>
            <button className="ghost-button compact" type="button" disabled={busy} onClick={onDeclineRematch}>
              Recusar
            </button>
          </div>
        </CenterModal>
      )}

      {confirmResign && (
        <CenterModal title="Tem certeza de que deseja desistir?">
          <div className="modal-actions">
            <button className="ghost-button compact" type="button" onClick={() => setConfirmResign(false)}>
              Cancelar
            </button>
            <button className="primary-button compact danger-button" type="button" disabled={busy} onClick={confirmResignation}>
              Desistir
            </button>
          </div>
        </CenterModal>
      )}

      {finalModalVisible && finalTitle && finalReason && (
        <CenterModal title={finalModalTitle ?? finalTitle}>
          <p>{declinedText ?? (outgoingRematch ? "Aguardando resposta do adversário..." : finalReason)}</p>
          <div className="modal-actions">
            {room.rematchDeclinedBy && showCasualPostRematchActions && (
              <button className="primary-button compact" type="button" disabled={busy} onClick={onFindNewOpponent}>
                Buscar novo adversário
              </button>
            )}
            {!room.rematchDeclinedBy && !outgoingRematch && canAskRematch && (
              <button className="primary-button compact" type="button" disabled={busy} onClick={onRematch}>
                Pedir revanche
              </button>
            )}
            <button className="ghost-button compact" type="button" onClick={() => setChatOpen(true)}>
              Ver chat
            </button>
            <button className="ghost-button compact" type="button" onClick={room.rematchDeclinedBy ? onBackToMenu : onLeave}>
              {room.rematchDeclinedBy ? "Voltar ao menu" : "Sair"}
            </button>
          </div>
        </CenterModal>
      )}

      {chatOpen && (
        <ChatPanel
          messages={chatMessages}
          viewer={session.player}
          playerNames={playerNames}
          muted={chatMuted}
          canSend={room.status === "playing"}
          onSend={onChatMessage}
          onMutedChange={setChatMuted}
          onClose={() => setChatOpen(false)}
        />
      )}

      {error && <p className="error-message floating">{error}</p>}
    </main>
  );
}

function renderReactionToast(slot: ReactionSlot, reaction: ReactionEvent | null) {
  if (!reaction) return null;

  const asset = getReactionAsset(reaction.value);

  return (
    <div key={`${slot}-${reaction.id}`} className={`reaction-toast ${slot}`} role="status">
      <img src={asset.src} alt={asset.label} draggable={false} />
    </div>
  );
}

function CenterModal({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="center-modal">
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
