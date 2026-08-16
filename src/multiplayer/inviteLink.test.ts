import { describe, expect, it, vi } from "vitest";
import {
  createRoomInviteLink,
  inviteErrorMessage,
  planInviteEntry,
  readRoomCodeFromUrl,
  readRoomInviteFromUrl,
  shareRoomInvite
} from "./inviteLink";
import type { PlayerSession } from "./types";

describe("convite de sala por link", () => {
  it("gera link usando apenas o codigo publico da sala", () => {
    const link = createRoomInviteLink("47aa2", {
      origin: "https://damas-online.vercel.app",
      pathname: "/"
    });

    expect(link).toBe("https://damas-online.vercel.app/?room=47AA2");
    expect(link).not.toContain("player_token");
    expect(link).not.toContain("service_role");
  });

  it("le codigo room valido da URL", () => {
    expect(readRoomCodeFromUrl("https://damas-online.vercel.app/?room=47aa2")).toBe("47AA2");
    expect(readRoomInviteFromUrl("https://damas-online.vercel.app/?room=47aa2")).toEqual({
      status: "valid",
      code: "47AA2"
    });
  });

  it("marca codigo invalido na URL", () => {
    expect(readRoomCodeFromUrl("https://damas-online.vercel.app/?room=***")).toBeNull();
    expect(readRoomInviteFromUrl("https://damas-online.vercel.app/?room=***")).toEqual({ status: "invalid" });
  });

  it("planeja entrada automatica pelo fluxo normal de join_room", () => {
    expect(
      planInviteEntry({
        code: "47AA2",
        nickname: "Wesley",
        currentSession: null,
        hasCurrentRoom: false,
        storedSession: null
      })
    ).toEqual({ action: "join_room", code: "47AA2" });
  });

  it("aguarda apelido antes da entrada automatica", () => {
    expect(
      planInviteEntry({
        code: "47AA2",
        nickname: null,
        currentSession: null,
        hasCurrentRoom: false,
        storedSession: null
      })
    ).toEqual({ action: "wait_for_nickname", code: "47AA2" });
  });

  it("trata sala invalida ou expirada como indisponivel", () => {
    expect(inviteErrorMessage("unavailable")).toBe("Esta sala não está mais disponível.");
  });

  it("trata sala completa com mensagem propria", () => {
    expect(inviteErrorMessage("full")).toBe("Esta sala já está completa.");
  });

  it("reconhece criador abrindo o proprio link no mesmo dispositivo", () => {
    const session = makeSession("47AA2", "red");

    expect(
      planInviteEntry({
        code: "47AA2",
        nickname: "Wesley",
        currentSession: session,
        hasCurrentRoom: true,
        storedSession: null
      })
    ).toEqual({ action: "already_in_room", session });
  });

  it("reabre sessao local salva antes de tentar criar segundo jogador", () => {
    const session = makeSession("47AA2", "red");

    expect(
      planInviteEntry({
        code: "47AA2",
        nickname: "Wesley",
        currentSession: null,
        hasCurrentRoom: false,
        storedSession: session
      })
    ).toEqual({ action: "resume_local_session", session });
  });

  it("usa Web Share API quando disponivel", async () => {
    const share = vi.fn().mockResolvedValue(undefined);

    await expect(shareRoomInvite("https://damas-online.vercel.app/?room=47AA2", { share })).resolves.toEqual({
      status: "shared"
    });
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Damas Online",
        url: "https://damas-online.vercel.app/?room=47AA2"
      })
    );
  });

  it("copia link quando Web Share API nao existe", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(
      shareRoomInvite("https://damas-online.vercel.app/?room=47AA2", { clipboard: { writeText } })
    ).resolves.toEqual({ status: "copied" });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("https://damas-online.vercel.app/?room=47AA2"));
  });

  it("informa indisponibilidade quando nao ha share nem clipboard", async () => {
    await expect(shareRoomInvite("https://damas-online.vercel.app/?room=47AA2", {})).resolves.toMatchObject({
      status: "unsupported"
    });
  });
});

function makeSession(code: string, player: PlayerSession["player"]): PlayerSession {
  return {
    roomId: "room-1",
    code,
    player,
    token: "token-1"
  };
}
