import { useState } from "react";
import type { FeedbackSettings } from "../feedback/feedback";

type FeedbackSettingsButtonProps = {
  settings: FeedbackSettings;
  onSoundChange: (enabled: boolean) => void;
  onVibrationChange: (enabled: boolean) => void;
  onReduceMotionChange: (enabled: boolean) => void;
};

export function FeedbackSettingsButton({
  settings,
  onSoundChange,
  onVibrationChange,
  onReduceMotionChange
}: FeedbackSettingsButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="settings-control">
      <button
        className="round-tool-button"
        type="button"
        aria-label="Abrir configurações"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        ⚙
      </button>
      {open && (
        <div className="settings-menu" aria-label="Configurações da partida">
          <label>
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(event) => onSoundChange(event.currentTarget.checked)}
            />
            Sons
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.vibrationEnabled}
              onChange={(event) => onVibrationChange(event.currentTarget.checked)}
            />
            Vibração
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.reduceMotion}
              onChange={(event) => onReduceMotionChange(event.currentTarget.checked)}
            />
            Reduzir animações
          </label>
        </div>
      )}
    </div>
  );
}
