import type { Channel, DmThreadWithOther, ModalType, Profile, Role, RolePermission, Screen, Server, ServerEmoji, Sticker, VoiceInvite, VoicePeerInfo } from './types'
import type { ScreenShareApi } from './useScreenShare'
import type { SavedCredentials } from '../../../shared/ipc'

export type AuthState = 'loading' | 'signedOut' | 'signedIn'

export interface Notice {
  kind: 'error' | 'success'
  text: string
}

export type { SavedCredentials }

/** Contrato público do contexto do app — consumido por todos os componentes. */
export interface AppContextValue {
  authState: AuthState
  profile: Profile | null
  servers: Server[]
  dms: DmThreadWithOther[]
  channels: Channel[]
  onlineUsers: Set<string>
  screen: Screen | null
  modal: ModalType
  notice: Notice | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, username: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  /** define a nova senha (sessão de recuperação ativa) e encerra a sessão */
  updatePassword: (newPassword: string) => Promise<void>
  /** true quando o app foi aberto por um link de redefinição válido */
  recoveryMode: boolean
  /** sai do modo de recuperação sem alterar a senha */
  clearRecovery: () => void
  logout: () => Promise<void>
  savedCredentials: SavedCredentials | null
  /** lembra a sessão atual (refresh token) para o login automático */
  storeCredentials: (meta: { email: string; username: string }) => Promise<void>
  /** entra com a sessão lembrada; falha se o token expirou/foi revogado */
  loginWithSaved: () => Promise<void>
  forgetCredentials: () => Promise<void>
  selectServer: (serverId: string) => Promise<void>
  selectChannel: (channelId: string) => void
  selectDm: (threadId: string | null) => void
  openModal: (modal: Exclude<ModalType, null>) => void
  closeModal: () => void
  renamingChannel: Channel | null
  openRenameChannel: (channel: Channel) => void
  handleRenameChannel: (channelId: string, name: string) => Promise<void>
  handleCreateServer: (name: string) => Promise<Server | null>
  handleJoinServer: (code: string) => Promise<Server | null>
  handleCreateChannel: (name: string, type: 'text' | 'voice') => Promise<void>
  handleDeleteChannel: (channelId: string) => Promise<void>
  handleDeleteServer: () => Promise<void>
  // ------------------------------------------------------------
  // Cargos (estilo Discord)
  // ------------------------------------------------------------
  /** cargos do servidor ativo (do mais baixo para o mais alto) */
  roles: Role[]
  /** role_id por membro do servidor ativo (user_id -> ids) */
  memberRoleIds: Record<string, string[]>
  /** contador que muda quando a lista de membros deve ser recarregada */
  membersVersion: number
  handleCreateRole: (name: string, color: string | null, permissions: RolePermission[]) => Promise<boolean>
  handleUpdateRole: (
    roleId: string,
    fields: { name?: string; color?: string | null; permissions?: RolePermission[] }
  ) => Promise<boolean>
  handleDeleteRole: (roleId: string) => Promise<boolean>
  handleMoveRole: (roleId: string, direction: 'up' | 'down') => Promise<boolean>
  handleSetMemberRoles: (userId: string, roleIds: string[]) => Promise<boolean>
  handleKickMember: (userId: string, username: string) => Promise<boolean>
  /** permissão efetiva do usuário no servidor ativo (dono/admin implicam tudo) */
  hasServerPermission: (perm: RolePermission) => boolean
  sendChannelMessage: (channelId: string, content: string) => Promise<void>
  sendDmMessage: (threadId: string, content: string) => Promise<void>
  serverEmojis: ServerEmoji[]
  addEmoji: (name: string, file: File) => Promise<boolean>
  removeEmoji: (emojiId: string) => Promise<void>
  // ------------------------------------------------------------
  // Figurinhas (stickers) e GIFs (Etapa 4)
  // ------------------------------------------------------------
  /** figurinhas disponíveis: pessoais minhas + as do servidor ativo */
  stickers: Sticker[]
  /** envia a figurinha: scope 'user' (pessoal) ou id do servidor */
  addSticker: (name: string, file: File, scope: 'user' | string) => Promise<boolean>
  /** exclui a figurinha (pessoal: só o dono; de servidor: só o dono do servidor) */
  removeSticker: (stickerId: string) => Promise<void>
  updateAvatarUrl: (url: string) => void
  voiceChannelId: string | null
  voiceRoster: VoicePeerInfo[]
  // quem está em CADA canal de voz (mesmo sem estar dentro da sala)
  voicePresence: Record<string, VoicePeerInfo[]>
  // início da atividade de cada canal de voz (channelId -> started_at ISO)
  voiceSessions: Record<string, string>
  voiceMuted: boolean
  voiceDeafened: boolean
  speakingUsers: Set<string>
  voiceInputLevel: number
  microphones: MediaDeviceInfo[]
  selectedMicId: string | null
  peerVolumes: Record<string, number>
  setPeerVolume: (userId: string, volume: number) => void
  peerSignals: Record<string, number>
  peerConnections: Record<string, RTCPeerConnectionState>
  micVolume: number
  setMicVolume: (volume: number) => void
  internetPing: number | null
  internetQuality: number
  outputDevices: MediaDeviceInfo[]
  selectedOutputId: string | null
  outputVolume: number
  loadOutputDevices: () => Promise<void>
  selectOutputDevice: (deviceId: string) => Promise<void>
  setOutputVolume: (volume: number) => void
  noiseSuppression: boolean
  setNoiseSuppression: (enabled: boolean) => Promise<void>
  /** redução ativa de ruído (ANC: highpass + lowpass + compressor) */
  activeNoiseReduction: boolean
  setActiveNoiseReduction: (enabled: boolean) => Promise<void>
  joinVoice: (channelId: string) => Promise<void>
  leaveVoice: () => Promise<void>
  toggleVoiceMute: () => void
  toggleVoiceDeafen: () => void
  loadMicrophones: () => Promise<void>
  selectMicrophone: (deviceId: string) => Promise<void>
  // compartilhamento de tela
  screenShareState: ScreenShareApi['screenShareState']
  screenSharePickerOpen: ScreenShareApi['screenSharePickerOpen']
  loadScreenSources: ScreenShareApi['loadScreenSources']
  openScreenSharePicker: ScreenShareApi['openScreenSharePicker']
  closeScreenSharePicker: ScreenShareApi['closeScreenSharePicker']
  confirmScreenSource: ScreenShareApi['confirmScreenSource']
  setSystemAudioEnabled: ScreenShareApi['setSystemAudioEnabled']
  stopScreenShare: ScreenShareApi['stopScreenShare']
  notify: (kind: Notice['kind'], text: string) => void
  // ------------------------------------------------------------
  // Notificações e não lidas (Etapa 1)
  // ------------------------------------------------------------
  /** canais de todos os servidores que sou membro (mapa channel_id -> server_id) */
  allChannels: Channel[]
  /** mensagens não lidas por canal de texto */
  unreadChannels: Record<string, number>
  /** mensagens não lidas por conversa direta (thread_id) */
  unreadDms: Record<string, number>
  /** soma das não lidas de canais de texto por servidor (badge no rail) */
  unreadByServer: Record<string, number>
  /** soma de todas as não lidas de DMs (badge da aba de conversas no rail) */
  unreadDmTotal: number
  /** zera o contador do canal (marcar como lido) */
  markChannelRead: (channelId: string) => void
  /** zera o contador da conversa (marcar como lida) */
  markDmRead: (threadId: string) => void
  // ------------------------------------------------------------
  // Convites diretos para salas de voz (Etapa 2)
  // ------------------------------------------------------------
  /** convites recebidos (popup com Entrar/Recusar) */
  incomingInvites: VoiceInvite[]
  /** envia convite da chamada atual para alguém (código da lista) */
  sendVoiceInviteTo: (toUserId: string) => Promise<boolean>
  /** aceita o convite: navega até o servidor/canal e entra na chamada */
  acceptVoiceInvite: (invite: VoiceInvite) => Promise<void>
  /** descarta o convite */
  declineVoiceInvite: (invite: VoiceInvite) => void
}
