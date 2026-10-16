#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Script de Backup Automático Diario para Canchariane v2 (PostgreSQL 16)
# Retención de 30 días con compresión gzip
# ==============================================================================

BACKUP_DIR="${BACKUP_DIR:-/var/backups/canchariane}"
CONTAINER_NAME="${CONTAINER_NAME:-canchariane_prod_postgres}"
DB_USER="${POSTGRES_USER:-canchariane}"
DB_NAME="${POSTGRES_DB:-canchariane_db}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/canchariane_${DB_NAME}_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -Iseconds)] Iniciando backup de la base de datos ${DB_NAME} desde contenedor ${CONTAINER_NAME}..."

# Ejecutar pg_dump dentro del contenedor y comprimir en destino
docker exec -t "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip -9 > "${BACKUP_FILE}"

FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date -Iseconds)] Backup completado con éxito: ${BACKUP_FILE} (Tamaño: ${FILE_SIZE})"

# Limpieza: Eliminar backups más antiguos de 30 días
echo "[$(date -Iseconds)] Limpiando backups con más de 30 días de antigüedad..."
find "${BACKUP_DIR}" -type f -name "canchariane_*.sql.gz" -mtime +30 -exec rm -v {} \;

echo "[$(date -Iseconds)] Tarea de backup finalizada."
