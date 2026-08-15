import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canSendReaction, isReactionValue, REACTION_COOLDOWN_MS } from "../feedback/feedback";
import { getLegalMoves } from "../game/rules";
import type { Move } from "../game/types";
import {
  createRoom as createRemoteRoom,
  gameStateFromRoom,
  joinRoom as joinRemoteRoom,
  claimAbandonment as claimRemoteAbandonment,
  declineRematch as declineRemoteRematch,
  proposeDraw as proposeRemoteDraw,
  requestRematch as requestRemoteRematch,
  resignRoom as resignRemoteRoom,
  respondToDraw as respondRemoteDraw,
  submitMove as submitRemoteMove,
  subscribeToRoom,
  updatePlayerPresence
} from "./roomService";
import { hasSupabaseConfig, supabase } from "./supabaseClient";
import type { DisconnectState, MoveFeedbackEvent, PlayerSession, PresenceState, ReactionEvent, ReactionValue, RoomSnapshot } from "./types";

const DISCONNECT_TOLERANCE_SECONDS = 60;
const emptyPresence: PresenceState = {
  connectedPlayers: [],
  opponentDisconnected: false,
  playerNames: {}
};

const emptyDisconnect: DisconnectState = {
  active: false,
  remainingSeconds: DISCONNECT_TOLERANCE_SECONDS,
  reconnected: false
};

