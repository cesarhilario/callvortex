import { useEffect, useState } from 'react'
import type { AppInfo } from '../../../shared/ipc'
import { useApp } from '../lib/useApp'
import Logo from './Logo'
import ModalShell from './ModalShell'

export function shortcutLabel(): string {
  return window.api.platform === 'darwin' ? '⌘ ,' : 'Ctrl + ,'
}

function osName(info: AppInfo): string {
  const base = info.platform === 'darwin' ? 'macOS' : info.platform === 'win32' ? 'Windows' : 'Linux'
  return `${base} ${info.osVersion}`
}

export default function SettingsModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { openModal } = useApp()
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    let alive = true
    window.api
      .getAppInfo()
      .then((i) => alive && setInfo(i))
      .catch(() => alive && setInfo(null))
    return () => {
      alive = false
    }
  }, [])

  const rows: [string, string][] = info
    ? [
        ['Versão', info.version],
        ['Sistema', osName(info)],
        ['Arquitetura', info.arch],
        ['Electron', info.electron],
        ['Chromium', info.chrome]
      ]
    : []

  return (
    <ModalShell onClose={onClose} className="settings-card">
      <button type="button" className="settings-close" title="Fechar" aria-label="Fechar" onClick={onClose}>
        ×
      </button>
      <div className="settings-logo">
        <Logo size={96} />
      </div>
      <h2 className="settings-name">CallVortex</h2>
      <div className="settings-version">{info ? `Versão ${info.version}` : 'Versão —'}</div>
      <dl className="settings-info">
        {rows.map(([k, v]) => (
          <div key={k} className="settings-info-row">
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className="settings-btn" onClick={() => openModal('permissions')}>
        Permissões…
      </button>
      <p className="settings-foot">
        Abrir configurações: {shortcutLabel()}
        <br />
        Licença GPL-3.0
      </p>
    </ModalShell>
  )
}
