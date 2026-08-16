import { describe, expect, it, vi } from "vitest";
import {
  applyCasualMatch,
  assignCasualColors,
  cancelCasualQueue,
  casualMatchUsesNormalRoomFeatures,
  CASUAL_PLAYER_KEY_STORAGE_KEY,
  createCasualQueueEntry,
  findCasualOpponent,
  getOrCreateCasualPlayerKey,
  isCasualEntryExpired,
  refreshCasualQueueEntry,
  removeExpiredCasualEntries,
  type CasualQueueEntry
} from "./casualMatchmaking";

describe("casual matchmaking", () => {
  it("entra na fila com apelido e heartbeat", () => {
    expect(createCasualQueueEntry("a", "Wesley", 1_000)).toEqual({
      playerKey: "a",
      nickname: "Wesley",
      status: "waiting",
      createdAt: 1_000,
      heartbeatAt: 1_000
    });
  });

  it("cancela fila removendo entrada de espera", () => {
    const queue = [entry("a"), entry("b")];

    expect(cancelCasualQueue(queue, "a")).toEqual([entry("b")]);
  });

  it("expira jogador offline", () => {
    const offline = entry("a", 1_000, 1_000);
    const online = entry("b", 1_000, 30_000);

    expect(isCasualEntryExpired(offline, 32_001)).toBe(true);
    expect(removeExpiredCasualEntries([offline, online], 32_001)).toEqual([online]);
  });

  it("forma par com dois jogadores diferentes", () => {
    const queue = [entry("a", 1_000), entry("b", 2_000)];

    expect(findCasualOpponent(queue, "b", 2_500)?.playerKey).toBe("a");
  });

  it("terceiro jogador nao entra no mesmo par", () => {
    const queue = applyCasualMatch([entry("a"), entry("b"), entry("c")], "b", "a", "room-1", assignCasualColors(0), 2_000);

    expect(queue.filter((item) => item.roomId === "room-1")).toHaveLength(2);
    expect(queue.find((item) => item.playerKey === "c")?.status).toBe("waiting");
  });

  it("jogador nao pareia consigo mesmo", () => {
    expect(findCasualOpponent([entry("a")], "a", 2_000)).toBeNull();
  });

  it("atribui cores corretamente", () => {
    expect(assignCasualColors(2)).toEqual({ currentPlayer: "red", opponentPlayer: "black" });
    expect(assignCasualColors(3)).toEqual({ currentPlayer: "black", opponentPlayer: "red" });
  });

  it("registra sala apos pareamento e remove ambos da fila de espera", () => {
    const queue = applyCasualMatch([entry("a"), entry("b")], "b", "a", "room-1", assignCasualColors(3), 2_000);

    expect(queue.every((item) => item.status === "matched")).toBe(true);
    expect(queue.map((item) => item.roomId)).toEqual(["room-1", "room-1"]);
    expect(queue.find((item) => item.playerKey === "b")?.player).toBe("black");
    expect(queue.find((item) => item.playerKey === "a")?.player).toBe("red");
  });

  it("concorrencia simples preserva um unico par", () => {
    const queue = applyCasualMatch([entry("a"), entry("b"), entry("c")], "b", "a", "room-1", assignCasualColors(0), 2_000);
    const nextOpponent = findCasualOpponent(queue, "c", 2_100);

    expect(nextOpponent).toBeNull();
  });

  it("bloqueia entrada duplicada atualizando heartbeat existente", () => {
    const first = createCasualQueueEntry("a", "Wesley", 1_000);
    const refreshed = refreshCasualQueueEntry(first, "Wesley B", 2_000);

    expect(refreshed.playerKey).toBe(first.playerKey);
    expect(refreshed.createdAt).toBe(first.createdAt);
    expect(refreshed.heartbeatAt).toBe(2_000);
    expect(refreshed.nickname).toBe("Wesley B");
  });

  it("usa sala normal do multiplayer com chat e reacoes apos match", () => {
    expect(casualMatchUsesNormalRoomFeatures()).toEqual(
      expect.arrayContaining(["rooms", "room_players", "submit-move", "realtime", "presence", "chat", "reactions"])
    );
  });

  it("mantem chave local do jogador casual", () => {
    const storage = createStorage();
    const randomUUID = vi.spyOn(crypto, "randomUUID").mockReturnValue("11111111-1111-4111-8111-111111111111");

    expect(getOrCreateCasualPlayerKey(storage)).toBe("11111111-1111-4111-8111-111111111111");
    expect(storage.getItem(CASUAL_PLAYER_KEY_STORAGE_KEY)).toBe("11111111-1111-4111-8111-111111111111");
    expect(getOrCreateCasualPlayerKey(storage)).toBe("11111111-1111-4111-8111-111111111111");

    randomUUID.mockRestore();
  });
});

function entry(playerKey: string, createdAt = 1_000, heartbeatAt = createdAt): CasualQueueEntry {
  return {
    playerKey,
    nickname: playerKey.toUpperCase(),
    status: "waiting",
    createdAt,
    heartbeatAt
  };
}

function createStorage(): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
}
