import { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/useApp'
import Logo from './Logo'

export default function AuthScreen(): React.JSX.Element {
  const { login, register, resetPassword, notify, savedCredentials, storeCredentials, forgetCredentials } = useApp()
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [email, setEmail] = useState(savedCredentials?.email ?? '')
  const [username, setUsername] = useState(savedCredentials?.username ?? '')
  const [password, setPassword] = useState(savedCredentials?.password ?? '')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const autoLoginTried = useRef(false)

  // Login automático: se o usuário marcou "Lembrar de mim" antes, entra sozinho
  useEffect(() => {
    if (autoLoginTried.current) return
    if (mode === 'forgot') return
    if (!savedCredentials?.email || !savedCredentials.password) return
    autoLoginTried.current = true
    setBusy(true)
    login(savedCredentials.email, savedCredentials.password)
      .catch(() => {
        // não conseguiu entrar automaticamente (ex.: sem rede) — deixa o
        // formulário preenchido para o usuário clicar em Entrar
        setError('Não foi possível entrar automaticamente. Confira os dados abaixo.')
      })
      .finally(() => setBusy(false))
  }, [savedCredentials, login, mode])

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (busy) return
    if (!email.trim()) {
      setError('Preencha o e-mail.')
      return
    }
    if (mode === 'forgot') {
      setBusy(true)
      setError(null)
      try {
        await resetPassword(email.trim())
        setResetSent(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Algo deu errado.')
      } finally {
        setBusy(false)
      }
      return
    }
    if (!password) {
      setError('Preencha e-mail e senha.')
      return
    }
    if (mode === 'register' && username.trim().length < 2) {
      setError('Escolha um nome de usuário com pelo menos 2 caracteres.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (mode === 'login') {
        await login(email.trim(), password)
      } else {
        await register(email.trim(), password, username.trim())
        notify('success', `Bem-vindo(a), ${username.trim()}!`)
      }
      // guarda (ou apaga) as credenciais conforme o checkbox
      if (remember) {
        await storeCredentials({ email: email.trim(), password, username: username.trim() })
      } else {
        await forgetCredentials()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
    } finally {
      setBusy(false)
    }
  }

  const switchMode = (next: 'login' | 'register' | 'forgot'): void => {
    setMode(next)
    setError(null)
    setResetSent(false)
  }

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon"><Logo size={64} /></div>
          <h1>CallVortex</h1>
          <p>Converse com seus amigos em tempo real</p>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => switchMode('login')}>
            Entrar
          </button>
          <button className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => switchMode('register')}>
            Criar conta
          </button>
        </div>

        {mode === 'forgot' ? (
          <form onSubmit={submit} className="auth-form">
            {resetSent ? (
              <>
                <p className="auth-hint">
                  Se existir uma conta com <strong>{email.trim()}</strong>, enviamos um link para
                  redefinir a senha. Abra o e-mail, clique no link e defina a nova senha; depois
                  volte aqui e entre com ela.
                </p>
                <button type="button" className="btn-primary btn-block" onClick={() => switchMode('login')}>
                  Voltar para o login
                </button>
              </>
            ) : (
              <>
                <p className="auth-hint">
                  Informe o e-mail da sua conta e enviaremos um link para você criar uma nova senha.
                </p>
                <label>
                  E-mail
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    autoFocus
                  />
                </label>

                {error && <div className="auth-error">{error}</div>}

                <button type="submit" className="btn-primary btn-block" disabled={busy}>
                  {busy ? 'Enviando…' : 'Enviar link de redefinição'}
                </button>
                <button type="button" className="auth-link" onClick={() => switchMode('login')}>
                  Voltar para o login
                </button>
              </>
            )}
          </form>
        ) : (
          <form onSubmit={submit} className="auth-form">
            {mode === 'register' && (
              <label>
                Nome de usuário
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ex: guilherme"
                  maxLength={24}
                  autoFocus
                />
              </label>
            )}
            <label>
              E-mail
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" autoFocus={mode === 'login'} />
            </label>
            <label>
              Senha
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={6} />
            </label>

            <label className="auth-remember">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>Lembrar de mim (entra automaticamente na próxima vez)</span>
            </label>

            {mode === 'login' && (
              <button type="button" className="auth-link" onClick={() => switchMode('forgot')}>
                Esqueci minha senha
              </button>
            )}

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="btn-primary btn-block" disabled={busy}>
              {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
