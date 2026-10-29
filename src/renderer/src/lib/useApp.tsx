import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { getSupabase } from './supabase'
import * as api from './api'
import { useVoice } from './useVoice'
import { useScreenShare } from './useScreenShare'
import { useRealtimeSubscriptions } from './realtime'
import { measurePing, qualityFromPing } from './internet'
import { VOICE_REJOIN_MS, readVoiceSession } from './settings'
import { playMessageSound } from './sounds'
import { subscribeVoiceInvites, sendVoiceInvite } from './invites'
import { writeVoiceSession } from './settings'
import { effectivePermissions } from './roles'
import type { AppContextValue, AuthState, Notice, SavedCredentials } from './app-types'
import type { Channel, DmThreadWithOther, MemberRole, ModalType, Profile, Role, RolePermission, Screen, Server, ServerEmoji, Sticker, VoiceInvite, VoicePeerInfo } from './types'

export type { Notice, SavedCredentials } from './app-types'

const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp deve ser usado dentro de <AppProvider>')
  return ctx
}

export function AppProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [savedCredentials, setSavedCredentials] = useState<SavedCredentials | null>(null)
  const savedCredentialsRef = useRef<SavedCredentials | null>(null)
  const [dataReady, setDataReady] = useState(false)
  const [servers, setServers] = useState<Server[]>([])
  const [dms, setDms] = useState<DmThreadWithOther[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [serverEmojis, setServerEmojis] = useState<ServerEmoji[]>([])
  // ------------------------------------------------------------
  // Cargos do servidor ativo (estilo Discord): cargos + atribuições
  // por membro, recarregados ao trocar de servidor e por Realtime.
  // ------------------------------------------------------------
  const [roles, setRoles] = useState<Role[]>([])
  const [memberRoleIds, setMemberRoleIds] = useState<Record<string, string[]>>({})
  // contador que forca quem exibe a lista de membros a recarregar (kick)
  const [membersVersion, setMembersVersion] = useState(0)
  // figurinhas (stickers) disponíveis: pessoais minhas + do servidor ativo
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [screen, setScreen] = useState<Screen | null>(null)
  const [modal, setModal] = useState<ModalType>(null)
  const [renamingChannel, setRenamingChannel] = useState<Channel | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  // true quando o app foi aberto por um link de redefinição de senha válido
  const [recoveryMode, setRecoveryMode] = useState(false)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // presença em cada canal de voz (fora da sala) + atividade das salas
  const [voicePresence, setVoicePresence] = useState<Record<string, VoicePeerInfo[]>>({})
  const [voiceSessions, setVoiceSessions] = useState<Record<string, string>>({})
  // ping da conexão com o servidor do app (sinal de internet)
  const [internetPing, setInternetPing] = useState<number | null>(null)
  // ------------------------------------------------------------
  // Notificações e não lidas (Etapa 1)
  // ------------------------------------------------------------
  const [allChannels, setAllChannels] = useState<Channel[]>([])
  const [unreadChannels, setUnreadChannels] = useState<Record<string, number>>({})
  const [unreadDms, setUnreadDms] = useState<Record<string, number>>({})
  // convites diretos de voz recebidos (popups flutuantes)
  const [incomingInvites, setIncomingInvites] = useState<VoiceInvite[]>([])

  // refs com os valores "ao vivo" para as assinaturas de notificação
  // (o callback do realtime lê os valores atuais sem refazer o subscribe)
  const screenRef = useRef<Screen | null>(null)
  const allChannelsRef = useRef<Channel[]>([])
  const dmsRef = useRef(dms)
  const profileRef = useRef(profile)
  const activeServersRef = useRef(servers)
  const voiceChannelIdRef = useRef<string | null>(null)

  const notify = useCallback((kind: Notice['kind'], text: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    setNotice({ kind, text })
    noticeTimer.current = setTimeout(() => setNotice(null), 5000)
  }, [])

  // mantém as refs de notificação sempre com o valor do render atual

  screenRef.current = screen
  dmsRef.current = dms
  profileRef.current = profile
  activeServersRef.current = servers

  // ------------------------------------------------------------
  // Voz (WebRTC + dispositivos + controles) — hook próprio
  // ------------------------------------------------------------
  const activeServerId = screen?.type === 'server' ? screen.serverId : null
  // mapa consolidado de canais (canais -> servidor): os canais carregados
  // do servidor ativo (frescos) sobrescrevem os da busca geral de todos
  const channelList = useMemo(() => {
    if (activeServerId === null) return allChannels
    const others = allChannels.filter((c) => c.server_id !== activeServerId)
    return [...others, ...channels]
  }, [allChannels, channels, activeServerId])
  allChannelsRef.current = channelList
  const voice = useVoice({ profile, activeServerId, notify })
  voiceChannelIdRef.current = voice.voiceChannelId

  // ------------------------------------------------------------
  // Compartilhamento de tela (reutiliza a malha WebRTC da voz)
  // ------------------------------------------------------------
  const screenShare = useScreenShare({
    voiceManager: voice.voiceManager,
    profileId: profile?.id ?? null,
    voiceChannelId: voice.voiceChannelId,
    notify
  })

  // ------------------------------------------------------------
  // Realtime (presença, DMs, servidores, canais, voz, perfis)
  // ------------------------------------------------------------
  useRealtimeSubscriptions({
    signedIn: authState === 'signedIn',
    profile,
    activeServerId,
    channels,
    voiceManager: voice.voiceManager,
    onMyProfileUpdate: voice.updateProfile,
    onVoiceChannelDeleted: voice.onJoinedChannelDeleted,
    setOnlineUsers,
    setDms,
    setServers,
    setScreen,
    setChannels,
    setProfile,
    setVoicePresence,
    setVoiceSessions
  })

  // ------------------------------------------------------------
  // Credenciais lembradas ("Lembrar de mim")
  // ------------------------------------------------------------
  useEffect(() => {
    void window.api
      .loadCredentials()
      .then((c) => setSavedCredentials(c))
      .catch(() => setSavedCredentials(null))
  }, [])

  useEffect(() => {
    savedCredentialsRef.current = savedCredentials
  }, [savedCredentials])

  const storeCredentials = useCallback(async (meta: { email: string; username: string }) => {
    const { data } = await getSupabase().auth.getSession()
    const refreshToken = data.session?.refresh_token
    if (!refreshToken) return
    const creds: SavedCredentials = { ...meta, refreshToken }
    savedCredentialsRef.current = creds
    setSavedCredentials(creds)
    await window.api.saveCredentials(creds)
  }, [])

  const forgetCredentials = useCallback(async () => {
    savedCredentialsRef.current = null
    setSavedCredentials(null)
    await window.api.clearCredentials()
  }, [])

  const loginWithSaved = useCallback(async () => {
    const saved = savedCredentialsRef.current
    if (!saved) throw new Error('Sem sessão lembrada.')
    const { data, error } = await getSupabase().auth.refreshSession({ refresh_token: saved.refreshToken })
    if (error || !data.session) {
      const status = (error as { status?: number } | null)?.status
      if (status && status >= 400 && status < 500) await forgetCredentials()
      throw error ?? new Error('Sessão expirada.')
    }
    setAuthState('signedIn')
  }, [forgetCredentials])

  // ------------------------------------------------------------
  // Sessão
  // ------------------------------------------------------------
  useEffect(() => {
    const supabase = getSupabase()
    supabase.auth.getSession().then(({ data }) => {
      setAuthState(data.session ? 'signedIn' : 'signedOut')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') setAuthState('signedIn')
      const saved = savedCredentialsRef.current
      if (saved && session && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') &&
          session.refresh_token !== saved.refreshToken) {
        const next = { ...saved, refreshToken: session.refresh_token }
        savedCredentialsRef.current = next
        void window.api.saveCredentials(next)
      }
      if (event === 'SIGNED_OUT') {
        voice.reset()
        setAuthState('signedOut')
        setProfile(null)
        setServers([])
        setDms([])
        setChannels([])
        setOnlineUsers(new Set())
        setScreen(null)
        setDataReady(false)
      }
    })
    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ------------------------------------------------------------
  // Deep-link callvortex://reset (redefinição de senha)
  // O clique no link do e-mail reabre o app com os tokens no fragmento.
  // Aplicamos a sessão temporária e entramos no modo "definir nova senha".
  // ------------------------------------------------------------
  const handleDeepLink = useCallback(async (url: string) => {
    if (!url.startsWith('callvortex://')) return
    const ok = await api.applyRecoveryLink(url)
    if (ok) setRecoveryMode(true)
  }, [])

  useEffect(() => {
    if (!window.api?.onDeepLink) return
    // Link do primeiro lançamento (pode ter chegado antes deste listener)
    void window.api.takePendingDeepLink().then((url) => {
      if (url) void handleDeepLink(url)
    })
    // Links recebidos com o app já aberto
    const off = window.api.onDeepLink((url) => {
      void handleDeepLink(url)
    })
    return off
  }, [handleDeepLink])

  // ------------------------------------------------------------
  // Carregamento inicial ao entrar
  // ------------------------------------------------------------
  useEffect(() => {
    if (authState !== 'signedIn') return
    let cancelled = false
    const load = async (): Promise<void> => {
      try {
        setDataReady(false)
        const supabase = getSupabase()
        const {
          data: { user }
        } = await supabase.auth.getUser()
        if (!user || cancelled) return
        const p = await api.fetchProfile(user.id)
        if (cancelled) return
        setProfile(p)
        const [srvRes, dmRes] = await Promise.allSettled([api.fetchMyServers(), api.fetchDmThreads()])
        if (cancelled) return
        setServers(srvRes.status === 'fulfilled' ? srvRes.value : [])
        setDms(dmRes.status === 'fulfilled' ? dmRes.value : [])
        setDataReady(true)
      } catch (e) {
        notify('error', e instanceof Error ? e.message : 'Erro ao carregar dados')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [authState, notify])

  // ------------------------------------------------------------
  // Emojis personalizados do servidor ativo
  // ------------------------------------------------------------
  useEffect(() => {
    if (authState !== 'signedIn') return
    if (screen?.type !== 'server') {
      setServerEmojis([])
      return
    }
    let cancelled = false
    api
      .fetchServerEmojis(screen.serverId)
      .then((e) => {
        if (!cancelled) setServerEmojis(e)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [authState, screen?.type, screen?.type === 'server' ? screen.serverId : null]) // eslint-disable-line react-hooks/exhaustive-deps
  // ------------------------------------------------------------
  // Canais de todos os servidores (mapa channel_id -> server_id):
  // recarrega quando a lista de servidores muda (criou/entrou/excluiu)
  // ------------------------------------------------------------
  // ------------------------------------------------------------
  // Cargos do servidor ativo (estilo Discord)
  // Cargos + atribuições chegam por consulta e se mantêm ao vivo via
  // Realtime (roles / member_roles). A lista de membros do servidor
  // reagrupa sozinha quando alguém cria/move/atribui um cargo.
  // ------------------------------------------------------------
  const reloadRoles = useCallback(async (serverId: string): Promise<void> => {
    try {
      const [r, mr] = await Promise.all([api.fetchRoles(serverId), api.fetchMemberRoles(serverId)])
      setRoles(r)
      const map: Record<string, string[]> = {}
      for (const m of mr) {
        ;(map[m.user_id] ??= []).push(m.role_id)
      }
      setMemberRoleIds(map)
    } catch {
      // sem permissão de leitura ou falha de rede: segue sem cargos (o app funciona)
      setRoles([])
      setMemberRoleIds({})
    }
  }, [])

  useEffect(() => {
    if (authState !== 'signedIn') return
    if (screen?.type !== 'server') {
      setRoles([])
      setMemberRoleIds({})
      return
    }
    const serverId = screen.serverId
    let cancelled = false
    void reloadRoles(serverId)
    const supabase = getSupabase()
    const ch = supabase.channel(`roles-live-${serverId}`)
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'roles' }, () => {
      if (!cancelled) void reloadRoles(serverId)
    })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_roles' }, () => {
        if (!cancelled) void reloadRoles(serverId)
      })
    void ch.subscribe()
    return () => {
      cancelled = true
      void supabase.removeChannel(ch)
    }
  }, [authState, screen?.type, activeServerId, reloadRoles]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateRole = useCallback(
    async (name: string, color: string | null, permissions: RolePermission[]): Promise<boolean> => {
      if (screen?.type !== 'server') return false
      try {
        await api.createRole(screen.serverId, { name: name.trim(), color, permissions })
        await reloadRoles(screen.serverId)
        notify('success', `Cargo "${name.trim()}" criado!`)
        return true
      } catch (e) {
        notify('error', e instanceof Error ? e.message : 'Erro ao criar cargo')
        return false
      }
    },
    [screen, notify, reloadRoles]
  )

  const handleUpdateRole = useCallback(
    async (roleId: string, fields: { name?: string; color?: string | null; permissions?: RolePermission[] }): Promise<boolean> => {
      if (screen?.type !== 'server') return false
      try {
        await api.updateRole(roleId, fields)
        await reloadRoles(screen.serverId)
        return true
      } catch (e) {
        notify('error', e instanceof Error ? e.message : 'Erro ao salvar cargo')
        return false
      }
    },
    [screen, notify, reloadRoles]
  )

  const handleDeleteRole = useCallback(
    async (roleId: string): Promise<boolean> => {
      if (screen?.type !== 'server') return false
      try {
        await api.deleteRole(roleId)
        await reloadRoles(screen.serverId)
        notify('success', 'Cargo excluído.')
        return true
      } catch (e) {
        notify('error', e instanceof Error ? e.message : 'Erro ao excluir cargo')
        return false
      }
    },
    [screen, notify, reloadRoles]
  )

  /** Move um cargo uma posição (up = mais alto). Renumera 1..n de cima para baixo. */
  const handleMoveRole = useCallback(
    async (roleId: string, direction: 'up' | 'down'): Promise<boolean> => {
      if (screen?.type !== 'server') return false
      const sorted = [...roles].sort((a, b) => b.position - a.position || a.name.localeCompare(b.name))
      const idx = sorted.findIndex((r) => r.id === roleId)
      const j = direction === 'up' ? idx - 1 : idx + 1
      if (idx < 0 || j < 0 || j >= sorted.length) return false
      ;[sorted[idx], sorted[j]] = [sorted[j], sorted[idx]]
      try {
        const base = sorted.length
        for (let i = 0; i < sorted.length; i++) {
          const pos = base - i
          if (sorted[i].position !== pos) await api.updateRole(sorted[i].id, { position: pos })
        }
        await reloadRoles(screen.serverId)
        return true
      } catch (e) {
        notify('error', e instanceof Error ? e.message : 'Você não pode mover cargos no seu nível ou acima dele.')
        await reloadRoles(screen.serverId)
        return false
      }
    },
    [screen, roles, notify, reloadRoles]
  )

  const handleSetMemberRoles = useCallback(
    async (userId: string, roleIds: string[]): Promise<boolean> => {
      if (screen?.type !== 'server') return false
      try {
        await api.setMemberRoles(screen.serverId, userId, roleIds)
        await reloadRoles(screen.serverId)
        return true
      } catch (e) {
        notify('error', e instanceof Error ? e.message : 'Não foi possível salvar os cargos do membro')
        return false
      }
    },
    [screen, notify, reloadRoles]
  )

  const handleKickMember = useCallback(
    async (userId: string, username: string): Promise<boolean> => {
      if (screen?.type !== 'server') return false
      try {
        await api.kickMember(screen.serverId, userId)
        await reloadRoles(screen.serverId)
        setMembersVersion((v) => v + 1)
        notify('success', `${username} foi removido do servidor.`)
        return true
      } catch (e) {
        notify('error', e instanceof Error ? e.message : 'Não foi possível remover o membro')
        return false
      }
    },
    [screen, notify, reloadRoles]
  )

  // ----------------------------------------------------------
  // Figurinhas: minhas pessoais + as do servidor ativo (Etapa 4)
  // Recarrega ao trocar de tela/servidor e reage a INSERT/DELETE na
  // tabela `stickers` via Realtime (gestor adiciona sem reiniciar o app).
  // ----------------------------------------------------------
  const stickerServerId = screen?.type === 'server' ? screen.serverId : null
  useEffect(() => {
    if (authState !== 'signedIn') {
      setStickers([])
      return
    }
    let cancelled = false
    const reload = (): void => {
      void api
        .fetchStickers(stickerServerId)
        .then((s) => {
          if (!cancelled) setStickers(s)
        })
        .catch(() => undefined)
    }
    reload()
    const supabase = getSupabase()
    const ch = supabase.channel('stickers-live')
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stickers' }, () => reload())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'stickers' }, () => reload())
    void ch.subscribe()
    return () => {
      cancelled = true
      void supabase.removeChannel(ch)
    }
  }, [authState, stickerServerId])

  const serverIds = useMemo(() => servers.map((s) => s.id).join(','), [servers])
  useEffect(() => {
    if (authState !== 'signedIn') {
      setAllChannels([])
      setUnreadChannels({})
      setUnreadDms({})
      setIncomingInvites([])
      return
    }
    const ids = serverIds ? serverIds.split(',') : []
    if (ids.length === 0) {
      setAllChannels([])
      return
    }
    let cancelled = false
    void api
      .fetchAllChannels(ids)
      .then((c) => {
        if (!cancelled) setAllChannels(c)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [authState, serverIds])

  // ------------------------------------------------------------
  // Assinatura global de novas mensagens (canais + DMs):
  //  - incrementa o badge da conversa/canal que NÃO está focado
  //  - toca o ping de nova mensagem (mesmo caso)
  //  - ignora mensagens do próprio autor e do chat em foco
  // ------------------------------------------------------------
  useEffect(() => {
    if (authState !== 'signedIn') return
    const supabase = getSupabase()
    const ch = supabase.channel('msg-notifications')

    const bumpChannel = (channelId: string): void =>
      setUnreadChannels((prev) => ({ ...prev, [channelId]: (prev[channelId] ?? 0) + 1 }))
    const bumpDm = (threadId: string): void =>
      setUnreadDms((prev) => ({ ...prev, [threadId]: (prev[threadId] ?? 0) + 1 }))

    // mensagem de canal de servidor
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      const row = payload.new as { id: number; channel_id: string; author_id: string } | null
      if (!row || row.author_id === profileRef.current?.id) return
      const channel = allChannelsRef.current.find((c) => c.id === row.channel_id)
      if (!channel || channel.type !== 'text') return // desconhecido ou canal de voz
      if (screenRef.current?.type === 'server' && screenRef.current.channelId === row.channel_id) return // chat focado
      bumpChannel(row.channel_id)
      playMessageSound()
    })
      // mensagem direta
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_messages' }, (payload) => {
        const row = payload.new as { id: number; thread_id: string; author_id: string } | null
        if (!row || row.author_id === profileRef.current?.id) return
        if (!dmsRef.current.some((t) => t.id === row.thread_id)) return // conversa nova: o refresh de dms-live exibe o badge no próximo update
        if (screenRef.current?.type === 'dm' && screenRef.current.threadId === row.thread_id) return // chat focado
        bumpDm(row.thread_id)
        playMessageSound()
      })

    void ch.subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [authState])

  // ------------------------------------------------------------
  // Convites diretos de voz: assinatura + ações (Etapa 2)
  // ------------------------------------------------------------
  useEffect(() => {
    if (authState !== 'signedIn' || !profile) return
    const myId = profile.id
    const unsubscribe = subscribeVoiceInvites(myId, (inv) => {
      // sanea: convite precisa ser de outra pessoa, para um servidor de que
      // sou membro e para uma sala em que já não estou
      if (inv.inviter?.id === myId) return
      if (!activeServersRef.current.some((s) => s.id === inv.serverId)) return
      if (voiceChannelIdRef.current === inv.channelId) return
      setIncomingInvites((prev) => {
        if (prev.some((p) => p.channelId === inv.channelId && p.inviter.id === inv.inviter.id)) return prev
        return [inv, ...prev]
      })
      playMessageSound()
    })
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, profile?.id])

  // convites pendurados mais de 5 min expiram sozinhos
  useEffect(() => {
    if (incomingInvites.length === 0) return
    const iv = setInterval(() => {
      setIncomingInvites((prev) => prev.filter((p) => Date.now() - p.invitedAt < 5 * 60_000))
    }, 30_000)
    return () => clearInterval(iv)
  }, [incomingInvites.length])

  // ------------------------------------------------------------
  // Focar canal/conversa zera o badge (marcar como lido)
  // ------------------------------------------------------------
  useEffect(() => {
    if (screen?.type === 'server' && screen.channelId) {
      const channelId = screen.channelId
      setUnreadChannels((prev) => (prev[channelId] ? { ...prev, [channelId]: 0 } : prev))
    } else if (screen?.type === 'dm' && screen.threadId) {
      const threadId = screen.threadId
      setUnreadDms((prev) => (prev[threadId] ? { ...prev, [threadId]: 0 } : prev))
    }
  }, [screen])
  const login = useCallback(async (email: string, password: string) => {
    await api.signIn(email, password)
  }, [])

  const register = useCallback(async (email: string, password: string, username: string) => {
    const p = await api.signUp(email, password, username)
    setProfile(p)
    setAuthState('signedIn')
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    await api.sendPasswordReset(email.trim())
  }, [])

  const updatePassword = useCallback(async (newPassword: string) => {
    await api.updatePassword(newPassword)
    // Sai da sessão de recuperação: o usuário volta ao login e entra com a
    // senha nova (evita ficar "logado" por um link de e-mail).
    const supabase = getSupabase()
    await supabase.auth.signOut()
    setRecoveryMode(false)
  }, [])

  const clearRecovery = useCallback(() => {
    setRecoveryMode(false)
  }, [])

  const logout = useCallback(async () => {
    // Sair explicitamente apaga as credenciais lembradas ("Lembrar de mim")
    // para não voltar a entrar automaticamente na tela de login.
    try {
      await forgetCredentials()
    } catch {
      // falha ao apagar as credenciais salvas — encerra a sessão mesmo assim
    }
    const supabase = getSupabase()
    await supabase.auth.signOut()
  }, [forgetCredentials])

  const selectServer = useCallback(async (serverId: string) => {
    const c = await api.fetchChannels(serverId)
    setChannels(c)
    setScreen({ type: 'server', serverId, channelId: c[0]?.id ?? '' })
  }, [])

  const selectChannel = useCallback((channelId: string) => {
    setScreen((prev) => (prev?.type === 'server' ? { ...prev, channelId } : prev))
  }, [])

  const selectDm = useCallback((threadId: string | null) => {
    setScreen({ type: 'dm', threadId })
  }, [])

  // ------------------------------------------------------------
  // Convites diretos de voz: enviar / aceitar / recusar (Etapa 2)
  // ------------------------------------------------------------
  const sendVoiceInviteTo = useCallback(
    async (toUserId: string): Promise<boolean> => {
      const me = profile
      const channelId = voice.voiceChannelId
      if (!me || !channelId || toUserId === me.id) return false
      const channel = channelList.find((c) => c.id === channelId)
      const server = servers.find((s) => s.id === channel?.server_id)
      if (!channel || !server) return false
      try {
        await sendVoiceInvite(toUserId, {
          channelId,
          serverId: server.id,
          channelName: channel.name,
          serverName: server.name,
          inviter: { id: me.id, username: me.username, avatar_color: me.avatar_color, avatar_url: me.avatar_url },
          invitedAt: Date.now()
        })
        return true
      } catch (e) {
        notify('error', e instanceof Error ? e.message : 'Não foi possível enviar o convite')
        return false
      }
    },
    [profile, voice.voiceChannelId, channelList, servers, notify]
  )

  const acceptVoiceInvite = useCallback(
    async (inv: VoiceInvite) => {
      setIncomingInvites((prev) => prev.filter((p) => !(p.channelId === inv.channelId && p.inviter.id === inv.inviter.id)))
      if (!profile) return
      try {
        await selectServer(inv.serverId) // carrega os canais e troca de servidor
        selectChannel(inv.channelId) // foca o canal de voz
        await voice.rejoin(inv.channelId, profile, inv.serverId)
        // registra a sessão local para o rejoin automático funcionar igual ao joinVoice
        writeVoiceSession({ channelId: inv.channelId, serverId: inv.serverId, at: Date.now() })
        notify('success', `Você entrou na chamada — ${inv.serverName} · ${inv.channelName}`)
      } catch (e) {
        notify('error', e instanceof Error ? e.message : 'Não foi possível entrar na chamada')
      }
    },
    [profile, selectServer, selectChannel, voice, notify]
  )

  const declineVoiceInvite = useCallback((inv: VoiceInvite) => {
    setIncomingInvites((prev) => prev.filter((p) => !(p.channelId === inv.channelId && p.inviter.id === inv.inviter.id)))
  }, [])

  // ------------------------------------------------------------
  // Navegação inicial automática
  // Se o usuário estava num canal de voz e saiu há menos de 20 minutos,
  // volta automaticamente para a sala (se a sessão ainda estiver ativa).
  // ------------------------------------------------------------
  useEffect(() => {
    if (authState !== 'signedIn' || !dataReady || screen || !profile) return
    if (servers.length === 0) {
      setScreen({ type: 'dm', threadId: null })
      return
    }
    const saved = readVoiceSession()
    const recent = saved && Date.now() - saved.at < VOICE_REJOIN_MS
    const server = recent && saved ? servers.find((s) => s.id === saved.serverId) : undefined
    if (server && saved) {
      void (async () => {
        try {
          const chs = await api.fetchChannels(server.id)
          const ch = chs.find((c) => c.id === saved.channelId && c.type === 'voice')
          if (!ch) throw new Error('canal de voz não existe mais')
          setChannels(chs)
          setScreen({ type: 'server', serverId: server.id, channelId: ch.id })
          await voice.rejoin(ch.id, profile, saved.serverId)
        } catch {
          // não conseguiu voltar (canal excluído, sem permissão de microfone…) —
          // segue para o servidor normalmente
          void selectServer(servers[0].id)
        }
      })()
    } else {
      void selectServer(servers[0].id)
    }
  }, [authState, dataReady, screen, servers, profile, voice.rejoin, selectServer]) // eslint-disable-line react-hooks/exhaustive-deps

  const openModal = useCallback((m: Exclude<ModalType, null>) => setModal(m), [])
  const closeModal = useCallback(() => {
    setModal(null)
    setRenamingChannel(null)
  }, [])
  const openRenameChannel = useCallback((channel: Channel) => {
    setRenamingChannel(channel)
    setModal('rename-channel')
  }, [])

  const handleCreateServer = useCallback(
    async (name: string): Promise<Server | null> => {
      try {
        const s = await api.createServer(name)
        const list = await api.fetchMyServers()
        setServers(list)
        await selectServer(s.id)
        if (s.invite_code) {
          notify('success', `Servidor criado! Código de convite: ${s.invite_code}`)
        }
        return s
      } catch (e) {
        notify('error', e instanceof Error ? e.message : 'Erro ao criar servidor')
        return null
      }
    },
    [notify, selectServer]
  )

  const handleJoinServer = useCallback(
    async (code: string): Promise<Server | null> => {
      try {
        const s = await api.joinServerByCode(code)
        const list = await api.fetchMyServers()
        setServers(list)
        await selectServer(s.id)
        notify('success', `Você entrou em "${s.name}"!`)
        return s
      } catch (e) {
        notify('error', e instanceof Error ? e.message : 'Não foi possível entrar no servidor')
        return null
      }
    },
    [notify, selectServer]
  )

  const handleCreateChannel = useCallback(
    async (name: string, type: 'text' | 'voice' = 'text') => {
      if (screen?.type !== 'server') return
      try {
        await api.createChannel(screen.serverId, name, type)
        const c = await api.fetchChannels(screen.serverId)
        setChannels(c)
        setScreen({ ...screen, channelId: c[c.length - 1]?.id ?? '' })
        notify('success', `${type === 'voice' ? '🔊' : '#'}${name.trim().replace(/\s+/g, '-').toLowerCase()} criado!`)
      } catch (e) {
        notify('error', e instanceof Error ? e.message : 'Erro ao criar canal')
      }
    },
    [screen, notify]
  )

  const handleDeleteChannel = useCallback(
    async (channelId: string) => {
      if (screen?.type !== 'server') return
      try {
        await api.deleteChannel(channelId)
        const c = await api.fetchChannels(screen.serverId)
        setChannels(c)
        setScreen((prev) => (prev?.type === 'server' && prev.channelId === channelId ? { ...prev, channelId: c[0]?.id ?? '' } : prev))
        notify('success', 'Canal excluído.')
      } catch (e) {
        notify('error', e instanceof Error ? e.message : 'Erro ao excluir canal')
      }
    },
    [screen, notify]
  )

  const handleRenameChannel = useCallback(
    async (channelId: string, name: string) => {
      if (screen?.type !== 'server') return
      try {
        await api.renameChannel(channelId, name)
        const c = await api.fetchChannels(screen.serverId)
        setChannels(c)
        notify('success', 'Canal renomeado!')
      } catch (e) {
        notify('error', e instanceof Error ? e.message : 'Erro ao renomear canal')
      }
    },
    [screen, notify]
  )

  const handleDeleteServer = useCallback(async () => {
    if (screen?.type !== 'server') return
    try {
      await api.deleteServer(screen.serverId)
      const list = await api.fetchMyServers()
      setServers(list)
      setScreen(null)
      if (list.length > 0) await selectServer(list[0].id)
      notify('success', 'Servidor excluído.')
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Erro ao excluir servidor')
    }
  }, [screen, notify, selectServer])

  const sendChannelMessage = useCallback(
    async (channelId: string, content: string) => {
      try {
        await api.sendChannelMessage(channelId, content)
      } catch (e) {
        notify('error', e instanceof Error ? e.message : 'Erro ao enviar mensagem')
      }
    },
    [notify]
  )

  const sendDmMessage = useCallback(
    async (threadId: string, content: string) => {
      try {
        await api.sendDmMessage(threadId, content)
      } catch (e) {
        notify('error', e instanceof Error ? e.message : 'Erro ao enviar mensagem')
      }
    },
    [notify]
  )

  const addEmoji = useCallback(
    async (name: string, file: File): Promise<boolean> => {
      if (screen?.type !== 'server') return false
      try {
        await api.addServerEmoji(screen.serverId, name, file)
        const list = await api.fetchServerEmojis(screen.serverId)
        setServerEmojis(list)
        notify('success', `Emoji :${name.toLowerCase()}: adicionado!`)
        return true
      } catch (e) {
        notify('error', e instanceof Error ? e.message : 'Erro ao adicionar emoji')
        return false
      }
    },
    [screen, notify]
  )

  const removeEmoji = useCallback(
    async (emojiId: string) => {
      if (screen?.type !== 'server') return
      try {
        await api.removeServerEmoji(emojiId)
        setServerEmojis((prev) => prev.filter((e) => e.id !== emojiId))
        notify('success', 'Emoji excluído.')
      } catch (e) {
        notify('error', e instanceof Error ? e.message : 'Erro ao excluir emoji')
      }
    },
    [screen, notify]
  )

  const updateAvatarUrl = useCallback((url: string) => {
    setProfile((prev) => (prev ? { ...prev, avatar_url: url } : prev))
  }, [])

  const addSticker = useCallback(
    async (name: string, file: File, scope: 'user' | string): Promise<boolean> => {
      try {
        await api.addSticker(scope, name, file)
        // a assinatura Realtime recarrega a lista; aqui apenas informamos
        notify('success', `Figurinha {{${name.toLowerCase()}}} adicionada!`)
        return true
      } catch (e) {
        notify('error', e instanceof Error ? e.message : 'Erro ao adicionar figurinha')
        return false
      }
    },
    [notify]
  )

  const removeSticker = useCallback(
    async (stickerId: string) => {
      try {
        await api.removeSticker(stickerId)
        setStickers((prev) => prev.filter((s) => s.id !== stickerId))
        notify('success', 'Figurinha excluída.')
      } catch (e) {
        notify('error', e instanceof Error ? e.message : 'Erro ao excluir figurinha')
      }
    },
    [notify]
  )

  // ------------------------------------------------------------
  // Sinal de internet: mede o ping até o servidor do app a cada 5s
  // ------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    const tick = async (): Promise<void> => {
      const p = await measurePing()
      if (cancelled) return
      setInternetPing((prev) => {
        if (p === null) return null
        if (prev === null) return p
        return Math.round(prev * 0.6 + p * 0.4) // média suave
      })
    }
    void tick()
    const iv = setInterval(() => void tick(), 5000)
    return () => {
      cancelled = true
      clearInterval(iv)
    }
  }, [])

  const internetQuality = qualityFromPing(internetPing)

  // ------------------------------------------------------------
  // Badges derivados (servidor e aba de DMs)
  // ------------------------------------------------------------
  const unreadByServer = useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of channelList) {
      const n = unreadChannels[c.id] ?? 0
      if (n > 0) map[c.server_id] = (map[c.server_id] ?? 0) + n
    }
    return map
  }, [channelList, unreadChannels])

  const unreadDmTotal = useMemo(() => {
    let total = 0
    for (const n of Object.values(unreadDms)) total += n
    return total
  }, [unreadDms])

  const markChannelRead = useCallback((channelId: string) => {
    setUnreadChannels((prev) => (prev[channelId] ? { ...prev, [channelId]: 0 } : prev))
  }, [])

  const markDmRead = useCallback((threadId: string) => {
    setUnreadDms((prev) => (prev[threadId] ? { ...prev, [threadId]: 0 } : prev))
  }, [])

  // ------------------------------------------------------------
  // Permissões do usuário no servidor ativo (cargos estilo Discord)
  // ------------------------------------------------------------
  const hasServerPermission = useCallback(
    (perm: RolePermission): boolean => {
      if (authState !== 'signedIn' || !profile || screen?.type !== 'server') return false
      const server = servers.find((s) => s.id === screen.serverId)
      const isOwner = !!server && server.owner_id === profile.id
      const myRoleIds = memberRoleIds[profile.id] ?? []
      return effectivePermissions(isOwner, myRoleIds, roles).has(perm)
    },
    [authState, profile, screen, servers, memberRoleIds, roles]
  )

  const value = useMemo<AppContextValue>(
    () => ({
      ...voice,
      ...screenShare,
      authState,
      profile,
      servers,
      dms,
      channels,
      onlineUsers,
      screen,
      modal,
      notice,
      login,
      register,
      resetPassword,
      updatePassword,
      recoveryMode,
      clearRecovery,
      logout,
      savedCredentials,
      storeCredentials,
      loginWithSaved,
      forgetCredentials,
      selectServer,
      selectChannel,
      selectDm,
      openModal,
      closeModal,
      renamingChannel,
      openRenameChannel,
      handleCreateServer,
      handleJoinServer,
      handleCreateChannel,
      handleDeleteChannel,
      handleRenameChannel,
      handleDeleteServer,
      sendChannelMessage,
      sendDmMessage,
      serverEmojis,
      addEmoji,
      removeEmoji,
      stickers,
      addSticker,
      removeSticker,
      updateAvatarUrl,
      voicePresence,
      voiceSessions,
      internetPing,
      internetQuality,
      allChannels: channelList,
      unreadChannels,
      unreadDms,
      unreadByServer,
      unreadDmTotal,
      markChannelRead,
      markDmRead,
      incomingInvites,
      sendVoiceInviteTo,
      acceptVoiceInvite,
      declineVoiceInvite,
      // cargos (estilo Discord)
      roles,
      memberRoleIds,
      membersVersion,
      handleCreateRole,
      handleUpdateRole,
      handleDeleteRole,
      handleMoveRole,
      handleSetMemberRoles,
      handleKickMember,
      hasServerPermission,
      notify
    }),
    [
      voice,
      screenShare,
      authState,
      profile,
      servers,
      dms,
      channels,
      onlineUsers,
      screen,
      modal,
      notice,
      login,
      register,
      resetPassword,
      updatePassword,
      recoveryMode,
      clearRecovery,
      logout,
      savedCredentials,
      storeCredentials,
      loginWithSaved,
      forgetCredentials,
      selectServer,
      selectChannel,
      selectDm,
      openModal,
      closeModal,
      renamingChannel,
      openRenameChannel,
      handleCreateServer,
      handleJoinServer,
      handleCreateChannel,
      handleDeleteChannel,
      handleRenameChannel,
      handleDeleteServer,
      sendChannelMessage,
      sendDmMessage,
      serverEmojis,
      addEmoji,
      removeEmoji,
      stickers,
      addSticker,
      removeSticker,
      updateAvatarUrl,
      voicePresence,
      voiceSessions,
      internetPing,
      internetQuality,
      channelList,
      unreadByServer,
      unreadDmTotal,
      markChannelRead,
      markDmRead,
      incomingInvites,
      sendVoiceInviteTo,
      acceptVoiceInvite,
      declineVoiceInvite,
      roles,
      memberRoleIds,
      membersVersion,
      handleCreateRole,
      handleUpdateRole,
      handleDeleteRole,
      handleMoveRole,
      handleSetMemberRoles,
      handleKickMember,
      hasServerPermission,
      notify
    ]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
