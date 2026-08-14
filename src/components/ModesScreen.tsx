type ModesScreenProps = {
  onFriend: () => void;
  onComputer: () => void;
};

export function ModesScreen({ onFriend, onComputer }: ModesScreenProps) {
  return (
    <main className="lobby mode-screen">
      <section className="brand-panel" aria-labelledby="app-title">
        <p className="eyebrow">Damas online</p>
        <h1 id="app-title">Jogue damas online</h1>
        <p className="subtle">Escolha como quer jogar. O modo com amigo continua usando salas por código.</p>
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
        <button className="mode-card soon" type="button" disabled>
          <span className="mode-icon" aria-hidden="true">🌐</span>
          <span>
            <strong>Casual Online</strong>
            <small>Em breve</small>
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
