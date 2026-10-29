import { app, ipcMain, session, desktopCapturer } from 'electron'
import { IPC, type ScreenSourceInfo } from '../../shared/ipc'
import { isTrustedSender } from '../security'

const IS_WAYLAND =
  process.platform === 'linux' && (process.env.XDG_SESSION_TYPE === 'wayland' || Boolean(process.env.WAYLAND_DISPLAY))

const SUPPORTS_SYSTEM_AUDIO = process.platform === 'win32'

let pendingScreenSourceId: string | null = null
let pendingScreenSourceAt = 0
const PENDING_SOURCE_TTL_MS = 30_000

const lastScreenSources = new Map<string, Electron.DesktopCapturerSource>()

export function registerScreenShareIpc(): void {
  ipcMain.handle(IPC.screenShareIsWayland, (e): boolean => {
    if (!isTrustedSender(e)) return false
    return IS_WAYLAND
  })

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

  ipcMain.handle(IPC.screenShareSelectSource, (e, sourceId: unknown): boolean => {
    if (!isTrustedSender(e)) return false
    if (typeof sourceId !== 'string' || sourceId.length === 0 || sourceId.length > 256) return false
    pendingScreenSourceId = sourceId
    pendingScreenSourceAt = Date.now()
    return true
  })

  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    let answered = false
    const answer = (streams: Electron.Streams): void => {
      if (answered) return
      answered = true
      try {
        callback(streams)
      } catch {
      }
    }
    const withVideo = (video: Electron.DesktopCapturerSource): Electron.Streams => {
      const streams: Electron.Streams = { video }
      if (request.audioRequested && SUPPORTS_SYSTEM_AUDIO) streams.audio = 'loopback'
      return streams
    }
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
    const cached = lastScreenSources.get(wanted)
    if (cached) {
      answer(withVideo(cached))
      return
    }
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
