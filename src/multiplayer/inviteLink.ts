import type { PlayerSession } from "./types";

export const ROOM_QUERY_PARAM = "room";
export const ROOM_CODE_PATTERN = /^[A-Z0-9]{5}$/;
export const INVITE_SHARE_TEXT =
  "🎮 Te desafio para uma partida de Damas Online! Toque no link para entrar na minha sala.";

export type InviteJoinErrorKind = "full" | "unavailable";
export type RoomInviteRequest =
  | { status: "none" }
  | { status: "valid"; code: string }
  | { status: "invalid" };

type NavigatorWithShare = Pick<Navigator, "share"> & {
  clipboard?: Pick<Clipboard, "writeText">;
};

export type ShareInviteResult =
  | { status: "shared" }
  | { status: "copied" }
  | { status: "unsupported"; message: string };

export type InviteEntryPlan =
  | { action: "invalid" }
  | { action: "wait_for_nickname"; code: string }
  | { action: "already_in_room"; session: PlayerSession }
  | { action: "resume_local_session"; session: PlayerSession }
  | { action: "join_room"; code: string };

export function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidRoomCode(value: string): boolean {
  return ROOM_CODE_PATTERN.test(normalizeRoomCode(value));
}

export function readRoomCodeFromUrl(url: string | URL): string | null {
  const request = readRoomInviteFromUrl(url);
  return request.status === "valid" ? request.code : null;
}

export function readRoomInviteFromUrl(url: string | URL): RoomInviteRequest {
  const parsed = typeof url === "string" ? new URL(url, "https://damas-online.local") : url;
  const value = parsed.searchParams.get(ROOM_QUERY_PARAM);
  if (value === null) return { status: "none" };

  const code = normalizeRoomCode(value);
  return ROOM_CODE_PATTERN.test(code) ? { status: "valid", code } : { status: "invalid" };
}

export function createRoomInviteLink(
  code: string,
  locationLike: Pick<Location, "origin" | "pathname"> = window.location
): string {
  const normalized = normalizeRoomCode(code);
  const url = new URL(locationLike.pathname || "/", locationLike.origin);
  url.searchParams.set(ROOM_QUERY_PARAM, normalized);
  return url.toString();
}

export function planInviteEntry(input: {
  code: string;
  nickname: string | null;
  currentSession: PlayerSession | null;
  hasCurrentRoom: boolean;
  storedSession: PlayerSession | null;
}): InviteEntryPlan {
  const code = normalizeRoomCode(input.code);
  if (!isValidRoomCode(code)) return { action: "invalid" };
  if (!input.nickname) return { action: "wait_for_nickname", code };

  if (input.currentSession?.code === code && input.hasCurrentRoom) {
    return { action: "already_in_room", session: input.currentSession };
  }

  if (input.storedSession?.code === code) {
    return { action: "resume_local_session", session: input.storedSession };
  }

  return { action: "join_room", code };
}

export function canUseWebShare(navigatorLike: Partial<NavigatorWithShare> = navigator): boolean {
  return typeof navigatorLike.share === "function";
}

export async function shareRoomInvite(
  link: string,
  navigatorLike: Partial<NavigatorWithShare> = navigator
): Promise<ShareInviteResult> {
  if (canUseWebShare(navigatorLike)) {
    await navigatorLike.share?.({
      title: "Damas Online",
      text: INVITE_SHARE_TEXT,
      url: link
    });
    return { status: "shared" };
  }

  if (typeof navigatorLike.clipboard?.writeText === "function") {
    await navigatorLike.clipboard.writeText(`${INVITE_SHARE_TEXT} ${link}`);
    return { status: "copied" };
  }

  return {
    status: "unsupported",
    message: "Não foi possível compartilhar neste navegador. Copie o link manualmente."
  };
}

export function classifyInviteJoinError(error: unknown): InviteJoinErrorKind {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

  if (normalized.includes("dois jogadores") || normalized.includes("sala ja tem") || normalized.includes("sala completa")) {
    return "full";
  }

  return "unavailable";
}

export function inviteErrorMessage(kind: InviteJoinErrorKind): string {
  return kind === "full" ? "Esta sala já está completa." : "Esta sala não está mais disponível.";
}
