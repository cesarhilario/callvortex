/**
 * Sinalização do compartilhamento de tela — somente comunicação, sem UI.
 *
 * Diferente do áudio (que usa broadcast do Realtime), a sinalização da tela
 * trafega pela tabela `call_signals` protegida por RLS:
 *  - o remetente é sempre auth.uid() no banco (impossível falsificar);
 *  - só é possível enviar para participantes da MESMA chamada;
 *  - postgres_changes entrega apenas as linhas visíveis por RLS.
 * Mensagens são efêmeras: apagadas após o consumo e purgadas pelo backend.
 *
 * Também observa a tabela `screen_shares` (quem está compartilhando agora),
 * que segue as mesmas políticas RLS.
 */
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabase } from '../supabase'
import { isScreenSignalKind, type ScreenSignalKind } from './types'
import {
  RESUBSCRIBE_DELAYS_MS,
  RetryScheduler,
  delayFromSchedule,
  isUnhealthyRealtimeStatus
} from '../connection'

export interface ScreenSignal {
  id: number
  senderId: string
  kind: ScreenSignalKind
  payload: {
    sdp?: RTCSessionDescriptionInit
    candidate?: RTCIceCandidateInit
  }
}

export class ScreenShareSignaling {
  private myId: string | null = null
  private signalChannel: RealtimeChannel | null = null
  private stateChannel: RealtimeChannel | null = null
  // estabilidade: rejoin dos canais em escalada se o Realtime oscilar
  private retries = new RetryScheduler()
  private signalAttempt = 0
  private stateAttempt = 0
  private currentChannelId: string | null = null

  onSignal: ((signal: ScreenSignal) => void) | null = null
  /** mudanças em screen_shares do canal observado (user_id ou null) */
  onSharerChange: ((sharerId: string | null) => void) | null = null

  // ------------------------------------------------------------
  // Sinais WebRTC endereçados (call_signals)
  // ------------------------------------------------------------
  subscribe(channelId: string, myId: string): void {
    void this.unsubscribe()
    this.myId = myId
    this.currentChannelId = channelId

    const ch = getSupabase()
      .channel(`screen-signaling:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `receiver_id=eq.${myId}`
        },
        (change: unknown) => {
          const row = (change as { payload?: { new?: unknown }; new?: unknown })
          this.handleRow(row.payload?.new ?? row.new)
        }
      )
    this.signalChannel = ch
    void ch.subscribe(async (status) => {
      if (this.signalChannel !== ch) return
      if (status === 'SUBSCRIBED') {
        this.signalAttempt = 0
        this.retries.cancel('signal-rejoin')
        // sincroniza o token (a sessão pode ter sido renovada)
        const { data } = await getSupabase().auth.getSession()
        if (data.session) getSupabase().realtime.setAuth(data.session.access_token)
      } else if (isUnhealthyRealtimeStatus(status)) {
        this.resubscribeSignal()
      }
    })
  }

  /** Rejoin do canal de sinalização em escalada (teto de 15 s). */
  private resubscribeSignal(): void {
    const ch = this.signalChannel
    if (!ch || !this.currentChannelId) return
    const attempt = this.signalAttempt
    this.signalAttempt = Math.min(this.signalAttempt + 1, RESUBSCRIBE_DELAYS_MS.length)
    this.retries.schedule('signal-rejoin', delayFromSchedule(RESUBSCRIBE_DELAYS_MS, attempt), () => {
      if (this.signalChannel !== ch) return
      void ch.subscribe(async (status) => {
        if (this.signalChannel !== ch) return
        if (status === 'SUBSCRIBED') {
          this.signalAttempt = 0
          this.retries.cancel('signal-rejoin')
          const { data } = await getSupabase().auth.getSession()
          if (data.session) getSupabase().realtime.setAuth(data.session.access_token)
        } else if (isUnhealthyRealtimeStatus(status)) {
          this.resubscribeSignal()
        }
      })
    })
  }

  async unsubscribe(): Promise<void> {
    const ch = this.signalChannel
    this.signalChannel = null
    if (ch) await getSupabase().removeChannel(ch).catch(() => undefined)
  }

  // ------------------------------------------------------------
  // Estado global de compartilhamento (screen_shares)
  // ------------------------------------------------------------
  async fetchActiveSharer(channelId: string): Promise<string | null> {
    try {
      const { data, error } = await getSupabase()
        .from('screen_shares')
        .select('user_id')
        .eq('channel_id', channelId)
        .maybeSingle<{ user_id: string }>()
      if (error) return null
      return data?.user_id ?? null
    } catch {
      return null
    }
  }

  async watchActiveShare(channelId: string): Promise<void> {
    await this.unwatchActiveShare()
    const ch = getSupabase()
      .channel(`screen-share-state:${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'screen_shares', filter: `channel_id=eq.${channelId}` },
        (change: unknown) => {
          const c = change as { payload?: { new?: { user_id?: string } }; new?: { user_id?: string } }
          const userId = (c.payload?.new ?? c.new)?.user_id
          this.onSharerChange?.(userId ?? null)
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'screen_shares', filter: `channel_id=eq.${channelId}` },
        () => this.onSharerChange?.(null)
      )
    this.stateChannel = ch
    void ch.subscribe((status) => {
      if (this.stateChannel !== ch) return
      if (status === 'SUBSCRIBED') {
        this.stateAttempt = 0
        this.retries.cancel('state-rejoin')
      } else if (isUnhealthyRealtimeStatus(status)) {
        const attempt = this.stateAttempt
        this.stateAttempt = Math.min(this.stateAttempt + 1, RESUBSCRIBE_DELAYS_MS.length)
        this.retries.schedule('state-rejoin', delayFromSchedule(RESUBSCRIBE_DELAYS_MS, attempt), () => {
          if (this.stateChannel !== ch) return
          void ch.subscribe()
        })
      }
    })
  }

