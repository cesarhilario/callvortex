// Contrato IPC compartilhado entre main, preload e renderer:
// nomes de canais e tipos trafegados. Sem dependências de runtime.

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

/** Sessão lembrada ("Lembrar de mim"): nunca guarda a senha, só o refresh token. */
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

/** Protocolo do deep-link (callvortex://reset#...). */
export const DEEP_LINK_PROTOCOL = 'callvortex'
/** Host esperado no deep-link de redefinição de senha. */
export const DEEP_LINK_RESET_HOST = 'reset'

/** Estado de uma permissão de privacidade do sistema (só o macOS informa). */
export type PermissionStatus = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown'

export interface PermissionsState {
  microphone: PermissionStatus
  screen: PermissionStatus
}

/** Painéis de configurações do sistema que o app sabe abrir (varia por SO). */
export type SettingsPane = 'microphone' | 'screen' | 'local-network' | 'firewall'

export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  /** process.platform: 'darwin' | 'win32' | 'linux' */
  platform: string
  arch: string
  /** versão do SO (process.getSystemVersion) */
  osVersion: string
}
