-- ============================================================
-- CORREÇÃO: políticas de upload de figurinhas (e emojis) do SERVIDOR
--
-- BUG: dentro do subquery `exists (select 1 from public.servers s ...)`,
-- a referência `storage.foldername(name)` ficava AMBÍGUA: existem duas
-- colunas `name` em escopo (`storage.objects.name` e `public.servers.name`),
-- e o PostgreSQL resolvia para `s.name` (nome do SERVIDOR, ex.: "Teste").
-- Assim `foldername('Teste')` = {'Teste'} e o índice [1]/[2] virava NULL,
-- fazendo a comparação `s.id::text = NULL` nunca casar → o DONO do servidor
-- era sempre rejeitado ("new row violates row-level security policy").
--
-- Correção: qualificar explicitamente a coluna como `storage.objects.name`
-- (o `name` do objeto de storage), eliminando a ambiguidade.
--
-- Idempotente e não destrutivo (apenas drop/create das políticas).
-- ============================================================

-- Remove a função de diagnóstico criada temporariamente na investigação
-- (a migração foi reparada como 'reverted'; a função pode ter ficado).
drop function if exists public.diag_stickers();

-- ------------------------------------------------------------
-- Figurinhas — escopo de SERVIDOR
-- Path: stickers/server/<server_id>/<uuid>.<ext>
-- ------------------------------------------------------------
drop policy if exists "stickers_server_owner_upload" on storage.objects;
create policy "stickers_server_owner_upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'stickers'
    and (storage.foldername(storage.objects.name))[1] = 'server'
    and exists (
      select 1 from public.servers s
      where s.id::text = (storage.foldername(storage.objects.name))[2]
        and s.owner_id = auth.uid()
    )
    and lower(storage.extension(storage.objects.name)) in ('png', 'jpg', 'jpeg', 'webp', 'gif')
  );

drop policy if exists "stickers_server_owner_delete" on storage.objects;
create policy "stickers_server_owner_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'stickers'
    and (storage.foldername(storage.objects.name))[1] = 'server'
    and exists (
      select 1 from public.servers s
      where s.id::text = (storage.foldername(storage.objects.name))[2]
        and s.owner_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- Figurinhas — escopo PESSOAL (reforça a qualificação; já funcionava,
-- pois não há subquery com alias `s` criando ambiguidade)
-- Path: stickers/user/<user_id>/<uuid>.<ext>
-- ------------------------------------------------------------
drop policy if exists "stickers_user_own_upload" on storage.objects;
create policy "stickers_user_own_upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'stickers'
    and (storage.foldername(storage.objects.name))[1] = 'user'
    and (storage.foldername(storage.objects.name))[2] = auth.uid()::text
    and lower(storage.extension(storage.objects.name)) in ('png', 'jpg', 'jpeg', 'webp', 'gif')
  );

drop policy if exists "stickers_user_own_delete" on storage.objects;
create policy "stickers_user_own_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'stickers'
    and (storage.foldername(storage.objects.name))[1] = 'user'
    and (storage.foldername(storage.objects.name))[2] = auth.uid()::text
  );

-- ------------------------------------------------------------
-- Emojis — mesmo bug (path: emojis/<server_id>/<uuid>.<ext>)
-- ------------------------------------------------------------
drop policy if exists "emojis_owner_upload" on storage.objects;
create policy "emojis_owner_upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'emojis'
    and exists (
      select 1 from public.servers s
      where s.id::text = (storage.foldername(storage.objects.name))[1]
        and s.owner_id = auth.uid()
    )
    and lower(storage.extension(storage.objects.name)) in ('png', 'jpg', 'jpeg', 'webp', 'gif')
  );

drop policy if exists "emojis_owner_delete" on storage.objects;
create policy "emojis_owner_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'emojis'
    and exists (
      select 1 from public.servers s
      where s.id::text = (storage.foldername(storage.objects.name))[1]
        and s.owner_id = auth.uid()
    )
  );
