import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../multiplayer/supabaseClient";
import type { AccountProfile, AccountSession, EmailLoginResult, SaveProfileResult } from "./profile";
import { createGuestAccountState, type AccountState } from "./profile";
import {
  cleanAuthRedirectUrl,
  createSupabaseProfileRepository,
  loadAccountProfile,
  loadPersistentAccountSession,
  requestMagicLink,
  resolveAuthRedirectOutcome,
  saveOwnAccountProfile,
  type ProfileRepository
} from "./profileService";

export type PlayerAccountController = AccountState & {
  hasAuthConfig: boolean;
  busy: boolean;
  error: string | null;
  sendMagicLink: (email: string) => Promise<EmailLoginResult>;
  saveProfile: (nickname: string) => Promise<SaveProfileResult>;
  signOut: () => Promise<{ ok: true } | { ok: false; message: string }>;
  refreshProfile: () => Promise<void>;
};

export function usePlayerAccount(): PlayerAccountController {
  const repository = useMemo<ProfileRepository | null>(() => createSupabaseProfileRepository(supabase), []);
  const [state, setState] = useState<AccountState>(() => (repository ? { ...createGuestAccountState(), status: "loading" } : createGuestAccountState()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfileForSession = useCallback(
    async (session: AccountSession | null) => {
      if (!repository || !session) {
        setState(createGuestAccountState());
        return;
      }

      setState((current) => ({
        status: "authenticated",
        session,
        profile: current.session?.userId === session.userId ? current.profile : null
      }));

      try {
        const profile = await loadAccountProfile(repository, session);
        setState({
          status: "authenticated",
          session,
          profile
        });
        setError(null);
      } catch (profileError) {
        setState({
          status: "authenticated",
          session,
          profile: null
        });
        setError(profileError instanceof Error ? profileError.message : "Não foi possível carregar o perfil.");
      }
    },
    [repository]
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!repository) {
        setState(createGuestAccountState());
        return;
      }

      try {
        const session = await loadPersistentAccountSession(repository);
        if (!active) return;
        const authRedirect = resolveAuthRedirectOutcome(window.location.href, session);
        if (authRedirect.shouldCleanUrl) {
          window.history.replaceState({}, document.title, cleanAuthRedirectUrl(window.location.href));
        }
        await loadProfileForSession(session);
        if (active && authRedirect.message) setError(authRedirect.message);
      } catch (sessionError) {
        if (!active) return;
        setState(createGuestAccountState());
        setError(sessionError instanceof Error ? sessionError.message : "Não foi possível carregar a sessão.");
      }
    })();

    return () => {
      active = false;
    };
  }, [loadProfileForSession, repository]);

  useEffect(() => {
    if (!repository) return;

    return repository.onSessionChange((session) => {
      void loadProfileForSession(session);
    });
  }, [loadProfileForSession, repository]);

  const sendMagicLink = useCallback(
    async (email: string): Promise<EmailLoginResult> => {
      setBusy(true);
      setError(null);
      const result = await requestMagicLink(repository, email, window.location.origin);
      if (!result.ok) setError(result.message);
      setBusy(false);
      return result;
    },
    [repository]
  );

  const saveProfile = useCallback(
    async (nickname: string): Promise<SaveProfileResult> => {
      setBusy(true);
      setError(null);
      const result = await saveOwnAccountProfile(repository, state.session, nickname);
      if (result.ok) {
        setState((current) => ({
          status: "authenticated",
          session: current.session,
          profile: result.profile
        }));
      } else {
        setError(result.message);
      }
      setBusy(false);
      return result;
    },
    [repository, state.session]
  );

  const signOut = useCallback(async () => {
    if (!repository) return { ok: false as const, message: "Autenticação indisponível." };

    setBusy(true);
    setError(null);
    try {
      await repository.signOut();
      setState(createGuestAccountState());
      return { ok: true as const };
    } catch (signOutError) {
      const message = signOutError instanceof Error ? signOutError.message : "Não foi possível sair da conta.";
      setError(message);
      return { ok: false as const, message };
    } finally {
      setBusy(false);
    }
  }, [repository]);

  const refreshProfile = useCallback(async () => {
    if (!state.session) return;
    await loadProfileForSession(state.session);
  }, [loadProfileForSession, state.session]);

  return useMemo(
    () => ({
      ...state,
      hasAuthConfig: Boolean(repository),
      busy,
      error,
      sendMagicLink,
      saveProfile,
      signOut,
      refreshProfile
    }),
    [busy, error, refreshProfile, repository, saveProfile, sendMagicLink, signOut, state]
  );
}
