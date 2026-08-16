import { formatOnlineCountState, type OnlineCountState } from "../multiplayer/globalPresence";

type ModesScreenProps = {
  playerName: string;
  onlineCount: OnlineCountState;
  onEditNickname: () => void;
  onFriend: () => void;
  onComputer: () => void;
  onCasual: () => void;
};

export function ModesScreen({ playerName, onlineCount, onEditNickname, onFriend, onComputer, onCasual }: ModesScreenProps) {
  const onlineText = formatOnlineCountState(onlineCount);

  return (
    <main className="lobby mode-screen">
      <section className="brand-panel" aria-labelledby="app-title">
        <p className="eyebrow">Damas online</p>
        <h1 id="app-title">Jogue damas online</h1>
        <p className="subtle">Escolha como quer jogar. O modo com amigo continua usando salas por código.</p>
        {onlineText && (
          <p className="online-counter" aria-live="polite">
            <span aria-hidden="true" />
            {onlineText}
          </p>
        )}
        <div className="profile-line">
          <span>Jogando como: <strong>{playerName}</strong></span>
          <button className="text-button" type="button" onClick={onEditNickname}>
            Editar apelido
          </button>
        </div>
      </section>

      <section className="mode-grid" aria-label="Modos de jogo">
        <button className="mode-card available" type="button" onClick={onFriend}>
          <span className="mode-icon" aria-hidden="true">🎮</span>
          <span>
            <strong>Jogar com amigo</strong>
            <small>Crie uma sala ou entre por código</small>
          </span>
        </button>
        <button className="mode-card available" type="button" onClick={onComputer}>
          <span className="mode-icon" aria-hidden="true">🤖</span>
          <span>
            <strong>Contra a máquina</strong>
            <small>Jogue offline após carregar a página</small>
          </span>
        </button>
        <button className="mode-card available" type="button" onClick={onCasual}>
          <span className="mode-icon" aria-hidden="true">🌐</span>
          <span>
            <strong>Casual Online</strong>
            <small>Encontrar adversário automaticamente</small>
          </span>
        </button>
        <button className="mode-card soon" type="button" disabled>
          <span className="mode-icon" aria-hidden="true">🏆</span>
          <span>
            <strong>Ranqueada</strong>
            <small>Em breve</small>
          </span>
        </button>
      </section>
    </main>
  );
}
