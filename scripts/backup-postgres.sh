#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups/postgres}"
RETENTION_DAILY="${RETENTION_DAILY:-7}"
RETENTION_WEEKLY="${RETENTION_WEEKLY:-4}"
RETENTION_MONTHLY="${RETENTION_MONTHLY:-6}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DAY_OF_WEEK="$(date +%u)"
DAY_OF_MONTH="$(date +%d)"

mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly" "${BACKUP_DIR}/monthly"

FILE="${BACKUP_DIR}/daily/aguia_${TIMESTAMP}.sql.gz"
pg_dump "${DATABASE_URL}" | gzip > "${FILE}"

if [[ "${DAY_OF_WEEK}" == "7" ]]; then
  cp "${FILE}" "${BACKUP_DIR}/weekly/aguia_week_${TIMESTAMP}.sql.gz"
fi

if [[ "${DAY_OF_MONTH}" == "01" ]]; then
  cp "${FILE}" "${BACKUP_DIR}/monthly/aguia_month_${TIMESTAMP}.sql.gz"
fi

ls -1t "${BACKUP_DIR}/daily" | tail -n +$((RETENTION_DAILY + 1)) | xargs -r -I{} rm -f "${BACKUP_DIR}/daily/{}"
ls -1t "${BACKUP_DIR}/weekly" | tail -n +$((RETENTION_WEEKLY + 1)) | xargs -r -I{} rm -f "${BACKUP_DIR}/weekly/{}"
ls -1t "${BACKUP_DIR}/monthly" | tail -n +$((RETENTION_MONTHLY + 1)) | xargs -r -I{} rm -f "${BACKUP_DIR}/monthly/{}"

if [[ -n "${BACKUP_REMOTE_PATH:-}" ]]; then
  cp "${FILE}" "${BACKUP_REMOTE_PATH}/"
fi

if command -v redis-cli >/dev/null 2>&1 && [[ -n "${REDIS_URL:-}" ]]; then
  redis-cli -u "${REDIS_URL}" SET ops:last-backup "$(date -Iseconds)" EX 604800 >/dev/null || true
fi

echo "Backup concluído: ${FILE}"
