import { app, BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'
import { DEEP_LINK_PROTOCOL } from '../shared/ipc'
import { createMainWindow } from './window'
import { registerPermissionHandlers } from './security'
import { deepLinkFromArgv, deliverDeepLink, registerProtocol, setPendingDeepLink } from './deepLink'
import { registerUpdater } from './updater'
import { registerAppMenu } from './menu'
import { registerCredentialsIpc } from './ipc/credentials'
import { registerScreenShareIpc } from './ipc/screenShare'
import { registerVoiceIpc } from './ipc/voice'
import { registerPermissionsIpc } from './ipc/permissions'

// Nome do app (menu, diálogos) — sem isso o dev mostra "Electron"
app.setName('CallVortex')

let mainWindow: BrowserWindow | null = null

// O áudio (WebRTC + processamento) precisa rodar sem exigir clique prévio
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
// Captura de tela em Wayland via portal/PipeWire (sem efeito no X11/Windows)
app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer')

// Diagnóstico de voz (CDP): só em dev, com CV_REMOTE_DEBUG_PORT=9222
if (!app.isPackaged && process.env.CV_REMOTE_DEBUG_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.CV_REMOTE_DEBUG_PORT)
}

function openMainWindow(): void {
  const win = createMainWindow()
  mainWindow = win
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })
}

registerProtocol()

// Instância única: um segundo lançamento (ex.: clique no deep-link com o app
// já aberto) entrega a URL para a instância existente em vez de abrir outra.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const url = deepLinkFromArgv(argv)
    if (url) deliverDeepLink(url, mainWindow)
  })

  // macOS: deep-links chegam por este evento
  app.on('open-url', (event, url) => {
    event.preventDefault()
    if (url.startsWith(`${DEEP_LINK_PROTOCOL}://`)) deliverDeepLink(url, mainWindow)
  })

  app.whenReady().then(() => {
    // Dock do macOS em dev: usa a logo do app (empacotado, o .icns já vem do build)
    if (process.platform === 'darwin' && !app.isPackaged) {
      const dockIcon = nativeImage.createFromPath(join(__dirname, '../../build/icon.png'))
      if (!dockIcon.isEmpty()) app.dock?.setIcon(dockIcon)
    }
    app.setAboutPanelOptions({ applicationName: 'CallVortex', applicationVersion: app.getVersion() })
    registerAppMenu(() => mainWindow)
    registerPermissionHandlers()
    registerCredentialsIpc()
    registerScreenShareIpc()
    registerVoiceIpc()
    registerPermissionsIpc()
    registerUpdater(() => mainWindow)

    // Deep-link no primeiro lançamento (Linux/Windows via argv). Definido
    // ANTES de criar a janela para o 'ready-to-show' já encontrá-lo.
    setPendingDeepLink(deepLinkFromArgv(process.argv))

    openMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) openMainWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
