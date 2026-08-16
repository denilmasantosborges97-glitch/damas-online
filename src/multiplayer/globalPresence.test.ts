import { describe, expect, it } from "vitest";
import {
  countUniquePresenceUsers,
  formatOnlineCount,
  formatOnlineCountState,
  getOrCreateGlobalPresenceKey,
  GLOBAL_ONLINE_CLIENT_KEY_STORAGE_KEY,
  loadingOnlineCount
} from "./globalPresence";

describe("presenca global online", () => {
  it("conta entrada de um usuario na presenca", () => {
    expect(countUniquePresenceUsers({ "online-a": [{ online: true }] })).toBe(1);
  });

  it("conta saida quando a presenca fica vazia", () => {
    expect(countUniquePresenceUsers({})).toBe(0);
  });

  it("conta multiplos usuarios", () => {
    expect(
      countUniquePresenceUsers({
        "online-a": [{ online: true }],
        "online-b": [{ online: true }],
        "online-c": [{ online: true }]
      })
    ).toBe(3);
  });

  it("evita duplicacao quando a mesma chave tem mais de uma presenca", () => {
    expect(
      countUniquePresenceUsers({
        "online-a": [{ online: true }, { online: true }]
      })
    ).toBe(1);
  });

  it("formata singular e plural", () => {
    expect(formatOnlineCount(1)).toBe("1 jogador online");
    expect(formatOnlineCount(8)).toBe("8 online agora");
  });

  it("formata estado carregando", () => {
    expect(formatOnlineCountState(loadingOnlineCount)).toBe("Verificando jogadores online...");
  });

  it("reutiliza a chave anonima salva no dispositivo", () => {
    const storage = new MemoryStorage();
    const first = getOrCreateGlobalPresenceKey(storage);
    const second = getOrCreateGlobalPresenceKey(storage);

    expect(first).toBe(second);
    expect(storage.getItem(GLOBAL_ONLINE_CLIENT_KEY_STORAGE_KEY)).toBe(first);
  });
});

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
