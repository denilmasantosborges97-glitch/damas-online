import { GameScreen } from "./components/GameScreen";
import { Lobby } from "./components/Lobby";
import { useRoom } from "./multiplayer/useRoom";

export default function App() {
  const room = useRoom();

  if (room.room && room.session) {
    return (
      <GameScreen
        room={room.room}
        session={room.session}
        presence={room.presence}
        legalMoves={room.legalMoves}
        busy={room.busy}
        error={room.error}
        onMove={room.playMove}
        onRematch={room.requestRematch}
        onLeave={room.leaveRoom}
      />
    );
  }

  return (
    <Lobby
      canUseOnline={room.hasSupabaseConfig}
      busy={room.busy}
      error={room.error}
      onCreateRoom={room.createRoom}
      onJoinRoom={room.joinRoom}
    />
  );
}
