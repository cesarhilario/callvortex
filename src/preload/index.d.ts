import type {
  AppInfo,
  FirewallFixResult,
  PermissionsState,
  SavedCredentials,
  ScreenSourceInfo,
  SettingsPane
} from '../shared/ipc'

export type { AppInfo, FirewallFixResult, PermissionsState, SavedCredentials, ScreenSourceInfo, SettingsPane }

export interface Api {
  platform: string
  saveCredentials: (creds: SavedCredentials) => Promise<boolean>
  loadCredentials: () => Promise<SavedCredentials | null>
  clearCredentials: () => Promise<boolean>
  screenShare: {
    getSources: () => Promise<ScreenSourceInfo[]>
    /** registra a fonte escolhida no picker; o getDisplayMedia() usará ela */
    selectSource: (sourceId: string) => Promise<boolean>
    /** true em Wayland: o picker é o do sistema (portal), não o interno */
    isWayland: () => Promise<boolean>
    /** true quando a plataforma oferece áudio do sistema (loopback no Windows) */
    supportsSystemAudio: () => Promise<boolean>
  }
  voice: {
    /** libera o áudio no Firewall do Windows (abre confirmação UAC) */
    fixFirewall: () => Promise<FirewallFixResult>
  }
  permissions: {
    /** estado das permissões (só o macOS informa; null nos demais) */
    get: () => Promise<PermissionsState | null>
    /** mostra o pedido de microfone do sistema (macOS, se ainda não decidido) */
    requestMicrophone: () => Promise<boolean>
    /** abre o painel correspondente nas configurações do sistema (false se não houver) */
    openSettings: (pane: SettingsPane) => Promise<boolean>
  }
  /** menu nativo → Configurações…; retorna função para cancelar a inscrição */
  onOpenSettings: (cb: () => void) => () => void
  /** nome/versão do app e do ambiente */
  getAppInfo: () => Promise<AppInfo | null>
  /**
   * Registra um callback para URLs `callvortex://` abertas pelo sistema
   * (ex.: link de redefinição de senha do e-mail). Retorna uma função para
   * cancelar a inscrição.
   */
  onDeepLink: (cb: (url: string) => void) => () => void
  /** URL de deep-link pendente do primeiro lançamento (ou null). */
  takePendingDeepLink: () => Promise<string | null>
}

declare global {
  interface Window {
    api: Api
  }
}

export {}
