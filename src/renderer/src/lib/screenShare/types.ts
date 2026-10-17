/**
 * Tipos do compartilhamento de tela.
 * A "chamada" no CallVortex é um canal de voz (channels.type='voice');
 * a autorização real vive no Supabase (RLS + RPCs) — estes tipos apenas
 * descrevem o estado local e as mensagens permitidas.
 */

/** Fonte capturável listada pelo processo principal (tela ou janela). */
export interface ScreenSourceInfo {
  id: string
  name: string
  thumbnail: string | null
  icon: string | null
}

/** Tipos de sinalização aceitos pelo backend (whitelist em call_signals.kind). */
export type ScreenSignalKind = 'screen-offer' | 'screen-answer' | 'screen-ice'

export function isScreenSignalKind(value: unknown): value is ScreenSignalKind {
  return value === 'screen-offer' || value === 'screen-answer' || value === 'screen-ice'
}

/** Estado do compartilhamento (local + remoto), consumido pela UI. */
export interface ScreenShareState {
  /** ciclo de vida do MEU compartilhamento */
  status: ScreenShareStatus
  /** id do usuário compartilhando agora (eu ou outro participante); null se ninguém */
  sharerId: string | null
  /** stream local quando EU compartilho */
  localStream: MediaStream | null
  /** stream remoto quando OUTRO compartilha */
  remoteStream: MediaStream | null
  connectionState: RTCPeerConnectionState | null
  error: string | null
  /**
   * Áudio do sistema capturado junto com o vídeo (só existe onde a
   * plataforma oferece — Windows, via loopback). Enquanto for false, o
   * botão de áudio da tela aparece desabilitado.
   */
  systemAudioAvailable: boolean
  /** Áudio do sistema está sendo transmitido (misturado à voz) agora. */
  systemAudioEnabled: boolean
}

export type ScreenShareStatus = 'idle' | 'starting' | 'sharing' | 'stopping'

export const INITIAL_SCREEN_SHARE_STATE: ScreenShareState = {
  status: 'idle',
  sharerId: null,
  localStream: null,
  remoteStream: null,
  connectionState: null,
  error: null,
  systemAudioAvailable: false,
  systemAudioEnabled: false
}
