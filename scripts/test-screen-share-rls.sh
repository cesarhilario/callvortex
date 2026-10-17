#!/usr/bin/env bash
# ============================================================
# TESTE RLS/RPC — COMPARTILHAMENTO DE TELA (CallVortex)
#
# Roda a suíte supabase/tests/screen_share_rls_test.sql contra
# um banco de teste. Dois modos:
#
#   1) Default — Postgres LOCAL com banco descartável
#      (cria, aplica schema + suíte; não apaga no fim para permitir
#       inspeção, e reexecutar é idempotente pois inicia com drop):
#         ./scripts/test-screen-share-rls.sh
#
#   2) Banco remoto (ex.: Supabase hospedado) via connection string:
#         ./scripts/test-screen-share-rls.sh "$DATABASE_URL"
#      ATENÇÃO: a suíte roda dentro de transação com ROLLBACK final,
#      então é não-destrutiva — mas só aponte para um banco DE TESTE.
#
# Saída: logs em /tmp e exit code 0/1.
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."

SCHEMA="supabase/schema.sql"
SUITE="supabase/tests/screen_share_rls_test.sql"
LOG_SCHEMA="/tmp/callvortex-rls-schema.log"
LOG_SUITE="/tmp/callvortex-rls-suite.log"

if [ $# -ge 1 ] && [ -n "${1:-}" ]; then
  # MODO REMOTO: URI posicional do psql (sem -h/-U/-d adicionais)
  PSQL=(psql "$1" -v ON_ERROR_STOP=1)
  echo "→ Modo REMOTO: suíte não-destrutiva (transação com ROLLBACK final)"
else
  # MODO LOCAL: banco descartável callvortex_test
  echo "→ Modo LOCAL: preparando banco descartável callvortex_test…"
  psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -q \
    -c "drop database if exists callvortex_test;" \
    -c "create database callvortex_test;"
  PSQL=(psql -h localhost -U postgres -d callvortex_test -v ON_ERROR_STOP=1)
fi

echo "→ Aplicando stubs de ambiente (auth/storage) + schema…"

# Stubs só fazem sentido no modo LOCAL (o Supabase hospedado já provê tudo)
if [ -z "${1:-}" ]; then
  "${PSQL[@]}" -q <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key, email text unique, encrypted_password text,
  raw_user_meta_data jsonb default '{}', created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid default gen_random_uuid() primary key,
  bucket_id text references storage.buckets(id) on delete cascade,
  name text, owner uuid,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$ select string_to_array(name, '/') $$;
create or replace function storage.filename(name text) returns text
language sql immutable as $$ select (string_to_array(name,'/'))[array_length(string_to_array(name,'/'),1)] $$;
create or replace function storage.extension(name text) returns text
language sql immutable as $$ select coalesce(split_part((string_to_array(name,'/'))[array_length(string_to_array(name,'/'),1)],'.',2), '') $$;
create or replace function storage.name(name text) returns text
language sql immutable as $$ select (string_to_array(name,'/'))[array_length(string_to_array(name,'/'),1)] $$;
do $$ begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
SQL
fi

"${PSQL[@]}" -f "$SCHEMA" > "$LOG_SCHEMA" 2>&1 || {
  echo "✗ Falha ao aplicar o schema (veja $LOG_SCHEMA)"; exit 1; }

echo "→ Rodando a suíte RLS ($SUITE)…"
if "${PSQL[@]}" -f "$SUITE" > "$LOG_SUITE" 2>&1; then
  echo "✔ SUÍTE RLS PASSOU (exit 0) — todos os cenários de ataque foram negados como esperado."
  echo "  Log: $LOG_SUITE"
else
  echo "✗ SUÍTE RLS FALHOU (veja $LOG_SUITE)"
  tail -20 "$LOG_SUITE"
  exit 1
fi
