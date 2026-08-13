import { useCallback, useEffect, useMemo, useState } from "react";
import { getLegalMoves } from "../game/rules";
import type { Move } from "../game/types";
import {
  createRoom as createRemoteRoom,
  gameStateFromRoom,
  joinRoom as joinRemoteRoom,
  requestRematch as requestRemoteRematch,
  submitMove as submitRemoteMove,
  subscribeToRoom
} from "./roomService";
import { hasSupabaseConfig } from "./supabaseClient";
import type { PlayerSession, PresenceState, RoomSnapshot } from "./types";

const emptyPresence: PresenceState = {
  connectedPlayers: [],
  opponentDisconnected: false
};

export function useRoom() {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [presence, setPresence] = useState<PresenceState>(emptyPresence);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;

    return subscribeToRoom(
      session,
      (nextRoom) => {
        setRoom(nextRoom);
        setError(null);
      },
      setPresence
    );
  }, [session]);

  const gameState = useMemo(() => (room ? gameStateFromRoom(room) : null), [room]);

  const legalMoves = useMemo(() => {
    if (!gameState || !session || gameState.currentPlayer !== session.player) return [];
    return getLegalMoves(gameState);
  }, [gameState, session]);

  const createRoom = useCallback(async () => {
    await runAction(setBusy, setError, async () => {
      const next = await createRemoteRoom();
      setRoom(next.room);
      setSession(next.session);
      setPresence(emptyPresence);
    });
  }, []);

  const joinRoom = useCallback(async (code: string) => {
    await runAction(setBusy, setError, async () => {
      const next = await joinRemoteRoom(code);
      setRoom(next.room);
      setSession(next.session);
      setPresence(emptyPresence);
    });
  }, []);

  const playMove = useCallback(
    async (move: Move) => {
      if (!session) return;

      await runAction(setBusy, setError, async () => {
        const nextRoom = await submitRemoteMove(session, move);
        setRoom(nextRoom);
      });
    },
    [session]
  );

  const requestRematch = useCallback(async () => {
    if (!session) return;

    await runAction(setBusy, setError, async () => {
      const nextRoom = await requestRemoteRematch(session);
      setRoom(nextRoom);
    });
  }, [session]);

  const leaveRoom = useCallback(() => {
    setRoom(null);
    setSession(null);
    setPresence(emptyPresence);
    setError(null);
  }, []);

  return {
    hasSupabaseConfig,
    room,
    session,
    presence,
    gameState,
    legalMoves,
    busy,
    error,
    createRoom,
    joinRoom,
    playMove,
    requestRematch,
    leaveRoom,
    clearError: () => setError(null)
  };
}

async function runAction(
  setBusy: (busy: boolean) => void,
  setError: (error: string | null) => void,
  action: () => Promise<void>
): Promise<void> {
  setBusy(true);
  setError(null);

  try {
    await action();
  } catch (error) {
    setError(error instanceof Error ? error.message : "Algo correu mal.");
  } finally {
    setBusy(false);
  }
}
