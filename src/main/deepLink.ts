import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { DEEP_LINK_PROTOCOL, DEEP_LINK_RESET_HOST, IPC } from '../shared/ipc'

let pendingDeepLink: string | null = null

function isValidDeepLink(url: string): boolean {
  if (url.length > 4096) return false
  try {
    const u = new URL(url)
    return u.protocol === `${DEEP_LINK_PROTOCOL}:` && u.hostname === DEEP_LINK_RESET_HOST
  } catch {
    return false
  }
}

export function deepLinkFromArgv(argv: string[]): string | null {
  return argv.find((a) => a.startsWith(`${DEEP_LINK_PROTOCOL}://`) && isValidDeepLink(a)) ?? null
}

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

export function takePendingDeepLink(): string | null {
  const url = pendingDeepLink
  pendingDeepLink = null
  return url
}

export function registerProtocol(): void {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL, process.execPath, [join(process.cwd(), process.argv[1])])
  } else {
    app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL)
  }
}
