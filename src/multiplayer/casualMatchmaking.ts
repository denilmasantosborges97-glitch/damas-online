import type { Player } from "../game/types";

export const CASUAL_PLAYER_KEY_STORAGE_KEY = "damas-casual-player-key-v1";
export const CASUAL_QUEUE_TTL_MS = 30_000;
export const CASUAL_HEARTBEAT_MS = 5_000;

export type CasualSearchState = {
  active: boolean;
  busy: boolean;
  error: string | null;
  startedAt: number | null;
};

export type CasualQueueEntry = {
  playerKey: string;
  nickname: string;
  status: "waiting" | "matched";
  createdAt: number;
  heartbeatAt: number;
  roomId?: string;
  player?: Player;
};

export type CasualColorAssignment = {
  currentPlayer: Player;
  opponentPlayer: Player;
};

export const emptyCasualSearch: CasualSearchState = {
  active: false,
  busy: false,
  error: null,
  startedAt: null
};

type CasualStorage = Pick<Storage, "getItem" | "setItem">;

export function getOrCreateCasualPlayerKey(storage: CasualStorage = getBrowserStorage()): string {
  try {
    const stored = storage.getItem(CASUAL_PLAYER_KEY_STORAGE_KEY);
    if (stored && isUuidLike(stored)) return stored;

    const next = createUuid();
    storage.setItem(CASUAL_PLAYER_KEY_STORAGE_KEY, next);
    return next;
  } catch {
    return createUuid();
  }
}

export function createCasualQueueEntry(playerKey: string, nickname: string, now: number): CasualQueueEntry {
  return {
    playerKey,
    nickname,
    status: "waiting",
    createdAt: now,
    heartbeatAt: now
  };
}

export function refreshCasualQueueEntry(entry: CasualQueueEntry, nickname: string, now: number): CasualQueueEntry {
  return {
    ...entry,
    nickname,
    heartbeatAt: now
  };
}

export function isCasualEntryExpired(entry: CasualQueueEntry, now: number, ttlMs = CASUAL_QUEUE_TTL_MS): boolean {
  return entry.status === "waiting" && now - entry.heartbeatAt > ttlMs;
}

export function removeExpiredCasualEntries(entries: CasualQueueEntry[], now: number): CasualQueueEntry[] {
  return entries.filter((entry) => !isCasualEntryExpired(entry, now));
}

export function cancelCasualQueue(entries: CasualQueueEntry[], playerKey: string): CasualQueueEntry[] {
  return entries.filter((entry) => !(entry.playerKey === playerKey && entry.status === "waiting"));
}

export function assignCasualColors(randomByte: number): CasualColorAssignment {
  return randomByte % 2 === 0
    ? { currentPlayer: "red", opponentPlayer: "black" }
    : { currentPlayer: "black", opponentPlayer: "red" };
}

export function findCasualOpponent(
  entries: CasualQueueEntry[],
  playerKey: string,
  now: number
): CasualQueueEntry | null {
  return removeExpiredCasualEntries(entries, now)
    .filter((entry) => entry.status === "waiting" && entry.playerKey !== playerKey)
    .sort((left, right) => left.createdAt - right.createdAt)[0] ?? null;
}

export function applyCasualMatch(
  entries: CasualQueueEntry[],
  currentPlayerKey: string,
  opponentPlayerKey: string,
  roomId: string,
  colors: CasualColorAssignment,
  now: number
): CasualQueueEntry[] {
  return entries.map((entry) => {
    if (entry.playerKey === currentPlayerKey) {
      return { ...entry, status: "matched", roomId, player: colors.currentPlayer, heartbeatAt: now };
    }

    if (entry.playerKey === opponentPlayerKey) {
      return { ...entry, status: "matched", roomId, player: colors.opponentPlayer, heartbeatAt: now };
    }

    return entry;
  });
}

export function casualMatchUsesNormalRoomFeatures(): string[] {
  return ["rooms", "room_players", "submit-move", "realtime", "presence", "chat", "reactions"];
}

function getBrowserStorage(): CasualStorage {
  if (typeof window === "undefined" || !window.localStorage) return createMemoryStorage();
  return window.localStorage;
}

function createMemoryStorage(): CasualStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    }
  };
}

function createUuid(): string {
  return crypto.randomUUID?.() ?? "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) =>
    (Number(char) ^ (Math.random() * 16) >> (Number(char) / 4)).toString(16)
  );
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
