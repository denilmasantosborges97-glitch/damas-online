export const PLAYER_IDENTITY_STORAGE_KEY = "damas-player-identity-v1";

export type StoredPlayerIdentity = {
  nickname: string;
  createdAt: string;
  updatedAt: string;
};

export type NicknameValidation =
  | { valid: true; nickname: string }
  | { valid: false; nickname: string; message: string };

type IdentityStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const NICKNAME_PATTERN = /^[\p{L}\p{N} _-]+$/u;

export function normalizeNickname(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function validateNickname(value: string): NicknameValidation {
  const nickname = normalizeNickname(value);

  if (!nickname) {
    return { valid: false, nickname, message: "Escolha um apelido para continuar." };
  }

  if (nickname.length < 3) {
    return { valid: false, nickname, message: "O apelido precisa ter pelo menos 3 caracteres." };
  }

  if (nickname.length > 16) {
    return { valid: false, nickname, message: "Use no máximo 16 caracteres no apelido." };
  }

  if (!NICKNAME_PATTERN.test(nickname)) {
    return {
      valid: false,
      nickname,
      message: "Use apenas letras, números, espaço, hífen ou underscore."
    };
  }

  return { valid: true, nickname };
}

export function loadPlayerIdentity(storage: IdentityStorage = getBrowserStorage()): StoredPlayerIdentity | null {
  try {
    const raw = storage.getItem(PLAYER_IDENTITY_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredPlayerIdentity>;
    if (typeof parsed.nickname !== "string") return null;

    const validation = validateNickname(parsed.nickname);
    if (!validation.valid) return null;

    const now = new Date().toISOString();
    return {
      nickname: validation.nickname,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : now,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : now
    };
  } catch {
    return null;
  }
}

export function savePlayerIdentity(
  value: string,
  storage: IdentityStorage = getBrowserStorage(),
  current: StoredPlayerIdentity | null = loadPlayerIdentity(storage)
): NicknameValidation {
  const validation = validateNickname(value);
  if (!validation.valid) return validation;

  const now = new Date().toISOString();
  const identity: StoredPlayerIdentity = {
    nickname: validation.nickname,
    createdAt: current?.createdAt ?? now,
    updatedAt: now
  };

  try {
    storage.setItem(PLAYER_IDENTITY_STORAGE_KEY, JSON.stringify(identity));
    return validation;
  } catch {
    return {
      valid: false,
      nickname: validation.nickname,
      message: "Não foi possível salvar o apelido neste dispositivo."
    };
  }
}

export function clearPlayerIdentity(storage: IdentityStorage = getBrowserStorage()): void {
  storage.removeItem(PLAYER_IDENTITY_STORAGE_KEY);
}

function getBrowserStorage(): IdentityStorage {
  if (typeof window === "undefined" || !window.localStorage) {
    return createMemoryStorage();
  }

  return window.localStorage;
}

function createMemoryStorage(): IdentityStorage {
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
