import { useMemo, useState } from "react";
import { REACTION_OPTIONS } from "../feedback/feedback";
import type { ReactionValue } from "../multiplayer/types";

type ReactionControlsProps = {
  cooldownUntil: number;
  onReaction: (reaction: ReactionValue) => boolean;
};

export function ReactionControls({ cooldownUntil, onReaction }: ReactionControlsProps) {
  const [open, setOpen] = useState(false);
  const remaining = useMemo(() => Math.max(0, cooldownUntil - Date.now()), [cooldownUntil]);
  const disabled = cooldownUntil > Date.now();

  function send(reaction: ReactionValue) {
    const accepted = onReaction(reaction);
    if (accepted) setOpen(false);
  }

  return (
    <div className="reaction-control">
      <button
        className="round-tool-button"
        type="button"
        disabled={disabled && !open}
        aria-expanded={open}
        aria-label="Abrir reações"
        onClick={() => setOpen((current) => !current)}
      >
        +
      </button>
      {open && (
        <div className="reaction-menu" role="menu" aria-label="Reações rápidas">
          {REACTION_OPTIONS.map((reaction) => (
            <button
              key={reaction}
              type="button"
              role="menuitem"
              disabled={disabled}
              onClick={() => send(reaction)}
            >
              {reaction}
            </button>
          ))}
          {disabled && <span className="cooldown-note">{Math.ceil(remaining / 1000)}s</span>}
        </div>
      )}
    </div>
  );
}
