import { getMovesForPiece, samePosition } from "../game/rules";
import type { GameState, Move, Player, Position } from "../game/types";
import type { CSSProperties } from "react";

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
  const rows = displayIndexes(viewer);
  const cols = rows;
  const selectedMoves = selected ? legalMoves.filter((move) => samePosition(move.from, selected)) : [];

  function handleSquare(position: Position) {
    if (disabled) return;

    const destinationMove = selectedMoves.find((move) => samePosition(move.to, position));
    if (destinationMove) {
      onMove(destinationMove);
      onSelect(null);
      return;
    }

    const piece = gameState.board[position.row][position.col];
    const pieceMoves = getMovesForPiece(gameState, position);

    if (piece?.player === gameState.currentPlayer && piece.player === viewer && pieceMoves.length > 0) {
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
            const isTarget = selectedMoves.some((move) => samePosition(move.to, position));
            const isLastFrom = lastMove ? samePosition(lastMove.from, position) : false;
            const isLastTo = lastMove ? samePosition(lastMove.to, position) : false;
            const isCaptured = lastMove?.captures.some((capture) => samePosition(capture, position)) ?? false;
            const isMovingPiece = Boolean(
              lastMove && piece?.id === lastMove.pieceId && samePosition(lastMove.to, position)
            );
            const isPlayablePiece =
              !disabled &&
              piece?.player === viewer &&
              piece.player === gameState.currentPlayer &&
              getMovesForPiece(gameState, position).length > 0;

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
                {isCaptured && !piece && !reduceMotion && (
                  <span className={`piece capture-ghost ${capturedPlayerFromMove(lastMove)}`} />
                )}
                {piece && (
                  <span
                    className={[
                      "piece",
                      piece.player,
                      piece.king ? "king" : "",
                      isMovingPiece && !reduceMotion ? "moving-piece" : ""
                    ].join(" ")}
                    style={isMovingPiece && !reduceMotion && lastMove ? slideStyle(lastMove, viewer) : undefined}
                    data-piece-id={piece.id}
                  >
                    {piece.king && <span className="king-mark">D</span>}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function slideStyle(move: Move, viewer: Player): CSSProperties {
  const from = visualPosition(move.from, viewer);
  const to = visualPosition(move.to, viewer);
  const squareAsPiecePercent = 100 / 0.78;

  return {
    "--slide-x": `${(from.col - to.col) * squareAsPiecePercent}%`,
    "--slide-y": `${(from.row - to.row) * squareAsPiecePercent}%`
  } as CSSProperties;
}

function visualPosition(position: Position, viewer: Player): Position {
  if (viewer === "red") return position;

  return {
    row: 7 - position.row,
    col: 7 - position.col
  };
}

function capturedPlayerFromMove(move: Move | null): Player {
  return move?.pieceId.startsWith("red-") ? "black" : "red";
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
