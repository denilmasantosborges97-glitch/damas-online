import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { appendChatMessage, canSendChatMessage, validateChatText } from "../chat/chat";
import { canSendReaction, isReactionValue, REACTION_COOLDOWN_MS } from "../feedback/feedback";
import { getLegalMoves } from "../game/rules";
import type { Move } from "../game/types";
import {
  CASUAL_HEARTBEAT_MS,
  emptyCasualSearch,
  getOrCreateCasualPlayerKey,
  type CasualSearchState
} from "./casualMatchmaking";
import {
  classifyInviteJoinError,
  inviteErrorMessage,
  isValidRoomCode,
  normalizeRoomCode,
  planInviteEntry,
  type InviteJoinErrorKind
} from "./inviteLink";
import { forgetRoomSession, loadRoomSession, saveRoomSession } from "./roomSessionStorage";
import {
  cancelCasualQueue as cancelRemoteCasualQueue,
  claimAbandonment as claimRemoteAbandonment,
  createRoom as createRemoteRoom,
  declineRematch as declineRemoteRematch,
  enterCasualQueue as enterRemoteCasualQueue,
  gameStateFromRoom,
  joinRoom as joinRemoteRoom,
  proposeDraw as proposeRemoteDraw,
  requestRematch as requestRemoteRematch,
  resumeRoomSession,
  resignRoom as resignRemoteRoom,
  respondToDraw as respondRemoteDraw,
  submitMove as submitRemoteMove,
  subscribeToRoom,
  updatePlayerPresence
} from "./roomService";
import { hasSupabaseConfig, supabase } from "./supabaseClient";
import type {
  ChatEvent,
  DisconnectState,
  MoveFeedbackEvent,
  PlayerSession,
  PresenceState,
  ReactionEvent,
  ReactionValue,
  RoomSnapshot
} from "./types";

type MatchMode = NonNullable<PlayerSession["matchMode"]>;

export type RoomJoinResult =
  | { ok: true }
  | { ok: false; kind: InviteJoinErrorKind; message: string };

