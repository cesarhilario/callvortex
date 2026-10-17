import { useApp } from '../lib/useApp'
import { MonitorIcon, MonitorOffIcon } from './Icons'

interface ScreenShareButtonProps {
  /**
   * control → controles grandes da tela do canal de voz;
   * quick   → ação rápida do painel "Voz conectada" (sidebar).
   * O fluxo é o mesmo; muda apenas a classe/estilo.
   */
  variant?: 'control' | 'quick'
  size?: number
}

/**
 * Botão de compartilhar tela dos controles da chamada.
 *  - ninguém compartilhando + estou na chamada → abre o fluxo (autoriza → picker)
 *  - EU compartilhando → para
 *  - OUTRO compartilhando → desabilitado (regra: um compartilhamento por canal)
 */
export default function ScreenShareButton({ variant = 'control', size = 20 }: ScreenShareButtonProps): React.JSX.Element {
  const { profile, voiceChannelId, screenShareState, openScreenSharePicker, stopScreenShare, notify } = useApp()

  const joined = voiceChannelId !== null
  const mine = screenShareState.status === 'sharing' && screenShareState.localStream !== null
  const otherSharing = screenShareState.sharerId !== null && screenShareState.sharerId !== profile?.id
  const busy = screenShareState.status === 'starting' || screenShareState.status === 'stopping'
  const stateClass = mine ? 'active sharing' : otherSharing ? 'blocked' : ''

  const handleClick = (): void => {
    if (!joined || busy) return
    if (mine) {
      void stopScreenShare().then(() => notify('success', 'Compartilhamento encerrado.'))
      return
    }
    // fase 1: autorização no banco ANTES da captura — só depois o picker
    // (único, controlado pelo contexto) é aberto. Se houver sessão órfã de
    // outro usuário, o próprio banco a expira e autoriza; se for ativa de
    // verdade, nega com aviso.
    void openScreenSharePicker()
  }

  const title = mine
    ? 'Parar compartilhamento de tela'
    : otherSharing
      ? 'Alguém está compartilhando a tela (se parou há pouco, tente de novo em instantes)'
      : !joined
        ? 'Entre no canal de voz para compartilhar a tela'
        : 'Compartilhar tela ou janela'

  return (
    <button
      className={variant === 'quick' ? `voice-quick-action ${stateClass}` : `voice-control ${stateClass}`}
      title={title}
      onClick={handleClick}
      disabled={!joined || busy}
      aria-label={title}
    >
      {mine ? <MonitorOffIcon size={size} /> : <MonitorIcon size={size} />}
    </button>
  )
}