  async unwatchActiveShare(): Promise<void> {
    const ch = this.stateChannel
    this.stateChannel = null
    if (ch) await getSupabase().removeChannel(ch).catch(() => undefined)
  }

  // ------------------------------------------------------------
  // Envio e consumo de sinais
  // ------------------------------------------------------------

  /**
   * Envia um sinal via RPC segura (remetente = usuário autenticado no banco).
   * Retorna false se o backend recusar (sem permissão, destinatário inválido…).
   */
  async sendSignal(channelId: string, receiverId: string, kind: ScreenSignalKind, payload: ScreenSignal['payload']): Promise<boolean> {
    // até 3 tentativas (falhas de rede em rajada devem reenviar, não perder
    // a renegociação de tela inteira)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { error } = await getSupabase().rpc('send_call_signal', {
          p_channel: channelId,
          p_receiver: receiverId,
          p_kind: kind,
          p_payload: payload
        })
        if (!error) return true
      } catch {
        // rede instável — tenta de novo abaixo
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
    }
    if (import.meta.env.DEV) {
      console.debug('[screen-share] sendSignal falhou', kind, 'para', receiverId.slice(0, 8))
    }
    return false
  }

  /** dedupe local (postgres_changes pode reentregar após reconexão) */
  private handledIds = new Set<number>()

  private handleRow(row: unknown): void {
    if (!row || typeof row !== 'object') return
    const r = row as Record<string, unknown>
    const id = typeof r.id === 'number' ? r.id : Number(r.id)
    if (!Number.isFinite(id) || this.handledIds.has(id)) return
    if (!isScreenSignalKind(r.kind)) return
    const payload = r.payload as ScreenSignal['payload'] | null
    if (!payload || typeof payload !== 'object') return
    const senderId = String(r.sender_id ?? '')
    if (!senderId || senderId === this.myId) return

    this.handledIds.add(id)
    if (this.handledIds.size > 500) {
      // limita a memória do dedupe (sinais antigos já foram apagados no banco)
      this.handledIds = new Set([...this.handledIds].slice(-250))
    }
    this.onSignal?.({ id, senderId, kind: r.kind, payload })
    // mensagem consumida — apaga (RLS permite: sou o destinatário)
    void getSupabase()
      .from('call_signals')
      .delete()
      .eq('id', id)
      .then(() => undefined, () => undefined)
  }

  destroy(): void {
    this.onSignal = null
    this.onSharerChange = null
    this.retries.destroy()
    void this.unsubscribe()
    void this.unwatchActiveShare()
  }
}
