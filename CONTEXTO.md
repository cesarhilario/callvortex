# 🧭 CONTEXTO DA APLICAÇÃO — CallVortex

Documento de contexto técnico para IAs/desenvolvedores que forem trabalhar
neste projeto. Descreve o que é, como está organizado, como rodar/compilar e
quais são os pontos de atenção.

---

## 1. Identidade

- **Nome:** CallVortex (`package.json:2`)
- **Versão:** 0.2.2
- **Descrição:** Chat por texto e voz (WebRTC) para grupos de amigos.
- **App ID:** `br.com.callvortex` • **productName:** `CallVortex`
- **Repositório:** https://github.com/guilhermehilario/callvortex

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Shell desktop | Electron 43 |
| Build | electron-vite 5 + Vite 7 |
| UI | React 19 + TypeScript 7 |
| Backend | Supabase (Postgres + Auth + Realtime + Storage) |
| Empacotamento | electron-builder 26 (AppImage / .exe portátil) |
| Gerenciador | yarn 1.22 (não usar npm) |
| Voz/Vídeo | WebRTC malha P2P (sem SFU) |

## 3. Arquitetura (3 processos Electron)

```
src/main/index.ts     → processo principal: janela, desktopCapturer,
                        getDisplayMedia (loopback de áudio SÓ no Windows),
                        IPC, auto-updater (electron-updater)
src/preload/index.ts  → ponte contextBridge → expõe window.api
src/renderer/src/     → React (UI + toda a lógica de app/voz/tela)
```

O estado central do app vive em **`src/renderer/src/lib/useApp.tsx`** (context).
Os componentes consomem via `useApp()`.

## 4. Módulos principais (`src/renderer/src/lib/`)

| Arquivo | Responsabilidade |
|---|---|
| `api.ts` | CRUD no Supabase (servidores, canais, mensagens, DMs, emojis, figurinhas) |
| `useApp.tsx` | Contexto/estado global, orquestra os hooks |
| `voice.ts` | Malha WebRTC: PCs por par, cadeia de mic, mixagem de áudio do sistema, reconexão/watchdog |
| `useVoice.ts` | Liga o `VoiceManager` ao ciclo de vida React |
| `screenShare/manager.ts` | Orquestrador do compartilhamento de tela (reserva RPC + ciclo de vida) |
| `screenShare/capture.ts` | Captura via `getDisplayMedia` (Electron) |
| `screenShare/signaling.ts` | Sinalização WebRTC via tabela `call_signals` (RLS) + observa `screen_shares` |
| `screenShare/audio.ts` | `ScreenAudioMixer` — mixa voz + áudio do sistema num único track |
| `screenShare/types.ts` | Tipos e estado inicial do compartilhamento |
| `realtime.ts` | Canais Realtime (mensagens, presença) |
| `connection.ts` | Agendas de retry/resubscribe (escala) |
| `types.ts` / `app-types.ts` | Tipos de domínio / do contexto |
| `settings.ts`, `sounds.ts`, `invites.ts`, `internet.ts`, `defaultStickers.ts` | Apoio |

### Componentes-chave (`src/renderer/src/components/`)
`ScreenShareStage.tsx` (palco + controle de áudio), `ScreenShareButton.tsx`,
`ScreenSharePicker.tsx`, `ChannelSidebar.tsx`, `ChatArea.tsx`, `Modals.tsx`
(servidores, emojis, **figurinhas**), `VoiceChannelScreen.tsx`,
`VoiceParticipantTiles.tsx`, `Icons.tsx`.

## 5. Funcionalidades

- Autenticação (e-mail + senha) via Supabase Auth
- Servidores, canais de texto, mensagens em tempo real, DMs 1:1
- Presença online, foto de perfil, emojis por servidor (`:nome:`)
- **Canais de voz** (WebRTC malha): mudo, surdo, indicador de fala
- **Compartilhamento de tela** (1 por canal): reserva atômica no banco,
  heartbeat de 90s, sinalização por RLS, visualização P2P
- **Figurinhas/GIFs** personalizados (pessoal) e de servidor (`{{nome}}`)
- Auto-update (electron-updater, provider GitHub)

## 6. Banco de dados (Supabase)

- **Schema base:** `supabase/schema.sql` (tabelas + RLS + Realtime)
- **Migrações:** `supabase/migrations/` (11 arquivos — **todas já aplicadas**
  no projeto hospedado `xgvmxmnsxysbubybxdtq`)

Tabelas-chave: `profiles`, `servers`, `server_members`, `channels`, `messages`,
`dm_threads`/`dm_messages`, `voice_sessions`, `screen_shares`, `call_signals`,
`server_emojis`, `stickers`.

RPCs de tela: `start_screen_share` / `touch_screen_share` / `stop_screen_share` /
`send_call_signal` / `is_call_participant`. Regra: **um compartilhamento por
canal**; sessões órfãs expiram por heartbeat (90s) ou sala morta (5 min).

**RLS em tudo.** Canais de voz usam o tópico Realtime privado
`voice:<channel_id>` (ver migração `20260824000000_realtime_private_voice.sql`);
requer "Allow private channels" ligado no painel + `VITE_REALTIME_PRIVATE=1`.

### Storage buckets (públicos)
`avatars`, `emojis`, `stickers` (este último com whitelist de extensão:
`png/jpg/jpeg/webp/gif`).

## 7. Build & execução

```bash
yarn install
yarn dev                       # dev com hot reload
yarn build                     # electron-vite build → out/
yarn dist                      # build + electron-builder (targets do package.json)
yarn dist --linux --win        # AppImage + .exe portátil (wine p/ o alvo Windows)
yarn typecheck                 # tsc em node + web
yarn check:styles              # valida organização dos CSS modules
```

**Saídas** em `release/`:
- `CallVortex-0.2.2.AppImage` (Linux, ~130 MB)
- `CallVortex 0.2.2.exe` (Windows portátil, ~94 MB)

**Env** (`.env`, copiar de `.env.example`):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (+ opcionais de TURN/Realtime).

## 8. Pontos de atenção / histórico

- **Áudio do sistema no compartilhamento** só existe no **Windows** (loopback
  WASAPI). No Linux o botão não aparece, por desenho.
- **ICE/TURN:** STUN público + TURN público (Open Relay). Redes com NAT restrito
  podem precisar de TURN próprio (`ICE_SERVERS` em `voice.ts`).
- **Não usar npm** — o projeto usa yarn 1 e há `yarn.lock`.
- Auto-deploy do schema só em push para `main` tocando `supabase/migrations/**`
  (`.github/workflows/deploy-schema.yml`); fora disso, aplicar no SQL Editor.

### Correções recentes (0.2.2)
- Compartilhamento de tela: limpeza imediata de `sharerId` ao parar/sair +
  reconciliação com o banco quando a trilha remota termina (evita botão
  "bloqueado" até sair/voltar da sala); liberação da reserva com timeout.
- Botão de áudio da tela: disponibilidade derivada da trilha capturada (não do
  mixer) e recriação do mixer no toggle — sem estado morto.
- Figurinhas: extensão canônica via MIME, mensagens de erro específicas
  (duplicado/formato/permissão) e erro exibido dentro do modal.
