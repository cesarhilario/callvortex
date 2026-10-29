import { app, BrowserWindow, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'

export function registerUpdater(getWindow: () => BrowserWindow | null): void {
  if (!app.isPackaged) return
  autoUpdater.autoDownload = true
  autoUpdater.on('update-downloaded', async () => {
    const win = getWindow()
    if (!win || win.isDestroyed()) return
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Atualização pronta',
      message: 'Uma nova versão do CallVortex foi baixada.',
      detail: 'Reinicie agora para aplicar. A chamada atual será encerrada.',
      buttons: ['Reiniciar agora', 'Depois'],
      defaultId: 0
    })
    if (response === 0) autoUpdater.quitAndInstall()
  })
  autoUpdater.on('error', (err) => {
    console.log('[updater] erro (ignorável offline):', err.message.slice(0, 120))
  })
  void autoUpdater.checkForUpdatesAndNotify().catch(() => undefined)
  setInterval(() => void autoUpdater.checkForUpdatesAndNotify().catch(() => undefined), 4 * 60 * 60 * 1000)
}
