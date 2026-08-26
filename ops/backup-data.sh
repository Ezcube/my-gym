#!/bin/sh

# Consistent backup of the complete My Gym data directory.
# The API is stopped only while the filesystem snapshot is created; compression
# and retention pruning happen after it is healthy again.
set -eu
umask 077

fail() {
  echo "backup failed: $*" >&2
  exit 1
}

# The production Compose service runs as root and creates secret/vapid files as
# root:root 0600. Running this snapshot as the deployment user would either
# omit those files or fail midway, so root is an explicit production contract.
[ "$(id -u)" -eq 0 ] || fail "must run as root for the rootful Docker data directory (use sudo)"

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_dir=${MY_GYM_PROJECT_DIR:-"$(dirname -- "$script_dir")"}

case ${MY_GYM_DATA_DIR:-data} in
  /*) data_dir=${MY_GYM_DATA_DIR:-data} ;;
  *) data_dir="$project_dir/${MY_GYM_DATA_DIR:-data}" ;;
esac
case ${MY_GYM_BACKUP_DIR:-backups} in
  /*) backup_dir=${MY_GYM_BACKUP_DIR:-backups} ;;
  *) backup_dir="$project_dir/${MY_GYM_BACKUP_DIR:-backups}" ;;
esac

retention_days=${BACKUP_RETENTION_DAYS:-30}
case $retention_days in
  ''|*[!0-9]*) fail "BACKUP_RETENTION_DAYS must be a positive integer" ;;
esac
[ "$retention_days" -ge 1 ] || fail "BACKUP_RETENTION_DAYS must be at least 1"
[ -f "$project_dir/docker-compose.yml" ] || fail "docker-compose.yml not found in $project_dir"
[ -d "$data_dir" ] || fail "data directory not found: $data_dir"

mkdir -p -- "$backup_dir"
project_dir=$(CDPATH= cd -- "$project_dir" && pwd)
data_dir=$(CDPATH= cd -- "$data_dir" && pwd)
backup_dir=$(CDPATH= cd -- "$backup_dir" && pwd)

[ "$data_dir" != / ] || fail "refusing to back up the filesystem root"
case "$backup_dir/" in
  "$data_dir/"*) fail "backup directory must be outside the data directory" ;;
esac

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
archive_name="my-gym-data-$timestamp.tar.gz"
archive_path="$backup_dir/$archive_name"
[ ! -e "$archive_path" ] || fail "archive already exists: $archive_path"

work_dir=$(mktemp -d "$backup_dir/.my-gym-backup.XXXXXX")
api_was_running=0
api_stopped=0

compose() {
  docker compose --project-directory "$project_dir" "$@"
}

restart_api() {
  [ "$api_was_running" -eq 1 ] || return 0
  [ "$api_stopped" -eq 1 ] || return 0

  compose start api

  attempt=0
  until compose exec -T api sh -ec 'wget --spider -q "http://127.0.0.1:${PORT:-3000}/api/health"'; do
    attempt=$((attempt + 1))
    [ "$attempt" -lt 15 ] || fail "API did not become healthy after restart"
    sleep 1
  done
  api_stopped=0
}

cleanup() {
  status=$?
  trap - EXIT HUP INT TERM

  if [ "$api_was_running" -eq 1 ] && [ "$api_stopped" -eq 1 ]; then
    compose start api >/dev/null 2>&1 || echo "warning: API restart needs manual attention" >&2
  fi

  case $work_dir in
    "$backup_dir"/.my-gym-backup.*) rm -rf -- "$work_dir" ;;
    *) echo "warning: refusing to remove unexpected temporary path: $work_dir" >&2 ;;
  esac
  exit "$status"
}
trap cleanup EXIT HUP INT TERM

running_services=$(compose ps --status running --services) || fail "cannot inspect Compose services"
if printf '%s\n' "$running_services" | grep -Fxq api; then
  api_was_running=1
  api_stopped=1
  compose stop api
fi

# With the only writer stopped, the SQLite database, WAL and legacy JSON files
# form one point-in-time snapshot. Do not exclude the session secret or VAPID keys.
tar -C "$data_dir" -cf "$work_dir/snapshot.tar" .

# Restore service before the CPU-heavy compression step.
restart_api

gzip -n -6 "$work_dir/snapshot.tar"
mv -- "$work_dir/snapshot.tar.gz" "$archive_path"
(
  cd "$backup_dir"
  sha256sum "$archive_name" > "$archive_name.sha256"
)

# Delete only archives created by this script. For a 30-day policy, -mtime +29
# removes files once 30 complete 24-hour periods have elapsed.
retention_mtime=$((retention_days - 1))
find "$backup_dir" -maxdepth 1 -type f \
  \( -name 'my-gym-data-*.tar.gz' -o -name 'my-gym-data-*.tar.gz.sha256' \) \
  -mtime "+$retention_mtime" -delete

echo "backup complete: $archive_path"
