import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { IPC } from '../shared/ipc'

/**
 * Menu nativo. "Configurações…" fica no menu do app no macOS (CallVortex) e em
 * Arquivo no Windows/Linux; o atalho (⌘, / Ctrl+,) é o accelerator do item.
 * O clique avisa o renderer, que abre o modal (ignorado fora da tela principal).
 */
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
    // Recarregar/DevTools só em desenvolvimento
    ...(app.isPackaged ? [] : [{ role: 'viewMenu' } as MenuItemConstructorOptions]),
    { role: 'windowMenu' }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
