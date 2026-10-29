import { app, session } from 'electron'

/** Origem permitida para o renderer: dev server ou o bundle local. */
function isDevServer(): boolean {
  return !app.isPackaged && Boolean(process.env['ELECTRON_RENDERER_URL'])
}

/** true se a URL pertence ao nosso renderer (comparação por origem/arquivo). */
export function isAppUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (isDevServer()) return u.origin === new URL(process.env['ELECTRON_RENDERER_URL']!).origin
    // produção: apenas o index.html empacotado
    return u.protocol === 'file:' && u.pathname.endsWith('/renderer/index.html')
  } catch {
    return false
  }
}

// Só aceita chamadas IPC vindas do frame principal da nossa janela — assim,
// nenhuma página externa (ou iframe) consegue ler/gravar credenciais.
export function isTrustedSender(event: Electron.IpcMainInvokeEvent): boolean {
  const frame = event.senderFrame
  if (!frame) return false
  // frame principal apenas (sem iframes)
  if (frame.parent !== null) return false
  return isAppUrl(frame.url)
}

/**
 * Permissões do renderer: apenas microfone/áudio e captura de tela, e só para
 * a nossa origem. Qualquer outra (câmera, geolocalização, notificações...) é negada.
 */
export function registerPermissionHandlers(): void {
  const allowed = new Set(['media', 'display-capture'])
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    callback(allowed.has(permission) && isAppUrl(wc.getURL()))
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
    if (!allowed.has(permission)) return false
    // requestingOrigin: "file:///" em produção; no dev vem com barra final
    // ("http://localhost:5173/"), então compara pela origem normalizada
    try {
      return isDevServer()
        ? new URL(requestingOrigin).origin === new URL(process.env['ELECTRON_RENDERER_URL']!).origin
        : requestingOrigin.startsWith('file://')
    } catch {
      return false
    }
  })
}
