import { useState } from "react";
import { choosePlayerColor, type AiDifficulty, type ColorChoice } from "./ai/checkersAi";
import { GameScreen } from "./components/GameScreen";
import { Lobby } from "./components/Lobby";
import { ModesScreen } from "./components/ModesScreen";
import { SoloGameScreen } from "./components/SoloGameScreen";
import { SoloSetupScreen } from "./components/SoloSetupScreen";
import type { Player } from "./game/types";
import { useRoom } from "./multiplayer/useRoom";

type AppScreen = "modes" | "friend" | "solo-setup" | "solo-game";
type SoloConfig = {
  difficulty: AiDifficulty;
  player: Player;
};

export default function App() {
  const room = useRoom();
  const [screen, setScreen] = useState<AppScreen>("modes");
  const [soloConfig, setSoloConfig] = useState<SoloConfig | null>(null);

  if (room.room && room.session) {
    return (
      <GameScreen
        room={room.room}
        session={room.session}
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
    <ModesScreen
      onFriend={() => setScreen("friend")}
      onComputer={() => setScreen("solo-setup")}
    />
  );
}
