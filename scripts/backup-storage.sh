#!/usr/bin/env bash
# ============================================================
# BACKUP DO STORAGE (buckets avatars e emojis)
#
# Usa a API S3-compatível do Supabase (documento 02, seção 6):
#   Painel -> Project Settings -> Storage -> S3 Access Keys
#
# Uso:
#   export SUPABASE_PROJECT_REF=xgvmxmnsxysbubybxdtq
#   export AWS_ACCESS_KEY_ID=...          # (ou SUPABASE_S3_ACCESS_KEY_ID)
#   export AWS_SECRET_ACCESS_KEY=...      # (ou SUPABASE_S3_SECRET_ACCESS_KEY)
#   ./scripts/backup-storage.sh [dir_destino]
#
# O destino deve ser privado (HD externo, repo privado, Drive).
# O script apenas baixa — não deleta nada do bucket de origem.
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."

REF="${SUPABASE_PROJECT_REF:-xgvmxmnsxysbubybxdtq}"
AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-${SUPABASE_S3_ACCESS_KEY_ID:-}}"
AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-${SUPABASE_S3_SECRET_ACCESS_KEY:-}}"
REGION="${AWS_REGION:-${SUPABASE_STORAGE_REGION:-auto}}"
ENDPOINT="${SUPABASE_STORAGE_ENDPOINT:-https://${REF}.supabase.co/storage/v1/s3}"
BUCKETS="${SUPABASE_STORAGE_BUCKETS:-avatars emojis}"
DEST="${1:-backup/storage}"

if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
  echo "✗ AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY ausentes (crie no painel: Storage -> S3 Access Keys)" >&2
  exit 1
fi

command -v aws >/dev/null 2>&1 || {
  echo "✗ Cliente AWS CLI não encontrado (pip install awscli ou https://aws.amazon.com/cli/)" >&2
  exit 1
}

mkdir -p "$DEST"
export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY

TOTAL_ARQUIVOS=0
for BUCKET in $BUCKETS; do
  echo "→ s3://$BUCKET → $DEST/$BUCKET"
  aws s3 sync "s3://${BUCKET}" "${DEST}/${BUCKET}" \
    --endpoint-url "$ENDPOINT" \
    --region "$REGION" \
    --no-progress
  N=$(find "${DEST}/${BUCKET}" -type f 2>/dev/null | wc -l | tr -d ' ')
  echo "  ✔ $N arquivo(s)"
  TOTAL_ARQUIVOS=$((TOTAL_ARQUIVOS + N))
done

echo
echo "✔ Backup do storage concluído em $DEST ($TOTAL_ARQUIVOS arquivo(s))."
echo "  Guarde em destino privado. Para restaurar, inverta o sync:"
echo "  aws s3 sync $DEST/avatars s3://avatars --endpoint-url \"$ENDPOINT\""
