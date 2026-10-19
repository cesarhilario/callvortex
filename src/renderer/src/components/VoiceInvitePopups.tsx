import { useApp } from '../lib/useApp'
import Avatar from './Avatar'
import { PhoneOffIcon, VolumeHighIcon } from './Icons'

/**
 * Popups flutuantes dos convites diretos de voz recebidos (Etapa 2).
 * Aparecem no canto inferior direito, um por convite, com "Entrar" e "Recusar".
 */
export default function VoiceInvitePopups(): React.JSX.Element | null {
  const { incomingInvites, acceptVoiceInvite, declineVoiceInvite } = useApp()
  if (incomingInvites.length === 0) return null

  return (
    <div className="voice-invite-popups">
      {incomingInvites.map((inv) => (
        <div key={`${inv.channelId}-${inv.inviter.id}-${inv.invitedAt}`} className="voice-invite-popup">
          <div className="voice-invite-popup-head">
            <span className="voice-invite-popup-ring">
              <VolumeHighIcon size={16} />
            </span>
            <span className="voice-invite-popup-label">Convite para chamada</span>
            <button className="voice-invite-popup-close" title="Recusar" onClick={() => declineVoiceInvite(inv)}>
              ✕
            </button>
          </div>
          <div className="voice-invite-popup-body">
            <Avatar name={inv.inviter.username} color={inv.inviter.avatar_color} size={36} url={inv.inviter.avatar_url} />
            <div className="voice-invite-popup-text">
              <span className="voice-invite-popup-inviter">{inv.inviter.username}</span>
              <span className="voice-invite-popup-where">
                {inv.serverName} · 🔊 {inv.channelName}
              </span>
            </div>
          </div>
          <div className="voice-invite-popup-actions">
            <button className="btn-secondary voice-invite-popup-btn" onClick={() => declineVoiceInvite(inv)}>
              <PhoneOffIcon size={14} /> Recusar
            </button>
            <button className="btn-primary voice-invite-popup-btn" onClick={() => void acceptVoiceInvite(inv)}>
              Entrar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
