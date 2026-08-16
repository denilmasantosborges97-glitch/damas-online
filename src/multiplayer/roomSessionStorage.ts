import { normalizeRoomCode } from "./inviteLink";
import type { PlayerSession } from "./types";

export const ROOM_SESSION_STORAGE_KEY = "damas-room-sessions-v1";

type RoomSessionRecord = PlayerSession & {
  savedAt: string;
};

type RoomSessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function saveRoomSession(session: PlayerSession, storage: RoomSessionStorage = getBrowserStorage()): void {
  try {
    const sessions = readSessions(storage);
    sessions[normalizeRoomCode(session.code)] = {
      ...session,
      code: normalizeRoomCode(session.code),
      savedAt: new Date().toISOString()
    };
    storage.setItem(ROOM_SESSION_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // A sessão em memória continua funcionando mesmo quando o armazenamento local não está disponível.
  }
}

export function loadRoomSession(code: string, storage: RoomSessionStorage = getBrowserStorage()): PlayerSession | null {
  try {
    const session = readSessions(storage)[normalizeRoomCode(code)];
    if (!isRoomSessionRecord(session)) return null;

    return {
      roomId: session.roomId,
      code: normalizeRoomCode(session.code),
      player: session.player,
      token: session.token
    };
  } catch {
    return null;
  }
}

export function forgetRoomSession(code: string, storage: RoomSessionStorage = getBrowserStorage()): void {
  try {
    const sessions = readSessions(storage);
    delete sessions[normalizeRoomCode(code)];
    storage.setItem(ROOM_SESSION_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    storage.removeItem(ROOM_SESSION_STORAGE_KEY);
  }
}

function readSessions(storage: RoomSessionStorage): Record<string, RoomSessionRecord> {
  const raw = storage.getItem(ROOM_SESSION_STORAGE_KEY);
  if (!raw) return {};

  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const sessions: Record<string, RoomSessionRecord> = {};

  for (const [code, value] of Object.entries(parsed)) {
    if (isRoomSessionRecord(value)) {
      sessions[normalizeRoomCode(code)] = value;
    }
  }

  return sessions;
}

function isRoomSessionRecord(value: unknown): value is RoomSessionRecord {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<RoomSessionRecord>;

  return (
    typeof session.roomId === "string" &&
    typeof session.code === "string" &&
    (session.player === "red" || session.player === "black") &&
    typeof session.token === "string" &&
    typeof session.savedAt === "string"
  );
}

function getBrowserStorage(): RoomSessionStorage {
  if (typeof window === "undefined" || !window.localStorage) return createMemoryStorage();
  return window.localStorage;
}

function createMemoryStorage(): RoomSessionStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    }
  };
}
