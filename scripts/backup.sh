#!/bin/bash
# ===========================================
# CloudGPUs.io Database Backup Script
# ===========================================
# Run via cron: 0 3 * * * /path/to/backup.sh

set -e

# Configuration
BACKUP_DIR="/opt/docker-projects/heavy-tasks/vibing-code/CloudGPUs.io/backups"
SCHEMA="cloudgpus"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${SCHEMA}_${TIMESTAMP}.sql"
LOG_FILE="/var/log/cloudgpus-backup.log"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
handle_error() {
    log "ERROR: Backup failed at line $1"
    exit 1
}
trap 'handle_error $LINENO' ERR

# Start backup
log "Starting backup of schema: $SCHEMA"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Dump database
log "Dumping database..."
docker exec supabase-db pg_dump -U postgres -n "$SCHEMA" --no-owner --no-acl > "$BACKUP_FILE"

# Verify backup is not empty
if [ ! -s "$BACKUP_FILE" ]; then
    log "ERROR: Backup file is empty"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Get backup size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log "Backup created: $BACKUP_SIZE"

# Compress backup
log "Compressing backup..."
gzip "$BACKUP_FILE"
COMPRESSED_SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
log "Compressed size: $COMPRESSED_SIZE"

# Upload to R2 (if configured)
if [ -n "$R2_BUCKET_NAME" ] && [ -n "$R2_ACCOUNT_ID" ]; then
    log "Uploading to Cloudflare R2..."
    aws s3 cp "${BACKUP_FILE}.gz" "s3://${R2_BUCKET_NAME}/backups/" \
        --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
        2>> "$LOG_FILE"
    log "Upload complete"
fi

# Cleanup old local backups
log "Cleaning up backups older than $RETENTION_DAYS days..."
DELETED_COUNT=$(find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
log "Deleted $DELETED_COUNT old backups"

# List remaining backups
log "Current backups:"
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -5 >> "$LOG_FILE"

log "Backup complete: ${BACKUP_FILE}.gz"
