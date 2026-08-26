import { createECDH } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openAppDatabase } from '../api/src/database.js'
import { migrateHealthSchema } from '../api/src/health/repository.js'

const read = relative => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8')

function createRestoreSnapshot() {
  const dir = mkdtempSync(path.join(tmpdir(), 'my-gym-restore-contract-'))
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  writeFileSync(path.join(dir, 'secret'), 'ab'.repeat(32))
  writeFileSync(path.join(dir, 'vapid.json'), JSON.stringify({
    publicKey: ecdh.getPublicKey().toString('base64url'),
    privateKey: ecdh.getPrivateKey().toString('base64url')
  }))
  const credentialKey = createCredentialPublicKey()
  writeFileSync(path.join(dir, 'db.json'), JSON.stringify({
    users: [{ id: 'user-a', name: 'Test User', created: '2026-08-25T00:00:00.000Z' }],
    creds: [{
      id: 'credential-a', userId: 'user-a', publicKey: credentialKey,
      counter: 0, transports: ['internal']
    }]
  }))
  const db = openAppDatabase(path.join(dir, 'mygym.sqlite'))
  migrateHealthSchema(db)
  db.close()
  return dir
}

function createCredentialPublicKey() {
  const ecdh = createECDH('prime256v1')
  const point = ecdh.generateKeys()
  const x = point.subarray(1, 33)
  const y = point.subarray(33, 65)
  return Buffer.concat([
    Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
    x,
    Buffer.from([0x22, 0x58, 0x20]),
    y
  ]).toString('base64url')
}

test('the shipped Compose stack builds this fork and only binds its web port to loopback', () => {
  const compose = read('docker-compose.yml')

  assert.match(compose, /^name: my-gym$/m)
  assert.doesNotMatch(compose, /registry\.gitlab\.com\/duartesantos8\/opengym/)
  assert.match(compose, /127\.0\.0\.1:\$\{WEB_PORT:-8080}:\$\{NGINX_PORT:-80}/)
})

test('the bundled reverse proxy accepts meal photos and applies baseline browser headers', () => {
  const nginx = read('web/nginx.conf.template')

  assert.match(nginx, /client_max_body_size\s+8m;/)
  assert.match(nginx, /X-Content-Type-Options\s+"nosniff"/)
  assert.match(nginx, /Referrer-Policy\s+"strict-origin-when-cross-origin"/)
  assert.match(nginx, /X-Frame-Options\s+"DENY"/)
  assert.match(nginx, /Content-Security-Policy\s+"[^"]*script-src 'self'/)
  assert.match(nginx, /Content-Security-Policy\s+"[^"]*object-src 'none'/)
  assert.match(nginx, /Content-Security-Policy\s+"[^"]*frame-ancestors 'none'/)
})

test('GitHub publishes fork-owned My Gym container names', () => {
  const workflow = read('.github/workflows/docker-publish.yml')

  assert.match(workflow, /ghcr\.io\/\$\{\{ steps\.repo\.outputs\.owner \}\}\/my-gym-\$\{\{ matrix\.image \}\}/)
  assert.doesNotMatch(workflow, /\/opengym-\$\{\{ matrix\.image \}\}/)
})

test('only the root runtime data directory is ignored, not Android source packages', () => {
  const ignore = read('.gitignore')

  assert.match(ignore, /^\/data\/$/m)
  assert.doesNotMatch(ignore, /^data\/$/m)
})

test('the Android companion rejects HTTP redirects before sending its bearer token', () => {
  const client = read('android-sync/app/src/main/java/ru/innu/mygym/sync/network/HealthSyncApi.kt')

  assert.match(client, /instanceFollowRedirects\s*=\s*false/)
})

