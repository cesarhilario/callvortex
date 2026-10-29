import { app, session } from 'electron'

function isDevServer(): boolean {
  return !app.isPackaged && Boolean(process.env['ELECTRON_RENDERER_URL'])
}

export function isAppUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (isDevServer()) return u.origin === new URL(process.env['ELECTRON_RENDERER_URL']!).origin
    return u.protocol === 'file:' && u.pathname.endsWith('/renderer/index.html')
  } catch {
    return false
  }
}

export function isTrustedSender(event: Electron.IpcMainInvokeEvent): boolean {
  const frame = event.senderFrame
  if (!frame) return false
  if (frame.parent !== null) return false
  return isAppUrl(frame.url)
}

export function registerPermissionHandlers(): void {
  const allowed = new Set(['media', 'display-capture'])
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    callback(allowed.has(permission) && isAppUrl(wc.getURL()))
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
    if (!allowed.has(permission)) return false
    try {
      return isDevServer()
        ? new URL(requestingOrigin).origin === new URL(process.env['ELECTRON_RENDERER_URL']!).origin
        : requestingOrigin.startsWith('file://')
    } catch {
      return false
    }
  })
}
