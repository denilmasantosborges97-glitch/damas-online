import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deriveMoveFeedback, shouldShowTurnCue } from "../feedback/feedback";
import { useFeedbackEffects } from "../feedback/useFeedbackEffects";
import { useFeedbackSettings } from "../feedback/useFeedbackSettings";
import type { Move, Position } from "../game/types";
import type {
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
  legalMoves: Move[];
  reactionEvent: ReactionEvent | null;
  moveFeedbackEvent: MoveFeedbackEvent | null;
  reactionCooldownUntil: number;
  busy: boolean;
  error: string | null;
  onMove: (move: Move) => void;
  onReaction: (reaction: ReactionValue) => boolean;
  onRematch: () => void;
  onLeave: () => void;
};

export function GameScreen({
  room,
  session,
  presence,
  legalMoves,
  reactionEvent,
  moveFeedbackEvent,
  reactionCooldownUntil,
  busy,
  error,
  onMove,
  onReaction,
  onRematch,
  onLeave
}: GameScreenProps) {
  const [selected, setSelected] = useState<Position | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [showTurnCue, setShowTurnCue] = useState(false);
  const [activeReaction, setActiveReaction] = useState<ReactionEvent | null>(null);
  const previousRoom = useRef<RoomSnapshot | null>(null);
  const handledFeedback = useRef(new Set<string>());
  const lastMoveTimer = useRef<number | null>(null);
  const turnCueTimer = useRef<number | null>(null);
  const reactionTimer = useRef<number | null>(null);
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
    if (room.status === "waiting") return "À espera do adversário";
    if (room.status === "draw") return "Partida empatada";
    if (room.winner) return room.winner === session.player ? "Ganhaste a partida" : "O adversário ganhou";
    if (room.currentPlayer === session.player) return "É a tua vez";
    return "Vez do adversário";
  }, [room.currentPlayer, room.status, room.winner, session.player]);

  const waitingForRematch =
    (room.status === "finished" || room.status === "draw") &&
    ((session.player === "red" && room.rematchRed) || (session.player === "black" && room.rematchBlack));

  useEffect(() => {
    const previous = previousRoom.current;

    if (shouldShowTurnCue(previous, room, session.player)) {
      setShowTurnCue(true);
      vibrateTurn();

      if (turnCueTimer.current) window.clearTimeout(turnCueTimer.current);
      turnCueTimer.current = window.setTimeout(() => setShowTurnCue(false), settings.reduceMotion ? 700 : 1500);
    }

    const derived = deriveMoveFeedback(previous, room);
    if (derived) {
      triggerMoveFeedback(derived.move, `move-${room.revision}`);
    }

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
    return () => {
      if (lastMoveTimer.current) window.clearTimeout(lastMoveTimer.current);
      if (turnCueTimer.current) window.clearTimeout(turnCueTimer.current);
      if (reactionTimer.current) window.clearTimeout(reactionTimer.current);
    };
  }, []);

  return (
    <main className={`game-screen ${settings.reduceMotion ? "reduce-motion" : ""}`}>
      {showTurnCue && (
        <div className="turn-cue" role="status">
          SUA VEZ
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
        <span className={`player-chip ${session.player}`}>Tu: {session.player === "red" ? "vermelhas" : "pretas"}</span>
        {room.status === "waiting" && <span>Partilha o código para começar.</span>}
        {room.status === "playing" && presence.opponentDisconnected && <span>Adversário desconectado.</span>}
        {busy && <span>A sincronizar...</span>}
      </section>

      <GameBoard
        gameState={{
          board: room.board,
          currentPlayer: room.currentPlayer,
          status: room.status,
          winner: room.winner,
          revision: room.revision,
          drawPlyCount: room.drawPlyCount
        }}
        viewer={session.player}
        selected={selected}
        legalMoves={legalMoves}
        lastMove={lastMove}
        reduceMotion={settings.reduceMotion}
        disabled={busy || room.status !== "playing" || room.currentPlayer !== session.player}
        onSelect={setSelected}
        onMove={onMove}
      />

      <footer className="game-footer">
        {room.status === "finished" || room.status === "draw" ? (
          <button className="primary-button compact" type="button" disabled={busy || waitingForRematch} onClick={onRematch}>
            {waitingForRematch ? "Aguardando nova partida" : "Pedir nova partida"}
          </button>
        ) : (
          <>
            <div className="turn-help">
              {legalMoves.some((move) => move.captures.length > 0) && room.currentPlayer === session.player
                ? "Captura obrigatória disponível."
                : room.currentPlayer === session.player
                  ? "Toca numa peça destacada."
                  : "Aguarda a jogada do adversário."}
            </div>
            <ReactionControls cooldownUntil={reactionCooldownUntil} onReaction={onReaction} />
          </>
        )}
      </footer>

      {error && <p className="error-message floating">{error}</p>}
    </main>
  );
}
