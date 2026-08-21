import { samePosition } from "../game/rules";
import type { GameState, Move, Piece, Player, Position } from "../game/types";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getCaptureStepIndex,
  getMoveAnimationKey,
  getVisualMoveStepDuration,
  getVisualMoveSteps,
  positionKey,
  type VisualMoveStep
} from "./moveAnimation";

type GameBoardProps = {
  gameState: GameState;
  viewer: Player;
  selected: Position | null;
  legalMoves: Move[];
  lastMove: Move | null;
  reduceMotion: boolean;
  disabled: boolean;
  onSelect: (position: Position | null) => void;
  onMove: (move: Move) => void;
};

export function GameBoard({
  gameState,
  viewer,
  selected,
  legalMoves,
  lastMove,
  reduceMotion,
  disabled,
  onSelect,
  onMove
}: GameBoardProps) {
  const rows = useMemo(() => displayIndexes(viewer), [viewer]);
  const cols = rows;
  const selectedMoves = useMemo(
    () => (selected ? legalMoves.filter((move) => samePosition(move.from, selected)) : []),
    [legalMoves, selected]
  );
  const selectedTargetKeys = useMemo(
    () => new Set(selectedMoves.map((move) => positionKey(move.to))),
    [selectedMoves]
  );
  const playableSourceKeys = useMemo(
    () => new Set(legalMoves.map((move) => positionKey(move.from))),
    [legalMoves]
  );
  const [activeAnimation, setActiveAnimation] = useState<BoardMoveAnimation | null>(null);
  const lastAnimatedMove = useRef<Move | null>(null);
  const interactionDisabled = disabled || Boolean(activeAnimation);

  useEffect(() => {
    if (!lastMove || reduceMotion) {
      if (reduceMotion) setActiveAnimation(null);
      return;
    }

    const animationKey = getMoveAnimationKey(lastMove);
    if (lastAnimatedMove.current === lastMove) return;

    const movingPiece = findPieceById(gameState.board, lastMove.pieceId);
    if (!movingPiece) return;

    lastAnimatedMove.current = lastMove;
    setActiveAnimation({
      key: animationKey,
      move: lastMove,
      movingPiece,
      capturedPlayer: opponentOf(movingPiece.player),
      steps: getVisualMoveSteps(lastMove),
      stepIndex: 0
    });
  }, [gameState.board, lastMove, reduceMotion]);

  useEffect(() => {
    if (!activeAnimation) return;

    const step = activeAnimation.steps[activeAnimation.stepIndex];
    if (!step) {
      setActiveAnimation(null);
      return;
    }

    const timer = window.setTimeout(() => {
      setActiveAnimation((current) => {
        if (!current || current.key !== activeAnimation.key) return current;
        if (current.stepIndex >= current.steps.length - 1) return null;
        return { ...current, stepIndex: current.stepIndex + 1 };
      });
    }, getVisualMoveStepDuration(step));

    return () => window.clearTimeout(timer);
  }, [activeAnimation]);

  const animationLayer = useMemo(
    () => (activeAnimation ? renderAnimationLayer(activeAnimation, viewer) : null),
    [activeAnimation, viewer]
  );

  function handleSquare(position: Position) {
    if (interactionDisabled) return;

    const destinationMove = selectedMoves.find((move) => samePosition(move.to, position));
    if (destinationMove) {
      onMove(destinationMove);
      onSelect(null);
      return;
    }

    const piece = gameState.board[position.row][position.col];

    if (piece?.player === gameState.currentPlayer && piece.player === viewer && playableSourceKeys.has(positionKey(position))) {
      onSelect(position);
      return;
    }

    onSelect(null);
  }

  return (
    <div className="board-shell" aria-label="Tabuleiro de damas">
      <div className="board">
        {rows.map((row) =>
          cols.map((col) => {
            const position = { row, col };
            const piece = gameState.board[row][col];
            const isSelected = selected ? samePosition(selected, position) : false;
            const positionKeyValue = positionKey(position);
            const isTarget = selectedTargetKeys.has(positionKeyValue);
            const isLastFrom = lastMove ? samePosition(lastMove.from, position) : false;
            const isLastTo = lastMove ? samePosition(lastMove.to, position) : false;
            const isHiddenAnimatedPiece = Boolean(
              activeAnimation &&
                piece?.id === activeAnimation.move.pieceId &&
                samePosition(activeAnimation.move.to, position)
            );
            const isPlayablePiece =
              !interactionDisabled &&
              piece?.player === viewer &&
              piece.player === gameState.currentPlayer &&
              playableSourceKeys.has(positionKeyValue);

            return (
              <button
                key={`${row}-${col}`}
                className={[
                  "square",
                  (row + col) % 2 === 1 ? "dark" : "light",
                  isSelected ? "selected" : "",
                  isTarget ? "target" : "",
                  isLastFrom ? "last-from" : "",
                  isLastTo ? "last-to" : "",
                  isPlayablePiece ? "playable" : ""
                ].join(" ")}
                type="button"
                aria-label={squareLabel(position, piece?.player, piece?.king)}
                onClick={() => handleSquare(position)}
              >
                {isTarget && <span className="target-dot" />}
                {piece && (
                  <span
                    className={[
                      "piece",
                      piece.player,
                      piece.king ? "king" : "",
                      isHiddenAnimatedPiece ? "piece-animation-placeholder" : ""
                    ].join(" ")}
                    data-piece-id={piece.id}
                  >
                    {piece.king && <span className="king-mark">D</span>}
                  </span>
                )}
              </button>
            );
          })
        )}
        {animationLayer}
      </div>
    </div>
  );
}

