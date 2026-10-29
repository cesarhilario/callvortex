import { useCallback, useEffect, useState } from 'react'
import type { PermissionStatus, PermissionsState, SettingsPane } from '../../../shared/ipc'
import ModalShell from './ModalShell'

export const PERMISSIONS_SEEN_KEY = 'cv-mac-permissions-seen'

export function hasSeenPermissions(): boolean {
  try {
    return localStorage.getItem(PERMISSIONS_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(PERMISSIONS_SEEN_KEY, '1')
  } catch {
  }
}

interface Row {
  id: string
  title: string
  description: string
  pane?: SettingsPane
  key?: keyof PermissionsState
  fixFirewall?: boolean
}

const ROWS_BY_PLATFORM: Record<string, Row[]> = {
  darwin: [
    { id: 'mic', pane: 'microphone', key: 'microphone', title: 'Microfone', description: 'Necessário para os outros ouvirem você nas chamadas de voz.' },
    { id: 'screen', pane: 'screen', key: 'screen', title: 'Gravação de tela', description: 'Necessário para compartilhar sua tela. Após permitir, reinicie o CallVortex.' },
    { id: 'lan', pane: 'local-network', title: 'Rede local', description: 'Permite a conexão direta com amigos na mesma rede. Procure por CallVortex (ou Electron, em desenvolvimento) e ative.' },
    { id: 'fw', pane: 'firewall', title: 'Firewall', description: 'Se o Firewall estiver ligado, permita conexões de entrada para o CallVortex.' }
  ],
  win32: [
    { id: 'mic', pane: 'microphone', title: 'Microfone', description: 'Em Privacidade e segurança → Microfone, deixe o acesso de aplicativos ativado.' },
    { id: 'fw', fixFirewall: true, title: 'Firewall do Windows', description: 'Libera o áudio das chamadas no Firewall. O Windows pedirá uma confirmação (UAC).' }
  ],
  linux: [
    { id: 'mic', title: 'Microfone', description: 'Se não captar, escolha a entrada correta nas configurações de som do sistema (PulseAudio/PipeWire).' },
    { id: 'screen', title: 'Compartilhamento de tela', description: 'No Wayland, o sistema mostra o seletor do portal (xdg-desktop-portal) ao compartilhar. Instale o portal do seu ambiente se ele não aparecer.' },
    { id: 'fw', title: 'Firewall', description: 'Se usar ufw ou firewalld, libere o tráfego UDP do CallVortex para as chamadas diretas.' }
  ]
}

function badge(status: PermissionStatus | undefined): { text: string; cls: string } {
  switch (status) {
    case 'granted':
      return { text: 'Permitido', cls: 'perm-badge-ok' }
    case 'denied':
    case 'restricted':
      return { text: 'Negado', cls: 'perm-badge-bad' }
    case 'not-determined':
      return { text: 'Pendente', cls: 'perm-badge-warn' }
    default:
      return { text: 'Verifique', cls: 'perm-badge-idle' }
  }
}

export default function PermissionsModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const platform = window.api.platform
  const rows = ROWS_BY_PLATFORM[platform] ?? ROWS_BY_PLATFORM.linux
  const [perms, setPerms] = useState<PermissionsState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fw, setFw] = useState<{ busy: boolean; msg: string }>({ busy: false, msg: '' })

  const refresh = useCallback(async () => {
    try {
      setPerms(await window.api.permissions.get())
    } catch {
      setPerms(null)
    }
  }, [])

  useEffect(() => {
    void refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refresh])

  const close = (): void => {
    markSeen()
    onClose()
  }

  const openPane = async (pane: SettingsPane): Promise<void> => {
    setError(null)
    let ok = false
    try {
      ok = await window.api.permissions.openSettings(pane)
    } catch {
      ok = false
    }
    if (!ok) setError('Não foi possível abrir as configurações do sistema. Abra manualmente pelo menu do sistema.')
  }

  const fixFirewall = async (): Promise<void> => {
    setFw({ busy: true, msg: 'Confirme a janela do Windows que apareceu (Controle de Conta de Usuário).' })
    try {
      const res = await window.api.voice.fixFirewall()
      setFw({ busy: false, msg: res.message })
    } catch {
      setFw({ busy: false, msg: 'Não foi possível executar a correção. Libere o app manualmente no painel do Firewall.' })
    }
  }

  const act = async (row: Row): Promise<void> => {
    if (row.fixFirewall) return fixFirewall()
    if (!row.pane) return
    if (row.pane === 'microphone' && perms?.microphone === 'not-determined') {
      let granted = false
      try {
        granted = await window.api.permissions.requestMicrophone()
      } catch {
        granted = false
      }
      await refresh()
      if (granted) return
    }
    await openPane(row.pane)
  }

  const buttonLabel = (row: Row, status: PermissionStatus | undefined): string => {
    if (row.fixFirewall) return fw.busy ? 'Aguardando…' : 'Liberar'
    if (row.pane === 'microphone' && status === 'not-determined') return 'Permitir'
    return platform === 'darwin' ? 'Abrir Ajustes' : 'Abrir configurações'
  }

  return (
    <ModalShell title="Permissões necessárias" onClose={close}>
      <p className="modal-hint">
        Para voz e compartilhamento de tela funcionarem, o CallVortex precisa destas permissões do sistema.
      </p>
      <ul className="perm-list">
        {rows.map((row) => {
          const status = row.key ? perms?.[row.key] : undefined
          const b = row.key ? badge(status) : null
          return (
            <li key={row.id} className="perm-row">
              <div className="perm-info">
                <div className="perm-title">
                  {row.title}
                  {b && <span className={`perm-badge ${b.cls}`}>{b.text}</span>}
                </div>
                <div className="perm-desc">{row.description}</div>
              </div>
              {(row.pane || row.fixFirewall) && (
                <button
                  type="button"
                  className={status === 'granted' ? 'btn-secondary' : 'btn-primary'}
                  disabled={row.fixFirewall && fw.busy}
                  onClick={() => void act(row)}
                >
                  {buttonLabel(row, status)}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {fw.msg && <p className="modal-hint">{fw.msg}</p>}
      {error && <p className="modal-hint perm-error">{error}</p>}
      <div className="modal-actions">
        <button type="button" className="btn-primary" onClick={close}>
          Concluído
        </button>
      </div>
    </ModalShell>
  )
}