export type ChatSendResult =
  | { ok: true }
  | { ok: false; message: string };

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
  const [chatMessages, setChatMessages] = useState<ChatEvent[]>([]);
  const [casualSearch, setCasualSearch] = useState<CasualSearchState>(emptyCasualSearch);
  const [reactionCooldownUntil, setReactionCooldownUntil] = useState(0);
  const casualPlayerKey = useMemo(() => getOrCreateCasualPlayerKey(), []);
  const eventChannel = useRef<RealtimeChannel | null>(null);
  const lastReactionAt = useRef<number | null>(null);
  const lastChatAt = useRef<number | null>(null);
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
      .on("broadcast", { event: "chat-message" }, ({ payload }) => {
        const event = parseChatEvent(payload);
        if (event) setChatMessages((current) => appendChatMessage(current, event));
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

  const applyRoomSession = useCallback(
    (nextRoom: RoomSnapshot, nextSession: PlayerSession, matchMode: MatchMode = nextSession.matchMode ?? "friend") => {
      const sessionWithMode: PlayerSession = {
        ...nextSession,
        matchMode
      };

      setRoom(nextRoom);
      setSession(sessionWithMode);
      saveRoomSession(sessionWithMode);
      setPresence({
        ...emptyPresence,
        playerNames: nickname ? { [sessionWithMode.player]: nickname } : {}
      });
    },
    [nickname]
  );

  const createRoom = useCallback(async () => {
    await runAction(setBusy, setError, async () => {
      const next = await createRemoteRoom();
      applyRoomSession(next.room, next.session, "friend");
    });
  }, [applyRoomSession]);

  const pollCasualQueue = useCallback(async () => {
    if (!nickname) {
      setCasualSearch({ active: false, busy: false, error: "Defina um apelido antes de buscar partida.", startedAt: null });
      return;
    }

    try {
      setCasualSearch((current) => ({
        active: true,
        busy: true,
        error: null,
        startedAt: current.startedAt ?? Date.now()
      }));

      const result = await enterRemoteCasualQueue(casualPlayerKey, nickname);
      if (result.status === "matched") {
        applyRoomSession(result.room, result.session, "casual");
        setCasualSearch(emptyCasualSearch);
        return;
      }

      setCasualSearch((current) => ({
        active: true,
        busy: false,
        error: null,
        startedAt: current.startedAt ?? Date.now()
      }));
    } catch (error) {
      setCasualSearch((current) => ({
        active: true,
        busy: false,
        error: error instanceof Error ? error.message : "Não foi possível buscar partida agora.",
        startedAt: current.startedAt ?? Date.now()
      }));
    }
  }, [applyRoomSession, casualPlayerKey, nickname]);

  const startCasualSearch = useCallback(() => {
    setCasualSearch({ active: true, busy: true, error: null, startedAt: Date.now() });
    void pollCasualQueue();
  }, [pollCasualQueue]);

  const cancelCasualSearch = useCallback(async () => {
    setCasualSearch(emptyCasualSearch);
    try {
      await cancelRemoteCasualQueue(casualPlayerKey);
    } catch (error) {
      setCasualSearch({
        active: false,
        busy: false,
        error: error instanceof Error ? error.message : "Não foi possível cancelar a busca.",
        startedAt: null
      });
    }
  }, [casualPlayerKey]);

  useEffect(() => {
    if (!casualSearch.active) return;

    const timer = window.setInterval(() => {
      void pollCasualQueue();
    }, CASUAL_HEARTBEAT_MS);

    return () => window.clearInterval(timer);
  }, [casualSearch.active, pollCasualQueue]);

  useEffect(() => {
    if (!casualSearch.active) return;

    function cancelOnExit() {
      void cancelRemoteCasualQueue(casualPlayerKey).catch(() => undefined);
    }

    window.addEventListener("pagehide", cancelOnExit);
    return () => window.removeEventListener("pagehide", cancelOnExit);
  }, [casualPlayerKey, casualSearch.active]);

  const joinRoom = useCallback(async (code: string): Promise<RoomJoinResult> => {
    const normalizedCode = normalizeRoomCode(code);
    if (!isValidRoomCode(normalizedCode)) {
      const message = "Código de sala inválido.";
      setError(message);
      return { ok: false, kind: "unavailable", message };
    }

    try {
      setBusy(true);
      setError(null);
      const next = await joinRemoteRoom(code);
      applyRoomSession(next.room, next.session, "friend");
      return { ok: true };
    } catch (error) {
      const kind = classifyInviteJoinError(error);
      const message = kind === "full" ? "Esta sala já está completa." : error instanceof Error ? error.message : inviteErrorMessage(kind);
      setError(message);
      return { ok: false, kind, message };
    } finally {
      setBusy(false);
    }
  }, [applyRoomSession]);

  const joinRoomFromInvite = useCallback(async (code: string): Promise<RoomJoinResult> => {
    const normalizedCode = normalizeRoomCode(code);
    if (!isValidRoomCode(normalizedCode)) {
      const message = inviteErrorMessage("unavailable");
      setError(message);
      return { ok: false, kind: "unavailable", message };
    }

    try {
      setBusy(true);
      setError(null);

      const storedSession = loadRoomSession(normalizedCode);
      const plan = planInviteEntry({
        code: normalizedCode,
        nickname,
        currentSession: session,
        hasCurrentRoom: Boolean(room),
        storedSession
      });

      if (plan.action === "invalid" || plan.action === "wait_for_nickname") {
        const message = inviteErrorMessage("unavailable");
        setError(message);
        return { ok: false, kind: "unavailable", message };
      }

      if (plan.action === "already_in_room") {
        return { ok: true };
      }

      if (plan.action === "resume_local_session") {
        try {
          const resumedRoom = await resumeRoomSession(plan.session);
          applyRoomSession(resumedRoom, plan.session);
          return { ok: true };
        } catch {
          forgetRoomSession(normalizedCode);
        }
      }

      const next = await joinRemoteRoom(normalizedCode);
      applyRoomSession(next.room, next.session, "friend");
      return { ok: true };
    } catch (error) {
      const kind = classifyInviteJoinError(error);
      const message = inviteErrorMessage(kind);
      setError(message);
      return { ok: false, kind, message };
    } finally {
      setBusy(false);
    }
  }, [applyRoomSession, nickname, room, session]);

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

  const sendChatMessage = useCallback(
    (text: string): ChatSendResult => {
      if (!session || !nickname) return { ok: false, message: "Chat indisponível agora." };
      if (room?.status !== "playing") return { ok: false, message: "Chat disponível apenas durante a partida." };

      const validation = validateChatText(text);
      if (!validation.valid) return { ok: false, message: validation.message };

      const now = Date.now();
      if (!canSendChatMessage(now, lastChatAt.current)) {
        return { ok: false, message: "Aguarde um instante antes de enviar outra mensagem." };
      }

      lastChatAt.current = now;
      const event: ChatEvent = {
        id: createEventId(),
        sender: session.player,
        senderName: nickname,
        text: validation.text,
        sentAt: now
      };

      setChatMessages((current) => appendChatMessage(current, event));
      void eventChannel.current?.send({
        type: "broadcast",
        event: "chat-message",
        payload: event
      });

      return { ok: true };
    },
    [nickname, room?.status, session]
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
    setChatMessages([]);
    setReactionCooldownUntil(0);
    lastReactionAt.current = null;
    lastChatAt.current = null;
  }, []);

  return {
    hasSupabaseConfig,
    room,
    session,
    presence,
    disconnect,
    gameState,
    legalMoves,
    casualSearch,
    busy,
    error,
    reactionEvent,
    moveFeedbackEvent,
    chatMessages,
    reactionCooldownUntil,
    createRoom,
    startCasualSearch,
    cancelCasualSearch,
    joinRoom,
    joinRoomFromInvite,
    playMove,
    sendReaction,
    sendChatMessage,
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

function parseChatEvent(payload: unknown): ChatEvent | null {
  if (!payload || typeof payload !== "object") return null;

  const candidate = payload as Partial<ChatEvent>;
  if (typeof candidate.id !== "string") return null;
  if (candidate.sender !== "red" && candidate.sender !== "black") return null;
  if (typeof candidate.senderName !== "string") return null;
  if (typeof candidate.text !== "string") return null;
  if (typeof candidate.sentAt !== "number") return null;

  const validation = validateChatText(candidate.text);
  if (!validation.valid) return null;

  return {
    id: candidate.id,
    sender: candidate.sender,
    senderName: candidate.senderName,
    text: validation.text,
    sentAt: candidate.sentAt
  };
}

function createEventId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
