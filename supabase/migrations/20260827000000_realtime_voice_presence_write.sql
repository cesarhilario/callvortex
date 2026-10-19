-- ============================================================
-- VISIBILIDADE DE CANAIS: PÚBLICO x PRIVADO (lista de aprovados)
-- Permite que cada canal de voz seja:
--   - 'public'  → qualquer usuário autenticado entra na sala
--   - 'private' → só usuários aprovados (channel_allowed_users)
--                + o dono do servidor entram
--
-- Também corrige a autorização de GRAVAÇÃO (INSERT) no tópico de voz
-- privado (a migração 20260824000000 só criou SELECT, então o cliente
-- não conseguia publicar presença/broadcast → participantes não
-- apareciam na sala).
--
-- Idempotente: pode rodar quantas vezes precisar.
-- ============================================================

-- Coluna de visibilidade em channels
alter table public.channels
  add column if not exists visibility text not null default 'public';
alter table public.channels drop constraint if exists channels_visibility_check;
alter table public.channels add constraint channels_visibility_check check (visibility in ('public', 'private'));
-- Lista de aprovados de canais privados
create table if not exists public.channel_allowed_users (
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (channel_id, user_id)
);
alter table public.channel_allowed_users enable row level security;
-- ------------------------------------------------------------
-- Função de autorização de canal
-- true se: canal público  OU  usuário aprovado  OU  dono do servidor
-- ------------------------------------------------------------
create or replace function public.can_access_channel(target_channel uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.channels c
    where c.id = target_channel
      and (
        c.visibility = 'public'
        or exists (
          select 1 from public.channel_allowed_users a
          where a.channel_id = c.id and a.user_id = auth.uid()
        )
        or exists (
          select 1 from public.servers s
          where s.id = c.server_id and s.owner_id = auth.uid()
        )
      )
  )
$$;
revoke all on function public.can_access_channel(uuid) from public;
grant execute on function public.can_access_channel(uuid) to authenticated;
-- ------------------------------------------------------------
-- RLS de channel_allowed_users (somente o dono do servidor gerencia)
-- ------------------------------------------------------------
drop policy if exists "channel_allowed_select" on public.channel_allowed_users;
create policy "channel_allowed_select" on public.channel_allowed_users
  for select to authenticated using (true);
drop policy if exists "channel_allowed_insert" on public.channel_allowed_users;
create policy "channel_allowed_insert" on public.channel_allowed_users
  for insert to authenticated with check (
    exists (
      select 1 from public.channels c
      join public.servers s on s.id = c.server_id
      where c.id = channel_id and s.owner_id = auth.uid()
    )
  );
drop policy if exists "channel_allowed_delete" on public.channel_allowed_users;
create policy "channel_allowed_delete" on public.channel_allowed_users
  for delete to authenticated using (
    exists (
      select 1 from public.channels c
      join public.servers s on s.id = c.server_id
      where c.id = channel_id and s.owner_id = auth.uid()
    )
  );
-- ------------------------------------------------------------
-- Políticas Realtime do tópico de voz (presença + broadcast)
-- Seleciona/excreve quem pode acessar o canal (função acima).
-- ------------------------------------------------------------
drop policy if exists "voice_topic_members_only" on realtime.messages;
create policy "voice_topic_members_only"
  on realtime.messages
  for select
  to authenticated
  using (
    ("topic" like 'voice:%')
    and public.can_access_channel(
      substring("topic" from 7)::uuid
    )
  );
drop policy if exists "voice_topic_members_can_insert" on realtime.messages;
create policy "voice_topic_members_can_insert"
  on realtime.messages
  for insert
  to authenticated
  with check (
    ("topic" like 'voice:%')
    and public.can_access_channel(
      substring("topic" from 7)::uuid
    )
  );
