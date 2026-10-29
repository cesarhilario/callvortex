import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { IPC } from '../shared/ipc'

export function registerAppMenu(getWindow: () => BrowserWindow | null): void {
  const isMac = process.platform === 'darwin'

  const openSettings = (): void => {
    const win = getWindow()
    if (win && !win.isDestroyed()) win.webContents.send(IPC.appOpenSettings)
  }

  const settingsItem: MenuItemConstructorOptions = {
    label: 'Configurações…',
    accelerator: 'CmdOrCtrl+,',
    click: openSettings
  }

  const template: MenuItemConstructorOptions[] = [
    isMac
      ? {
          label: app.name,
          submenu: [
            { role: 'about', label: 'Sobre o CallVortex' },
            { type: 'separator' },
            settingsItem,
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        }
      : {
          label: 'Arquivo',
          submenu: [settingsItem, { type: 'separator' }, { role: 'quit', label: 'Sair' }]
        },
    { role: 'editMenu' },
    ...(app.isPackaged ? [] : [{ role: 'viewMenu' } as MenuItemConstructorOptions]),
    { role: 'windowMenu' }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
