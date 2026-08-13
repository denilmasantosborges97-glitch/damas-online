import { useMemo, useState } from "react";
import type { Move, Position } from "../game/types";
import type { PlayerSession, PresenceState, RoomSnapshot } from "../multiplayer/types";
import { GameBoard } from "./GameBoard";

type GameScreenProps = {
  room: RoomSnapshot;
  session: PlayerSession;
  presence: PresenceState;
  legalMoves: Move[];
  busy: boolean;
  error: string | null;
  onMove: (move: Move) => void;
  onRematch: () => void;
  onLeave: () => void;
};

export function GameScreen({
  room,
  session,
  presence,
  legalMoves,
  busy,
  error,
  onMove,
  onRematch,
  onLeave
}: GameScreenProps) {
  const [selected, setSelected] = useState<Position | null>(null);

  const statusText = useMemo(() => {
    if (room.status === "waiting") return "À espera do adversário";
    if (room.winner) return room.winner === session.player ? "Ganhaste a partida" : "O adversário ganhou";
    if (room.currentPlayer === session.player) return "É a tua vez";
    return "Vez do adversário";
  }, [room.currentPlayer, room.status, room.winner, session.player]);

  const waitingForRematch =
    room.status === "finished" &&
    ((session.player === "red" && room.rematchRed) || (session.player === "black" && room.rematchBlack));

  return (
    <main className="game-screen">
      <header className="game-header">
        <div>
          <p className="eyebrow">Sala {room.code}</p>
          <h1>{statusText}</h1>
        </div>
        <button className="icon-button" type="button" onClick={onLeave} aria-label="Sair da sala">
          Sair
        </button>
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
          revision: room.revision
        }}
        viewer={session.player}
        selected={selected}
        legalMoves={legalMoves}
        disabled={busy || room.status !== "playing" || room.currentPlayer !== session.player}
        onSelect={setSelected}
        onMove={onMove}
      />

      <footer className="game-footer">
        {room.status === "finished" ? (
          <button className="primary-button compact" type="button" disabled={busy || waitingForRematch} onClick={onRematch}>
            {waitingForRematch ? "Aguardando nova partida" : "Pedir nova partida"}
          </button>
        ) : (
          <div className="turn-help">
            {legalMoves.some((move) => move.captures.length > 0) && room.currentPlayer === session.player
              ? "Captura obrigatória disponível."
              : "Toca numa peça destacada."}
          </div>
        )}
      </footer>

      {error && <p className="error-message floating">{error}</p>}
    </main>
  );
}
