#!/bin/bash

# Kairo Database Restore Script
# This script restores the Kairo database from a backup

set -e

# Configuration
LOG_FILE="/var/log/kairo/restore.log"
S3_BUCKET="kairo-backups"
TEMP_DIR="/tmp/kairo_restore"

# Ensure log directory exists
mkdir -p /var/log/kairo

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    cleanup
    exit 1
}

# Cleanup function
cleanup() {
    log "Cleaning up temporary files..."
    rm -rf "$TEMP_DIR" || true
}

# Download backup from S3
download_backup() {
    local backup_file=$1

    log "Downloading backup from S3: $backup_file"

    # Create temp directory
    mkdir -p "$TEMP_DIR"

    # Download from S3
    if ! aws s3 cp "s3://$S3_BUCKET/$backup_file" "$TEMP_DIR/" >> "$LOG_FILE" 2>&1; then
        error_exit "Failed to download backup from S3"
    fi

    log "Backup downloaded successfully"
}

# Verify backup integrity
verify_backup() {
    local backup_file=$1

    log "Verifying backup integrity..."

    # Check if file exists
    if [ ! -f "$backup_file" ]; then
        error_exit "Backup file does not exist: $backup_file"
    fi

    # Check file size
    local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null || echo "0")
    if [ "$file_size" -eq 0 ]; then
        error_exit "Backup file is empty"
    fi

    # Test decompression
    if ! gunzip -c "$backup_file" > /dev/null 2>&1; then
        error_exit "Backup file is corrupted or not a valid gzip file"
    fi

    log "Backup integrity verification passed"
}

# Create database backup before restore
create_pre_restore_backup() {
    log "Creating pre-restore backup..."

    local pre_restore_file="/tmp/kairo_pre_restore_$(date +%Y%m%d_%H%M%S).sql.gz"

    if ! pg_dump "$DATABASE_URL" | gzip > "$pre_restore_file" 2>> "$LOG_FILE"; then
        log "WARNING: Failed to create pre-restore backup"
    else
        log "Pre-restore backup created: $pre_restore_file"
    fi
}

# Stop application (if applicable)
stop_application() {
    log "Stopping application services..."

    # Add your application stop commands here
    # Example:
    # systemctl stop kairo-web
    # systemctl stop kairo-worker

    log "Application services stopped"
}

# Start application (if applicable)
start_application() {
    log "Starting application services..."

    # Add your application start commands here
    # Example:
    # systemctl start kairo-web
    # systemctl start kairo-worker

    log "Application services started"
}

# Restore database
restore_database() {
    local backup_file=$1

    log "Starting database restore..."

    # Decompress and restore
    if ! gunzip -c "$backup_file" | psql "$DATABASE_URL" >> "$LOG_FILE" 2>&1; then
        error_exit "Database restore failed"
    fi

    log "Database restore completed successfully"
}

# Run post-restore validation
validate_restore() {
    log "Running post-restore validation..."

    # Test basic database connectivity
    if ! psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM auth_user;" > /dev/null 2>&1; then
        error_exit "Database validation failed - cannot query users table"
    fi

    # Get user count
    local user_count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM auth_user;" 2>/dev/null || echo "0")
    log "Database validation passed. User count: $user_count"

    # Add more validation queries as needed
    # - Check table existence
    # - Verify data integrity
    # - Run application-specific tests
}

# Main restore function
restore_from_backup() {
    local backup_file=$1

    log "=== Kairo Database Restore Started ==="
    log "Backup file: $backup_file"

    # Check if DATABASE_URL is set
    if [ -z "$DATABASE_URL" ]; then
        error_exit "DATABASE_URL environment variable is not set"
    fi

    # Handle S3 paths
    if [[ "$backup_file" == s3://* ]]; then
        local s3_path=$backup_file
        backup_file="$TEMP_DIR/$(basename "$backup_file")"
        download_backup "$s3_path"
    fi

    # Verify backup
    verify_backup "$backup_file"

    # Create pre-restore backup
    create_pre_restore_backup

    # Stop application
    stop_application

    # Restore database
    restore_database "$backup_file"

    # Run validation
    validate_restore

    # Start application
    start_application

    log "=== Kairo Database Restore Completed Successfully ==="
}

# Show usage
usage() {
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Arguments:"
    echo "  backup_file    Path to backup file (local path or S3 URL)"
    echo ""
    echo "Examples:"
    echo "  $0 /backups/2024-01-15/kairo_backup_20240115_120000.sql.gz"
    echo "  $0 s3://kairo-backups/2024-01-15/kairo_backup_20240115_120000.sql.gz"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_URL   Database connection string (required)"
    echo "  S3_BUCKET      S3 bucket name for backups (default: kairo-backups)"
    exit 1
}

# Main execution
main() {
    local backup_file=$1

    if [ -z "$backup_file" ]; then
        usage
    fi

    # Trap to ensure cleanup on exit
    trap cleanup EXIT

    # Run restore
    restore_from_backup "$backup_file"
}

# Run main function with arguments
main "$@"
