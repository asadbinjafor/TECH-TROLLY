#!/bin/sh
set -eu
umask 077
while true; do
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  if pg_dump --format=custom --no-owner --file="/backups/$stamp.dump.partial"; then
    mv "/backups/$stamp.dump.partial" "/backups/$stamp.dump"
    find /backups -name '*.dump' -mtime +30 -delete
    printf 'Backup completed: %s\n' "$stamp"
  else
    printf 'Backup failed: %s\n' "$stamp" >&2
    exit 1
  fi
  sleep 86400
done
