import { useEffect, useState } from 'react'
import { fetchMembers } from '../lib/api'
import { getSupabase } from '../lib/supabase'
import { ROLE_COLORS, effectivePermissions, highestPosition, memberColor, rolesForMember } from '../lib/roles'
import type { Profile, Role } from '../lib/types'
import { useApp } from '../lib/useApp'
import Avatar from './Avatar'

/**
 * Lista de membros do servidor (estilo Discord):
 *  - online agrupado pelo cargo mais alto de cada membro (grupos na ordem
 *    da hierarquia), membros sem cargo no grupo "Online";
 *  - todos os offline num único grupo embaixo;
 *  - nome colorido pela cor do cargo mais alto que tenha cor definida;
 *  - mini etiquetas com todos os cargos do membro;
 *  - clique abre o painel de cargos do membro (atribuição) — só para quem
 *    pode gerenciar cargos; botão de expulsar para quem tem a permissão.
 */
export default function MemberList({ serverId }: { serverId: string }): React.JSX.Element | null {
  const {
    profile,
    onlineUsers,
    servers,
    roles,
    memberRoleIds,
    membersVersion,
    handleSetMemberRoles,
    handleKickMember
  } = useApp()
  const [members, setMembers] = useState<Profile[]>([])
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<Profile | null>(null)

  useEffect(() => {
    let cancelled = false
    setMembers([])
    setError(false)
    fetchMembers(serverId)
      .then((m) => {
        if (!cancelled) setMembers(m)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [serverId, membersVersion])

  // nome/foto de usuário mudou: atualiza a lista de membros ao vivo;
  // membro removido do servidor sai na hora (expulsão)
  useEffect(() => {
    const supabase = getSupabase()
    const ch = supabase.channel(`members-live-${serverId}`)
    ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
      const p = payload.new as Profile
      setMembers((prev) => prev.map((m) => (m.id === p.id ? { ...m, ...p } : m)))
    })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'server_members' }, (payload) => {
        const old = payload.old as { user_id?: string }
        if (old?.user_id) setMembers((prev) => prev.filter((m) => m.id !== old.user_id))
      })
    void ch.subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [serverId])

  const server = servers.find((s) => s.id === serverId)
  const isOwner = !!server && server.owner_id === profile?.id
  const myRoleIds = (profile && memberRoleIds[profile.id]) || []
  const myPerms = effectivePermissions(isOwner, myRoleIds, roles)
  const canManageRoles = myPerms.has('administrator') || myPerms.has('manage_roles')
  const myPosition = highestPosition(myRoleIds, roles, isOwner)
  // expulsar: qualquer alvo dentro da hierarquia (o dono nunca é expulsável)
  const canKick = myPerms.has('kick_members')

  const online = members.filter((m) => onlineUsers.has(m.id))
  const offline = members.filter((m) => !onlineUsers.has(m.id))

  // grupos de online: um por cargo, do mais alto para o mais baixo;
  // cada membro aparece apenas no grupo do seu cargo mais alto
  const topRoleByMember = new Map<string, string>()
  for (const m of online) {
    const rs = rolesForMember(memberRoleIds[m.id] ?? [], roles)
    if (rs[0]) topRoleByMember.set(m.id, rs[0].id)
  }
  const groupedIds = new Set(topRoleByMember.values())
  const roleGroups = [...roles]
    .sort((a, b) => b.position - a.position || a.name.localeCompare(b.name))
    .filter((r) => groupedIds.has(r.id))
    .map((r) => ({ role: r, members: online.filter((m) => topRoleByMember.get(m.id) === r.id) }))
  const noRole = online.filter((m) => !topRoleByMember.has(m.id))

  const nameColor = (m: Profile): string | null => memberColor(memberRoleIds[m.id] ?? [], roles)

  return (
    <aside className="member-list">
      <div className="member-list-header">
        Membros — {members.length} ({online.length} online)
      </div>
      <div className="member-list-scroll">
        {error && <div className="sidebar-empty">Não foi possível carregar membros.</div>}
        {roleGroups.map((g) => (
          <div key={g.role.id} className="member-group">
            <div className="member-group-label" style={g.role.color ? { color: g.role.color } : undefined}>
              {g.role.name} — {g.members.length}
            </div>
            {g.members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                nameColor={nameColor(m)}
                roleNames={rolesForMember(memberRoleIds[m.id] ?? [], roles)}
                onClick={canManageRoles ? () => setSelected(m) : undefined}
              />
            ))}
          </div>
        ))}
        {noRole.length > 0 && (
          <div className="member-group">
            <div className="member-group-label">Online — {noRole.length}</div>
            {noRole.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                nameColor={nameColor(m)}
                roleNames={rolesForMember(memberRoleIds[m.id] ?? [], roles)}
                onClick={canManageRoles ? () => setSelected(m) : undefined}
              />
            ))}
          </div>
        )}
        {offline.length > 0 && (
          <div className="member-group">
            <div className="member-group-label muted">Offline — {offline.length}</div>
            {offline.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                online={false}
                nameColor={nameColor(m)}
                roleNames={rolesForMember(memberRoleIds[m.id] ?? [], roles)}
                onClick={canManageRoles ? () => setSelected(m) : undefined}
              />
            ))}
          </div>
        )}
        {members.length === 0 && !error && <div className="sidebar-empty">Carregando membros…</div>}
      </div>

      {selected && canManageRoles && (
        <MemberRolesPopover
          member={selected}
          isOwner={isOwner}
          canKick={canKick}
          myPosition={myPosition}
          onClose={() => setSelected(null)}
          onSaveRoles={handleSetMemberRoles}
          onKick={handleKickMember}
        />
      )}
    </aside>
  )
}

