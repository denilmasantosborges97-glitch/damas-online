import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ModesScreen } from "./ModesScreen";

describe("ModesScreen", () => {
  it("renderiza estado carregando do contador online", () => {
    const html = renderModes({ status: "loading", count: null });

    expect(html).toContain("Verificando jogadores online...");
  });

  it("renderiza contador online singular", () => {
    const html = renderModes({ status: "ready", count: 1 });

    expect(html).toContain("1 jogador online");
  });

  it("renderiza contador online plural", () => {
    const html = renderModes({ status: "ready", count: 12 });

    expect(html).toContain("12 online agora");
  });

  it("renderiza estado de visitante no menu", () => {
    const html = renderModes({ status: "ready", count: 1 });

    expect(html).toContain("Jogando como:");
    expect(html).toContain("Visitante");
    expect(html).toContain("Perfil");
  });
});

function renderModes(onlineCount: Parameters<typeof ModesScreen>[0]["onlineCount"]): string {
  return renderToStaticMarkup(
    <ModesScreen
      playerName="Wesley"
      accountStatus="guest"
      onlineCount={onlineCount}
      onOpenProfile={() => undefined}
      onFriend={() => undefined}
      onComputer={() => undefined}
      onCasual={() => undefined}
    />
  );
}
