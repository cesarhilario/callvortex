import { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/useApp'
import type { VoicePeerInfo } from '../lib/types'
import {
  MonitorIcon,
  ExpandIcon,
  ShrinkIcon,
  PipIcon,
  MicIcon,
  MicOffIcon,
  VolumeHighIcon,
  VolumeMuteIcon
} from './Icons'

/**
 * Palco do compartilhamento: exibe a tela de quem está compartilhando
 * (a minha em prévia, ou a remota), com indicador e controle de parada.
 * Estados visíveis ao usuário: conectando / reconectando / encerrado.
 * Botões de visualização (todos os participantes):
 *   - tela cheia;  - janela flutuante (Picture-in-Picture do sistema).
 */
export default function ScreenShareStage({ members }: { members: VoicePeerInfo[] }): React.JSX.Element | null {
  const { profile, screenShareState, stopScreenShare, setSystemAudioEnabled, voiceMuted, toggleVoiceMute } = useApp()
  const systemAudioEnabled = screenShareState.systemAudioEnabled
  const systemAudioAvailable = screenShareState.systemAudioAvailable
  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  // trilha de vídeo realmente transmitindo? (ao encerrar, o WebRTC apenas
  // "muta" a trilha remota e o <video> congela no último frame — detectamos
  // isso para limpar a imagem e avisar o usuário)
  const [trackLive, setTrackLive] = useState(false)
  const [pipSupported] = useState(
    () => typeof document !== 'undefined' && document.pictureInPictureEnabled === true
  )

  const sharerId = screenShareState.sharerId
  const mine = sharerId !== null && sharerId === profile?.id && screenShareState.localStream !== null
  const stream = mine ? screenShareState.localStream : screenShareState.remoteStream

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    if (el.srcObject !== stream) {
      el.srcObject = stream
    }
    if (stream) {
      void el.play().catch(() => undefined)
    }
  }, [stream])

  // acompanha o ciclo de vida da trilha de vídeo: mute = imagem parada
  useEffect(() => {
    const track = stream?.getVideoTracks()[0]
    if (!stream || !track) {
      setTrackLive(false)
      return
    }
    const update = () => {
      setTrackLive(track.readyState !== 'ended' && !track.muted)
    }
    update()
    track.addEventListener('mute', update)
    track.addEventListener('unmute', update)
    track.addEventListener('ended', update)
    return () => {
      track.removeEventListener('mute', update)
      track.removeEventListener('unmute', update)
      track.removeEventListener('ended', update)
    }
  }, [stream])

  // acompanha entrada/saída da tela cheia (inclusive via tecla Esc)
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === stageRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = () => {
    const el = stageRef.current
    if (!el) return
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined)
    } else {
      void el.requestFullscreen().catch(() => undefined)
    }
  }

  const togglePip = () => {
    const video = videoRef.current
    if (!video) return
    try {
      if (document.pictureInPictureElement) {
        void document.exitPictureInPicture().catch(() => undefined)
      } else {
        void video.requestPictureInPicture().catch(() => undefined)
      }
    } catch {
      // sem suporte neste ambiente — botão nem aparece quando é o caso
    }
  }

  if (!sharerId) return null
  const sharer = members.find((m) => m.userId === sharerId)

  // status para o usuário final (sem detalhes técnicos)
  let statusText: string | null = null
  const trackEnded = stream?.getVideoTracks()[0]?.readyState === 'ended'
  if (mine) {
    statusText = '🔴 Compartilhando sua tela'
  } else if (!stream) {
    statusText = 'Conectando…'
  } else if (trackEnded || !trackLive) {
    statusText = 'Compartilhamento encerrado'
  } else {
    const cs = screenShareState.connectionState
    if (cs === 'disconnected') statusText = 'Reconectando…'
    else if (cs === 'failed' || cs === 'closed') statusText = 'Conexão perdida'
  }

  return (
    <div className="ss-stage" ref={stageRef}>
      <header className="ss-stage-header">
        <span className="ss-stage-title">
          <MonitorIcon size={16} />
          {sharer ? `${sharer.username} está compartilhando a tela` : 'Compartilhamento de tela'}
        </span>
        {statusText && <span className={`ss-status ${statusText.startsWith('🔴') ? 'live' : ''}`}>{statusText}</span>}
        {mine && (
          <button className="ss-stop-btn" onClick={() => void stopScreenShare()}>
            Parar compartilhamento
          </button>
        )}
        {/* controles INDEPENDENTES de áudio — só fazem sentido para quem
            compartilha: o áudio do sistema e a própria voz são fontes
            distintas, cada uma com seu próprio on/off */}
        {mine && (
          <div className="ss-audio-tools" role="group" aria-label="Áudio do compartilhamento">
            <button
              className={`ss-audio-btn ${systemAudioEnabled ? 'on' : 'off'}`}
              disabled={!screenShareState.systemAudioAvailable}
              aria-pressed={systemAudioEnabled}
              title={
                !screenShareState.systemAudioAvailable
                  ? 'Áudio do sistema indisponível neste dispositivo (recurso do Windows)'
                  : systemAudioEnabled
                    ? 'Áudio da tela: Ativo — clique para silenciar'
                    : 'Áudio da tela: Mutado — clique para ativar'
              }
              onClick={() => setSystemAudioEnabled(!systemAudioEnabled)}
            >
              {systemAudioEnabled ? <VolumeHighIcon size={16} /> : <VolumeMuteIcon size={16} />}
              <span className="ss-audio-name">Áudio da tela:</span>
              <span className="ss-audio-state">{systemAudioEnabled ? 'Ativo' : 'Muted'}</span>
            </button>
            <button
              className={`ss-audio-btn ${voiceMuted ? 'off' : 'on'}`}
              aria-pressed={!voiceMuted}
              title={voiceMuted ? 'Microfone: Mutado — clique para ativar' : 'Microfone: Ativo — clique para silenciar'}
              onClick={toggleVoiceMute}
            >
              {voiceMuted ? <MicOffIcon size={16} /> : <MicIcon size={16} />}
              <span className="ss-audio-name">Microfone:</span>
              <span className="ss-audio-state">{voiceMuted ? 'Muted' : 'Ativo'}</span>
            </button>
          </div>
        )}
        {stream && trackLive && (
          <div className="ss-stage-tools">
            <button
              className="ss-icon-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            >
              {isFullscreen ? <ShrinkIcon size={16} /> : <ExpandIcon size={16} />}
            </button>
            {pipSupported && (
              <button
                className="ss-icon-btn"
                onClick={togglePip}
                title="Janela flutuante (separar da janela principal)"
                aria-label="Janela flutuante"
              >
                <PipIcon size={16} />
              </button>
            )}
          </div>
        )}
      </header>
      <div className="ss-stage-body">
        {stream && (
          <video
            ref={videoRef}
            className={`ss-video${trackLive ? '' : ' ss-video-idle'}`}
            autoPlay
            playsInline
            muted={mine}
          />
        )}
        {!trackLive && !mine && (
          <div className="ss-stage-placeholder">
            {stream ? 'Compartilhamento encerrado por quem compartilhava.' : 'Aguardando o vídeo…'}
          </div>
        )}
        {mine && stream && <div className="ss-preview-tag">Prévia local</div>}
        {/* parar sempre visível sobre o vídeo — sem precisar procurar */}
        {mine && stream && (
          <button className="ss-stop-fab" onClick={() => void stopScreenShare()}>
            Parar compartilhamento
          </button>
        )}
      </div>
    </div>
  )
}

/** Selo 🖥️ sobre o tile de quem está compartilhando (grade da sala). */
export function ScreenSharingDot({ userId }: { userId: string }): React.JSX.Element | null {
  const { screenShareState } = useApp()
  if (screenShareState.sharerId !== userId) return null
  return (
    <span className="ss-dot" title="Compartilhando a tela" aria-label="Compartilhando a tela">
      <MonitorIcon size={14} />
    </span>
  )
}
