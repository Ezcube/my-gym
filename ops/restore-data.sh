#!/bin/sh

# Guarded full-data restore for the rootful My Gym Compose deployment.
# The archive is validated and extracted beside data/ before the API is stopped.
set -eu
umask 077
unset TAR_OPTIONS

fail() {
  echo "restore failed: $*" >&2
  exit 1
}

[ "$#" -eq 1 ] || fail "usage: restore-data.sh /path/to/my-gym-data-YYYYMMDDTHHMMSSZ.tar.gz"
[ "$(id -u)" -eq 0 ] || fail "must run as root for the rootful Docker data directory (use sudo)"

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_dir=${MY_GYM_PROJECT_DIR:-"$(dirname -- "$script_dir")"}

case ${MY_GYM_DATA_DIR:-data} in
  /*) data_dir=${MY_GYM_DATA_DIR:-data} ;;
  *) data_dir="$project_dir/${MY_GYM_DATA_DIR:-data}" ;;
esac
case ${MY_GYM_EXPECTED_DATA_DIR:-"$project_dir/data"} in
  /*) expected_data_dir=${MY_GYM_EXPECTED_DATA_DIR:-"$project_dir/data"} ;;
  *) expected_data_dir="$project_dir/${MY_GYM_EXPECTED_DATA_DIR:-data}" ;;
esac
case ${MY_GYM_BACKUP_DIR:-backups} in
  /*) backup_dir=${MY_GYM_BACKUP_DIR:-backups} ;;
  *) backup_dir="$project_dir/${MY_GYM_BACKUP_DIR:-backups}" ;;
esac

data_uid=${MY_GYM_DATA_UID:-0}
data_gid=${MY_GYM_DATA_GID:-0}
case $data_uid in ''|*[!0-9]*) fail "MY_GYM_DATA_UID must be a numeric uid" ;; esac
case $data_gid in ''|*[!0-9]*) fail "MY_GYM_DATA_GID must be a numeric gid" ;; esac

[ -d "$project_dir" ] || fail "project directory not found: $project_dir"
project_dir=$(CDPATH= cd -- "$project_dir" && pwd)
[ -f "$project_dir/docker-compose.yml" ] || fail "docker-compose.yml not found in $project_dir"
validator_path="$project_dir/ops/validate-restore-data.mjs"
[ -f "$validator_path" ] || fail "restore validator not found: $validator_path"
[ ! -L "$validator_path" ] || fail "restore validator must not be a symlink"
[ -d "$data_dir" ] || fail "data directory not found: $data_dir"
[ ! -L "$data_dir" ] || fail "data directory must not be a symlink: $data_dir"
[ -d "$expected_data_dir" ] || fail "expected data directory not found: $expected_data_dir"
[ ! -L "$expected_data_dir" ] || fail "expected data directory must not be a symlink: $expected_data_dir"
[ -d "$backup_dir" ] || fail "backup directory not found: $backup_dir"

data_dir=$(CDPATH= cd -- "$data_dir" && pwd)
expected_data_dir=$(CDPATH= cd -- "$expected_data_dir" && pwd)
backup_dir=$(CDPATH= cd -- "$backup_dir" && pwd)
[ "$data_dir" = "$expected_data_dir" ] || fail "data directory does not match MY_GYM_EXPECTED_DATA_DIR"
[ "$data_dir" != / ] || fail "refusing to replace the filesystem root"
[ "$data_dir" != "$project_dir" ] || fail "refusing to replace the project directory"
case "$backup_dir/" in "$data_dir/"*) fail "backup directory must be outside the data directory" ;; esac
case "$data_dir/" in "$backup_dir/"*) fail "data directory must be outside the backup directory" ;; esac

archive_arg=$1
archive_name=$(basename -- "$archive_arg")
archive_parent=$(dirname -- "$archive_arg")
[ -d "$archive_parent" ] || fail "archive directory not found: $archive_parent"
archive_dir=$(CDPATH= cd -- "$archive_parent" && pwd)
archive_path="$archive_dir/$archive_name"
[ "$archive_dir" = "$backup_dir" ] || fail "archive must be directly inside MY_GYM_BACKUP_DIR"
printf '%s\n' "$archive_name" | grep -Eq '^my-gym-data-[0-9]{8}T[0-9]{6}Z\.tar\.gz$' \
  || fail "unexpected archive name: $archive_name"
[ -f "$archive_path" ] || fail "archive not found: $archive_path"
[ ! -L "$archive_path" ] || fail "archive must not be a symlink"
checksum_path="$archive_path.sha256"
[ -f "$checksum_path" ] || fail "checksum sidecar not found: $checksum_path"
[ ! -L "$checksum_path" ] || fail "checksum sidecar must not be a symlink"

data_parent=$(dirname -- "$data_dir")
data_parent=$(CDPATH= cd -- "$data_parent" && pwd)
work_dir=$(mktemp -d "$data_parent/.my-gym-restore.XXXXXX")
staged_data="$work_dir/staged-data"
rollback_data="$work_dir/previous-data"
failed_data="$work_dir/failed-data"
mkdir -m 0700 -- "$staged_data"

api_stopped=0
old_moved=0
new_active=0
restore_committed=0

compose() {
  docker compose --project-directory "$project_dir" "$@"
}

validate_snapshot() {
  snapshot_dir=$1
  validation_output="$work_dir/validation.out"
  compose run --rm --no-deps -T \
    --volume "$snapshot_dir:/restore-data:ro" \
    --volume "$project_dir/ops/validate-restore-data.mjs:/restore-validator.mjs:ro" \
    --entrypoint node api \
    --disable-warning=ExperimentalWarning /restore-validator.mjs /restore-data \
    > "$validation_output" || return 1

  validation_line=$(grep -E '^MY_GYM_RESTORE_VALIDATION users=[0-9]+ credentials=[0-9]+$' \
    "$validation_output" || true)
  validation_lines=$(printf '%s\n' "$validation_line" | awk 'NF { count += 1 } END { print count + 0 }')
  [ "$validation_lines" -eq 1 ] || return 1
  printf '%s\n' "$validation_line" | sed -n 's/^MY_GYM_RESTORE_VALIDATION users=\([0-9][0-9]*\) credentials=[0-9][0-9]*$/\1/p'
}

wait_for_api() {
  expected_users=${1:-}
  attempt=0
  until compose exec -T -e "MY_GYM_RESTORE_EXPECTED_USERS=$expected_users" api \
    node --input-type=module --eval '
      const expectedText = process.env.MY_GYM_RESTORE_EXPECTED_USERS || "";
      if (expectedText && !/^[0-9]+$/.test(expectedText)) process.exit(2);
      try {
        const response = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/health`, {
          redirect: "error"
        });
        if (!response.ok) process.exit(1);
        const payload = await response.json();
        if (payload?.ok !== true) process.exit(1);
        if (expectedText && payload.users !== Number(expectedText)) process.exit(1);
      } catch { process.exit(1); }
    '; do
    attempt=$((attempt + 1))
    [ "$attempt" -lt 30 ] || return 1
    sleep 1
  done
}

validate_checksum() {
  checksum_line=$(sed -n '1p' "$checksum_path")
  checksum_lines=$(awk 'END { print NR }' "$checksum_path")
  [ -n "$checksum_line" ] || fail "checksum sidecar is empty"
  [ "$checksum_lines" -eq 1 ] || fail "checksum sidecar must contain exactly one entry"
  printf '%s\n' "$checksum_line" \
    | grep -Eq "^[0-9A-Fa-f]{64}  $archive_name\$" \
    || fail "checksum sidecar must name only $archive_name"

  expected_checksum=$(printf '%s\n' "$checksum_line" | cut -d ' ' -f 1 | tr 'A-F' 'a-f')
  actual_checksum=$(sha256sum "$archive_path" | cut -d ' ' -f 1 | tr 'A-F' 'a-f')
  [ "$actual_checksum" = "$expected_checksum" ] || fail "archive checksum mismatch"
}

validate_archive() {
  archive_listing="$work_dir/archive.list"
  archive_verbose="$work_dir/archive.verbose"
  archive_duplicates="$work_dir/archive.duplicates"

  tar -tzf "$archive_path" > "$archive_listing" || fail "cannot list archive"
  [ -s "$archive_listing" ] || fail "archive is empty"
  tar -tvzf "$archive_path" > "$archive_verbose" || fail "cannot inspect archive member types"

  while IFS= read -r detail || [ -n "$detail" ]; do
    member_type=$(printf '%s' "$detail" | cut -c 1)
    case $member_type in
      -|d) ;;
      *) fail "unsupported archive member type: $member_type" ;;
    esac
  done < "$archive_verbose"

  while IFS= read -r member || [ -n "$member" ]; do
    case $member in
      .|./) continue ;;
      ./*) relative_member=${member#./} ;;
      *) fail "unsafe archive member outside expected data root: $member" ;;
    esac
    case $relative_member in
      ''|/*|*\\*|*//*) fail "unsafe archive member: $member" ;;
    esac
    case "/$relative_member/" in
      */../*|*/./*) fail "unsafe archive member: $member" ;;
    esac
  done < "$archive_listing"

  LC_ALL=C sort "$archive_listing" | uniq -d > "$archive_duplicates"
  [ ! -s "$archive_duplicates" ] || fail "archive contains duplicate members"
}

rollback_restore() {
  [ "$old_moved" -eq 1 ] || return 0

  compose stop api >/dev/null 2>&1 || true
  api_stopped=1
  if [ "$new_active" -eq 1 ] && [ -d "$data_dir" ]; then
    mv -- "$data_dir" "$failed_data" || return 1
    new_active=0
  fi
  [ -d "$rollback_data" ] || return 1
  mv -- "$rollback_data" "$data_dir" || return 1
  old_moved=0
  compose up -d api >/dev/null || return 1
  api_stopped=0
  wait_for_api
}

cleanup() {
  status=$?
  trap - EXIT HUP INT TERM

  if [ "$status" -ne 0 ] && [ "$restore_committed" -eq 0 ] && [ "$old_moved" -eq 1 ]; then
    rollback_restore || echo "critical: automatic data rollback failed; keep $work_dir for recovery" >&2
  elif [ "$status" -ne 0 ] && [ "$api_stopped" -eq 1 ]; then
    compose up -d api >/dev/null 2>&1 || echo "warning: API restart needs manual attention" >&2
  fi

  if [ "$old_moved" -eq 0 ]; then
    case $work_dir in
      "$data_parent"/.my-gym-restore.*) rm -rf -- "$work_dir" ;;
      *) echo "warning: refusing to remove unexpected temporary path: $work_dir" >&2 ;;
    esac
  else
    echo "critical: previous data remains in $rollback_data" >&2
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

validate_checksum
validate_archive

tar --extract --gzip --file "$archive_path" --directory "$staged_data" \
  --no-same-owner --no-same-permissions \
  || fail "cannot extract archive into staging"

unsafe_staged=$(find "$staged_data" ! -type f ! -type d -print -quit)
[ -z "$unsafe_staged" ] || fail "staging contains an unsupported filesystem object"
for required_file in db.json secret vapid.json mygym.sqlite; do
  [ -f "$staged_data/$required_file" ] || fail "archive is missing required data file: $required_file"
  [ ! -L "$staged_data/$required_file" ] || fail "required data file is a symlink: $required_file"
  [ -s "$staged_data/$required_file" ] || fail "required data file is empty: $required_file"
done

expected_users=$(validate_snapshot "$staged_data") \
  || fail "staged data failed JSON, secret, VAPID or SQLite validation"
case $expected_users in ''|*[!0-9]*) fail "validator returned an invalid user count" ;; esac
[ "$expected_users" -ge 1 ] || fail "validator returned an empty user set"
expected_credentials=$(sed -n \
  's/^MY_GYM_RESTORE_VALIDATION users=[0-9][0-9]* credentials=\([0-9][0-9]*\)$/\1/p' \
  "$work_dir/validation.out")
case $expected_credentials in ''|*[!0-9]*) fail "validator returned an invalid credential count" ;; esac
[ "$expected_credentials" -ge "$expected_users" ] \
  || fail "validator returned fewer credentials than users"
echo "staged snapshot validated: users=$expected_users credentials=$expected_credentials"

# The entire directory is sensitive. Rootful Compose reads uid/gid 0 by
# default; custom numeric ownership must be stated explicitly for a custom image.
chown -R "$data_uid:$data_gid" "$staged_data"
find "$staged_data" -type d -exec chmod 0700 {} \;
find "$staged_data" -type f -exec chmod 0600 {} \;

# Validation and extraction are complete before downtime begins. Both renames
# are on the data parent filesystem, limiting the replacement gap to two local
# directory renames while the only writer is stopped.
compose stop api
api_stopped=1
mv -- "$data_dir" "$rollback_data"
old_moved=1
mv -- "$staged_data" "$data_dir"
new_active=1

compose up -d api
api_stopped=0
if ! wait_for_api "$expected_users"; then
  rollback_restore \
    || fail "restored API failed data-aware health check and automatic rollback failed; inspect $work_dir"
  fail "restored API failed data-aware health check; previous data was restored and is healthy"
fi

restore_committed=1
old_moved=0
echo "restore complete and API data verified: $archive_name (users=$expected_users)"
