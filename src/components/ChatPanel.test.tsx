import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../chat/chat";
import { ChatPanel } from "./ChatPanel";

describe("ChatPanel", () => {
  it("renderiza apelido em cada mensagem", () => {
    const html = renderPanel([message("msg-1", "Boa partida!", "black", "Denilma")]);

    expect(html).toContain("Denilma");
    expect(html).toContain("Boa partida!");
  });

  it("renderiza mensagem como texto puro", () => {
    const html = renderPanel([message("msg-1", "<script>alert(1)</script>", "black", "Denilma")]);

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});

function renderPanel(messages: ChatMessage[]): string {
  return renderToStaticMarkup(
    <ChatPanel
      messages={messages}
      viewer="red"
      playerNames={{ red: "Wesley", black: "Denilma" }}
      muted={false}
      canSend
      onSend={() => ({ ok: true })}
      onMutedChange={() => undefined}
      onClose={() => undefined}
    />
  );
}

function message(id: string, text: string, sender: ChatMessage["sender"], senderName: string): ChatMessage {
  return {
    id,
    sender,
    senderName,
    text,
    sentAt: Date.now()
  };
}
