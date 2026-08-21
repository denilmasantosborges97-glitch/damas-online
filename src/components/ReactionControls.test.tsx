import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReactionControls } from "./ReactionControls";

describe("ReactionControls", () => {
  it("renderiza o botao de reacoes com emoji personalizado local", () => {
    const html = renderToStaticMarkup(<ReactionControls cooldownUntil={0} onReaction={() => true} />);

    expect(html).toContain("/reactions/sorrir.png");
    expect(html).toContain("Abrir emotes");
  });
});
