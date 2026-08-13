# Publicar uma versão gratuita de teste

## Opção simples: Vercel

1. Envia este projeto para um repositório GitHub.
2. Em https://vercel.com, escolhe `Add New > Project`.
3. Importa o repositório.
4. Em `Environment Variables`, adiciona:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Usa:
   - Build command: `npm run build`
   - Output directory: `dist`
6. Publica.

## Opção simples: Netlify

1. Envia este projeto para um repositório GitHub.
2. Em https://netlify.com, escolhe `Add new site > Import an existing project`.
3. Adiciona as mesmas variáveis de ambiente.
4. Usa:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Publica.

## Teste em dois telemóveis

1. Abre o URL publicado no telemóvel A.
2. Toca em `Criar Sala`.
3. Copia ou dita o código exibido no topo, por exemplo `A1B2C`.
4. Abre o mesmo URL publicado no telemóvel B.
5. Toca em `Entrar numa Sala`.
6. Introduz o código.
7. O telemóvel A joga com as peças vermelhas; o telemóvel B joga com as pretas.
8. Faz uma jogada no telemóvel A e confirma que aparece rapidamente no telemóvel B.
9. Tenta mover uma peça no telemóvel errado durante o turno do adversário; a UI deve bloquear.
10. Fecha o separador num dos telemóveis; o outro deve mostrar que o adversário se desconectou.
