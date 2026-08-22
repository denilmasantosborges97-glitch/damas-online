import type { AccountProfile, AccountSession, EmailLoginResult, SaveProfileResult } from "./profile";
import {
  PROFILE_UNAVAILABLE_MESSAGE,
  mapProfileRow,
  profileSaveErrorMessage,
  validateProfileNickname
} from "./profile";

type MaybeSupabaseError = {
  code?: string;
  message?: string;
  details?: string;
};

export type ProfileRepository = {
  getCurrentSession: () => Promise<AccountSession | null>;
  onSessionChange: (listener: (session: AccountSession | null) => void) => () => void;
  sendMagicLink: (email: string, redirectTo: string) => Promise<void>;
  signOut: () => Promise<void>;
  getOwnProfile: (userId: string) => Promise<AccountProfile | null>;
  upsertOwnProfile: (input: { nickname: string; preferences?: Record<string, unknown> }) => Promise<AccountProfile>;
};

export type AuthRedirectOutcome = {
  shouldCleanUrl: boolean;
  message: string | null;
};

export const AUTH_LINK_EXPIRED_MESSAGE = "Este link expirou. Solicite um novo link de acesso.";

const AUTH_REDIRECT_PARAMS = [
  "access_token",
  "code",
  "error",
  "error_code",
  "error_description",
  "error_uri",
  "expires_at",
  "expires_in",
  "provider_refresh_token",
  "provider_token",
  "refresh_token",
  "token_type",
  "type"
];

export async function loadPersistentAccountSession(repository: ProfileRepository | null): Promise<AccountSession | null> {
  if (!repository) return null;
  return repository.getCurrentSession();
}

export async function loadAccountProfile(
  repository: ProfileRepository | null,
  session: AccountSession | null
): Promise<AccountProfile | null> {
  if (!repository || !session) return null;
  return repository.getOwnProfile(session.userId);
}

export async function saveOwnAccountProfile(
  repository: ProfileRepository | null,
  session: AccountSession | null,
  nickname: string
): Promise<SaveProfileResult> {
  if (!repository || !session) {
    return { ok: false, message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  const validation = validateProfileNickname(nickname);
  if (!validation.valid) {
    return { ok: false, message: validation.message };
  }

  try {
    const profile = await repository.upsertOwnProfile({
      nickname: validation.nickname,
      preferences: {}
    });
    return { ok: true, profile };
  } catch (error) {
    return { ok: false, message: profileSaveErrorMessage(error) };
  }
}

export async function requestMagicLink(
  repository: ProfileRepository | null,
  email: string,
  redirectTo: string
): Promise<EmailLoginResult> {
  if (!repository) {
    return { ok: false, message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  const normalizedEmail = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { ok: false, message: "Informe um e-mail válido." };
  }

  try {
    await repository.sendMagicLink(normalizedEmail, redirectTo);
    return { ok: true, message: "Enviamos um link de acesso para o seu e-mail." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Não foi possível enviar o link agora."
    };
  }
}

export function resolveAuthRedirectOutcome(rawUrl: string, session: AccountSession | null): AuthRedirectOutcome {
  const url = parseUrl(rawUrl);
  const searchParams = new URLSearchParams(url.search);
  const hashParams = parseHashParams(url.hash);
  const hasAuthReturnParams = hasAnyAuthRedirectParam(searchParams) || hasAnyAuthRedirectParam(hashParams);

  if (!hasAuthReturnParams) {
    return { shouldCleanUrl: false, message: null };
  }

  if (session) {
    return { shouldCleanUrl: true, message: null };
  }

  const errorCode = searchParams.get("error_code") ?? hashParams.get("error_code");
  const error = searchParams.get("error") ?? hashParams.get("error");
  const errorDescription = searchParams.get("error_description") ?? hashParams.get("error_description");

  if (errorCode === "otp_expired" || error === "access_denied" || /expired/i.test(errorDescription ?? "")) {
    return { shouldCleanUrl: true, message: AUTH_LINK_EXPIRED_MESSAGE };
  }

  if (error || errorCode || errorDescription) {
    return { shouldCleanUrl: true, message: "Não foi possível confirmar o acesso. Solicite um novo link." };
  }

  return { shouldCleanUrl: true, message: null };
}

export function cleanAuthRedirectUrl(rawUrl: string): string {
  const url = parseUrl(rawUrl);
  const searchParams = new URLSearchParams(url.search);
  const hashParams = parseHashParams(url.hash);

  for (const param of AUTH_REDIRECT_PARAMS) {
    searchParams.delete(param);
    hashParams.delete(param);
  }

  const search = searchParams.toString();
  const hash = hashParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${hash ? `#${hash}` : ""}`;
}

export function createSupabaseProfileRepository(client: unknown): ProfileRepository | null {
  if (!client || typeof client !== "object") return null;

  const supabaseClient = client as {
    auth: {
      getSession: () => Promise<{ data: { session: SupabaseAuthSession | null }; error: MaybeSupabaseError | null }>;
      onAuthStateChange: (
        callback: (event: string, session: SupabaseAuthSession | null) => void
      ) => { data: { subscription: { unsubscribe: () => void } } };
      signInWithOtp: (params: {
        email: string;
        options: { emailRedirectTo: string };
      }) => Promise<{ error: MaybeSupabaseError | null }>;
      signOut: () => Promise<{ error: MaybeSupabaseError | null }>;
    };
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: MaybeSupabaseError | null }>;
        };
      };
    };
    rpc: (
      functionName: string,
      params: Record<string, unknown>
    ) => Promise<{ data: Record<string, unknown> | null; error: MaybeSupabaseError | null }>;
  };

  return {
    async getCurrentSession() {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw new Error(error.message ?? "Não foi possível carregar a sessão.");
      return authSessionToAccountSession(data.session);
    },
    onSessionChange(listener) {
      const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
        listener(authSessionToAccountSession(session));
      });
      return () => data.subscription.unsubscribe();
    },
    async sendMagicLink(email, redirectTo) {
      const { error } = await supabaseClient.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo
        }
      });
      if (error) throw new Error(error.message ?? "Não foi possível enviar o link agora.");
    },
    async signOut() {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw new Error(error.message ?? "Não foi possível sair da conta.");
    },
    async getOwnProfile(userId) {
      const { data, error } = await supabaseClient
        .from("player_profiles")
        .select("user_id,nickname,avatar_id,region_code,preferences,future_progression,created_at,updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw new Error(error.message ?? "Não foi possível carregar o perfil.");
      return data ? mapProfileRow(data) : null;
    },
    async upsertOwnProfile(input) {
      const { data, error } = await supabaseClient.rpc("upsert_own_player_profile", {
        p_nickname: input.nickname,
        p_avatar_id: null,
        p_preferences: input.preferences ?? {}
      });

      if (error) throw error;
      if (!data) throw new Error("Não foi possível salvar o perfil agora.");
      return mapProfileRow(data);
    }
  };
}

type SupabaseAuthSession = {
  user: {
    id: string;
    email?: string | null;
  };
};

function parseUrl(rawUrl: string): URL {
  return new URL(rawUrl, "http://localhost");
}

function parseHashParams(hash: string): URLSearchParams {
  const value = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(value);
}

function hasAnyAuthRedirectParam(params: URLSearchParams): boolean {
  return AUTH_REDIRECT_PARAMS.some((param) => params.has(param));
}

function authSessionToAccountSession(session: SupabaseAuthSession | null): AccountSession | null {
  if (!session?.user?.id) return null;

  return {
    userId: session.user.id,
    email: session.user.email ?? null
  };
}
