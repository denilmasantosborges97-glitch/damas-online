import { describe, expect, it } from "vitest";
import type { AccountProfile, AccountSession } from "./profile";
import {
  PROFILE_DUPLICATE_NICKNAME_MESSAGE,
  canMutateProfile,
  createGuestAccountState,
  isDuplicateNicknameError,
  nicknameInitialValue,
  nicknameKey,
  validateProfileNickname
} from "./profile";
import {
  AUTH_LINK_EXPIRED_MESSAGE,
  cleanAuthRedirectUrl,
  loadAccountProfile,
  loadPersistentAccountSession,
  requestMagicLink,
  resolveAuthRedirectOutcome,
  saveOwnAccountProfile,
  type ProfileRepository
} from "./profileService";

describe("base de conta e perfil", () => {
  it("mantem visitante sem conta", () => {
    expect(createGuestAccountState()).toEqual({
      status: "guest",
      session: null,
      profile: null
    });
  });

  it("cria e carrega perfil persistente", async () => {
    const repository = createRepository();
    const session = await loadPersistentAccountSession(repository);

    const saved = await saveOwnAccountProfile(repository, session, "Wesley");
    const loaded = await loadAccountProfile(repository, session);

    expect(saved).toMatchObject({ ok: true });
    expect(loaded).toMatchObject({ userId: "user-1", nickname: "Wesley" });
  });

  it("migra o apelido local como valor inicial do perfil", () => {
    expect(nicknameInitialValue({ nickname: "Denilma", createdAt: "1", updatedAt: "1" }, null)).toBe("Denilma");
  });

  it("rejeita apelido invalido", () => {
    expect(validateProfileNickname("No")).toMatchObject({
      valid: false,
      message: "O apelido precisa ter pelo menos 3 caracteres."
    });
  });

  it("detecta apelido duplicado sem diferenciar maiusculas", async () => {
    const repository = createRepository();
    const first = await loadPersistentAccountSession(repository);
    await saveOwnAccountProfile(repository, first, "Wesley");

    repository.setSession({ userId: "user-2", email: "two@example.com" });
    const second = await loadPersistentAccountSession(repository);
    const result = await saveOwnAccountProfile(repository, second, "wesley");

    expect(nicknameKey(" Wesley ")).toBe("wesley");
    expect(isDuplicateNicknameError({ code: "23505" })).toBe(true);
    expect(result).toEqual({ ok: false, message: PROFILE_DUPLICATE_NICKNAME_MESSAGE });
  });

  it("edita o proprio apelido", async () => {
    const repository = createRepository();
    const session = await loadPersistentAccountSession(repository);
    await saveOwnAccountProfile(repository, session, "Wesley");

    const result = await saveOwnAccountProfile(repository, session, "Wesley Jr");

    expect(result).toMatchObject({ ok: true, profile: { nickname: "Wesley Jr" } });
  });

  it("impede edicao de outro perfil pela regra de dono", () => {
    const session: AccountSession = { userId: "user-1", email: "one@example.com" };
    const otherProfile = createProfile("user-2", "Outro");

    expect(canMutateProfile(session, otherProfile)).toBe(false);
  });

  it("mantem sessao persistente", async () => {
    const repository = createRepository();

    expect(await loadPersistentAccountSession(repository)).toEqual({
      userId: "user-1",
      email: "one@example.com"
    });
  });

  it("faz logout", async () => {
    const repository = createRepository();

    await repository.signOut();

    expect(await loadPersistentAccountSession(repository)).toBeNull();
  });

  it("carrega perfil apos login", async () => {
    const repository = createRepository();
    const session = await loadPersistentAccountSession(repository);
    await saveOwnAccountProfile(repository, session, "Wesley");
    await repository.signOut();

    repository.setSession({ userId: "user-1", email: "one@example.com" });
    const loggedSession = await loadPersistentAccountSession(repository);
    const profile = await loadAccountProfile(repository, loggedSession);

    expect(profile).toMatchObject({ nickname: "Wesley" });
  });

  it("envia link magico por email valido", async () => {
    const repository = createRepository();
    const result = await requestMagicLink(repository, " jogador@example.com ", "https://damas-online.vercel.app");

    expect(result.ok).toBe(true);
    expect(repository.sentLoginLinks).toEqual([
      {
        email: "jogador@example.com",
        redirectTo: "https://damas-online.vercel.app"
      }
    ]);
  });

  it("considera login bem-sucedido quando ha sessao valida e erro residual na URL", () => {
    const session: AccountSession = { userId: "user-1", email: "one@example.com" };
    const url =
      "https://damas-online.vercel.app/?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";

    expect(resolveAuthRedirectOutcome(url, session)).toEqual({
      shouldCleanUrl: true,
      message: null
    });
    expect(cleanAuthRedirectUrl(url)).toBe("/");
  });

  it("mostra mensagem amigavel quando link expirou sem sessao valida", () => {
    const url =
      "https://damas-online.vercel.app/?room=47AA2#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";

    expect(resolveAuthRedirectOutcome(url, null)).toEqual({
      shouldCleanUrl: true,
      message: AUTH_LINK_EXPIRED_MESSAGE
    });
    expect(cleanAuthRedirectUrl(url)).toBe("/?room=47AA2");
  });
});

type TestRepository = ProfileRepository & {
  sentLoginLinks: Array<{ email: string; redirectTo: string }>;
  setSession: (session: AccountSession | null) => void;
};

function createRepository(): TestRepository {
  let session: AccountSession | null = { userId: "user-1", email: "one@example.com" };
  const profiles = new Map<string, AccountProfile>();
  const sentLoginLinks: Array<{ email: string; redirectTo: string }> = [];
  const listeners = new Set<(session: AccountSession | null) => void>();

  return {
    sentLoginLinks,
    setSession(nextSession) {
      session = nextSession;
      for (const listener of listeners) listener(session);
    },
    async getCurrentSession() {
      return session;
    },
    onSessionChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async sendMagicLink(email, redirectTo) {
      sentLoginLinks.push({ email, redirectTo });
    },
    async signOut() {
      session = null;
    },
    async getOwnProfile(userId) {
      return profiles.get(userId) ?? null;
    },
    async upsertOwnProfile(input) {
      if (!session) throw new Error("not_authenticated");

      const duplicate = Array.from(profiles.values()).find(
        (profile) => profile.userId !== session?.userId && nicknameKey(profile.nickname) === nicknameKey(input.nickname)
      );
      if (duplicate) throw { code: "23505", message: "duplicate key value violates unique constraint" };

      const current = profiles.get(session.userId);
      const profile = createProfile(session.userId, input.nickname, current?.createdAt);
      profiles.set(session.userId, profile);
      return profile;
    }
  };
}

function createProfile(userId: string, nickname: string, createdAt = "2026-08-21T00:00:00.000Z"): AccountProfile {
  return {
    userId,
    nickname,
    avatarId: null,
    regionCode: null,
    preferences: {},
    futureProgression: {
      ranked: {
        enabled: false,
        rating: null,
        rank: null,
        wins: 0,
        losses: 0,
        draws: 0
      },
      coins: 0,
      equippedBoard: "madeira"
    },
    createdAt,
    updatedAt: "2026-08-21T00:00:00.000Z"
  };
}
