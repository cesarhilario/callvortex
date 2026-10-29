import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { DEEP_LINK_PROTOCOL, DEEP_LINK_RESET_HOST, IPC } from '../shared/ipc'

// ---------------------------------------------------------------------------
// Deep-link callvortex:// (redefinição de senha)
// O e-mail de reset enviado pelo Supabase aponta para `callvortex://reset#...`
// e o sistema operacional reabre ESTE app com a URL. Guardamos a URL pendente
// até a janela estar pronta para entregá-la ao renderer.
// ---------------------------------------------------------------------------
let pendingDeepLink: string | null = null

/** Aceita só callvortex://reset... (descarta qualquer outro host/protocolo). */
function isValidDeepLink(url: string): boolean {
  if (url.length > 4096) return false
  try {
    const u = new URL(url)
    return u.protocol === `${DEEP_LINK_PROTOCOL}:` && u.hostname === DEEP_LINK_RESET_HOST
  } catch {
    return false
  }
}

/** Extrai uma URL callvortex:// válida dos argumentos de linha de comando. */
export function deepLinkFromArgv(argv: string[]): string | null {
  return argv.find((a) => a.startsWith(`${DEEP_LINK_PROTOCOL}://`) && isValidDeepLink(a)) ?? null
}

/** Envia a URL ao renderer; se ainda não há janela, guarda para depois. */
export function deliverDeepLink(url: string, win: BrowserWindow | null): void {
  if (!isValidDeepLink(url)) return
  if (win && !win.isDestroyed()) {
    if (win.webContents.isLoading()) {
      win.webContents.once('did-finish-load', () => {
        win.webContents.send(IPC.authDeepLink, url)
      })
    } else {
      win.webContents.send(IPC.authDeepLink, url)
    }
    if (win.isMinimized()) win.restore()
    win.focus()
  } else {
    pendingDeepLink = url
  }
}

export function setPendingDeepLink(url: string | null): void {
  pendingDeepLink = url
}

/** Entrega (e limpa) a URL pendente do primeiro lançamento. */
export function takePendingDeepLink(): string | null {
  const url = pendingDeepLink
  pendingDeepLink = null
  return url
}

/**
 * Registro do protocolo. Em dev no Linux/Windows funciona via
 * app.setAsDefaultProtocolClient; no macOS o SO usa o Info.plist
 * (feito pelo electron-builder em produção).
 */
export function registerProtocol(): void {
  if (process.defaultApp && process.argv.length >= 2) {
    // Dev: passa o caminho do app como argumento para o registro funcionar
    app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL, process.execPath, [join(process.cwd(), process.argv[1])])
  } else {
    app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL)
  }
}
