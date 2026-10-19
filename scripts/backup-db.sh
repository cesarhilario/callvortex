#!/usr/bin/env bash
# Backup do banco CallVortex (Supabase)
# Uso: ./scripts/backup-db.sh
# A connection string vem da variável DATABASE_URL ou do arquivo
# ~/.callvortex-db-url (fora do git — nunca commite a senha do banco).
set -euo pipefail

# 1) Connection string (segredo)
if [[ -z "${DATABASE_URL:-}" && -f "$HOME/.callvortex-db-url" ]]; then
  DATABASE_URL="$(cat "$HOME/.callvortex-db-url")"
fi
DB_URL="${DATABASE_URL:?Defina DATABASE_URL (connection string do Supabase)}"

# 2) Destino (padrão: ~/callvortex-backups)
DEST="${BACKUP_DIR:-$HOME/callvortex-backups}"
mkdir -p "$DEST"

STAMP="$(date +%Y-%m-%d_%H%M)"
echo "Gerando backup em $DEST ..."

# 3) Dump: schema public + auth (contas de usuário), sem owner/privileges
pg_dump "$DB_URL" \
  --schema=public --schema=auth \
  --no-owner --no-privileges \
  | gzip > "$DEST/callvortex-$STAMP.sql.gz"

# 4) Mantém só os 10 backups mais recentes
ls -1t "$DEST"/callvortex-*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm --

echo "Backup concluído: $DEST/callvortex-$STAMP.sql.gz"
