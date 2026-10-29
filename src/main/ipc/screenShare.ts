import { app, ipcMain, session, desktopCapturer } from 'electron'
import { IPC, type ScreenSourceInfo } from '../../shared/ipc'
import { isTrustedSender } from '../security'

/**
 * Sessão Wayland: o xdg-desktop-portal é o ÚNICO picker de tela. Chamar
 * `desktopCapturer.getSources()` já abre o diálogo do portal, e devolver a
 * fonte enumerada no handler abre um SEGUNDO diálogo (sessões PipeWire são
 * isoladas e o id enumerado é inválido para captura). Por isso, no Wayland
 * pulamos a listagem e entregamos uma fonte sintética — o Chromium abre o
 * portal exatamente uma vez, na hora de capturar.
 */
const IS_WAYLAND =
  process.platform === 'linux' && (process.env.XDG_SESSION_TYPE === 'wayland' || Boolean(process.env.WAYLAND_DISPLAY))

/**
 * Áudio do sistema (WASAPI loopback) — somente o Windows oferece. É a única
 * forma de capturar o áudio reproduzido pela máquina no Electron; em
 * Linux/macOS o handler simplesmente não entrega áudio e a captura fica só
 * com vídeo (comportamento original).
 */
const SUPPORTS_SYSTEM_AUDIO = process.platform === 'win32'

// ---------------------------------------------------------------------------
// Compartilhamento de tela: lista as fontes capturáveis (telas e janelas).
// O desktopCapturer só existe no processo principal; o renderer recebe
// apenas metadados (id, nome, miniatura) e faz a captura em si via
// getUserMedia — nenhum acesso genérico ao Node é exposto.
// ---------------------------------------------------------------------------

/** Fonte escolhida no picker aguardando o getDisplayMedia() do renderer. */
let pendingScreenSourceId: string | null = null
/** Instante em que a fonte foi escolhida — descarta escolhas antigas. */
let pendingScreenSourceAt = 0
/** Uma escolha vale por este tempo; reemissões do Chromium são imediatas. */
const PENDING_SOURCE_TTL_MS = 30_000

/**
 * Fontes exatas devolvidas pela última listagem do picker, indexadas por id.
 * No Wayland cada `getSources()` abre o diálogo do portal; reaproveitar o
 * objeto já listado no handler do getDisplayMedia evita um SEGUNDO diálogo
 * e o descasamento de ids (que resultava em NotAllowedError).
 */
const lastScreenSources = new Map<string, Electron.DesktopCapturerSource>()

export function registerScreenShareIpc(): void {
  // Informa o renderer se a sessão é Wayland (a UI pula o picker interno).
  ipcMain.handle(IPC.screenShareIsWayland, (e): boolean => {
    if (!isTrustedSender(e)) return false
    return IS_WAYLAND
  })

  // Áudio do sistema (loopback) só existe no Windows (ver Streams.audio no
  // handler abaixo). O renderer usa isto para decidir se pede áudio no
  // getDisplayMedia — assim Linux/macOS mantêm exatamente o comportamento
  // antigo (só vídeo), sem risco de a requisição falhar.
  ipcMain.handle(IPC.screenShareSupportsSystemAudio, (e): boolean => {
    if (!isTrustedSender(e)) return false
    return SUPPORTS_SYSTEM_AUDIO
  })

  ipcMain.handle(IPC.screenShareGetSources, async (e): Promise<ScreenSourceInfo[]> => {
    if (!isTrustedSender(e)) return []
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true
      })
      if (!app.isPackaged) console.log('[main] get-sources:', sources.length, 'fontes')
      const visible = sources.slice(0, 50)
      // guarda os objetos nativos da fonte para o handler reutilizar
      lastScreenSources.clear()
      for (const s of visible) lastScreenSources.set(s.id, s)
      return visible.map((s) => ({
        id: s.id,
        name: s.name.trim() || (s.id.startsWith('screen:') ? 'Tela inteira' : 'Janela'),
        thumbnail: s.thumbnail.isEmpty() ? null : s.thumbnail.toDataURL(),
        icon: s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : null
      }))
    } catch {
      return []
    }
  })

  // Registra a fonte escolhida no nosso picker; o getDisplayMedia() do
  // renderer será atendido pelo handler abaixo usando essa fonte.
  ipcMain.handle(IPC.screenShareSelectSource, (e, sourceId: unknown): boolean => {
    if (!isTrustedSender(e)) return false
    if (typeof sourceId !== 'string' || sourceId.length === 0 || sourceId.length > 256) return false
    pendingScreenSourceId = sourceId
    pendingScreenSourceAt = Date.now()
    return true
  })

  // Captura de tela no Electron moderno: o renderer chama
  // navigator.mediaDevices.getDisplayMedia() e AQUI decidimos qual fonte
  // entregar — a escolhida no nosso picker. Esse é o único caminho que
  // funciona em Wayland (portal/PipeWire) e também cobre X11 e Windows.
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    // O callback é de uso ÚNICO e o Chromium pode reemitir a mesma
    // requisição (comum em Wayland/PipeWire): guarda contra chamada dupla,
    // que derrubaria a captura com "One-time callback was called more than once".
    let answered = false
    const answer = (streams: Electron.Streams): void => {
      if (answered) return
      answered = true
      try {
        callback(streams)
      } catch {
        // callback já consumido por uma reemissão anterior — ignora
      }
    }
    /**
     * Áudio do sistema: só quando o renderer pediu E a plataforma suporta
     * (loopback = Windows). Sem isso a requisição com áudio seria respondida
     * apenas com vídeo e o renderer não receberia a trilha de áudio.
     */
    const withVideo = (video: Electron.DesktopCapturerSource): Electron.Streams => {
      const streams: Electron.Streams = { video }
      if (request.audioRequested && SUPPORTS_SYSTEM_AUDIO) streams.audio = 'loopback'
      return streams
    }
    // Wayland: não enumera (isso abriria o portal) nem reusa uma fonte.
    // Entrega um id sintético; o Chromium/PipeWire abre o portal UMA vez,
    // no início da captura, e o usuário escolhe a tela/janela ali.
    if (IS_WAYLAND) {
      answer(withVideo({ id: 'screen:0:0', name: 'Screen' } as Electron.DesktopCapturerSource))
      return
    }

    const wanted = pendingScreenSourceId
    const fresh = wanted !== null && Date.now() - pendingScreenSourceAt < PENDING_SOURCE_TTL_MS
    if (!fresh) {
      answer({})
      return
    }
    // Reaproveita o objeto listado no picker — sem novo getSources(), que no
    // Wayland dispararia outro diálogo do portal e poderia trazer ids
    // diferentes do escolhido (→ NotAllowedError).
    const cached = lastScreenSources.get(wanted)
    if (cached) {
      answer(withVideo(cached))
      return
    }
    // NÃO limpa a fonte: o Chromium pode reemitir a MESMA requisição (comum
    // em Wayland/PipeWire) como nova invocação deste handler; limpá-la levaria
    // a segunda tentativa a answer({}) → NotAllowedError. A escolha é
    // substituída no próximo select-source e expira pelo TTL.
    void desktopCapturer
      .getSources({ types: ['screen', 'window'] })
      .then((sources) => {
        const source = sources.find((s) => s.id === wanted)
        if (source) answer(withVideo(source))
        else answer({})
      })
      .catch(() => answer({}))
  })
}
