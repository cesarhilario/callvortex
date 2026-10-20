import { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/useApp'
import { getOrCreateDmThread, searchUsers, fetchMembers } from '../lib/api'
import type { Profile, Sticker } from '../lib/types'
import Avatar from './Avatar'

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="modal-card" ref={ref}>
        <h2 className="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function CreateServerModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { handleCreateServer } = useApp()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (busy || name.trim().length < 2) return
    setBusy(true)
    const s = await handleCreateServer(name)
    setBusy(false)
    if (s) onClose()
  }

  return (
    <ModalShell title="Criar servidor" onClose={onClose}>
      <form onSubmit={submit} className="modal-form">
        <p className="modal-hint">Dê um nome para o servidor. Você poderá convidar amigos com um código.</p>
        <input className="modal-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Turma do Zap" maxLength={32} autoFocus />
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={busy || name.trim().length < 2}>
            Criar
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function JoinServerModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { handleJoinServer } = useApp()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (busy || code.trim().length < 4) return
    setBusy(true)
    setError(null)
    const s = await handleJoinServer(code)
    setBusy(false)
    if (s) onClose()
    else setError('Código inválido. Peça o código de convite para o dono do servidor.')
  }

  return (
    <ModalShell title="Entrar em um servidor" onClose={onClose}>
      <form onSubmit={submit} className="modal-form">
        <p className="modal-hint">Peça o código de convite para um amigo e cole aqui embaixo.</p>
        <input
          className="modal-input code-input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          placeholder="ABCDEF"
          maxLength={8}
          autoFocus
        />
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={busy || code.trim().length < 4}>
            Entrar
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function CreateChannelModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { handleCreateChannel } = useApp()
  const [name, setName] = useState('')
  const [type, setType] = useState<'text' | 'voice'>('text')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (busy || name.trim().length < 1) return
    setBusy(true)
    await handleCreateChannel(name, type)
    setBusy(false)
    onClose()
  }

  return (
    <ModalShell title="Criar canal" onClose={onClose}>
      <form onSubmit={submit} className="modal-form">
        <p className="modal-hint">Os canais separam as conversas por assunto dentro do servidor.</p>
        <div className="channel-type-picker">
          <button type="button" className={`channel-type-option ${type === 'text' ? 'active' : ''}`} onClick={() => setType('text')}>
            <span className="channel-type-icon">📝</span>
            <span className="channel-type-label">Texto</span>
          </button>
          <button type="button" className={`channel-type-option ${type === 'voice' ? 'active' : ''}`} onClick={() => setType('voice')}>
            <span className="channel-type-icon">🔊</span>
            <span className="channel-type-label">Voz</span>
          </button>
        </div>
        <div className="modal-input-prefix">
          <span>{type === 'voice' ? '🔊' : '#'}</span>
          <input className="modal-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={type === 'voice' ? 'sala-da-galera' : 'novo-canal'} maxLength={32} autoFocus />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={busy || name.trim().length < 1}>
            Criar
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function RenameChannelModal({ onClose }: { onClose: () => void }): React.JSX.Element | null {
  const { renamingChannel, handleRenameChannel } = useApp()
  const [name, setName] = useState(renamingChannel?.name ?? '')
  const [busy, setBusy] = useState(false)
  const channel = renamingChannel

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (busy || !channel || name.trim().length < 1 || name.trim() === channel.name) return
    setBusy(true)
    await handleRenameChannel(channel.id, name)
    setBusy(false)
    onClose()
  }

  if (!channel) return null

  return (
    <ModalShell title="Renomear canal" onClose={onClose}>
      <form onSubmit={submit} className="modal-form">
        <p className="modal-hint">
          Escolha um novo nome para {channel.type === 'voice' ? 'o canal de voz' : 'o canal de texto'}. Letras minúsculas e espaços viram hífens.
        </p>
        <div className="modal-input-prefix">
          <span>{channel.type === 'voice' ? '🔊' : '#'}</span>
          <input
            className="modal-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="novo-nome"
            maxLength={32}
            autoFocus
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={busy || name.trim().length < 1 || name.trim() === channel.name}>
            Salvar
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function StartDmModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { selectDm, notify } = useApp()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      void searchUsers(query).then(setResults).catch(() => setResults([]))
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  const open = async (p: Profile): Promise<void> => {
    setBusy(true)
    try {
      const threadId = await getOrCreateDmThread(p.id)
      selectDm(threadId)
      onClose()
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Erro ao abrir conversa')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title="Nova conversa" onClose={onClose}>
      <div className="modal-form">
        <p className="modal-hint">Procure um amigo pelo nome de usuário.</p>
        <input
          className="modal-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar usuário…"
          autoFocus
        />
        <div className="dm-results">
          {query.trim().length >= 2 && results.length === 0 && <div className="modal-hint">Ninguém encontrado.</div>}
          {results.map((p) => (
            <button key={p.id} className="dm-result" disabled={busy} onClick={() => void open(p)}>
              <Avatar name={p.username} color={p.avatar_color} size={32} url={p.avatar_url} />
              <span>{p.username}</span>
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

function ManageEmojisModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { serverEmojis, addEmoji, removeEmoji } = useApp()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const pickFile = (): void => {
    const emojiName = name.trim() || undefined
    if (emojiName !== undefined && !/^[\w+-]+$/.test(emojiName)) {
      setError('Nome inválido: use apenas letras, números, _ ou - (ex: risada).')
      return
    }
    setError(null)
    fileRef.current?.click()
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('O arquivo precisa ser uma imagem.')
      return
    }
    if (file.size > 512 * 1024) {
      setError('Imagem muito grande (máximo 512 KB).')
      return
    }
    const emojiName =
      name.trim() || file.name.split('.')[0].toLowerCase().replace(/[^\w+-]/g, '') || 'emoji'
    if (!/^[\w+-]+$/.test(emojiName)) {
      setError('Nome inválido: use apenas letras, números, _ ou - (ex: risada).')
      return
    }
    setBusy(true)
    const ok = await addEmoji(emojiName, file)
    setBusy(false)
    if (ok) {
      setName('')
      setError(null)
    }
  }

  return (
    <ModalShell title="Emojis do servidor" onClose={onClose}>
      <div className="modal-form">
        <p className="modal-hint">
          Envie uma imagem (até 512 KB). Ela vira o emoji <code>:nome:</code>, que todos os membros podem usar nas mensagens.
        </p>
        <div className="emoji-add-row">
          <input
            className="modal-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="nome (ex: risada)"
            maxLength={24}
          />
          <button className="btn-primary" onClick={pickFile} disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onFile(e)} />
        {error && <div className="modal-error">{error}</div>}
        <div className="emoji-list">
          {serverEmojis.length === 0 && <div className="modal-hint">Nenhum emoji ainda. Adicione o primeiro acima!</div>}
          {serverEmojis.map((e) => (
            <div key={e.id} className="emoji-list-item">
              <img className="emoji-list-img" src={e.url} alt={`:${e.name}:`} />
              <span className="emoji-list-name">:{e.name}:</span>
              <button className="emoji-list-delete" title="Excluir emoji" onClick={() => void removeEmoji(e.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

/**
 * Modal "Convidar amigos": lista suas conversas (DMs) e os membros online
 * do servidor atual; um clique envia o convite direto para a chamada ativa.
 */
function VoiceInviteModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { voiceChannelId, allChannels, servers, dms, onlineUsers, profile, screen, sendVoiceInviteTo, voicePresence } = useApp()
  const [sent, setSent] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [members, setMembers] = useState<Profile[]>([])

  const activeServerId = screen?.type === 'server' ? screen.serverId : (voiceChannelId !== null ? (allChannels.find((c) => c.id === voiceChannelId)?.server_id ?? null) : null)

  useEffect(() => {
    let cancelled = false
    if (!activeServerId) {
      setMembers([])
      return
    }
    void fetchMembers(activeServerId)
      .then((ms) => {
        if (!cancelled) setMembers(ms.filter((m) => m.id !== profile?.id))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [activeServerId, profile?.id])

  const channel = allChannels.find((c) => c.id === voiceChannelId)
  const server = servers.find((s) => s.id === channel?.server_id)
  const inCall = new Set((voicePresence[voiceChannelId ?? ''] ?? []).map((p) => p.userId))

  // lista de contatos: conversas primeiro (a "lista de amigos" do app)
  const seen = new Set([profile?.id])
  const dmContacts: Profile[] = []
  for (const t of dms) {
    if (seen.has(t.other.id)) continue
    seen.add(t.other.id)
    dmContacts.push(t.other)
  }
  const onlineMembers = members.filter((m) => onlineUsers.has(m.id) && !seen.has(m.id))

  const invite = async (userId: string): Promise<void> => {
    setBusy(userId)
    const ok = await sendVoiceInviteTo(userId)
    setSent((prev) => ({ ...prev, [userId]: ok }))
    setBusy(null)
  }

  const row = (p: Profile): React.JSX.Element => {
    const onCall = inCall.has(p.id)
    return (
      <div key={p.id} className="invite-contact">
        <Avatar name={p.username} color={p.avatar_color} size={32} online={onlineUsers.has(p.id)} url={p.avatar_url} />
        <span className="invite-contact-name">{p.username}</span>
        {sent[p.id] ? (
          <span className="invite-contact-sent">Enviado ✓</span>
        ) : onCall ? (
          <span className="invite-contact-oncall">Na chamada</span>
        ) : (
          <button className="btn-secondary invite-contact-btn" disabled={busy === p.id} onClick={() => void invite(p.id)}>
            {busy === p.id ? 'Enviando…' : 'Convidar'}
          </button>
        )}
      </div>
    )
  }

  const listEmpty = dmContacts.length === 0 && onlineMembers.length === 0

  return (
    <ModalShell title="Convidar para a chamada" onClose={onClose}>
      <div className="modal-form">
        <p className="modal-hint">
          {server ? `${server.name} · 🔊 ${channel?.name ?? ''}` : 'Chamada de voz ativa'}
      </p>
        <div className="invite-contact-list">
          {dmContacts.length > 0 && <div className="invite-contact-section">Suas conversas</div>}
          {dmContacts.map((p) => row(p))}
          {onlineMembers.length > 0 && <div className="invite-contact-section">Online neste servidor</div>}
          {onlineMembers.map((p) => row(p))}
          {listEmpty && <div className="modal-hint">Ninguém para convidar ainda. Abra uma conversa ou convide amigos para o servidor com o código de convite.</div>}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

/**
 * Painel de figurinhas (stickers) e GIFs personalizados.
 *  - Pessoal: qualquer usuário adiciona/remove as DELE (bucket user/<id>).
 *  - Servidor: dono adiciona/remove; visível para membros (bucket server/<id>).
 */
function ManageStickersModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { profile, servers, screen, stickers, addSticker, removeSticker, openModal } = useApp()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const activeServerId = screen?.type === 'server' ? screen.serverId : null
  const activeServer = servers.find((s) => s.id === activeServerId)
  const isOwner = !!activeServer && activeServer.owner_id === profile?.id
  // escopo do próximo envio: servidor (dono) ou pessoal
  const [scope, setScope] = useState<'user' | 'server'>('user')
  const selectedScope: 'user' | 'server' = scope === 'server' && isOwner && activeServerId ? 'server' : 'user'

  const pickFile = (): void => {
    // valida/aplica o MESMO saneamento do onFile (espaços → '-'), em vez de
    // barrar nomes com espaço antes mesmo de abrir o seletor de arquivo.
    const stickerName = name.trim().toLowerCase().replace(/\s+/g, '-')
    if (stickerName && !/^[\w+-]+$/.test(stickerName)) {
      setError('Nome inválido: use apenas letras, números, _ ou - (ex: risada).')
      return
    }
    setError(null)
    fileRef.current?.click()
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('O arquivo precisa ser uma imagem (png, jpg, webp ou gif).')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Figurinha muito grande (máximo 2 MB).')
      return
    }
    const stickerName =
      name.trim().toLowerCase().replace(/\s+/g, '-') ||
      file.name.split('.')[0].toLowerCase().replace(/[^\w+-]/g, '').slice(0, 32) ||
      'figurinha'
    if (!/^[\w+-]+$/.test(stickerName)) {
      setError('Nome inválido: use apenas letras, números, _ ou - (ex: risada).')
      return
    }
    setBusy(true)
    setError(null)
    const ok = await addSticker(stickerName, file, selectedScope === 'server' && activeServerId ? activeServerId : 'user')
    setBusy(false)
    if (ok) {
      setName('')
      setError(null)
    } else {
      // mostra a falha DENTRO do modal (o toast de 5s é fácil de perder)
      setError('Não foi possível enviar a figurinha. Veja o aviso acima para o motivo.')
    }
  }

  const mine = stickers.filter((s) => s.owner_user_id !== null)
  const serverStickers = stickers.filter((s) => s.server_id !== null)

  const stickerRow = (s: Sticker, canDelete: boolean): React.JSX.Element => (
    <div key={s.id} className="emoji-list-item">
      <img className="sticker-list-img" src={s.url} alt={`{{${s.name}}}`} />
      <span className="emoji-list-name">{'{{'} {s.name} {'}}'}</span>
      {canDelete && (
        <button className="emoji-list-delete" title="Excluir figurinha" onClick={() => void removeSticker(s.id)}>
          ✕
        </button>
      )}
    </div>
  )

  return (
    <ModalShell title="Figurinhas e GIFs" onClose={onClose}>
      <div className="modal-form">
        <p className="modal-hint">
          Envie uma imagem ou GIF (até 2 MB). Ela vira a figurinha <code>{'{{nome}}'}</code>, que você insere no chat pelo
          painel 🙃 do campo de mensagem.
        </p>
        {(
          <div className="sticker-scope-picker">
            <button
              type="button"
              className={`channel-type-option ${selectedScope === 'user' ? 'active' : ''}`}
              onClick={() => setScope('user')}
            >
              <span className="channel-type-icon">🙋</span>
              <span className="channel-type-label">Minhas (pessoal)</span>
            </button>
            {isOwner && activeServerId && (
              <button
                type="button"
                className={`channel-type-option ${selectedScope === 'server' ? 'active' : ''}`}
                onClick={() => setScope('server')}
              >
                <span className="channel-type-icon">🏰</span>
                <span className="channel-type-label">Servidor</span>
              </button>
            )}
          </div>
        )}
        <div className="emoji-add-row">
          <input
            className="modal-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="nome (ex: risada)"
            maxLength={24}
          />
          <button className="btn-primary" onClick={pickFile} disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onFile(e)} />
        {error && <div className="modal-error">{error}</div>}
        <div className="emoji-list">
          {mine.length > 0 && <div className="invite-contact-section">Minhas figurinhas</div>}
          {mine.map((s) => stickerRow(s, true))}
          {serverStickers.length > 0 && (
            <div className="invite-contact-section">Figurinhas do servidor{isOwner ? '' : ' (gerencia o dono)'}</div>
          )}
          {serverStickers.map((s) => stickerRow(s, isOwner))}
          {stickers.length === 0 && <div className="modal-hint">Nenhuma figurinha ainda. Envie a primeira acima!</div>}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

export default function Modals(): React.JSX.Element | null {
  const { modal, closeModal } = useApp()
  if (!modal) return null
  switch (modal) {
    case 'create-server':
      return <CreateServerModal onClose={closeModal} />
    case 'join-server':
      return <JoinServerModal onClose={closeModal} />
    case 'create-channel':
      return <CreateChannelModal onClose={closeModal} />
    case 'rename-channel':
      return <RenameChannelModal onClose={closeModal} />
    case 'start-dm':
      return <StartDmModal onClose={closeModal} />
    case 'manage-emojis':
      return <ManageEmojisModal onClose={closeModal} />
    case 'manage-stickers':
      return <ManageStickersModal onClose={closeModal} />
    case 'voice-invite':
      return <VoiceInviteModal onClose={closeModal} />
    default:
      return null
  }
}
