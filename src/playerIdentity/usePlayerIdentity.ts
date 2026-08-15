import { useCallback, useMemo, useState } from "react";
import {
  loadPlayerIdentity,
  savePlayerIdentity,
  validateNickname,
  type NicknameValidation,
  type StoredPlayerIdentity
} from "./identity";

export function usePlayerIdentity() {
  const [identity, setIdentity] = useState<StoredPlayerIdentity | null>(() => loadPlayerIdentity());

  const saveNickname = useCallback(
    (value: string): NicknameValidation => {
      const result = savePlayerIdentity(value, undefined, identity);
      if (result.valid) {
        setIdentity(loadPlayerIdentity());
      }
      return result;
    },
    [identity]
  );

  return useMemo(
    () => ({
      identity,
      nickname: identity?.nickname ?? null,
      saveNickname,
      validateNickname
    }),
    [identity, saveNickname]
  );
}
