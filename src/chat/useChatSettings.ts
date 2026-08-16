import { useEffect, useState } from "react";
import { CHAT_MUTED_STORAGE_KEY, parseChatMuted } from "./chat";

export function useChatSettings() {
  const [muted, setMuted] = useState(() => readMutedSetting());

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAT_MUTED_STORAGE_KEY, String(muted));
    } catch {
      // A preferência segue ativa em memória quando o armazenamento local está indisponível.
    }
  }, [muted]);

  return {
    muted,
    setMuted
  };
}

function readMutedSetting(): boolean {
  try {
    return parseChatMuted(window.localStorage.getItem(CHAT_MUTED_STORAGE_KEY));
  } catch {
    return false;
  }
}
