import { useMemo, useState } from "react";
import { getReactionAsset, REACTION_OPTIONS } from "../feedback/feedback";
import type { ReactionValue } from "../multiplayer/types";

type ReactionControlsProps = {
  cooldownUntil: number;
  onReaction: (reaction: ReactionValue) => boolean;
};

export function ReactionControls({ cooldownUntil, onReaction }: ReactionControlsProps) {
  const [open, setOpen] = useState(false);
  const remaining = useMemo(() => Math.max(0, cooldownUntil - Date.now()), [cooldownUntil]);
  const disabled = cooldownUntil > Date.now();
  const triggerAsset = getReactionAsset("smile");

  function send(reaction: ReactionValue) {
    const accepted = onReaction(reaction);
    if (accepted) setOpen(false);
  }

  return (
    <div className="reaction-control">
      <button
        className="round-tool-button reaction-trigger-button"
        type="button"
        disabled={disabled && !open}
        aria-expanded={open}
        aria-label="Abrir emotes"
        onClick={() => setOpen((current) => !current)}
      >
        <img src={triggerAsset.src} alt="" aria-hidden="true" draggable={false} />
      </button>
      {open && (
        <div className="reaction-menu" role="menu" aria-label="Reações rápidas">
          {REACTION_OPTIONS.map((reaction) => {
            const asset = getReactionAsset(reaction);

            return (
              <button
                key={reaction}
                type="button"
                role="menuitem"
                disabled={disabled}
                aria-label={asset.label}
                title={asset.label}
                onClick={() => send(reaction)}
              >
                <img src={asset.src} alt="" aria-hidden="true" draggable={false} />
              </button>
            );
          })}
          {disabled && <span className="cooldown-note">{Math.ceil(remaining / 1000)}s</span>}
        </div>
      )}
    </div>
  );
}