test('production schedules global Health Connect retention pruning', () => {
  const server = read('api/server.js')

  assert.match(server, /healthRepository\.pruneExpired\(\)/)
  assert.match(server, /setInterval\([^]*healthRepository\.pruneExpired/)
})

test('rootful production backup runs as root and preserves the complete private data root', () => {
  const backup = read('ops/backup-data.sh')
  const production = read('docs/PRODUCTION.md')

  assert.match(backup, /\[ "\$\(id -u\)" -eq 0 \]/)
  assert.match(backup, /tar -C "\$data_dir" -cf "\$work_dir\/snapshot\.tar" \./)
  assert.match(production, /sudo env [^\n]*MY_GYM_BACKUP_DIR=\/var\/backups\/my-gym/)
  assert.match(production, /sudo crontab -e/)
})

test('restore verifies and stages a full data snapshot before guarded replacement', () => {
  const restore = read('ops/restore-data.sh')

  assert.match(restore, /validate_checksum\(\)/)
  assert.match(restore, /checksum_lines=.*awk/)
  assert.match(restore, /validate_archive\(\)/)
  assert.match(restore, /MY_GYM_EXPECTED_DATA_DIR/)
  assert.match(restore, /unsafe archive member/)
  assert.match(restore, /unsupported archive member type/)
  assert.match(restore, /staged_data/)
  assert.match(restore, /chown -R/)
  assert.match(restore, /rollback_restore\(\)/)
  assert.match(restore, /wait_for_api\(\)/)
  assert.match(restore, /for required_file in db\.json secret vapid\.json mygym\.sqlite/)
  assert.match(restore, /validate-restore-data\.mjs:\/restore-validator\.mjs:ro/)

  const validation = restore.indexOf('expected_users=$(validate_snapshot')
  const stopMatches = [...restore.matchAll(/\r?\ncompose stop api\r?\n/g)]
  const stop = stopMatches.at(-1)?.index ?? -1
  const dataAwareSmoke = restore.indexOf('wait_for_api "$expected_users"')
  const commit = restore.indexOf('restore_committed=1')
  assert.ok(validation >= 0 && validation < stop, 'snapshot validation must finish before downtime')
  assert.ok(dataAwareSmoke >= 0 && dataAwareSmoke < commit,
    'data-aware smoke must pass before the previous data can be discarded')
})

test('restore validator accepts a complete snapshot and reports its data identity', async t => {
  const { validateRestoreData } = await import('../ops/validate-restore-data.mjs')
  const dir = createRestoreSnapshot()
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  assert.deepEqual(validateRestoreData(dir), {
    users: 1,
    credentials: 1,
    sqliteSchemaVersion: 2
  })
})

test('restore validator rejects empty identity data and malformed private material', async t => {
  const { validateRestoreData } = await import('../ops/validate-restore-data.mjs')
  const dir = createRestoreSnapshot()
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  writeFileSync(path.join(dir, 'db.json'), JSON.stringify({ users: [], creds: [], subs: [], invites: [] }))
  assert.throws(() => validateRestoreData(dir), /db\.json must contain at least one user/)

  writeFileSync(path.join(dir, 'db.json'), '{not-json')
  assert.throws(() => validateRestoreData(dir), /db\.json is not valid JSON/)

  writeFileSync(path.join(dir, 'db.json'), JSON.stringify({
    users: [{ id: 'user-a', name: 'Test User' }],
    creds: [{
      id: 'credential-a', userId: 'user-a', publicKey: createCredentialPublicKey(),
      counter: 0, transports: []
    }],
    subs: [], invites: []
  }))

  writeFileSync(path.join(dir, 'db.json'), JSON.stringify({
    users: [{ id: 'user-a', name: 'Test User' }],
    creds: [{
      id: 'credential-a', userId: 'user-a', publicKey: Buffer.alloc(64, 7).toString('base64url'),
      counter: 0, transports: []
    }]
  }))
  assert.throws(() => validateRestoreData(dir), /valid WebAuthn COSE public key/)

  writeFileSync(path.join(dir, 'db.json'), JSON.stringify({
    users: [{ id: 'user-a', name: 'Test User' }],
    creds: [{
      id: 'credential-a', userId: 'user-a', publicKey: createCredentialPublicKey(),
      counter: 0, transports: []
    }]
  }))
  writeFileSync(path.join(dir, 'secret'), 'too-short')
  assert.throws(() => validateRestoreData(dir), /secret must be exactly 64 hexadecimal characters/)

  writeFileSync(path.join(dir, 'secret'), 'ab'.repeat(32))
  writeFileSync(path.join(dir, 'vapid.json'), JSON.stringify({ publicKey: 'not+a-url-key', privateKey: 'weak' }))
  assert.throws(() => validateRestoreData(dir), /vapid\.json publicKey must be canonical URL-safe base64/)
})

test('restore validator rejects corrupt or incomplete SQLite state', async t => {
  const { validateRestoreData } = await import('../ops/validate-restore-data.mjs')
  const dir = createRestoreSnapshot()
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  writeFileSync(path.join(dir, 'mygym.sqlite'), 'not a SQLite database')
  assert.throws(() => validateRestoreData(dir), /mygym\.sqlite validation failed/)

  const incompleteDir = createRestoreSnapshot()
  t.after(() => rmSync(incompleteDir, { recursive: true, force: true }))
  const db = new DatabaseSync(path.join(incompleteDir, 'mygym.sqlite'))
  db.exec(`
    ALTER TABLE nutrition_profiles RENAME TO nutrition_profiles_original;
    CREATE TABLE nutrition_profiles (
      user_id TEXT,
      profile_json TEXT,
      targets_json TEXT,
      updated_at TEXT
    );
    DROP TABLE nutrition_profiles_original;
  `)
  db.close()
  assert.throws(() => validateRestoreData(incompleteDir), /incompatible schema for nutrition_profiles/)
})

test('production documents the guarded restore command and both scripts have CI syntax checks', () => {
  const production = read('docs/PRODUCTION.md')
  const workflow = read('.github/workflows/test.yml')

  assert.match(production, /ops\/restore-data\.sh \\/)
  assert.match(production, /my-gym-data-YYYYMMDDTHHMMSSZ\.tar\.gz/)
  assert.match(production, /JSON\/schema, 256-bit session secret, matching URL-safe VAPID keys/)
  assert.match(production, /SQLite `integrity_check`, foreign keys and application schema/)
  assert.match(production, /expected non-zero user count/)
  assert.doesNotMatch(production, /(?:^|&&\s|\n)\.\/gradlew\s/m)
  assert.match(production, /sh \.\/gradlew --no-daemon testDebugUnitTest assembleDebug/)
  assert.match(workflow, /sh -n ops\/backup-data\.sh ops\/restore-data\.sh/)
})
