import { FormEvent, useEffect, useState } from "react";
import type { StoredPlayerIdentity } from "../playerIdentity/identity";
import { validateNickname } from "../playerIdentity/identity";
import type { PlayerAccountController } from "../playerAccount/usePlayerAccount";
import { nicknameInitialValue } from "../playerAccount/profile";

type ProfilePanelProps = {
  account: PlayerAccountController;
  localIdentity: StoredPlayerIdentity | null;
  playerName: string;
  onSaveGuestNickname: (nickname: string) => boolean;
  onClose: () => void;
};

export function ProfilePanel({
  account,
  localIdentity,
  playerName,
  onSaveGuestNickname,
  onClose
}: ProfilePanelProps) {
  const isConnected = account.status === "authenticated";
  const [email, setEmail] = useState("");
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [nickname, setNickname] = useState(() => nicknameInitialValue(localIdentity, account.profile));
  const [nicknameMessage, setNicknameMessage] = useState<string | null>(null);
  const [editingNickname, setEditingNickname] = useState(!isConnected || !account.profile);

  useEffect(() => {
    setNickname(nicknameInitialValue(localIdentity, account.profile));
    setEditingNickname(!isConnected || !account.profile);
  }, [account.profile, isConnected, localIdentity]);

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailMessage(null);

    const result = await account.sendMagicLink(email);
    setEmailMessage(result.message);
  }

  async function submitNickname(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNicknameMessage(null);

    const validation = validateNickname(nickname);
    if (!validation.valid) {
      setNicknameMessage(validation.message);
      return;
    }

    if (isConnected) {
      const result = await account.saveProfile(validation.nickname);
      setNicknameMessage(result.ok ? "Perfil salvo." : result.message);
      if (result.ok) setEditingNickname(false);
      return;
    }

    const saved = onSaveGuestNickname(validation.nickname);
    setNicknameMessage(saved ? "Apelido salvo neste dispositivo." : "Não foi possível salvar o apelido agora.");
    if (saved) setEditingNickname(false);
  }

  async function signOut() {
    const result = await account.signOut();
    if (!result.ok) setEmailMessage(result.message);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Perfil do jogador">
      <div className="center-modal profile-modal account-profile-modal">
        <div className="profile-modal-header">
          <div>
            <p className="eyebrow">Perfil</p>
            <h2>{playerName}</h2>
          </div>
          <button className="icon-button compact" type="button" onClick={onClose} aria-label="Fechar perfil">
            Fechar
          </button>
        </div>

        <section className="account-status-card">
          <span className={`account-status-dot ${isConnected ? "connected" : "guest"}`} aria-hidden="true" />
          <div>
            <strong>{isConnected ? "Conta conectada" : "Visitante"}</strong>
            <small>
              {isConnected
                ? account.session?.email ?? "Sessão ativa no Supabase"
                : "Identidade salva apenas neste dispositivo."}
            </small>
          </div>
        </section>

        <section className="future-stats-grid" aria-label="Recursos futuros">
          <span>Rank: Em breve</span>
          <span>Partidas: Em breve</span>
          <span>Moedas: Em breve</span>
        </section>

        {editingNickname ? (
          <form className="profile-form compact-profile-form" onSubmit={submitNickname}>
            <label htmlFor="account-nickname">{isConnected ? "Apelido da conta" : "Apelido de visitante"}</label>
            <input
              id="account-nickname"
              autoComplete="nickname"
              maxLength={24}
              placeholder="Seu apelido"
              value={nickname}
              onChange={(event) => {
                setNickname(event.target.value);
                setNicknameMessage(null);
              }}
            />
            {nicknameMessage && <p className="error-message inline-error">{nicknameMessage}</p>}
            {!account.profile && isConnected && localIdentity?.nickname && (
              <p className="subtle compact-subtle">Usaremos seu apelido atual: {localIdentity.nickname}</p>
            )}
            <div className="profile-actions">
              <button className="primary-button compact" type="submit" disabled={account.busy}>
                {isConnected ? "Salvar perfil" : "Salvar apelido"}
              </button>
              {(account.profile || !isConnected) && (
                <button className="ghost-button compact" type="button" onClick={() => setEditingNickname(false)}>
                  Cancelar
                </button>
              )}
            </div>
          </form>
        ) : (
          <button className="ghost-button compact full-width-button" type="button" onClick={() => setEditingNickname(true)}>
            Editar apelido
          </button>
        )}

        {!isConnected && (
          <form className="profile-form compact-profile-form" onSubmit={submitEmail}>
            <label htmlFor="account-email">Entrar com e-mail</label>
            <input
              id="account-email"
              autoComplete="email"
              inputMode="email"
              placeholder="voce@email.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailMessage(null);
              }}
            />
            <button className="primary-button compact" type="submit" disabled={account.busy || !account.hasAuthConfig}>
              Enviar link mágico
            </button>
            {!account.hasAuthConfig && <p className="error-message inline-error">Supabase Auth não configurado neste ambiente.</p>}
            {emailMessage && <p className="share-confirmation">{emailMessage}</p>}
          </form>
        )}

        {isConnected && (
          <button className="ghost-button compact danger" type="button" disabled={account.busy} onClick={signOut}>
            Sair da conta
          </button>
        )}

        {account.error && <p className="error-message inline-error">{account.error}</p>}
      </div>
    </div>
  );
}