function MemberRow({
  member,
  online = true,
  nameColor,
  roleNames,
  onClick
}: {
  member: Profile
  online?: boolean
  nameColor: string | null
  roleNames: Role[]
  onClick?: () => void
}): React.JSX.Element {
  return (
    <div
      className={`member-item ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      title={onClick ? 'Cargos do membro' : undefined}
      role={onClick ? 'button' : undefined}
    >
      <Avatar name={member.username} color={member.avatar_color} size={32} online={online} url={member.avatar_url} />
      <div className="member-row-text">
        <span
          className={`member-name ${online ? '' : 'muted'}`}
          style={online && nameColor ? { color: nameColor } : undefined}
        >
          {member.username}
        </span>
        {roleNames.length > 0 && (
          <span className="member-role-tags">
            {roleNames.map((r) => (
              <span key={r.id} className="member-role-tag" style={r.color ? { color: r.color, borderColor: `${r.color}66` } : undefined}>
                {r.name}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Painel flutuante com os cargos do membro selecionado: marca/desmarca
 * cada cargo e permite expulsar. As regras de hierarquia valem aqui e
 * são revalidadas pelo banco (RLS) em toda gravação.
 */
function MemberRolesPopover({
  member,
  isOwner,
  canKick,
  myPosition,
  onClose,
  onSaveRoles,
  onKick
}: {
  member: Profile
  isOwner: boolean
  canKick: boolean
  myPosition: number
  onClose: () => void
  onSaveRoles: (userId: string, roleIds: string[]) => Promise<boolean>
  onKick: (userId: string, username: string) => Promise<boolean>
}): React.JSX.Element {
  const { roles, memberRoleIds, handleCreateRole } = useApp()
  const [checked, setChecked] = useState<string[]>(memberRoleIds[member.id] ?? [])
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'list' | 'create'>('list')
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string | null>(null)

  const memberPosition = highestPosition(memberRoleIds[member.id] ?? [], roles, false)
  const hierarchyAllows = myPosition > memberPosition

  return (
    <>
      <div className="member-popover-backdrop" onClick={onClose} />
      <div className="member-popover" role="dialog" aria-label={`Cargos de ${member.username}`}>
        <div className="member-popover-head">
          <Avatar name={member.username} color={member.avatar_color} size={44} url={member.avatar_url} />
          <div>
            <div className="member-popover-name">{member.username}</div>
            <div className="member-popover-sub">
              {isOwner || hierarchyAllows ? 'Clique para alternar os cargos' : 'Cargo no seu nível ou acima — sem permissão'}
            </div>
          </div>
        </div>

        {mode === 'list' ? (
          <>
            <div className="member-popover-roles">
              {roles.map((r) => {
                const on = checked.includes(r.id)
                const assignable = hierarchyAllows
                return (
                  <label
                    key={r.id}
                    className={`role-check ${assignable ? '' : 'locked'}`}
                    title={assignable ? undefined : 'Cargo no seu nível ou acima — só o dono/administrador pode atribuir'}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={busy || !assignable}
                      onChange={() => setChecked(on ? checked.filter((x) => x !== r.id) : [...checked, r.id])}
                    />
                    <span className="role-check-dot" style={r.color ? { background: r.color } : undefined} />
                    <span className="role-check-name">{r.name}</span>
                  </label>
                )
              })}
              {roles.length === 0 && <div className="modal-hint">Nenhum cargo criado neste servidor.</div>}
            </div>
            <div className="modal-actions">
              {(isOwner || hierarchyAllows) && roles.length > 0 && (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    const ok = await onSaveRoles(member.id, checked)
                    setBusy(false)
                    if (ok) onClose()
                  }}
                >
                  Salvar cargos
                </button>
              )}
              {(isOwner || hierarchyAllows) && (
                <button type="button" className="btn-secondary" onClick={() => setMode('create')}>
                  Criar cargo
                </button>
              )}
              {canKick && hierarchyAllows && !isOwner && (
                <button
                  type="button"
                  className="btn-danger"
                  disabled={busy}
                  onClick={async () => {
                    if (!window.confirm(`Expulsar ${member.username} do servidor?`)) return
                    setBusy(true)
                    const ok = await onKick(member.id, member.username)
                    setBusy(false)
                    if (ok) onClose()
                  }}
                >
                  Expulsar
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="modal-form">
              <input
                className="modal-input"
                placeholder="Nome do cargo"
                value={newName}
                maxLength={64}
                onChange={(e) => setNewName(e.target.value)}
              />
              <div className="role-color-row" role="group" aria-label="Cor do cargo">
                {ROLE_COLORS.map((c) => (
                  <button
                    key={c ?? 'none'}
                    type="button"
                    className={`role-color-dot ${newColor === c ? 'selected' : ''} ${c === null ? 'none' : ''}`}
                    style={c ? { background: c } : undefined}
                    title={c ? c : 'Sem cor'}
                    aria-pressed={newColor === c}
                    onClick={() => setNewColor(c)}
                  />
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setMode('list')}>
                Voltar
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={busy || newName.trim().length < 1}
                onClick={async () => {
                  setBusy(true)
                  await handleCreateRole(newName, newColor, [])
                  setBusy(false)
                  setNewName('')
                  setMode('list')
                }}
              >
                Criar cargo
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
