/**
 * Sistema de estabilidade de conexão — CallVortex.
 *
 * Problema que este módulo ataca: um ou outro participante cai de tempos
 * em tempos no servidor. Causas reais que ele compensa:
 *
 *  - o socket do Realtime morre silenciosamente (TIMED_OUT/CHANNEL_ERROR)
 *    e ninguém religa — a presença some e os pares são fechados;
 *  - ICE chega a 'disconnected' e nunca recupera: a conexão WebRTC fica
 *    pendurada até alguém encerrar por fora;
 *  - blip de presença (reconexão do outro lado) fechava o par na hora;
 *  - qualquer erro de sinalização destruía o PeerConnection inteiro.
 *
 * O que vive aqui: APENAS lógica reutilizável e testável de reconexão
 * (agendas de retentativa, eventos de rede). O trabalho específico
 * (reiniciar ICE, re-track de presença…) fica nos donos das conexões
 * (voice.ts / screenShare/signaling.ts).
 */

/** Agenda de retentativa de resubscribe no Realtime (ms), por tentativa. */
export const RESUBSCRIBE_DELAYS_MS: readonly number[] = [1_000, 3_000, 8_000, 15_000]

/** Agenda de tentativas de ICE restart após 'disconnected' (ms). */
export const ICE_RESTART_DELAYS_MS: readonly number[] = [1_000, 3_000, 7_000, 15_000]

/**
 * Agenda de tentativas de reconectar um PeerConnection que falhou de vez
 * (connectionState 'failed') — reinicia do zero com nova oferta (ms).
 */
export const PC_RECONNECT_DELAYS_MS: readonly number[] = [1_500, 5_000, 15_000, 30_000]

/**
 * Tolerância antes de fechar um par porque sua presença saiu (ms).
 * Reconexão do cliente remoto causa leave+join de presença: fechar o
 * PeerConnection nesse instante derruba a voz — esperamos e só fechamos
 * se ele de fato não voltar (novo join ou sinal nesse intervalo).
 */
export const PRESENCE_LEAVE_GRACE_MS = 4_000

/**
 * Saúde do Realtime, exposta pela UI/toasts: 'connected' = canal ativo;
 * 'reconnecting' = tentando voltar; 'offline' = dispositivo sem rede.
 */
export type RealtimeHealth = 'connected' | 'reconnecting' | 'offline'

/**
 * Status do Realtime do Supabase que indicam canal conectado/desconectado.
 * Os strings correspondem aos status emitidos no callback de subscribe()
 * do supabase-js v2 (ex.: 'SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED').
 */
export function isUnhealthyRealtimeStatus(status: string): boolean {
  return status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED'
}

/**
 * Atraso do item `attempt` na agenda — as últimas tentativas repetem o teto
 * (retry fica indefinido, apenas espaçado).
 */
export function delayFromSchedule(schedule: readonly number[], attempt: number): number {
  if (schedule.length === 0) return 1_000
  const idx = Math.max(0, Math.min(attempt, schedule.length - 1))
  return schedule[idx]
}

/**
 * Escuta eventos globais de rede e devolve uma função de limpeza.
 * Pode ser chamada múltiplas vezes: cada consumidor faz seu próprio
 * registro (baixo custo).
 */
export function watchNetworkEvents(handlers: { onOnline?: () => void; onOffline?: () => void }): () => void {
  const onOnline = (): void => {
    if (navigator.onLine) handlers.onOnline?.()
  }
  const onOffline = (): void => {
    if (!navigator.onLine) handlers.onOffline?.()
  }
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  // o evento 'online' pode não disparar se o app abrir já conectado:
  // uma checagem inicial imediata ajuda a sincronizar o estado.
  if (handlers.onOnline && navigator.onLine) handlers.onOnline()
  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  }
}

/**
 * Guarda timers de retentativa por chave: substitui (cancela + agenda de
 * novo) e permite cancelar em lote quando a chamada termina.
 */
export class RetryScheduler {
  private timers = new Map<string, number>()

  /** Programa uma retentativa: se já existe timer para a chave, substitui. */
  schedule(key: string, delayMs: number, run: () => void): void {
    this.cancel(key)
    const timer = window.setTimeout(() => {
      this.timers.delete(key)
      run()
    }, delayMs)
    this.timers.set(key, timer)
  }

  cancel(key: string): void {
    const t = this.timers.get(key)
    if (t !== undefined) {
      clearTimeout(t)
      this.timers.delete(key)
    }
  }

  cancelAll(): void {
    for (const t of this.timers.values()) clearTimeout(t)
    this.timers.clear()
  }

  /** true se já há uma retentativa marcada com essa chave. */
  has(key: string): boolean {
    return this.timers.has(key)
  }

  destroy(): void {
    this.cancelAll()
  }
}