export function useRoom(nickname: string | null) {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [presence, setPresence] = useState<PresenceState>(emptyPresence);
  const [disconnect, setDisconnect] = useState<DisconnectState>(emptyDisconnect);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reactionEvent, setReactionEvent] = useState<ReactionEvent | null>(null);
  const [moveFeedbackEvent, setMoveFeedbackEvent] = useState<MoveFeedbackEvent | null>(null);
  const [reactionCooldownUntil, setReactionCooldownUntil] = useState(0);
  const eventChannel = useRef<RealtimeChannel | null>(null);
  const lastReactionAt = useRef<number | null>(null);
  const disconnectedSince = useRef<number | null>(null);
  const disconnectTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!session || !nickname) return;

    return subscribeToRoom(
      session,
      nickname,
      (nextRoom) => {
        setRoom(nextRoom);
        setError(null);
      },
      (nextPresence) => {
        setPresence((current) => ({
          ...nextPresence,
          playerNames: {
            ...current.playerNames,
            ...nextPresence.playerNames
          }
        }));
      }
    );
  }, [nickname, session]);

  useEffect(() => {
    if (!session) return;

    void updatePlayerPresence(session).catch(() => undefined);
    const timer = window.setInterval(() => {
      void updatePlayerPresence(session).catch(() => undefined);
    }, 12_000);

    return () => window.clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!session || !room || room.status !== "playing" || !presence.opponentDisconnected) {
      disconnectedSince.current = null;
      if (disconnect.active) setDisconnect((current) => ({ ...emptyDisconnect, reconnected: current.active }));
      return;
    }

    if (!disconnectedSince.current) disconnectedSince.current = Date.now();
    setDisconnect({
      active: true,
      remainingSeconds: DISCONNECT_TOLERANCE_SECONDS,
      reconnected: false
    });

    if (disconnectTimer.current) window.clearInterval(disconnectTimer.current);
    disconnectTimer.current = window.setInterval(() => {
      const startedAt = disconnectedSince.current;
      if (!startedAt) return;

      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remainingSeconds = Math.max(0, DISCONNECT_TOLERANCE_SECONDS - elapsed);
      setDisconnect({ active: true, remainingSeconds, reconnected: false });

      if (remainingSeconds === 0) {
        window.clearInterval(disconnectTimer.current ?? undefined);
        disconnectTimer.current = null;
        void runAction(setBusy, setError, async () => {
          const nextRoom = await claimRemoteAbandonment(session);
          setRoom(nextRoom);
        });
      }
    }, 1000);

    return () => {
      if (disconnectTimer.current) window.clearInterval(disconnectTimer.current);
      disconnectTimer.current = null;
    };
  }, [disconnect.active, presence.opponentDisconnected, room, session]);

  useEffect(() => {
    if (!session || !supabase) return;

    const client = supabase;
    const channel = client
      .channel(`room-events:${session.roomId}`, {
        config: {
          broadcast: {
            self: false
          }
        }
      })
      .on("broadcast", { event: "reaction" }, ({ payload }) => {
        const event = parseReactionEvent(payload);
        if (event) setReactionEvent(event);
      })
      .on("broadcast", { event: "move-feedback" }, ({ payload }) => {
        const event = parseMoveFeedbackEvent(payload);
        if (event) setMoveFeedbackEvent(event);
      })
      .subscribe();

    eventChannel.current = channel;

    return () => {
      eventChannel.current = null;
      void client.removeChannel(channel);
    };
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
      setPresence({
        ...emptyPresence,
        playerNames: nickname ? { [next.session.player]: nickname } : {}
      });
    });
  }, [nickname]);

  const joinRoom = useCallback(async (code: string) => {
    await runAction(setBusy, setError, async () => {
      const next = await joinRemoteRoom(code);
      setRoom(next.room);
      setSession(next.session);
      setPresence({
        ...emptyPresence,
        playerNames: nickname ? { [next.session.player]: nickname } : {}
      });
    });
  }, [nickname]);

  const playMove = useCallback(
    async (move: Move) => {
      if (!session) return;

      await runAction(setBusy, setError, async () => {
        const nextRoom = await submitRemoteMove(session, move);
        setRoom(nextRoom);
        const event: MoveFeedbackEvent = {
          id: createEventId(),
          sender: session.player,
          revision: nextRoom.revision,
          move
        };

        void eventChannel.current?.send({
          type: "broadcast",
          event: "move-feedback",
          payload: event
        });
      });
    },
    [session]
  );

  const sendReaction = useCallback(
    (value: ReactionValue) => {
      if (!session || !isReactionValue(value)) return false;

      const now = Date.now();
      if (!canSendReaction(now, lastReactionAt.current)) return false;

      lastReactionAt.current = now;
      setReactionCooldownUntil(now + REACTION_COOLDOWN_MS);

      const event: ReactionEvent = {
        id: createEventId(),
        sender: session.player,
        value,
        sentAt: now
      };

      setReactionEvent(event);
      void eventChannel.current?.send({
        type: "broadcast",
        event: "reaction",
        payload: event
      });

      window.setTimeout(() => {
        if (Date.now() >= now + REACTION_COOLDOWN_MS) {
          setReactionCooldownUntil(0);
        }
      }, REACTION_COOLDOWN_MS + 40);

      return true;
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

  const resign = useCallback(async () => {
    if (!session) return;

    await runAction(setBusy, setError, async () => {
      const nextRoom = await resignRemoteRoom(session);
      setRoom(nextRoom);
    });
  }, [session]);

  const proposeDraw = useCallback(async () => {
    if (!session) return;

    await runAction(setBusy, setError, async () => {
      const nextRoom = await proposeRemoteDraw(session);
      setRoom(nextRoom);
    });
  }, [session]);

  const respondToDraw = useCallback(async (accept: boolean) => {
    if (!session) return;

    await runAction(setBusy, setError, async () => {
      const nextRoom = await respondRemoteDraw(session, accept);
      setRoom(nextRoom);
    });
  }, [session]);

  const declineRematch = useCallback(async () => {
    if (!session) return;

    await runAction(setBusy, setError, async () => {
      const nextRoom = await declineRemoteRematch(session);
      setRoom(nextRoom);
    });
  }, [session]);

  const leaveRoom = useCallback(() => {
    setRoom(null);
    setSession(null);
    setPresence(emptyPresence);
    setDisconnect(emptyDisconnect);
    setError(null);
    setReactionEvent(null);
    setMoveFeedbackEvent(null);
    setReactionCooldownUntil(0);
    lastReactionAt.current = null;
  }, []);

  return {
    hasSupabaseConfig,
    room,
    session,
    presence,
    disconnect,
    gameState,
    legalMoves,
    busy,
    error,
    reactionEvent,
    moveFeedbackEvent,
    reactionCooldownUntil,
    createRoom,
    joinRoom,
    playMove,
    sendReaction,
    requestRematch,
    resign,
    proposeDraw,
    respondToDraw,
    declineRematch,
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
    setError(error instanceof Error ? error.message : "Algo deu errado.");
  } finally {
    setBusy(false);
  }
}

function parseReactionEvent(payload: unknown): ReactionEvent | null {
  if (!payload || typeof payload !== "object") return null;

  const candidate = payload as Partial<ReactionEvent>;
  if (typeof candidate.id !== "string") return null;
  if (candidate.sender !== "red" && candidate.sender !== "black") return null;
  if (!isReactionValue(candidate.value)) return null;
  if (typeof candidate.sentAt !== "number") return null;

  return {
    id: candidate.id,
    sender: candidate.sender,
    value: candidate.value,
    sentAt: candidate.sentAt
  };
}

function parseMoveFeedbackEvent(payload: unknown): MoveFeedbackEvent | null {
  if (!payload || typeof payload !== "object") return null;

  const candidate = payload as Partial<MoveFeedbackEvent>;
  if (typeof candidate.id !== "string") return null;
  if (candidate.sender !== "red" && candidate.sender !== "black") return null;
  if (typeof candidate.revision !== "number") return null;
  if (!candidate.move || typeof candidate.move !== "object") return null;

  return {
    id: candidate.id,
    sender: candidate.sender,
    revision: candidate.revision,
    move: candidate.move
  };
}

function createEventId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
