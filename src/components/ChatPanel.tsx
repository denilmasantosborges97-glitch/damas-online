import { FormEvent, useEffect, useRef, useState } from "react";
import { CHAT_MAX_LENGTH, type ChatMessage } from "../chat/chat";
import type { Player } from "../game/types";
import { playerNameFor, type PlayerNames } from "../playerIdentity/playerLabels";

type ChatPanelProps = {
  messages: ChatMessage[];
  viewer: Player;
  playerNames: PlayerNames;
  muted: boolean;
  canSend: boolean;
  onSend: (text: string) => { ok: true } | { ok: false; message: string };
  onMutedChange: (muted: boolean) => void;
  onClose: () => void;
};

export function ChatPanel({
  messages,
  viewer,
  playerNames,
  muted,
  canSend,
  onSend,
  onMutedChange,
  onClose
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const result = onSend(draft);
    if (result.ok) {
      setDraft("");
    } else {
      setError(result.message);
    }
  }

  return (
    <section className="chat-panel" aria-label="Chat da partida">
      <div className="chat-header">
        <div>
          <strong>Chat</strong>
          <span>{muted ? "Silenciado" : "Mensagens da sala"}</span>
        </div>
        <button className="icon-button chat-close" type="button" onClick={onClose} aria-label="Fechar chat">
          Fechar
        </button>
      </div>

      <label className="chat-muted-toggle">
        <input type="checkbox" checked={muted} onChange={(event) => onMutedChange(event.target.checked)} />
        Silenciar chat
      </label>

      <div className="chat-messages" ref={listRef} aria-live={muted ? "off" : "polite"}>
        {messages.length === 0 ? (
          <p className="chat-empty">Nenhuma mensagem ainda.</p>
        ) : (
          messages.map((message) => (
            <article key={message.id} className={`chat-message ${message.sender === viewer ? "own" : "opponent"}`}>
              <strong>{playerNameFor(message.sender, playerNames, message.senderName || "Adversário")}</strong>
              <p>{message.text}</p>
            </article>
          ))
        )}
      </div>

      <form className="chat-form" onSubmit={submit}>
        <input
          aria-label="Digite uma mensagem"
          disabled={!canSend}
          maxLength={CHAT_MAX_LENGTH + 8}
          placeholder="Digite uma mensagem..."
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
        />
        <button className="primary-button compact chat-send-button" type="submit" disabled={!canSend}>
          Enviar
        </button>
      </form>

      {!canSend && <p className="chat-note">Chat disponível apenas durante a partida.</p>}
      {error && <p className="chat-error">{error}</p>}
    </section>
  );
}
