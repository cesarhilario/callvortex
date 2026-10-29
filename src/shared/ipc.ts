
export const IPC = {
  credentialsSave: 'credentials:save',
  credentialsLoad: 'credentials:load',
  credentialsClear: 'credentials:clear',
  screenShareGetSources: 'screen-share:get-sources',
  screenShareSelectSource: 'screen-share:select-source',
  screenShareIsWayland: 'screen-share:is-wayland',
  screenShareSupportsSystemAudio: 'screen-share:supports-system-audio',
  voiceFixFirewall: 'voice:fix-firewall',
  authDeepLink: 'auth:deep-link',
  authTakePendingDeepLink: 'auth:take-pending-deep-link',
  permissionsGet: 'permissions:get',
  permissionsRequestMicrophone: 'permissions:request-microphone',
  permissionsOpenSettings: 'permissions:open-settings',
  appGetInfo: 'app:get-info',
  appOpenSettings: 'app:open-settings'
} as const

export interface SavedCredentials {
  email: string
  username: string
  refreshToken: string
}

export interface ScreenSourceInfo {
  id: string
  name: string
  thumbnail: string | null
  icon: string | null
}

export interface FirewallFixResult {
  ok: boolean
  message: string
}

export const DEEP_LINK_PROTOCOL = 'callvortex'
export const DEEP_LINK_RESET_HOST = 'reset'

export type PermissionStatus = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown'

export interface PermissionsState {
  microphone: PermissionStatus
  screen: PermissionStatus
}

export type SettingsPane = 'microphone' | 'screen' | 'local-network' | 'firewall'

export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  platform: string
  arch: string
  osVersion: string
}
