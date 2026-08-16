export const GLOBAL_ONLINE_CHANNEL = "global-online-presence-v1";
export const GLOBAL_ONLINE_CLIENT_KEY_STORAGE_KEY = "damas-global-presence-client-key-v1";

export type OnlineCountState =
  | { status: "loading"; count: null }
  | { status: "ready"; count: number }
  | { status: "unavailable"; count: null };

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const loadingOnlineCount: OnlineCountState = { status: "loading", count: null };
export const unavailableOnlineCount: OnlineCountState = { status: "unavailable", count: null };

export function getOrCreateGlobalPresenceKey(storage?: StorageLike): string {
  if (!storage) return createAnonymousPresenceKey();

  try {
    const stored = storage.getItem(GLOBAL_ONLINE_CLIENT_KEY_STORAGE_KEY);
    if (isValidPresenceKey(stored)) return stored;

    const next = createAnonymousPresenceKey();
    storage.setItem(GLOBAL_ONLINE_CLIENT_KEY_STORAGE_KEY, next);
    return next;
  } catch {
    return createAnonymousPresenceKey();
  }
}

export function countUniquePresenceUsers(presenceState: Record<string, unknown[]>): number {
  return Object.keys(presenceState).length;
}

export function formatOnlineCount(count: number): string {
  return count === 1 ? "1 jogador online" : `${count} online agora`;
}

export function formatOnlineCountState(state: OnlineCountState): string | null {
  if (state.status === "loading") return "Verificando jogadores online...";
  if (state.status === "ready") return formatOnlineCount(state.count);
  return null;
}

function createAnonymousPresenceKey(): string {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `online-${randomId}`;
}

function isValidPresenceKey(value: string | null): value is string {
  return typeof value === "string" && value.startsWith("online-") && value.length <= 80;
}
