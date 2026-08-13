import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canSendReaction, isReactionValue, REACTION_COOLDOWN_MS } from "../feedback/feedback";
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
import { hasSupabaseConfig, supabase } from "./supabaseClient";
import type { MoveFeedbackEvent, PlayerSession, PresenceState, ReactionEvent, ReactionValue, RoomSnapshot } from "./types";

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
  const [reactionEvent, setReactionEvent] = useState<ReactionEvent | null>(null);
  const [moveFeedbackEvent, setMoveFeedbackEvent] = useState<MoveFeedbackEvent | null>(null);
  const [reactionCooldownUntil, setReactionCooldownUntil] = useState(0);
  const eventChannel = useRef<RealtimeChannel | null>(null);
  const lastReactionAt = useRef<number | null>(null);

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

  const leaveRoom = useCallback(() => {
    setRoom(null);
    setSession(null);
    setPresence(emptyPresence);
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
