import { contextBridge, ipcRenderer } from 'electron'

export interface SavedCredentials {
  email: string
  password: string
  username: string
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

// API mínima exposta ao renderer (o Supabase roda direto no renderer via fetch/websocket)
const api = {
  platform: process.platform,
  // Credenciais lembradas — criptografadas no processo principal (safeStorage)
  saveCredentials: (creds: SavedCredentials): Promise<boolean> => ipcRenderer.invoke('credentials:save', creds),
  loadCredentials: (): Promise<SavedCredentials | null> => ipcRenderer.invoke('credentials:load'),
  clearCredentials: (): Promise<boolean> => ipcRenderer.invoke('credentials:clear'),
  // Compartilhamento de tela — listagem das fontes (para o picker) e
  // registro da fonte escolhida; a captura em si é feita no renderer via
  // getDisplayMedia(), atendido pelo handler do processo principal.
  screenShare: {
    getSources: (): Promise<ScreenSourceInfo[]> => ipcRenderer.invoke('screen-share:get-sources'),
    selectSource: (sourceId: string): Promise<boolean> => ipcRenderer.invoke('screen-share:select-source', sourceId),
    /** true em Wayland: o picker é o do sistema (portal), não o interno */
    isWayland: (): Promise<boolean> => ipcRenderer.invoke('screen-share:is-wayland'),
    /** true quando a plataforma oferece áudio do sistema (loopback no Windows) */
    supportsSystemAudio: (): Promise<boolean> => ipcRenderer.invoke('screen-share:supports-system-audio')
  },
  // Voz — correção do Firewall do Windows com confirmação do sistema (UAC)
  voice: {
    fixFirewall: (): Promise<FirewallFixResult> => ipcRenderer.invoke('voice:fix-firewall')
  },
  // Deep-link (redefinição de senha): recebe URLs callvortex:// abertas pelo
  // sistema (clique no link do e-mail) e as repassa ao renderer.
  onDeepLink: (cb: (url: string) => void): (() => void) => {
    const listener = (_: unknown, url: string): void => cb(url)
    ipcRenderer.on('auth:deep-link', listener)
    return () => ipcRenderer.removeListener('auth:deep-link', listener)
  },
  /** URL de deep-link pendente do primeiro lançamento (ou null). */
  takePendingDeepLink: (): Promise<string | null> => ipcRenderer.invoke('auth:take-pending-deep-link')
}

contextBridge.exposeInMainWorld('api', api)
