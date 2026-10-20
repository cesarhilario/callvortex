import { useState } from 'react'
import { useApp } from '../lib/useApp'
import Logo from './Logo'

/**
 * Tela exibida quando o app é aberto por um link de redefinição de senha
 * (callvortex://reset). O usuário define a nova senha e volta ao login.
 */
export default function ResetPasswordScreen(): React.JSX.Element {
  const { updatePassword, clearRecovery } = useApp()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (busy) return
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As duas senhas não coincidem.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await updatePassword(password)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon"><Logo size={64} /></div>
          <h1>Definir nova senha</h1>
        </div>

        {done ? (
          <div className="auth-form">
            <p className="auth-hint">
              Sua senha foi alterada com sucesso. Entre no app com a nova senha.
            </p>
            <button type="button" className="btn-primary btn-block" onClick={() => clearRecovery()}>
              Ir para o login
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="auth-form">
            <p className="auth-hint">Escolha uma nova senha para a sua conta.</p>
            <label>
              Nova senha
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                autoFocus
              />
            </label>
            <label>
              Confirmar nova senha
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                minLength={6}
              />
            </label>

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="btn-primary btn-block" disabled={busy}>
              {busy ? 'Salvando…' : 'Salvar nova senha'}
            </button>
            <button type="button" className="auth-link" onClick={() => clearRecovery()}>
              Cancelar
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
