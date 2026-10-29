import { app, ipcMain, shell, systemPreferences } from 'electron'
import {
  IPC,
  type AppInfo,
  type PermissionStatus,
  type PermissionsState,
  type SettingsPane
} from '../../shared/ipc'
import { isTrustedSender } from '../security'

const IS_MAC = process.platform === 'darwin'

const SETTINGS_URLS: Partial<Record<NodeJS.Platform, Partial<Record<SettingsPane, string>>>> = {
  darwin: {
    microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
    screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
    'local-network': 'x-apple.systempreferences:com.apple.preference.security?Privacy_LocalNetwork',
    firewall: 'x-apple.systempreferences:com.apple.preference.security?Firewall'
  },
  win32: {
    microphone: 'ms-settings:privacy-microphone'
  }
}

function mediaStatus(type: 'microphone' | 'screen'): PermissionStatus {
  try {
    return systemPreferences.getMediaAccessStatus(type)
  } catch {
    return 'unknown'
  }
}

export function registerPermissionsIpc(): void {
  ipcMain.handle(IPC.permissionsGet, (e): PermissionsState | null => {
    if (!IS_MAC || !isTrustedSender(e)) return null
    return { microphone: mediaStatus('microphone'), screen: mediaStatus('screen') }
  })

  ipcMain.handle(IPC.permissionsRequestMicrophone, async (e): Promise<boolean> => {
    if (!IS_MAC || !isTrustedSender(e)) return false
    try {
      return await systemPreferences.askForMediaAccess('microphone')
    } catch {
      return false
    }
  })

  ipcMain.handle(IPC.permissionsOpenSettings, async (e, pane: unknown): Promise<boolean> => {
    if (!isTrustedSender(e)) return false
    const urls = SETTINGS_URLS[process.platform]
    if (!urls || typeof pane !== 'string' || !Object.hasOwn(urls, pane)) return false
    try {
      await shell.openExternal(urls[pane as SettingsPane]!)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle(IPC.appGetInfo, (e): AppInfo | null => {
    if (!isTrustedSender(e)) return null
    return {
      name: app.getName(),
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      platform: process.platform,
      arch: process.arch,
      osVersion: process.getSystemVersion()
    }
  })
}
