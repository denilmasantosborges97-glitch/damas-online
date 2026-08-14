import { FormEvent, useState } from "react";

type LobbyProps = {
  canUseOnline: boolean;
  busy: boolean;
  error: string | null;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onBack: () => void;
};

export function Lobby({ canUseOnline, busy, error, onCreateRoom, onJoinRoom, onBack }: LobbyProps) {
  const [mode, setMode] = useState<"menu" | "join">("menu");
  const [code, setCode] = useState("");

  function submitJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.trim().length >= 4) onJoinRoom(code);
  }

  return (
    <main className="lobby">
      <section className="brand-panel" aria-labelledby="app-title">
        <p className="eyebrow">Damas online</p>
        <h1 id="app-title">Jogar com amigo</h1>
        <p className="subtle">Crie uma sala, compartilhe o código e jogue com outra pessoa pela internet.</p>
      </section>

      {!canUseOnline && (
        <div className="notice" role="status">
          Supabase ainda não está configurado. Preencha o arquivo .env para ativar as salas online.
        </div>
      )}

      {mode === "menu" ? (
        <section className="action-stack" aria-label="Ações da sala">
          <button className="primary-button" type="button" disabled={!canUseOnline || busy} onClick={onCreateRoom}>
            Criar Sala
          </button>
          <button className="secondary-button" type="button" disabled={!canUseOnline || busy} onClick={() => setMode("join")}>
            Entrar em uma Sala
          </button>
          <button className="ghost-button" type="button" onClick={onBack}>
            Voltar aos modos
          </button>
        </section>
      ) : (
        <form className="join-form" onSubmit={submitJoin}>
          <label htmlFor="room-code">Código da sala</label>
          <input
            id="room-code"
            autoComplete="off"
            inputMode="text"
            maxLength={6}
            placeholder="AB12C"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          />
          <button className="primary-button" type="submit" disabled={!canUseOnline || busy || code.trim().length < 4}>
            Entrar
          </button>
          <button className="ghost-button" type="button" onClick={() => setMode("menu")}>
            Voltar
          </button>
        </form>
      )}

      {error && <p className="error-message">{error}</p>}
    </main>
  );
}
