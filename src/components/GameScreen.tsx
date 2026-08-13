import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { deriveMoveFeedback, shouldShowTurnCue } from "../feedback/feedback";
import { useFeedbackEffects } from "../feedback/useFeedbackEffects";
import { useFeedbackSettings } from "../feedback/useFeedbackSettings";
import type { Move, Position } from "../game/types";
import {
  canOfferDraw,
  formatPieceSummary,
  hasIncomingDrawOffer,
  hasIncomingRematchRequest,
  hasOutgoingDrawOffer,
  hasOutgoingRematchRequest,
  rematchDeclinedText,
  resultReasonText,
  resultTitle,
  summarizePieces
} from "../experience/experience";
import type {
  DisconnectState,
  MoveFeedbackEvent,
  PlayerSession,
  PresenceState,
  ReactionEvent,
  ReactionValue,
  RoomSnapshot
} from "../multiplayer/types";
import { FeedbackSettingsButton } from "./FeedbackSettingsButton";
import { GameBoard } from "./GameBoard";
import { ReactionControls } from "./ReactionControls";

type GameScreenProps = {
  room: RoomSnapshot;
  session: PlayerSession;
  presence: PresenceState;
  disconnect: DisconnectState;
  legalMoves: Move[];
  reactionEvent: ReactionEvent | null;
  moveFeedbackEvent: MoveFeedbackEvent | null;
  reactionCooldownUntil: number;
  busy: boolean;
  error: string | null;
  onMove: (move: Move) => void;
  onReaction: (reaction: ReactionValue) => boolean;
  onRematch: () => void;
  onDeclineRematch: () => void;
  onResign: () => void;
  onProposeDraw: () => void;
  onRespondDraw: (accept: boolean) => void;
  onLeave: () => void;
};

