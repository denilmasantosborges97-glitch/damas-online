import { useCallback, useEffect, useRef, type MutableRefObject } from "react";

type SoundKind = "move" | "capture";
type VibrationKind = "turn" | "capture";

export function useFeedbackEffects(soundEnabled: boolean, vibrationEnabled: boolean) {
  const audioContext = useRef<AudioContext | null>(null);
  const unlocked = useRef(false);

  useEffect(() => {
    function unlockAudio() {
      unlocked.current = true;
      const context = getAudioContext(audioContext);
      void context?.resume();
    }

    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio);

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  const playSound = useCallback(
    (kind: SoundKind) => {
      if (!soundEnabled || !unlocked.current) return;

      const context = getAudioContext(audioContext);
      if (!context) return;

      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = kind === "capture" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(kind === "capture" ? 220 : 430, now);
      oscillator.frequency.exponentialRampToValueAtTime(kind === "capture" ? 120 : 520, now + 0.08);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(kind === "capture" ? 0.075 : 0.045, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "capture" ? 0.13 : 0.08));

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + (kind === "capture" ? 0.14 : 0.09));
    },
    [soundEnabled]
  );

  const vibrate = useCallback(
    (kind: VibrationKind) => {
      if (!vibrationEnabled || !("vibrate" in navigator)) return;
      navigator.vibrate(kind === "capture" ? [18, 30, 28] : 22);
    },
    [vibrationEnabled]
  );

  return {
    playMoveSound: () => playSound("move"),
    playCaptureSound: () => playSound("capture"),
    vibrateTurn: () => vibrate("turn"),
    vibrateCapture: () => vibrate("capture")
  };
}

function getAudioContext(ref: MutableRefObject<AudioContext | null>): AudioContext | null {
  if (ref.current) return ref.current;

  const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  const AudioContextConstructor = window.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextConstructor) return null;

  ref.current = new AudioContextConstructor();
  return ref.current;
}
