import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlayerIdentityStrip } from "./PlayerIdentityStrip";

describe("PlayerIdentityStrip", () => {
  it("renderiza apelido no modo solo contra a maquina", () => {
    const html = renderToStaticMarkup(
      <PlayerIdentityStrip redName="Wesley" blackName="Computador" currentPlayer="red" />
    );

    expect(html).toContain("Wesley · Vermelhas");
    expect(html).toContain("Computador · Pretas");
  });

  it("renderiza apelidos da sala multiplayer quando disponiveis", () => {
    const html = renderToStaticMarkup(
      <PlayerIdentityStrip redName="Wesley" blackName="Denilma" currentPlayer="black" extra="Sincronizando..." />
    );

    expect(html).toContain("Wesley · Vermelhas");
    expect(html).toContain("Denilma · Pretas");
    expect(html).toContain("Sincronizando...");
  });
});
