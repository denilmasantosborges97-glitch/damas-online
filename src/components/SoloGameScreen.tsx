import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { chooseComputerMove, shouldComputerPlay, type AiDifficulty } from "../ai/checkersAi";
import { useFeedbackEffects } from "../feedback/useFeedbackEffects";
import { useFeedbackSettings } from "../feedback/useFeedbackSettings";
import { applyMove, createInitialGameState, getLegalMoves } from "../game/rules";
import type { GameState, Move, Player, Position } from "../game/types";
import { formatPieceSummary, resultReasonText, summarizePieces } from "../experience/experience";
import { victoryTitleFor } from "../playerIdentity/playerLabels";
import { FeedbackSettingsButton } from "./FeedbackSettingsButton";
import { GameBoard } from "./GameBoard";
import { getVisualMoveDuration } from "./moveAnimation";
import { PlayerIdentityStrip } from "./PlayerIdentityStrip";

type SoloGameScreenProps = {
  difficulty: AiDifficulty;
  player: Player;
  playerName: string;
  onChangeSetup: () => void;
  onBackToModes: () => void;
};

const difficultyLabel: Record<AiDifficulty, string> = {
  easy: "Fácil",
  medium: "Médio",
  hard: "Difícil"
};

export function SoloGameScreen({ difficulty, player, playerName, onChangeSetup, onBackToModes }: SoloGameScreenProps) {
  const computer = player === "red" ? "black" : "red";
  const playerNames = {
    [player]: playerName,
    [computer]: "Computador"
  };
  const [state, setState] = useState<GameState>(() => createInitialGameState());
  const [selected, setSelected] = useState<Position | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [thinking, setThinking] = useState(false);
  const [showTurnCue, setShowTurnCue] = useState(player === "red");
  const lastMoveTimer = useRef<number | null>(null);
  const turnCueTimer = useRef<number | null>(null);
  const aiTimer = useRef<number | null>(null);
  const { settings, setSoundEnabled, setVibrationEnabled, setReduceMotion } = useFeedbackSettings();
  const { playMoveSound, playCaptureSound, vibrateTurn, vibrateCapture } = useFeedbackEffects(
    settings.soundEnabled,
    settings.vibrationEnabled
  );

  const legalMoves = useMemo(() => {
    if (state.status !== "playing" || state.currentPlayer !== player) return [];
    return getLegalMoves(state, player);
  }, [player, state]);

  const triggerMoveFeedback = useCallback(
    (move: Move) => {
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

  const showHumanTurnCue = useCallback(() => {
    setShowTurnCue(true);
    vibrateTurn();
    if (turnCueTimer.current) window.clearTimeout(turnCueTimer.current);
    turnCueTimer.current = window.setTimeout(() => setShowTurnCue(false), settings.reduceMotion ? 700 : 1500);
  }, [settings.reduceMotion, vibrateTurn]);

  useEffect(() => {
    if (!shouldComputerPlay(state, computer)) return;

    setThinking(true);
    const delay = 400 + Math.floor(Math.random() * 500);
    aiTimer.current = window.setTimeout(() => {
      const move = chooseComputerMove(state, difficulty, computer);
      if (!move) {
        setThinking(false);
        return;
      }

      const next = applyMove(state, move);
      setState(next);
      setThinking(false);
      triggerMoveFeedback(move);
      if (next.status === "playing" && next.currentPlayer === player) showHumanTurnCue();
    }, delay);

    return () => {
      if (aiTimer.current) window.clearTimeout(aiTimer.current);
      aiTimer.current = null;
    };
  }, [computer, difficulty, player, showHumanTurnCue, state, triggerMoveFeedback]);

  useEffect(() => {
    return () => {
      if (lastMoveTimer.current) window.clearTimeout(lastMoveTimer.current);
      if (turnCueTimer.current) window.clearTimeout(turnCueTimer.current);
      if (aiTimer.current) window.clearTimeout(aiTimer.current);
    };
  }, []);

  function handleMove(move: Move) {
    if (state.status !== "playing" || state.currentPlayer !== player || thinking) return;

    const next = applyMove(state, move);
    setSelected(null);
    setState(next);
    triggerMoveFeedback(move);
  }

  function restart() {
    setState(createInitialGameState());
    setSelected(null);
    setLastMove(null);
    setThinking(false);
    setShowTurnCue(player === "red");
  }

  const redSummary = summarizePieces(state.board, "red");
  const blackSummary = summarizePieces(state.board, "black");
  const statusText = statusLabel(state, player, thinking);
  const finalTitle = finalTitleFor(state, player);
  const finalReason = finalTitle ? resultReasonText(state.resultReason, state.winner === player) : null;
  const finalModalTitle = state.status === "finished" ? victoryTitleFor(state.winner, playerNames) : finalTitle;

  return (
    <main className={`game-screen ${settings.reduceMotion ? "reduce-motion" : ""}`}>
      {showTurnCue && (
        <div className="turn-cue" role="status">
          SUA VEZ
        </div>
      )}

      <header className={`game-header ${state.currentPlayer === player && state.status === "playing" ? "your-turn" : ""}`}>
        <div>
          <p className="eyebrow">Contra a máquina · {difficultyLabel[difficulty]}</p>
          <h1>{statusText}</h1>
        </div>
        <div className="game-tools">
          <FeedbackSettingsButton
            settings={settings}
            onSoundChange={setSoundEnabled}
            onVibrationChange={setVibrationEnabled}
            onReduceMotionChange={setReduceMotion}
          />
          <button className="icon-button" type="button" onClick={onBackToModes} aria-label="Sair da partida">
            Sair
          </button>
        </div>
      </header>

      <PlayerIdentityStrip
        redName={player === "red" ? playerName : "Computador"}
        blackName={player === "black" ? playerName : "Computador"}
        currentPlayer={state.status === "playing" ? state.currentPlayer : undefined}
      />

      <section className="piece-counter" aria-label="Contador de peças">
        <span>{formatPieceSummary("Vermelhas", redSummary)}</span>
        <span>{formatPieceSummary("Pretas", blackSummary)}</span>
      </section>

      <GameBoard
        gameState={state}
        viewer={player}
        selected={selected}
        legalMoves={legalMoves}
        lastMove={lastMove}
        reduceMotion={settings.reduceMotion}
        disabled={thinking || state.status !== "playing" || state.currentPlayer !== player}
        onSelect={setSelected}
        onMove={handleMove}
      />

      <footer className="game-footer">
        <div className="turn-help">
          {thinking
            ? "Computador pensando..."
            : state.status === "playing" && state.currentPlayer === player
              ? "Toque em uma peça destacada."
              : state.status === "playing"
                ? "Vez do computador."
                : "Partida encerrada."}
        </div>
      </footer>

      {finalTitle && finalReason && (
        <CenterModal title={finalModalTitle ?? finalTitle}>
          <p>{finalReason}</p>
          <div className="modal-actions">
            <button className="primary-button compact" type="button" onClick={restart}>
              Jogar novamente
            </button>
            <button className="secondary-button compact" type="button" onClick={onChangeSetup}>
              Trocar dificuldade
            </button>
            <button className="ghost-button compact" type="button" onClick={onBackToModes}>
              Voltar aos modos
            </button>
          </div>
        </CenterModal>
      )}
    </main>
  );
}

function statusLabel(state: GameState, player: Player, thinking: boolean): string {
  if (state.status === "draw") return "Partida empatada";
  if (state.status === "finished") return state.winner === player ? "Você venceu" : "Você perdeu";
  if (thinking) return "Computador pensando...";
  return state.currentPlayer === player ? "Sua vez" : "Vez do computador";
}

function finalTitleFor(state: GameState, player: Player): "VITÓRIA" | "DERROTA" | "EMPATE" | null {
  if (state.status === "draw") return "EMPATE";
  if (state.status !== "finished" || !state.winner) return null;
  return state.winner === player ? "VITÓRIA" : "DERROTA";
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
