# Configuração do Supabase

Esta versão usa o Supabase como autoridade de salas e estado partilhado. O cliente nunca atualiza `turno`, `board`, `winner` ou `status` diretamente: cria/entra em salas por RPC e envia jogadas para a Edge Function `submit-move`.

## 1. Criar projeto

1. Cria um projeto gratuito em https://supabase.com.
2. Em `Project Settings > API`, copia:
   - `Project URL`
   - `anon public key`
3. Cria um ficheiro `.env` na raiz do projeto com:

```bash
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
```

## 2. Criar tabelas, políticas e funções

No painel do Supabase, abre `SQL Editor`, cola o conteúdo de `supabase/migrations/001_rooms.sql` e executa.

Isto cria:

- `rooms`: guarda sala, código, tabuleiro, turno, vencedor e pedidos de nova partida.
- `room_players`: guarda os tokens privados dos jogadores; não é legível pelo cliente.
- RPC `create_room()`: gera código curto e cria o Jogador 1.
- RPC `join_room(code)`: entra como Jogador 2 e inicia a partida.
- RPC `request_rematch(room_id, player_token)`: prepara nova partida quando ambos pedem.
- RLS: clientes anónimos podem ler `rooms` para realtime, mas não podem inserir, alterar ou apagar salas diretamente; `room_players` fica privada.
- Realtime: adiciona `rooms` à publicação `supabase_realtime`.

## 3. Publicar a Edge Function

Instala e liga a CLI do Supabase:

```bash
npm install -g supabase
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy submit-move
```

A função usa `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, que o Supabase fornece no ambiente da Edge Function. Não coloques a service role key no `.env` do frontend.

## 4. Ativar realtime

No painel do Supabase, confirma em `Database > Replication` que a tabela `rooms` está ativa para realtime. A migração tenta ativar isto automaticamente, mas o painel é o melhor lugar para conferir.
