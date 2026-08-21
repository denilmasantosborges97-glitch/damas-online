import { describe, expect, it } from "vitest";
import { loadRoomSession, ROOM_SESSION_STORAGE_KEY, saveRoomSession } from "./roomSessionStorage";
import type { PlayerSession } from "./types";

describe("armazenamento local da sessao da sala", () => {
  it("salva e carrega sessao pelo codigo publico", () => {
    const storage = createStorage();
    const session: PlayerSession = {
      roomId: "room-1",
      code: "47aa2",
      player: "red",
      token: "token-privado",
      matchMode: "casual"
    };

    saveRoomSession(session, storage);

    expect(storage.getItem(ROOM_SESSION_STORAGE_KEY)).toContain("token-privado");
    expect(loadRoomSession("47AA2", storage)).toEqual({
      roomId: "room-1",
      code: "47AA2",
      player: "red",
      token: "token-privado",
      matchMode: "casual"
    });
  });
});

function createStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    }
  };
}
