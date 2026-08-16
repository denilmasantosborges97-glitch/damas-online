import { useEffect, useMemo, useState } from "react";
import type { CasualSearchState } from "../multiplayer/casualMatchmaking";

type CasualMatchScreenProps = {
  playerName: string;
  canUseOnline: boolean;
  search: CasualSearchState;
  onStart: () => void;
  onCancel: () => void;
};

export function CasualMatchScreen({ playerName, canUseOnline, search, onStart, onCancel }: CasualMatchScreenProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!canUseOnline || search.active) return;
    onStart();
  }, [canUseOnline, onStart, search.active]);

  useEffect(() => {
    if (!search.active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [search.active]);

  const elapsedSeconds = useMemo(() => {
    if (!search.startedAt) return 0;
    return Math.max(0, Math.floor((now - search.startedAt) / 1000));
  }, [now, search.startedAt]);

  return (
    <main className="lobby casual-search-screen">
      <section className="brand-panel" aria-live="polite">
        <p className="eyebrow">Casual Online</p>
        <h1>{canUseOnline ? "Procurando adversário..." : "Modo online indisponível"}</h1>
        <p className="subtle">
          {canUseOnline
            ? `Procurando adversário para ${playerName}. Você pode cancelar quando quiser.`
            : "Configure o Supabase para usar partidas online."}
        </p>
      </section>

      {canUseOnline && (
        <section className="casual-search-panel">
          <div className="search-pulse" aria-hidden="true" />
          <strong>{search.busy ? "Entrando na fila..." : "Ainda procurando..."}</strong>
          <span>Tempo de espera: {elapsedSeconds}s</span>
          {search.error && <p className="chat-error">{search.error}</p>}
        </section>
      )}

      <section className="action-stack">
        <button className="ghost-button" type="button" onClick={onCancel}>
          {canUseOnline ? "Cancelar busca" : "Voltar aos modos"}
        </button>
      </section>
    </main>
  );
}
