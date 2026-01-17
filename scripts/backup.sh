#!/bin/bash
# NCLINIC Database Backup Script

BACKUP_DIR="/root/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/db_backup_$TIMESTAMP.sql"
CONTAINER_NAME="patient-assistant-postgres"
DB_USER="postgres"
DB_NAME="patient_assistant"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Perform backup
echo "Starting backup for $DB_NAME..."
if docker exec -t "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" > "$FILENAME"; then
    echo "Database dump successful."
    
    # Gzip the backup
    gzip "$FILENAME"
    echo "Backup compressed: $FILENAME.gz"

    # Delete backups older than 7 days
    find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +7 -delete
    echo "Old backups cleaned up."
else
    echo "Error: Database dump failed!"
    rm -f "$FILENAME"
    exit 1
fi
