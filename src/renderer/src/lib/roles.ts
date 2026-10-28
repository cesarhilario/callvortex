import type { MemberRole, Role, RolePermission } from './types'

/** Paleta de cores para cargos (tons do Discord). null = sem cor definida. */
export const ROLE_COLORS: (string | null)[] = [
  null,
  '#99aab5',
  '#5865f2',
  '#3ba55c',
  '#faa61a',
  '#ed4245',
  '#eb459e',
  '#9b59b6',
  '#1abc9c',
  '#3498db',
  '#e91e63',
  '#e67e22',
  '#f1c40f',
  '#71368a',
  '#206694',
  '#11806a',
  '#a84300',
  '#9879bb'
]

/** Mapa role_id → cargo. */
export function roleMap(roles: Role[]): Map<string, Role> {
  return new Map(roles.map((r) => [r.id, r]))
}

/** Cargo de maior posição de uma lista de atribuições (ou null). */
export function highestRole(roleIds: string[], roles: Role[]): Role | null {
  const byId = roleMap(roles)
  let best: Role | null = null
  for (const id of roleIds) {
    const r = byId.get(id)
    if (r && (best === null || r.position > best.position)) best = r
  }
  return best
}

/** Cargos de um membro, do mais alto para o mais baixo. */
export function rolesForMember(roleIds: string[], roles: Role[]): Role[] {
  const byId = roleMap(roles)
  return roleIds
    .map((id) => byId.get(id))
    .filter((r): r is Role => !!r)
    .sort((a, b) => b.position - a.position || a.name.localeCompare(b.name))
}

/** Cor de nome de usuário: a do cargo mais alto que tenha cor definida. */
export function memberColor(roleIds: string[], roles: Role[]): string | null {
  for (const r of rolesForMember(roleIds, roles)) {
    if (r.color) return r.color
  }
  return null
}

/**
 * Permissões efetivas de alguém no servidor: dono tem tudo implícito e
 * a permissão "administrator" também implica todas as outras.
 */
export function effectivePermissions(
  isOwner: boolean,
  myRoleIds: string[],
  roles: Role[]
): Set<RolePermission> {
  const set = new Set<RolePermission>()
  if (isOwner) {
    set.add('administrator')
    set.add('manage_channels')
    set.add('manage_roles')
    set.add('kick_members')
    return set
  }
  for (const r of rolesForMember(myRoleIds, roles)) {
    if (r.permissions.includes('administrator')) {
      set.add('administrator')
      set.add('manage_channels')
      set.add('manage_roles')
      set.add('kick_members')
      break
    }
    for (const p of r.permissions) set.add(p)
  }
  return set
}

/**
 * Maior posição de cargo de um membro. O dono vale infinito (nunca é
 * alcançado pela hierarquia). Recebe `isOwner` pronto da tela.
 */
export function highestPosition(roleIds: string[], roles: Role[], isOwner: boolean): number {
  if (isOwner) return Number.MAX_SAFE_INTEGER
  let best = 0
  for (const r of rolesForMember(roleIds, roles)) {
    if (r.position > best) best = r.position
  }
  return best
}

/**
 * Se eu posso atribuir o cargo `role` ao membro `memberRoleIds`, dadas as
 * permissões e a posição do maior cargo alheio — regra do Discord: o cargo
 * deve ficar estritamente abaixo do meu maior e o membro não pode estar
 * acima de mim.
 */
export function canAssignRole(params: {
  role: Role
  memberRoleIds: string[]
  roles: Role[]
  myPermissions: Set<RolePermission>
  myPosition: number
}): boolean {
  if (params.myPermissions.has('administrator')) return true
  if (!params.myPermissions.has('manage_roles')) return false
  return params.role.position < params.myPosition && highestPosition(params.memberRoleIds, params.roles, false) < params.myPosition
}