export function GameScreen({
  room,
  session,
  presence,
  disconnect,
  legalMoves,
  reactionEvent,
  moveFeedbackEvent,
  reactionCooldownUntil,
  busy,
  error,
  onMove,
  onReaction,
  onRematch,
  onDeclineRematch,
  onResign,
  onProposeDraw,
  onRespondDraw,
  onLeave
}: GameScreenProps) {
  const [selected, setSelected] = useState<Position | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [showTurnCue, setShowTurnCue] = useState(false);
  const [showReconnectCue, setShowReconnectCue] = useState(false);
  const [activeReaction, setActiveReaction] = useState<ReactionEvent | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const previousRoom = useRef<RoomSnapshot | null>(null);
  const handledFeedback = useRef(new Set<string>());
  const lastMoveTimer = useRef<number | null>(null);
  const turnCueTimer = useRef<number | null>(null);
  const reactionTimer = useRef<number | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const { settings, setSoundEnabled, setVibrationEnabled, setReduceMotion } = useFeedbackSettings();
  const { playMoveSound, playCaptureSound, vibrateTurn, vibrateCapture } = useFeedbackEffects(
    settings.soundEnabled,
    settings.vibrationEnabled
  );

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
      lastMoveTimer.current = window.setTimeout(() => setLastMove(null), settings.reduceMotion ? 450 : 950);
    },
    [playCaptureSound, playMoveSound, settings.reduceMotion, vibrateCapture]
  );

  const statusText = useMemo(() => {
    if (room.status === "waiting") return "Aguardando adversário";
    if (room.status === "draw") return "Partida empatada";
    if (room.winner) return room.winner === session.player ? "Você venceu" : "Você perdeu";
    if (disconnect.active) return "Partida pausada";
    if (room.currentPlayer === session.player) return "Sua vez";
    return "Vez do adversário";
  }, [disconnect.active, room.currentPlayer, room.status, room.winner, session.player]);

  const redSummary = summarizePieces(room.board, "red");
  const blackSummary = summarizePieces(room.board, "black");
  const incomingDrawOffer = hasIncomingDrawOffer(room, session.player);
  const outgoingDrawOffer = hasOutgoingDrawOffer(room, session.player);
  const incomingRematch = hasIncomingRematchRequest(room, session.player);
  const outgoingRematch = hasOutgoingRematchRequest(room, session.player);
  const declinedText = rematchDeclinedText(room, session.player);
  const finalTitle = resultTitle(room, session.player);
  const didWin = room.winner === session.player;
  const finalReason = room.status === "draw" || room.status === "finished"
    ? resultReasonText(room.resultReason, didWin)
    : null;

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

    previousRoom.current = room;
  }, [room, session.player, settings.reduceMotion, triggerMoveFeedback, vibrateTurn]);

  useEffect(() => {
    if (!moveFeedbackEvent || moveFeedbackEvent.revision !== room.revision) return;
    triggerMoveFeedback(moveFeedbackEvent.move, `move-${moveFeedbackEvent.revision}`);
  }, [moveFeedbackEvent, room.revision, triggerMoveFeedback]);

  useEffect(() => {
    if (!reactionEvent) return;

    setActiveReaction(reactionEvent);
    if (reactionTimer.current) window.clearTimeout(reactionTimer.current);
    reactionTimer.current = window.setTimeout(() => setActiveReaction(null), 3000);
  }, [reactionEvent]);

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
      if (reactionTimer.current) window.clearTimeout(reactionTimer.current);
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
    };
  }, []);

  function confirmResignation() {
    setConfirmResign(false);
    onResign();
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
      {activeReaction && (
        <div className={`reaction-toast ${activeReaction.sender === session.player ? "own" : "opponent"}`} role="status">
          {activeReaction.value}
        </div>
      )}

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
          <button className="icon-button" type="button" onClick={onLeave} aria-label="Sair da sala">
            Sair
          </button>
        </div>
      </header>

      <section className="status-strip" aria-live="polite">
        <span className={`player-chip ${session.player}`}>
          Suas peças: {session.player === "red" ? "vermelhas" : "pretas"}
        </span>
        {room.status === "waiting" && <span>Compartilhe o código para começar.</span>}
        {room.status === "playing" && !disconnect.active && presence.opponentDisconnected && <span>Reconectando adversário...</span>}
        {busy && <span>Sincronizando...</span>}
      </section>

      {room.status === "waiting" && (
        <section className="waiting-panel">
          <strong>Sala: {room.code}</strong>
          <span>Compartilhe o código da sala com quem vai jogar com você.</span>
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

      <footer className="game-footer">
        {room.status === "playing" ? (
          <>
            <div className="turn-help">
              {outgoingDrawOffer
                ? "Aguardando resposta do adversário..."
                : legalMoves.some((move) => move.captures.length > 0) && room.currentPlayer === session.player
                  ? "Captura obrigatória disponível."
                  : room.currentPlayer === session.player
                    ? "Toque em uma peça destacada."
                    : "Vez do adversário."}
            </div>
            <div className="match-actions">
              <button className="ghost-button compact-action" type="button" disabled={busy || !canOfferDraw(room, session.player)} onClick={onProposeDraw}>
                Propor empate
              </button>
              <button className="ghost-button compact-action danger" type="button" disabled={busy} onClick={() => setConfirmResign(true)}>
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
        <CenterModal title="Adversário desconectado">
          <p>Aguardando reconexão...</p>
          <strong>{disconnect.remainingSeconds}s</strong>
        </CenterModal>
      )}

      {incomingDrawOffer && (
        <CenterModal title="Seu adversário propôs um empate.">
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
        <CenterModal title="Pedido de revanche">
          <p>Seu adversário quer jogar novamente.</p>
          <div className="modal-actions">
            <button className="primary-button compact" type="button" disabled={busy} onClick={onRematch}>
              Aceitar revanche
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

      {finalTitle && finalReason && (
        <CenterModal title={finalTitle}>
          <p>{finalReason}</p>
          <div className="modal-actions">
            <button className="primary-button compact" type="button" disabled={busy || outgoingRematch} onClick={onRematch}>
              {outgoingRematch ? "Aguardando resposta..." : "Pedir revanche"}
            </button>
            <button className="ghost-button compact" type="button" onClick={onLeave}>
              Sair
            </button>
          </div>
        </CenterModal>
      )}

      {error && <p className="error-message floating">{error}</p>}
    </main>
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
