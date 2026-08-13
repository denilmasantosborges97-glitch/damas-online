import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { applyMove, type GameState, type Move, type Player } from "../_shared/checkers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type RoomRow = {
  id: string;
  status: GameState["status"];
  board: GameState["board"];
  current_player: Player;
  winner: Player | null;
  revision: number;
};

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { roomId, playerToken, move } = (await request.json()) as {
      roomId?: string;
      playerToken?: string;
      move?: Move;
    };

    if (!roomId || !playerToken || !move) {
      return json({ error: "Pedido incompleto." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Variáveis da Edge Function em falta." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { data: room, error: readError } = await admin
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single<RoomRow>();

    if (readError || !room) {
      return json({ error: "Sala não encontrada." }, 404);
    }

    const player = await resolvePlayer(admin, room.id, playerToken);
    if (!player) return json({ error: "Jogador inválido." }, 403);
    if (room.status !== "playing") return json({ error: "A partida ainda não está ativa." }, 409);
    if (room.current_player !== player) return json({ error: "Ainda não é a tua vez." }, 409);

    const currentState: GameState = {
      board: room.board,
      currentPlayer: room.current_player,
      status: room.status,
      winner: room.winner,
      revision: room.revision
    };

    const nextState = applyMove(currentState, move);

    const { data: updatedRoom, error: updateError } = await admin
      .from("rooms")
      .update({
        board: nextState.board,
        current_player: nextState.currentPlayer,
        status: nextState.status,
        winner: nextState.winner,
        rematch_red: false,
        rematch_black: false,
        revision: room.revision + 1
      })
      .eq("id", room.id)
      .eq("revision", room.revision)
      .select("id, code, status, board, current_player, winner, revision, rematch_red, rematch_black")
      .single();

    if (updateError || !updatedRoom) {
      return json({ error: "A sala mudou antes desta jogada. Atualiza o estado e tenta novamente." }, 409);
    }

    return json({ room: updatedRoom });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Jogada rejeitada." }, 400);
  }
});

async function resolvePlayer(
  admin: ReturnType<typeof createClient>,
  roomId: string,
  token: string
): Promise<Player | null> {
  const { data } = await admin
    .from("room_players")
    .select("player")
    .eq("room_id", roomId)
    .eq("player_token", token)
    .maybeSingle<{ player: Player }>();

  return data?.player ?? null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
