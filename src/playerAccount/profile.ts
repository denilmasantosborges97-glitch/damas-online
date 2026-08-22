import { normalizeNickname, validateNickname, type NicknameValidation, type StoredPlayerIdentity } from "../playerIdentity/identity";

export type AccountProfile = {
  userId: string;
  nickname: string;
  avatarId: string | null;
  regionCode: string | null;
  preferences: Record<string, unknown>;
  futureProgression: {
    ranked: {
      enabled: false;
      rating: null;
      rank: null;
      wins: number;
      losses: number;
      draws: number;
    };
    coins: number;
    equippedBoard: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type AccountSession = {
  userId: string;
  email: string | null;
};

export type AccountStatus = "guest" | "loading" | "authenticated";

export type AccountState = {
  status: AccountStatus;
  session: AccountSession | null;
  profile: AccountProfile | null;
};

export type SaveProfileResult =
  | { ok: true; profile: AccountProfile }
  | { ok: false; message: string };

export type EmailLoginResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export const PROFILE_DUPLICATE_NICKNAME_MESSAGE = "Este apelido já está em uso.";
export const PROFILE_UNAVAILABLE_MESSAGE = "Perfil indisponível agora. Verifique a configuração do Supabase.";

export function createGuestAccountState(): AccountState {
  return {
    status: "guest",
    session: null,
    profile: null
  };
}

export function nicknameInitialValue(localIdentity: StoredPlayerIdentity | null, profile: AccountProfile | null): string {
  return profile?.nickname ?? localIdentity?.nickname ?? "";
}

export function validateProfileNickname(value: string): NicknameValidation {
  return validateNickname(value);
}

export function nicknameKey(value: string): string {
  return normalizeNickname(value).toLocaleLowerCase();
}

export function isDuplicateNicknameError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const details = "details" in error && typeof error.details === "string" ? error.details : "";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const code = "code" in error && typeof error.code === "string" ? error.code : "";

  return code === "23505" || /duplicate|unique|nickname/i.test(`${details} ${message}`);
}

export function profileSaveErrorMessage(error: unknown): string {
  if (isDuplicateNicknameError(error)) return PROFILE_DUPLICATE_NICKNAME_MESSAGE;
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Não foi possível salvar o perfil agora.";
}

export function canMutateProfile(session: AccountSession | null, profile: Pick<AccountProfile, "userId">): boolean {
  return Boolean(session && session.userId === profile.userId);
}

export function mapProfileRow(row: Record<string, unknown>): AccountProfile {
  return {
    userId: String(row.user_id),
    nickname: String(row.nickname),
    avatarId: typeof row.avatar_id === "string" ? row.avatar_id : null,
    regionCode: typeof row.region_code === "string" ? row.region_code : null,
    preferences: toObject(row.preferences),
    futureProgression: mapFutureProgression(row.future_progression),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function mapFutureProgression(value: unknown): AccountProfile["futureProgression"] {
  const object = toObject(value);
  const ranked = toObject(object.ranked);

  return {
    ranked: {
      enabled: false,
      rating: null,
      rank: null,
      wins: numberOrZero(ranked.wins),
      losses: numberOrZero(ranked.losses),
      draws: numberOrZero(ranked.draws)
    },
    coins: numberOrZero(object.coins),
    equippedBoard: typeof object.equipped_board === "string" ? object.equipped_board : "madeira"
  };
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
