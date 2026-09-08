#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml"
mkdir -p "$BACKUP_DIR/$STAMP"

$COMPOSE exec -T warehouse pg_dump -U kotva -d kotva_warehouse -Fc > "$BACKUP_DIR/$STAMP/postgres.dump"
$COMPOSE exec -T arangodb rm -rf "/tmp/kotva-backup-$STAMP"
$COMPOSE exec -T arangodb arangodump --server.endpoint tcp://127.0.0.1:8529 --server.database kotva --server.username root --server.password "$ARANGO_PASSWORD" --output-directory "/tmp/kotva-backup-$STAMP"
docker cp "$($COMPOSE ps -q arangodb):/tmp/kotva-backup-$STAMP" "$BACKUP_DIR/$STAMP/arangodb"
$COMPOSE exec -T arangodb rm -rf "/tmp/kotva-backup-$STAMP"
tar -czf "$BACKUP_DIR/kotva-$STAMP.tar.gz" -C "$BACKUP_DIR/$STAMP" .
rm -rf "$BACKUP_DIR/$STAMP"
echo "Backup created: $BACKUP_DIR/kotva-$STAMP.tar.gz"
