-- ============================================================
-- Privilégios de tabela para channel_allowed_users (lista de
-- aprovados de canais privados).
-- No ambiente hospedado, tabelas novas não recebem GRANT
-- automático para o papel 'authenticated'; a migração
-- 20260827000000 criou a tabela/políticas mas faltava o grant.
-- ============================================================
revoke all on table public.channel_allowed_users from anon;
revoke all on table public.channel_allowed_users from authenticated;
grant select, insert, delete on table public.channel_allowed_users to authenticated;
