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

app.setName('CallVortex')

let mainWindow: BrowserWindow | null = null

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer')

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

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const url = deepLinkFromArgv(argv)
    if (url) deliverDeepLink(url, mainWindow)
  })

  app.on('open-url', (event, url) => {
    event.preventDefault()
    if (url.startsWith(`${DEEP_LINK_PROTOCOL}://`)) deliverDeepLink(url, mainWindow)
  })

  app.whenReady().then(() => {
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
