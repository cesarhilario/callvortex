import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabase } from './supabase'
import type { VoiceInvite } from './types'

/**
 * Convites diretos para salas de voz (Etapa 2).
 *
 * Funciona 100% em tempo real com broadcast do Supabase Realtime — sem tabela
 * nova nem migração SQL. Cada cliente assinado ao canal `voice-invites`
 * escuta apenas o evento do PRÓPRIO id (`voice-invite:<userId>`); o remetente
 * envia nesse mesmo canal com o evento do destinatário.
 *
 * Limitação natural de broadcast: quem não está com o app aberto não recebe
 * o convite (não há fila persistida).
 */

const INVITE_CHANNEL = 'voice-invites'

function inviteEvent(toUserId: string): string {
  return `voice-invite:${toUserId}`
}

type InviteCallback = (invite: VoiceInvite) => void

// instância compartilhada do canal (Mesmo cliente supabase reutiliza a
// instância por tópico — mantemos UMA, com binding de evento do usuário atual)
let channel: RealtimeChannel | null = null
let channelUserId: string | null = null
let subscribeReady: Promise<void> | null = null
let listeners = new Set<InviteCallback>()

function buildChannel(userId: string | null): Promise<void> {
  const supabase = getSupabase()
  const ch = supabase.channel(INVITE_CHANNEL, {
    config: { broadcast: { self: false } }
  })
  if (userId) {
    ch.on('broadcast', { event: inviteEvent(userId) }, ({ payload }) => {
      const inv = payload as VoiceInvite | null
      if (!inv || !inv.channelId || !inv.inviter?.id || !inv.inviter?.username) return
      for (const l of listeners) l(inv)
    })
  }
  const ready = new Promise<void>((resolve) => {
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve()
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        // esvazia para que a próxima chamada recrie o canal
        if (channel === ch) {
          channel = null
          channelUserId = null
          subscribeReady = null
        }
        resolve()
      }
      // 'CLOSED' é o caminho do unmount próprio — não há nada a fazer
    })
  })
  channel = ch
  channelUserId = userId
  subscribeReady = ready
  return ready
}

/**
 * Garante o canal único, com binding de evento do usuário quando informado.
 * Recria o canal quando o binding precisa trocar (logout/login com outra conta).
 */
function getChannel(userBindingId: string | null): Promise<void> {
  if (channel) {
    if (channelUserId === null || userBindingId === null || channelUserId === userBindingId) {
      return subscribeReady ?? buildChannel(userBindingId)
    }
    // binding de outro usuário: derruba e recria
    void getSupabase().removeChannel(channel)
  }
  return buildChannel(userBindingId)
}

/** Assina os convites destinados a mim (o App chama uma vez por sessão). */
export function subscribeVoiceInvites(userId: string, onInvite: InviteCallback): () => void {
  listeners.add(onInvite)
  void getChannel(userId).catch(() => undefined)
  return () => {
    listeners.delete(onInvite)
  }
}

/** Envia o convite em tempo real para o usuário alvo. */
export async function sendVoiceInvite(toUserId: string, invite: VoiceInvite): Promise<void> {
  await getChannel(channelUserId)
  if (!channel) throw new Error('Não foi possível conectar ao canal de convites.')
  await channel.send({ type: 'broadcast', event: inviteEvent(toUserId), payload: invite })
}