type BoardMoveAnimation = {
  key: string;
  move: Move;
  movingPiece: Piece;
  capturedPlayer: Player;
  steps: VisualMoveStep[];
  stepIndex: number;
};

function renderAnimationLayer(animation: BoardMoveAnimation, viewer: Player) {
  const currentStep = animation.steps[animation.stepIndex];
  if (!currentStep) return null;

  return (
    <div className="board-animation-layer" aria-hidden="true">
      {animation.move.captures.map((capture) => {
        const captureStepIndex = getCaptureStepIndex(animation.steps, capture);
        const isFading = animation.stepIndex >= captureStepIndex;

        return (
          <span
            key={`capture-${positionKey(capture)}`}
            className={[
              "piece",
              animation.capturedPlayer,
              "board-overlay-piece",
              "animated-capture-ghost",
              isFading ? "fade" : ""
            ].join(" ")}
            style={overlayPieceStyle(capture, viewer)}
          />
        );
      })}
      <span
        key={`${animation.key}-${animation.stepIndex}`}
        className={[
          "piece",
          animation.movingPiece.player,
          animation.movingPiece.king ? "king" : "",
          "board-overlay-piece",
          "animated-moving-piece"
        ].join(" ")}
        style={movingOverlayStyle(currentStep, viewer)}
        data-piece-id={animation.movingPiece.id}
      >
        {animation.movingPiece.king && <span className="king-mark">D</span>}
      </span>
    </div>
  );
}

function movingOverlayStyle(step: VisualMoveStep, viewer: Player): CSSProperties {
  const from = visualPosition(step.from, viewer);
  const to = visualPosition(step.to, viewer);
  const squareAsPiecePercent = 100 / 0.78;

  return {
    ...overlayPieceStyle(step.to, viewer),
    "--slide-x": `${(from.col - to.col) * squareAsPiecePercent}%`,
    "--slide-y": `${(from.row - to.row) * squareAsPiecePercent}%`,
    "--move-animation-ms": `${getVisualMoveStepDuration(step)}ms`
  } as CSSProperties;
}

function overlayPieceStyle(position: Position, viewer: Player): CSSProperties {
  const visual = visualPosition(position, viewer);

  return {
    "--visual-row": `${visual.row}`,
    "--visual-col": `${visual.col}`
  } as CSSProperties;
}

function visualPosition(position: Position, viewer: Player): Position {
  if (viewer === "red") return position;

  return {
    row: 7 - position.row,
    col: 7 - position.col
  };
}

function findPieceById(board: GameState["board"], pieceId: string): Piece | null {
  for (const row of board) {
    for (const piece of row) {
      if (piece?.id === pieceId) return piece;
    }
  }

  return null;
}

function opponentOf(player: Player): Player {
  return player === "red" ? "black" : "red";
}

function displayIndexes(viewer: Player): number[] {
  const indexes = Array.from({ length: 8 }, (_, index) => index);
  return viewer === "black" ? indexes.reverse() : indexes;
}

function squareLabel(position: Position, player?: Player, king?: boolean): string {
  const file = String.fromCharCode(65 + position.col);
  const rank = 8 - position.row;

  if (!player) return `${file}${rank}`;
  return `${file}${rank}, peça ${player === "red" ? "vermelha" : "preta"}${king ? " dama" : ""}`;
}
