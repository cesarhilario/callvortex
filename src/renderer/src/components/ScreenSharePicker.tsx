import { useEffect, useState } from 'react'
import { useApp } from '../lib/useApp'
import type { ScreenSourceInfo } from '../lib/screenShare/types'

/**
 * Picker de telas/janelas do compartilhamento.
 *
 * Instância ÚNICA montada no layout (App): o botão de compartilhar aparece
 * em mais de um lugar, então o picker não pode viver dentro dele — caso
 * contrário cada botão abriria seu próprio overlay. A abertura é controlada
 * por `screenSharePickerOpen` no contexto.
 */
export default function ScreenSharePicker(): React.JSX.Element | null {
  const { screenSharePickerOpen, loadScreenSources, confirmScreenSource, closeScreenSharePicker } = useApp()
  const [sources, setSources] = useState<ScreenSourceInfo[] | null>(null)

  useEffect(() => {
    if (!screenSharePickerOpen) return
    let cancelled = false
    setSources(null)
    void loadScreenSources().then((s) => {
      if (!cancelled) setSources(s)
    })
    return () => {
      cancelled = true
    }
  }, [screenSharePickerOpen, loadScreenSources])

  if (!screenSharePickerOpen) return null

  const pick = (id: string): void => {
    closeScreenSharePicker()
    void confirmScreenSource(id)
  }

  const cancel = (): void => {
    closeScreenSharePicker()
    void confirmScreenSource(null)
  }

  return (
    <div className="ss-overlay" role="dialog" aria-modal="true" aria-label="Escolher o que compartilhar">
      <div className="ss-picker">
        <header className="ss-picker-header">
          <h3>Escolha o que compartilhar</h3>
          <p>A transmissão é direta (P2P) e só para quem está na chamada.</p>
        </header>
        <div className="ss-picker-grid">
          {sources === null && <p className="ss-picker-empty">Carregando fontes…</p>}
          {sources !== null && sources.length === 0 && (
            <p className="ss-picker-empty">Nenhuma tela ou janela disponível para captura.</p>
          )}
          {sources?.map((s) => (
            <button key={s.id} className="ss-source" title={s.name} onClick={() => pick(s.id)}>
              {s.thumbnail ? (
                <img src={s.thumbnail} alt="" className="ss-thumb" draggable={false} />
              ) : (
                <div className="ss-thumb ss-thumb-empty" />
              )}
              <span className="ss-source-name">{s.name}</span>
            </button>
          ))}
        </div>
        <footer className="ss-picker-footer">
          <button className="btn-secondary" onClick={cancel}>
            Cancelar
          </button>
        </footer>
      </div>
    </div>
  )
}
