import { useState } from "react";
import { choosePlayerColor, type AiDifficulty, type ColorChoice } from "./ai/checkersAi";
import { GameScreen } from "./components/GameScreen";
import { Lobby } from "./components/Lobby";
import { ModesScreen } from "./components/ModesScreen";
import { NicknameForm } from "./components/NicknameForm";
import { SoloGameScreen } from "./components/SoloGameScreen";
import { SoloSetupScreen } from "./components/SoloSetupScreen";
import type { Player } from "./game/types";
import { useRoom } from "./multiplayer/useRoom";
import { usePlayerIdentity } from "./playerIdentity/usePlayerIdentity";

type AppScreen = "modes" | "friend" | "solo-setup" | "solo-game";
type SoloConfig = {
  difficulty: AiDifficulty;
  player: Player;
};

export default function App() {
  const playerIdentity = usePlayerIdentity();
  const room = useRoom(playerIdentity.nickname);
  const [screen, setScreen] = useState<AppScreen>("modes");
  const [soloConfig, setSoloConfig] = useState<SoloConfig | null>(null);
  const [editingNickname, setEditingNickname] = useState(false);

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
        reactionCooldownUntil={room.reactionCooldownUntil}
        busy={room.busy}
        error={room.error}
        onMove={room.playMove}
        onReaction={room.sendReaction}
        onRematch={room.requestRematch}
        onDeclineRematch={room.declineRematch}
        onResign={room.resign}
        onProposeDraw={room.proposeDraw}
        onRespondDraw={room.respondToDraw}
        onLeave={room.leaveRoom}
      />
    );
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

  return (
    <>
      <ModesScreen
        playerName={playerIdentity.nickname}
        onEditNickname={() => setEditingNickname(true)}
        onFriend={() => setScreen("friend")}
        onComputer={() => setScreen("solo-setup")}
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
