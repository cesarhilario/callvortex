import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScreenShareManager } from './screenShare/manager'
import { listScreenSources, WAYLAND_PORTAL_SENTINEL } from './screenShare/capture'
import type { ScreenShareState, ScreenSourceInfo } from './screenShare/types'
import type { VoiceManager } from './voice'
import type { Notice } from './app-types'

interface UseScreenShareDeps {
  voiceManager: VoiceManager | null
  profileId: string | null
  voiceChannelId: string | null
  notify: (kind: Notice['kind'], text: string) => void
}

export interface ScreenShareApi {
  screenShareState: ScreenShareState
  /**
   * Picker de fontes aberto. O estado vive no contexto (instância única),
   * não em cada botão — assim nunca há dois overlays simultâneos, mesmo
   * com o botão montado em mais de um lugar.
   */
  screenSharePickerOpen: boolean
  /** fontes capturáveis para o picker (telas e janelas) */
  loadScreenSources: () => Promise<ScreenSourceInfo[]>
  /**
   * Fase 1 do início: valida autorização no banco, reserva a vaga e abre
   * o picker. Se a autorização falhar, o erro vira aviso e o picker não abre.
   */
  openScreenSharePicker: () => Promise<void>
  /** Fecha o picker sem escolher (equivalente a cancelar). */
  closeScreenSharePicker: () => void
  /** Fase 2: fonte escolhida no picker (null = cancelou). */
  confirmScreenSource: (sourceId: string | null) => Promise<void>
  stopScreenShare: () => Promise<void>
}

/**
 * Estado e ações do compartilhamento de tela.
 * O trabalho pesado vive em ScreenShareManager; este hook só o liga ao
 * ciclo de vida React e espelha o estado para o contexto do app.
 */
export function useScreenShare({ voiceManager, profileId, voiceChannelId, notify }: UseScreenShareDeps): ScreenShareApi {
  const managerRef = useRef<ScreenShareManager | null>(null)
  if (!managerRef.current) managerRef.current = new ScreenShareManager()

  const [state, setState] = useState<ScreenShareState>(() => managerRef.current!.getState())
  const [pickerOpen, setPickerOpen] = useState(false)
  const lastErrorRef = useRef<string | null>(null)

  // ------------------------------------------------------------
  // Liga o manager ao VoiceManager e espelha o estado
  // ------------------------------------------------------------
  useEffect(() => {
    const m = managerRef.current!
    const sync = (): void => {
      const s = m.getState()
      if (s.error && s.error !== lastErrorRef.current) {
        notify('error', s.error)
        lastErrorRef.current = s.error
      } else if (!s.error) {
        lastErrorRef.current = null
      }
      setState(s)
    }
    m.onChange = sync
    if (voiceManager) {
      m.attach(voiceManager)
      sync()
    }
    return () => {
      m.detach()
      m.onChange = null
    }
  }, [voiceManager, notify])

  // ------------------------------------------------------------
  // Sessão segura acompanha a entrada/saída do canal de voz
  // (sair da chamada encerra o compartilhamento e limpa tudo)
  // ------------------------------------------------------------
  useEffect(() => {
    const m = managerRef.current!
    if (voiceChannelId && profileId) {
      m.enterChannel(voiceChannelId, profileId)
    } else {
      m.leaveChannel()
    }
    return () => undefined
  }, [voiceChannelId, profileId])

  // NÃO destrói o manager no unmount: ele é um singleton do provider que
  // vive enquanto o app vive, e o React StrictMode (dev) simula um
  // desmonte/remonte logo após a montagem — um destroy() aqui deixaria a
  // instância morta em silêncio (botões sem qualquer reação). A limpeza
  // real acontece no leaveChannel(), ao sair do canal/da conta.

  // O picker só faz sentido durante a reserva ('starting'). Assim que o
  // fluxo conclui (sharing) ou falha/expira (idle/stopping), fecha — evita
  // overlay órfão aberto depois de um erro, o que permitia abrir um segundo
  // picker ao clicar no outro botão montado.
  useEffect(() => {
    if (state.status !== 'starting') setPickerOpen(false)
  }, [state.status])

  const loadScreenSources = useCallback(async () => listScreenSources(), [])

  // No Wayland o picker é o do sistema (portal): a UI não abre o overlay
  // interno e a captura dispara o diálogo do portal uma única vez.
  const waylandRef = useRef<boolean | null>(null)
  const isWayland = useCallback(async (): Promise<boolean> => {
    if (waylandRef.current === null) {
      waylandRef.current = await window.api.screenShare.isWayland().catch(() => false)
    }
    return waylandRef.current
  }, [])

  const openScreenSharePicker = useCallback(async () => {
    const ok = await managerRef.current!.beginStart()
    if (!ok) return
    if (await isWayland()) {
      await managerRef.current!.startWithSource(WAYLAND_PORTAL_SENTINEL)
      return
    }
    setPickerOpen(true)
  }, [isWayland])

  const closeScreenSharePicker = useCallback(() => setPickerOpen(false), [])

  const confirmScreenSource = useCallback(async (sourceId: string | null) => {
    await managerRef.current!.startWithSource(sourceId)
  }, [])

  const stopScreenShare = useCallback(async () => {
    await managerRef.current!.stop()
  }, [])

  return useMemo<ScreenShareApi>(
    () => ({
      screenShareState: state,
      screenSharePickerOpen: pickerOpen,
      loadScreenSources,
      openScreenSharePicker,
      closeScreenSharePicker,
      confirmScreenSource,
      stopScreenShare
    }),
    [state, pickerOpen, loadScreenSources, openScreenSharePicker, closeScreenSharePicker, confirmScreenSource, stopScreenShare]
  )
}
