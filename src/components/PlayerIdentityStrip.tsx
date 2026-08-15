import type { Player } from "../game/types";
import { playerColorLine } from "../playerIdentity/playerLabels";

type PlayerIdentityStripProps = {
  redName: string;
  blackName: string;
  currentPlayer?: Player;
  extra?: string | null;
};

export function PlayerIdentityStrip({ redName, blackName, currentPlayer, extra }: PlayerIdentityStripProps) {
  return (
    <section className="status-strip player-identity-strip" aria-live="polite">
      <span className={`player-chip red ${currentPlayer === "red" ? "active-player" : ""}`}>
        {playerColorLine(redName, "red")}
      </span>
      <span className={`player-chip black ${currentPlayer === "black" ? "active-player" : ""}`}>
        {playerColorLine(blackName, "black")}
      </span>
      {extra && <span className="status-note">{extra}</span>}
    </section>
  );
}
