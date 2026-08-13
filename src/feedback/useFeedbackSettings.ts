import { useEffect, useMemo, useState } from "react";
import { createDefaultFeedbackSettings, normalizeFeedbackSettings, type FeedbackSettings } from "./feedback";

const STORAGE_KEY = "damas-feedback-settings";

export function useFeedbackSettings() {
  const prefersReducedMotion = useMemo(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    []
  );
  const [settings, setSettings] = useState<FeedbackSettings>(() =>
    normalizeFeedbackSettings(readStoredSettings(), prefersReducedMotion)
  );

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  function updateSetting<Key extends keyof FeedbackSettings>(key: Key, value: FeedbackSettings[Key]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  return {
    settings,
    setSoundEnabled: (enabled: boolean) => updateSetting("soundEnabled", enabled),
    setVibrationEnabled: (enabled: boolean) => updateSetting("vibrationEnabled", enabled),
    setReduceMotion: (enabled: boolean) => updateSetting("reduceMotion", enabled)
  };
}

function readStoredSettings(): Partial<FeedbackSettings> | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Partial<FeedbackSettings>) : null;
  } catch {
    return createDefaultFeedbackSettings(false);
  }
}
