-- ============================================================
-- FIGURINHAS (stickers) e GIFs — Etapa 4
--
-- Tabela única `stickers` para os dois escopos:
--   server_id preenchido  → figurinha do SERVIDOR (gerencia o dono)
--   owner_user_id preenchido → figurinha PESSOAL do usuário
-- (check garante exatamente um dos preenchidos)
--
-- Bucket próprio no Storage (`stickers`) porque a política do bucket
-- `emojis` exige que a primeira pasta seja um server_id de propriedade
-- do dono — não servia para figurinhas pessoais.
-- Paths:
--   stickers/server/<server_id>/<uuid>.<ext>
--   stickers/user/<user_id>/<uuid>.<ext>
--
-- Idempotente e seguro para projetos que já têm dados.
-- ============================================================

create table if not exists public.stickers (
  id uuid primary key default gen_random_uuid(),
  server_id uuid references public.servers (id) on delete cascade,
  owner_user_id uuid references public.profiles (id) on delete cascade,
  name text not null,
  url text not null,
  created_at timestamptz not null default now(),
  constraint stickers_scope_check check ((server_id is null) <> (owner_user_id is null)),
  constraint stickers_name_check check (name ~ '^[\w+-]{1,32}$')
);

-- nome único dentro de cada escopo (servidor ou usuário)
create unique index if not exists stickers_scope_name_idx
  on public.stickers (coalesce(server_id::text, 'user:' || owner_user_id::text), name);

alter table public.stickers enable row level security;

drop policy if exists "stickers_select" on public.stickers;
create policy "stickers_select" on public.stickers
  for select to authenticated using (
    (server_id is not null and public.is_server_member(server_id))
    or owner_user_id = auth.uid()
  );

drop policy if exists "stickers_insert" on public.stickers;
create policy "stickers_insert" on public.stickers
  for insert to authenticated with check (
    (server_id is not null and owner_user_id is null and public.is_server_owner(server_id))
    or (server_id is null and owner_user_id = auth.uid())
  );

drop policy if exists "stickers_update" on public.stickers;
create policy "stickers_update" on public.stickers
  for update to authenticated using (
    (server_id is not null and public.is_server_owner(server_id))
    or owner_user_id = auth.uid()
  );

drop policy if exists "stickers_delete" on public.stickers;
create policy "stickers_delete" on public.stickers
  for delete to authenticated using (
    (server_id is not null and public.is_server_owner(server_id))
    or owner_user_id = auth.uid()
  );

-- Realtime: avisos de INSERT/DELETE para o picker atualizar ao vivo
-- (tolera execução repetida)
do $$ begin
  alter publication supabase_realtime add table public.stickers;
exception when duplicate_object then null; end $$;

-- ============================================================
-- Storage: bucket público `stickers`
-- Aperto de extensões espelha o hardening dos emojis (SEC-012)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('stickers', 'stickers', true)
on conflict (id) do nothing;

drop policy if exists "stickers_public_read" on storage.objects;
create policy "stickers_public_read" on storage.objects
  for select using (bucket_id = 'stickers');

drop policy if exists "stickers_server_owner_upload" on storage.objects;
create policy "stickers_server_owner_upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'stickers'
    and (storage.foldername(name))[1] = 'server'
    and exists (
      select 1 from public.servers s
      where s.id::text = (storage.foldername(name))[2] and s.owner_id = auth.uid()
    )
    and lower(storage.extension(name)) in ('png', 'jpg', 'jpeg', 'webp', 'gif')
  );

drop policy if exists "stickers_server_owner_delete" on storage.objects;
create policy "stickers_server_owner_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'stickers'
    and (storage.foldername(name))[1] = 'server'
    and exists (
      select 1 from public.servers s
      where s.id::text = (storage.foldername(name))[2] and s.owner_id = auth.uid()
    )
  );

drop policy if exists "stickers_user_own_upload" on storage.objects;
create policy "stickers_user_own_upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'stickers'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = auth.uid()::text
    and lower(storage.extension(name)) in ('png', 'jpg', 'jpeg', 'webp', 'gif')
  );

drop policy if exists "stickers_user_own_delete" on storage.objects;
create policy "stickers_user_own_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'stickers'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
