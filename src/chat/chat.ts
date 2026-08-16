import type { Player } from "../game/types";

export const CHAT_MAX_LENGTH = 120;
export const CHAT_MAX_MESSAGES = 50;
export const CHAT_COOLDOWN_MS = 1_000;
export const CHAT_MUTED_STORAGE_KEY = "damas-chat-muted-v1";

export type ChatMessage = {
  id: string;
  sender: Player;
  senderName: string;
  text: string;
  sentAt: number;
};

export type ChatValidation =
  | { valid: true; text: string }
  | { valid: false; text: string; message: string };

export function normalizeChatText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function validateChatText(value: string): ChatValidation {
  const text = normalizeChatText(value);

  if (!text) {
    return { valid: false, text, message: "Digite uma mensagem antes de enviar." };
  }

  if (text.length > CHAT_MAX_LENGTH) {
    return { valid: false, text, message: `Use no máximo ${CHAT_MAX_LENGTH} caracteres.` };
  }

  return { valid: true, text };
}

export function canSendChatMessage(now: number, lastSentAt: number | null): boolean {
  return lastSentAt === null || now - lastSentAt >= CHAT_COOLDOWN_MS;
}

export function appendChatMessage(messages: ChatMessage[], message: ChatMessage): ChatMessage[] {
  if (messages.some((item) => item.id === message.id)) return messages;
  return [...messages, message].slice(-CHAT_MAX_MESSAGES);
}

export function shouldIncrementUnread(input: {
  isChatOpen: boolean;
  muted: boolean;
  message: ChatMessage;
  viewer: Player;
}): boolean {
  return !input.isChatOpen && !input.muted && input.message.sender !== input.viewer;
}

export function isChatAvailableForMode(mode: "online" | "solo"): boolean {
  return mode === "online";
}

export function parseChatMuted(value: string | null): boolean {
  return value === "true";
}
