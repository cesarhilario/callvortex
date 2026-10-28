-- ============================================================
-- CARGOS (estilo Discord)
-- Rodar no SQL Editor para projetos já existentes.
-- Projetos novos: o supabase/schema.sql já contém esta seção.
--
-- Cargo por servidor com cor, posição (maior = mais alto) e permissões:
-- administrator · manage_channels · manage_roles · kick_members
-- O dono do servidor tem TODAS as permissões implícitas.
-- Administrador implícito: cada permissão exceto nada — equivalente ao
-- Discord: quem tem "administrator" pode tudo.
--
-- Hierarquia: quem gerencia cargos/membros só pode mexer em cargos abaixo
-- do seu maior cargo — o dono ignora a hierarquia (posição infinita).
-- ============================================================

create table if not exists public.roles (
  id uuid default gen_random_uuid() primary key,
  server_id uuid not null references public.servers (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 64),
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  position int not null default 0,
  permissions jsonb not null default '[]'::jsonb check (jsonb_typeof(permissions) = 'array'),
  created_at timestamptz not null default now()
);

create index if not exists roles_server_pos_idx on public.roles (server_id, position desc);

create table if not exists public.member_roles (
  server_id uuid not null references public.servers (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (role_id, user_id)
);

create index if not exists member_roles_server_user_idx on public.member_roles (server_id, user_id);
create index if not exists member_roles_user_idx on public.member_roles (user_id);

alter table public.roles enable row level security;
alter table public.member_roles enable row level security;

-- ------------------------------------------------------------
-- Permissões (SECURITY DEFINER para as policies poderem ler as duas tabelas)
-- O dono tem tudo; o administrador implica todas as outras.
-- ------------------------------------------------------------

create or replace function public.is_server_admin(target_server uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_server_owner(target_server),
    exists (
      select 1
      from public.member_roles mr
      join public.roles r on r.id = mr.role_id
      where mr.server_id = target_server
        and mr.user_id = auth.uid()
        and r.permissions @> '["administrator"]'::jsonb
    )
  )
$$;

create or replace function public.has_server_permission(target_server uuid, permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_server_admin(target_server),
    exists (
      select 1
      from public.member_roles mr
      join public.roles r on r.id = mr.role_id
      where mr.server_id = target_server
        and mr.user_id = auth.uid()
        and r.permissions @> to_jsonb(ARRAY[permission])
    )
  )
$$;

-- Maior posição de cargo do usuário neste servidor (0 quando não tem cargos).
-- O dono é tratado como posição infinita (hierarquia nunca o alcança).
create or replace function public.my_role_position(target_server uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_server_owner(target_server) then 2147483647
    else coalesce((
      select max(r.position)
      from public.member_roles mr
      join public.roles r on r.id = mr.role_id
      where mr.server_id = target_server and mr.user_id = auth.uid()
    ), 0)
  end
$$;

-- Maior posição de cargo de QUALQUER usuário (invisible para quem vê).
create or replace function public.role_position_of(target_server uuid, target_user uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select max(r.position)
      from public.member_roles mr
      join public.roles r on r.id = mr.role_id
      where mr.server_id = target_server and mr.user_id = target_user
    ),
    0
  )
$$;

revoke all on function public.is_server_admin(uuid) from public;
revoke all on function public.has_server_permission(uuid, text) from public;
revoke all on function public.my_role_position(uuid) from public;
revoke all on function public.role_position_of(uuid, uuid) from public;
grant execute on function public.is_server_admin(uuid) to authenticated;
grant execute on function public.has_server_permission(uuid, text) to authenticated;
grant execute on function public.my_role_position(uuid) to authenticated;
grant execute on function public.role_position_of(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- RLS — roles
-- Membros do servidor lêem os cargos. Criar/editar/remover exige
-- a permissão manage_roles (ou administrador/dono) e respeita a
-- hierarquia: cargo no mesmo nível ou acima do meu pode ser lido,
-- mas não é editável por quem não é dono/admin.
-- ------------------------------------------------------------

drop policy if exists "roles_select" on public.roles;
create policy "roles_select" on public.roles
  for select to authenticated using (public.is_server_member(server_id));

drop policy if exists "roles_insert" on public.roles;
create policy "roles_insert" on public.roles
  for insert to authenticated with check (
    public.has_server_permission(server_id, 'manage_roles')
    and (
      public.is_server_admin(server_id)
      or position < public.my_role_position(server_id)
    )
  );

drop policy if exists "roles_update" on public.roles;
create policy "roles_update" on public.roles
  for update to authenticated using (
    public.has_server_permission(server_id, 'manage_roles')
    and (
      public.is_server_admin(server_id)
      or position < public.my_role_position(server_id)
    )
  );

drop policy if exists "roles_delete" on public.roles;
create policy "roles_delete" on public.roles
  for delete to authenticated using (
    public.has_server_permission(server_id, 'manage_roles')
    and (
      public.is_server_admin(server_id)
      or position < public.my_role_position(server_id)
    )
  );

-- ------------------------------------------------------------
-- RLS — member_roles (atribuição de cargos)
-- Lectura aberta a membros; gravação exige manage_roles, respeita
-- a hierarquia (não atribuir cargo ≥ o meu maior; não mexer em membro
-- com maior cargo que o meu) e exige que o alvo seja membro do servidor.
-- ------------------------------------------------------------

drop policy if exists "member_roles_select" on public.member_roles;
create policy "member_roles_select" on public.member_roles
  for select to authenticated using (public.is_server_member(server_id));

drop policy if exists "member_roles_insert" on public.member_roles;
create policy "member_roles_insert" on public.member_roles
  for insert to authenticated with check (
    public.has_server_permission(server_id, 'manage_roles')
    and user_id <> auth.uid()
    and public.is_server_member(server_id)
    and (
      public.is_server_admin(server_id)
      or (
        public.role_position_of(server_id, user_id) < public.my_role_position(server_id)
        and (select r.position from public.roles r where r.id = role_id) < public.my_role_position(server_id)
      )
    )
  );

drop policy if exists "member_roles_delete" on public.member_roles;
create policy "member_roles_delete" on public.member_roles
  for delete to authenticated using (
    public.has_server_permission(server_id, 'manage_roles')
    and public.is_server_member(server_id)
    and (
      public.is_server_admin(server_id)
      or (
        public.role_position_of(server_id, user_id) < public.my_role_position(server_id)
        and (select r.position from public.roles r where r.id = role_id) < public.my_role_position(server_id)
      )
    )
  );

revoke all on table public.member_roles from anon;
revoke all on table public.member_roles from authenticated;
grant select, insert, delete on table public.member_roles to authenticated;

revoke all on table public.roles from anon;
revoke all on table public.roles from authenticated;
grant select, insert, update, delete on table public.roles to authenticated;

-- ------------------------------------------------------------
-- Expulsar membro: remove a linha de server_members. O dono do
-- servidor nunca é expulsável; quem expulsa precisa da permissão
-- kick_members (ou administrador) e hierarquia acima do alvo.
-- Auto-saída (remover a própria linha) continua possível.
-- Migrados: membro antigo não tinha cargos — posição 0 vence tudo
-- e o dono segue intocável.
-- ------------------------------------------------------------

drop policy if exists "members_kick" on public.server_members;
create policy "members_kick" on public.server_members
  for delete to authenticated using (
    user_id = auth.uid()
    or (
      user_id <> (select s.owner_id from public.servers s where s.id = server_id)
      and public.has_server_permission(server_id, 'kick_members')
      and (
        public.is_server_admin(server_id)
        or public.role_position_of(server_id, user_id) < public.my_role_position(server_id)
      )
    )
  );

-- ------------------------------------------------------------
-- As policies de canais e emojis passam a respeitar permissões de
-- cargo: dono do servidor OU administrador OU cargo com a permissão
-- correspondente. (Antes: apenas o dono.)
-- ------------------------------------------------------------

drop policy if exists "channels_insert" on public.channels;
create policy "channels_insert" on public.channels
  for insert to authenticated with check (
    public.has_server_permission(server_id, 'manage_channels')
  );

drop policy if exists "channels_update" on public.channels;
create policy "channels_update" on public.channels
  for update to authenticated using (
    public.has_server_permission(server_id, 'manage_channels')
  );

drop policy if exists "channels_delete" on public.channels;
create policy "channels_delete" on public.channels
  for delete to authenticated using (
    public.has_server_permission(server_id, 'manage_channels')
  );

drop policy if exists "server_emojis_insert" on public.server_emojis;
create policy "server_emojis_insert" on public.server_emojis
  for insert to authenticated with check (
    public.has_server_permission(server_id, 'manage_channels')
  );

drop policy if exists "server_emojis_update" on public.server_emojis;
create policy "server_emojis_update" on public.server_emojis
  for update to authenticated using (
    public.has_server_permission(server_id, 'manage_channels')
  );

drop policy if exists "server_emojis_delete" on public.server_emojis;
create policy "server_emojis_delete" on public.server_emojis
  for delete to authenticated using (
    public.has_server_permission(server_id, 'manage_channels')
  );

-- ------------------------------------------------------------
-- Realtime: cargos e atribuições ao vivo (lista de membros se
-- reorganiza sozinha quando alguém cria/move/atribui cargo).
-- ------------------------------------------------------------

do $$
begin
  begin
    alter publication supabase_realtime add table public.roles;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.member_roles;
  exception when duplicate_object then null;
  end;
end $$;
