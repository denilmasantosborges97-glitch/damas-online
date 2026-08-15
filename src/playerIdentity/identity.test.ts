import { describe, expect, it } from "vitest";
import {
  PLAYER_IDENTITY_STORAGE_KEY,
  loadPlayerIdentity,
  savePlayerIdentity,
  validateNickname
} from "./identity";

describe("identidade do jogador", () => {
  it("aceita apelido valido", () => {
    expect(validateNickname(" Wesley_7 ").valid).toBe(true);
    expect(validateNickname(" Wesley_7 ")).toMatchObject({ nickname: "Wesley_7" });
  });

  it("rejeita apelido curto demais", () => {
    expect(validateNickname("We")).toMatchObject({
      valid: false,
      message: "O apelido precisa ter pelo menos 3 caracteres."
    });
  });

  it("rejeita apelido longo demais", () => {
    expect(validateNickname("JogadorComNomeGigante")).toMatchObject({
      valid: false,
      message: "Use no máximo 16 caracteres no apelido."
    });
  });

  it("rejeita caracteres invalidos", () => {
    expect(validateNickname("Wesley!")).toMatchObject({
      valid: false,
      message: "Use apenas letras, números, espaço, hífen ou underscore."
    });
  });

  it("salva e carrega o apelido no armazenamento local", () => {
    const storage = createStorage();

    const result = savePlayerIdentity(" Denilma-10 ", storage);
    const stored = storage.getItem(PLAYER_IDENTITY_STORAGE_KEY);

    expect(result).toMatchObject({ valid: true, nickname: "Denilma-10" });
    expect(stored).toContain("Denilma-10");
    expect(loadPlayerIdentity(storage)).toMatchObject({ nickname: "Denilma-10" });
  });

  it("edita apelido preservando a identidade local", () => {
    const storage = createStorage();

    savePlayerIdentity("Wesley", storage);
    const first = loadPlayerIdentity(storage);
    savePlayerIdentity("Wesley Jr", storage, first);
    const edited = loadPlayerIdentity(storage);

    expect(edited?.nickname).toBe("Wesley Jr");
    expect(edited?.createdAt).toBe(first?.createdAt);
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
