import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type FirewallFixResult,
  type AppInfo,
  type PermissionsState,
  type SettingsPane,
  type SavedCredentials,
  type ScreenSourceInfo
} from '../shared/ipc'

// API mínima exposta ao renderer (o Supabase roda direto no renderer via fetch/websocket)
const api = {
  platform: process.platform,
  // Credenciais lembradas — criptografadas no processo principal (safeStorage)
  saveCredentials: (creds: SavedCredentials): Promise<boolean> => ipcRenderer.invoke(IPC.credentialsSave, creds),
  loadCredentials: (): Promise<SavedCredentials | null> => ipcRenderer.invoke(IPC.credentialsLoad),
  clearCredentials: (): Promise<boolean> => ipcRenderer.invoke(IPC.credentialsClear),
  // Compartilhamento de tela — listagem das fontes (para o picker) e
  // registro da fonte escolhida; a captura em si é feita no renderer via
  // getDisplayMedia(), atendido pelo handler do processo principal.
  screenShare: {
    getSources: (): Promise<ScreenSourceInfo[]> => ipcRenderer.invoke(IPC.screenShareGetSources),
    selectSource: (sourceId: string): Promise<boolean> => ipcRenderer.invoke(IPC.screenShareSelectSource, sourceId),
    /** true em Wayland: o picker é o do sistema (portal), não o interno */
    isWayland: (): Promise<boolean> => ipcRenderer.invoke(IPC.screenShareIsWayland),
    /** true quando a plataforma oferece áudio do sistema (loopback no Windows) */
    supportsSystemAudio: (): Promise<boolean> => ipcRenderer.invoke(IPC.screenShareSupportsSystemAudio)
  },
  // Voz — correção do Firewall do Windows com confirmação do sistema (UAC)
  voice: {
    fixFirewall: (): Promise<FirewallFixResult> => ipcRenderer.invoke(IPC.voiceFixFirewall)
  },
  // Permissões do sistema (estado só no macOS) e atalhos para os ajustes
  permissions: {
    get: (): Promise<PermissionsState | null> => ipcRenderer.invoke(IPC.permissionsGet),
    requestMicrophone: (): Promise<boolean> => ipcRenderer.invoke(IPC.permissionsRequestMicrophone),
    openSettings: (pane: SettingsPane): Promise<boolean> => ipcRenderer.invoke(IPC.permissionsOpenSettings, pane)
  },
  /** nome/versão do app e do ambiente (tela de Configurações) */
  getAppInfo: (): Promise<AppInfo | null> => ipcRenderer.invoke(IPC.appGetInfo),
  /** o menu nativo (CallVortex/Arquivo → Configurações…) pediu para abrir as configurações */
  onOpenSettings: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on(IPC.appOpenSettings, listener)
    return () => ipcRenderer.removeListener(IPC.appOpenSettings, listener)
  },
  // Deep-link (redefinição de senha): recebe URLs callvortex:// abertas pelo
  // sistema (clique no link do e-mail) e as repassa ao renderer.
  onDeepLink: (cb: (url: string) => void): (() => void) => {
    const listener = (_: unknown, url: string): void => cb(url)
    ipcRenderer.on(IPC.authDeepLink, listener)
    return () => ipcRenderer.removeListener(IPC.authDeepLink, listener)
  },
  /** URL de deep-link pendente do primeiro lançamento (ou null). */
  takePendingDeepLink: (): Promise<string | null> => ipcRenderer.invoke(IPC.authTakePendingDeepLink)
}

contextBridge.exposeInMainWorld('api', api)
