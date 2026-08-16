import { describe, expect, it } from "vitest";
import {
  appendChatMessage,
  canSendChatMessage,
  CHAT_MAX_MESSAGES,
  CHAT_MAX_LENGTH,
  isChatAvailableForMode,
  parseChatMuted,
  shouldIncrementUnread,
  validateChatText,
  type ChatMessage
} from "./chat";

describe("chat da partida", () => {
  it("aceita mensagem valida e remove espacos extras", () => {
    expect(validateChatText("  Boa   partida!  ")).toEqual({ valid: true, text: "Boa partida!" });
  });

  it("rejeita mensagem vazia", () => {
    expect(validateChatText("   ")).toMatchObject({
      valid: false,
      message: "Digite uma mensagem antes de enviar."
    });
  });

  it("rejeita mensagem acima de 120 caracteres", () => {
    expect(validateChatText("a".repeat(CHAT_MAX_LENGTH + 1))).toMatchObject({
      valid: false,
      message: "Use no máximo 120 caracteres."
    });
  });

  it("aplica cooldown de uma mensagem por segundo", () => {
    expect(canSendChatMessage(2_000, null)).toBe(true);
    expect(canSendChatMessage(2_500, 2_000)).toBe(false);
    expect(canSendChatMessage(3_000, 2_000)).toBe(true);
  });

  it("mantem apenas as ultimas 50 mensagens", () => {
    const messages = Array.from({ length: CHAT_MAX_MESSAGES + 3 }, (_, index) =>
      message(`msg-${index}`, index === 0 ? "primeira" : `Mensagem ${index}`)
    ).reduce<ChatMessage[]>((current, item) => appendChatMessage(current, item), []);

    expect(messages).toHaveLength(CHAT_MAX_MESSAGES);
    expect(messages[0].id).toBe("msg-3");
  });

  it("controla indicador de mensagem nova respeitando silenciar", () => {
    const incoming = message("msg-1", "Oi", "black");

    expect(shouldIncrementUnread({ isChatOpen: false, muted: false, message: incoming, viewer: "red" })).toBe(true);
    expect(shouldIncrementUnread({ isChatOpen: true, muted: false, message: incoming, viewer: "red" })).toBe(false);
    expect(shouldIncrementUnread({ isChatOpen: false, muted: true, message: incoming, viewer: "red" })).toBe(false);
    expect(shouldIncrementUnread({ isChatOpen: false, muted: false, message: incoming, viewer: "black" })).toBe(false);
  });

  it("carrega preferencia de chat silenciado", () => {
    expect(parseChatMuted("true")).toBe(true);
    expect(parseChatMuted("false")).toBe(false);
    expect(parseChatMuted(null)).toBe(false);
  });

  it("nao disponibiliza chat no modo contra a maquina", () => {
    expect(isChatAvailableForMode("online")).toBe(true);
    expect(isChatAvailableForMode("solo")).toBe(false);
  });
});

function message(id: string, text: string, sender: ChatMessage["sender"] = "red"): ChatMessage {
  return {
    id,
    sender,
    senderName: sender === "red" ? "Wesley" : "Denilma",
    text,
    sentAt: Date.now()
  };
}
