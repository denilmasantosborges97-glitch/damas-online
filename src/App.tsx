import { useEffect, useMemo, useRef, useState } from "react";
import { choosePlayerColor, type AiDifficulty, type ColorChoice } from "./ai/checkersAi";
import { CasualMatchScreen } from "./components/CasualMatchScreen";
import { GameScreen } from "./components/GameScreen";
import { Lobby } from "./components/Lobby";
import { ModesScreen } from "./components/ModesScreen";
import { NicknameForm } from "./components/NicknameForm";
import { SoloGameScreen } from "./components/SoloGameScreen";
import { SoloSetupScreen } from "./components/SoloSetupScreen";
import type { Player } from "./game/types";
import { inviteErrorMessage, readRoomInviteFromUrl } from "./multiplayer/inviteLink";
import { useGlobalOnlineCount } from "./multiplayer/useGlobalOnlineCount";
import { useRoom } from "./multiplayer/useRoom";
import { usePlayerIdentity } from "./playerIdentity/usePlayerIdentity";

type AppScreen = "modes" | "friend" | "solo-setup" | "solo-game" | "casual";
type SoloConfig = {
  difficulty: AiDifficulty;
  player: Player;
};

export default function App() {
  const initialInvite = useMemo(() => readRoomInviteFromUrl(window.location.href), []);
  const playerIdentity = usePlayerIdentity();
  const onlineCount = useGlobalOnlineCount();
  const room = useRoom(playerIdentity.nickname);
  const [screen, setScreen] = useState<AppScreen>("modes");
  const [soloConfig, setSoloConfig] = useState<SoloConfig | null>(null);
  const [editingNickname, setEditingNickname] = useState(false);
  const [inviteCode, setInviteCode] = useState(initialInvite.status === "valid" ? initialInvite.code : null);
  const [inviteError, setInviteError] = useState<string | null>(
    initialInvite.status === "invalid" ? inviteErrorMessage("unavailable") : null
  );
  const [inviteJoining, setInviteJoining] = useState(false);
  const inviteAttempted = useRef(false);

  useEffect(() => {
    if (!playerIdentity.nickname || !inviteCode || room.room || inviteAttempted.current) return;

    inviteAttempted.current = true;
    setInviteJoining(true);
    void room
      .joinRoomFromInvite(inviteCode)
      .then((result) => {
        if (!result.ok) {
          setInviteError(result.message);
          setInviteCode(null);
        }
      })
      .catch(() => {
        setInviteError(inviteErrorMessage("unavailable"));
        setInviteCode(null);
      })
      .finally(() => setInviteJoining(false));
  }, [inviteCode, playerIdentity.nickname, room]);

  function clearInviteUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function returnToStart() {
    clearInviteUrl();
    setInviteCode(null);
    setInviteError(null);
    inviteAttempted.current = false;
    setSoloConfig(null);
    setScreen("modes");
  }

  function leaveRoom() {
    clearInviteUrl();
    setInviteCode(null);
    inviteAttempted.current = false;
    room.leaveRoom();
  }

  if (inviteError) {
    return <InviteStatusScreen title={inviteError} onBack={returnToStart} />;
  }

  if (!playerIdentity.nickname) {
    return (
      <main className="lobby nickname-screen">
        <section className="brand-panel" aria-label="Identidade do jogador">
          <p className="eyebrow">Damas online</p>
          <NicknameForm
            title="Como você quer aparecer no jogo?"
            description="Use um apelido curto. Não precisa ser seu nome real."
            submitLabel="Continuar"
            onSubmit={(nickname) => playerIdentity.saveNickname(nickname).valid}
          />
        </section>
      </main>
    );
  }

  if (room.room && room.session) {
    return (
      <GameScreen
        room={room.room}
        session={room.session}
        playerName={playerIdentity.nickname}
        presence={room.presence}
        disconnect={room.disconnect}
        legalMoves={room.legalMoves}
        reactionEvent={room.reactionEvent}
        moveFeedbackEvent={room.moveFeedbackEvent}
        chatMessages={room.chatMessages}
        reactionCooldownUntil={room.reactionCooldownUntil}
        busy={room.busy}
        error={room.error}
        onMove={room.playMove}
        onReaction={room.sendReaction}
        onChatMessage={room.sendChatMessage}
        onRematch={room.requestRematch}
        onDeclineRematch={room.declineRematch}
        onResign={room.resign}
        onProposeDraw={room.proposeDraw}
        onRespondDraw={room.respondToDraw}
        onLeave={leaveRoom}
      />
    );
  }

  if (inviteJoining && inviteCode) {
    return <InviteStatusScreen title="Entrando na sala..." description={`Sala ${inviteCode}`} />;
  }

  if (screen === "solo-game" && soloConfig) {
    return (
      <SoloGameScreen
        difficulty={soloConfig.difficulty}
        player={soloConfig.player}
        playerName={playerIdentity.nickname}
        onChangeSetup={() => setScreen("solo-setup")}
        onBackToModes={() => {
          setSoloConfig(null);
          setScreen("modes");
        }}
      />
    );
  }

  if (screen === "solo-setup") {
    return (
      <SoloSetupScreen
        onStart={(difficulty: AiDifficulty, colorChoice: ColorChoice) => {
          setSoloConfig({
            difficulty,
            player: choosePlayerColor(colorChoice)
          });
          setScreen("solo-game");
        }}
        onBack={() => setScreen("modes")}
      />
    );
  }

  if (screen === "friend") {
    return (
      <Lobby
        playerName={playerIdentity.nickname}
        canUseOnline={room.hasSupabaseConfig}
        busy={room.busy}
        error={room.error}
        onCreateRoom={room.createRoom}
        onJoinRoom={room.joinRoom}
        onBack={() => setScreen("modes")}
      />
    );
  }

  if (screen === "casual") {
    return (
      <CasualMatchScreen
        playerName={playerIdentity.nickname}
        canUseOnline={room.hasSupabaseConfig}
        search={room.casualSearch}
        onStart={room.startCasualSearch}
        onCancel={() => {
          void room.cancelCasualSearch();
          setScreen("modes");
        }}
      />
    );
  }

  return (
    <>
      <ModesScreen
        playerName={playerIdentity.nickname}
        onlineCount={onlineCount}
        onEditNickname={() => setEditingNickname(true)}
        onFriend={() => setScreen("friend")}
        onComputer={() => setScreen("solo-setup")}
        onCasual={() => setScreen("casual")}
      />
      {editingNickname && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Editar apelido">
          <div className="center-modal profile-modal">
            <NicknameForm
              initialNickname={playerIdentity.nickname}
              title="Editar apelido"
              submitLabel="Salvar apelido"
              onSubmit={(nickname) => {
                const result = playerIdentity.saveNickname(nickname);
                if (result.valid) setEditingNickname(false);
                return result.valid;
              }}
              onCancel={() => setEditingNickname(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}

function InviteStatusScreen({
  title,
  description,
  onBack
}: {
  title: string;
  description?: string;
  onBack?: () => void;
}) {
  return (
    <main className="lobby invite-status-screen">
      <section className="brand-panel" aria-live="polite">
        <p className="eyebrow">Convite de partida</p>
        <h1>{title}</h1>
        {description && <p className="subtle">{description}</p>}
      </section>
      {onBack && (
        <section className="action-stack">
          <button className="primary-button" type="button" onClick={onBack}>
            Voltar ao início
          </button>
        </section>
      )}
    </main>
  );
}
