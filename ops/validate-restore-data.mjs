import { createECDH, createPublicKey, timingSafeEqual } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const REQUIRED_SQLITE_SCHEMA = {
  schema_migrations: {
    type: 'table', sql: 'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)'
  },
  nutrition_profiles: {
    type: 'table', sql: 'CREATE TABLE nutrition_profiles (user_id TEXT PRIMARY KEY, profile_json TEXT NOT NULL, targets_json TEXT NOT NULL, updated_at TEXT NOT NULL)'
  },
  nutrition_meals: {
    type: 'table', sql: 'CREATE TABLE nutrition_meals (id TEXT NOT NULL, user_id TEXT NOT NULL, local_date TEXT NOT NULL, eaten_at TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, id))'
  },
  nutrition_meals_user_date: {
    type: 'index', sql: 'CREATE INDEX nutrition_meals_user_date ON nutrition_meals (user_id, local_date, eaten_at)'
  },
  nutrition_daily_reviews: {
    type: 'table', sql: 'CREATE TABLE nutrition_daily_reviews (user_id TEXT NOT NULL, local_date TEXT NOT NULL, source_hash TEXT NOT NULL, review_json TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (user_id, local_date))'
  },
  nutrition_ai_usage: {
    type: 'table', sql: 'CREATE TABLE nutrition_ai_usage (user_id TEXT NOT NULL, usage_date TEXT NOT NULL, operation TEXT NOT NULL, used_count INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, usage_date, operation))'
  },
  health_pairing_codes: {
    type: 'table', sql: 'CREATE TABLE health_pairing_codes (code_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL, consumed_at TEXT)'
  },
  health_pairing_codes_expiry: {
    type: 'index', sql: 'CREATE INDEX health_pairing_codes_expiry ON health_pairing_codes (expires_at)'
  },
  health_devices: {
    type: 'table', sql: 'CREATE TABLE health_devices (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, device_name TEXT NOT NULL, platform TEXT NOT NULL, app_version TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, paired_at TEXT NOT NULL, last_sync_at TEXT, revoked_at TEXT)'
  },
  health_devices_user: {
    type: 'index', sql: 'CREATE INDEX health_devices_user ON health_devices (user_id, revoked_at)'
  },
  health_daily: {
    type: 'table', sql: 'CREATE TABLE health_daily (user_id TEXT NOT NULL, local_date TEXT NOT NULL, source_device_id TEXT NOT NULL, steps INTEGER, active_calories_kcal REAL, sleep_minutes INTEGER, weight_kg REAL, body_fat_percent REAL, heart_rate_avg_bpm REAL, heart_rate_min_bpm REAL, heart_rate_max_bpm REAL, oxygen_saturation_avg_percent REAL, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, local_date), FOREIGN KEY (source_device_id) REFERENCES health_devices(id))'
  },
  health_workouts: {
    type: 'table', sql: 'CREATE TABLE health_workouts (user_id TEXT NOT NULL, device_id TEXT NOT NULL, external_id TEXT NOT NULL, start_at TEXT NOT NULL, end_at TEXT NOT NULL, duration_minutes REAL NOT NULL, timezone TEXT NOT NULL, exercise_type TEXT NOT NULL, title TEXT, active_calories_kcal REAL, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, device_id, external_id), FOREIGN KEY (device_id) REFERENCES health_devices(id))'
  },
  health_workouts_user_start: {
    type: 'index', sql: 'CREATE INDEX health_workouts_user_start ON health_workouts (user_id, start_at)'
  },
  health_workout_tombstones: {
    type: 'table', sql: 'CREATE TABLE health_workout_tombstones (user_id TEXT NOT NULL, device_id TEXT NOT NULL, external_id TEXT NOT NULL, deleted_at TEXT NOT NULL, PRIMARY KEY (user_id, device_id, external_id), FOREIGN KEY (device_id) REFERENCES health_devices(id))'
  },
  health_sync_batches: {
    type: 'table', sql: 'CREATE TABLE health_sync_batches (device_id TEXT NOT NULL, user_id TEXT NOT NULL, batch_id TEXT NOT NULL, digest TEXT NOT NULL, synced_at TEXT NOT NULL, PRIMARY KEY (device_id, batch_id), FOREIGN KEY (device_id) REFERENCES health_devices(id))'
  },
  health_sync_batches_user_time: {
    type: 'index', sql: 'CREATE INDEX health_sync_batches_user_time ON health_sync_batches (user_id, synced_at)'
  }
}

function requiredFile(root, name) {
  const file = path.join(root, name)
  let stat
  try { stat = lstatSync(file) } catch {
    throw new Error(`${name} is missing`)
  }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${name} must be a regular file`)
  if (stat.size < 1) throw new Error(`${name} must not be empty`)
  return file
}

function readJson(root, name) {
  const file = requiredFile(root, name)
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch {
    throw new Error(`${name} is not valid JSON`)
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requireRecord(value, label) {
  if (!isRecord(value)) throw new Error(`${label} must be an object`)
}

function requireArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
}

function requireString(value, label, { max = 4096 } = {}) {
  if (typeof value !== 'string' || value.length < 1 || value.length > max) {
    throw new Error(`${label} must be a non-empty string no longer than ${max} characters`)
  }
}

function decodeBase64Url(value, label) {
  requireString(value, label)
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`${label} must be canonical URL-safe base64`)
  }
  const bytes = Buffer.from(value, 'base64url')
  if (!bytes.length || bytes.toString('base64url') !== value) {
    throw new Error(`${label} must be canonical URL-safe base64`)
  }
  return bytes
}

function decodeCbor(buffer) {
  let offset = 0

  function take(length) {
    if (!Number.isSafeInteger(length) || length < 0 || offset + length > buffer.length) {
      throw new Error('truncated CBOR')
    }
    const value = buffer.subarray(offset, offset + length)
    offset += length
    return value
  }

  function lengthValue(additional) {
    if (additional < 24) return additional
    if (additional === 24) return take(1)[0]
    if (additional === 25) return take(2).readUInt16BE()
    if (additional === 26) return take(4).readUInt32BE()
    if (additional === 27) {
      const value = take(8).readBigUInt64BE()
      if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('oversized CBOR integer')
      return Number(value)
    }
    throw new Error('indefinite or reserved CBOR length')
  }

  function item(depth = 0) {
    if (depth > 16) throw new Error('CBOR nesting is too deep')
    const initial = take(1)[0]
    const major = initial >> 5
    const length = lengthValue(initial & 31)
    if (major === 0) return length
    if (major === 1) return -1 - length
    if (major === 2) return Buffer.from(take(length))
    if (major === 3) return take(length).toString('utf8')
    if (major === 4) return Array.from({ length }, () => item(depth + 1))
    if (major === 5) {
      const map = new Map()
      for (let index = 0; index < length; index += 1) {
        const key = item(depth + 1)
        if (map.has(key)) throw new Error('duplicate CBOR map key')
        map.set(key, item(depth + 1))
      }
      return map
    }
    throw new Error('unsupported CBOR value')
  }

  const result = item()
  if (offset !== buffer.length) throw new Error('trailing CBOR data')
  return result
}

function requireKeyBytes(value, length, label) {
  if (!Buffer.isBuffer(value) || (length ? value.length !== length : value.length < 1)) {
    throw new Error(`${label} has an invalid length`)
  }
  return value.toString('base64url')
}

function validateCredentialPublicKey(value, label) {
  const encoded = decodeBase64Url(value, label)
  try {
    const key = decodeCbor(encoded)
    if (!(key instanceof Map)) throw new Error('COSE key is not a map')
    const kty = key.get(1)
    const alg = key.get(3)
    let jwk
    if (kty === 2) {
      const curves = new Map([
        [1, { alg: -7, name: 'P-256', bytes: 32 }],
        [2, { alg: -35, name: 'P-384', bytes: 48 }],
        [3, { alg: -36, name: 'P-521', bytes: 66 }],
        [8, { alg: -47, name: 'secp256k1', bytes: 32 }]
      ])
      const curve = curves.get(key.get(-1))
      if (!curve || alg !== curve.alg) throw new Error('unsupported EC2 curve or algorithm')
      jwk = {
        kty: 'EC', crv: curve.name,
        x: requireKeyBytes(key.get(-2), curve.bytes, 'COSE x'),
        y: requireKeyBytes(key.get(-3), curve.bytes, 'COSE y')
      }
    } else if (kty === 1) {
      if (key.get(-1) !== 6 || alg !== -8) throw new Error('unsupported OKP curve or algorithm')
      jwk = { kty: 'OKP', crv: 'Ed25519', x: requireKeyBytes(key.get(-2), 32, 'COSE x') }
    } else if (kty === 3) {
      if (!new Set([-37, -38, -39, -257, -258, -259, -65535]).has(alg)) {
        throw new Error('unsupported RSA algorithm')
      }
      const modulus = key.get(-1)
      const exponent = key.get(-2)
      if (!Buffer.isBuffer(modulus) || modulus.length < 256) throw new Error('RSA modulus is too short')
      if (!Buffer.isBuffer(exponent) || exponent.length < 1 || exponent.length > 8) {
        throw new Error('RSA exponent is invalid')
      }
      jwk = { kty: 'RSA', n: modulus.toString('base64url'), e: exponent.toString('base64url') }
    } else {
      throw new Error('unsupported COSE key type')
    }
    createPublicKey({ key: jwk, format: 'jwk' })
  } catch {
    throw new Error(`${label} must contain a valid WebAuthn COSE public key`)
  }
}

function validateLegacyDatabase(root) {
  const db = readJson(root, 'db.json')
  requireRecord(db, 'db.json')
  for (const field of ['users', 'creds']) {
    requireArray(db[field], `db.json.${field}`)
  }
  const subscriptions = db.subs === undefined ? [] : db.subs
  const invites = db.invites === undefined ? [] : db.invites
  requireArray(subscriptions, 'db.json.subs')
  requireArray(invites, 'db.json.invites')
  if (db.users.length < 1) throw new Error('db.json must contain at least one user')

  const userIds = new Set()
  for (const [index, user] of db.users.entries()) {
    const label = `db.json.users[${index}]`
    requireRecord(user, label)
    requireString(user.id, `${label}.id`, { max: 128 })
    if (!/^[A-Za-z0-9_-]+$/.test(user.id)) throw new Error(`${label}.id must be URL-safe`)
    requireString(user.name, `${label}.name`, { max: 80 })
    if (userIds.has(user.id)) throw new Error(`${label}.id must be unique`)
    if (user.sv !== undefined && (!Number.isInteger(user.sv) || user.sv < 0)) {
      throw new Error(`${label}.sv must be a non-negative integer`)
    }
    userIds.add(user.id)
  }

  if (db.creds.length < 1) throw new Error('db.json must contain at least one credential')
  const credentialIds = new Set()
  const credentialUsers = new Set()
  for (const [index, credential] of db.creds.entries()) {
    const label = `db.json.creds[${index}]`
    requireRecord(credential, label)
    decodeBase64Url(credential.id, `${label}.id`)
    requireString(credential.userId, `${label}.userId`, { max: 128 })
    if (!userIds.has(credential.userId)) throw new Error(`${label}.userId references no user`)
    if (credentialIds.has(credential.id)) throw new Error(`${label}.id must be unique`)
    if (!Number.isInteger(credential.counter) || credential.counter < 0) {
      throw new Error(`${label}.counter must be a non-negative integer`)
    }
    validateCredentialPublicKey(credential.publicKey, `${label}.publicKey`)
    requireArray(credential.transports, `${label}.transports`)
    if (!credential.transports.every(value => typeof value === 'string')) {
      throw new Error(`${label}.transports must contain only strings`)
    }
    credentialIds.add(credential.id)
    credentialUsers.add(credential.userId)
  }
  for (const userId of userIds) {
    if (!credentialUsers.has(userId)) throw new Error(`db.json user ${userId} has no credential`)
  }

  for (const [index, subscription] of subscriptions.entries()) {
    const label = `db.json.subs[${index}]`
    requireRecord(subscription, label)
    requireString(subscription.userId, `${label}.userId`, { max: 128 })
    if (!userIds.has(subscription.userId)) throw new Error(`${label}.userId references no user`)
    requireString(subscription.endpoint, `${label}.endpoint`)
    requireRecord(subscription.keys, `${label}.keys`)
    requireString(subscription.keys.p256dh, `${label}.keys.p256dh`)
    requireString(subscription.keys.auth, `${label}.keys.auth`)
  }

  const inviteCodes = new Set()
  for (const [index, invite] of invites.entries()) {
    const label = `db.json.invites[${index}]`
    requireRecord(invite, label)
    requireString(invite.code, `${label}.code`, { max: 128 })
    if (inviteCodes.has(invite.code)) throw new Error(`${label}.code must be unique`)
    if (invite.usedBy !== undefined && invite.usedBy !== null && !userIds.has(invite.usedBy)) {
      throw new Error(`${label}.usedBy references no user`)
    }
    inviteCodes.add(invite.code)
  }

  return { users: db.users.length, credentials: db.creds.length }
}

function validateSecret(root) {
  const secret = readFileSync(requiredFile(root, 'secret'), 'utf8')
  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error('secret must be exactly 64 hexadecimal characters (256 bits)')
  }
}

function validateVapid(root) {
  const vapid = readJson(root, 'vapid.json')
  requireRecord(vapid, 'vapid.json')
  const publicKey = decodeBase64Url(vapid.publicKey, 'vapid.json publicKey')
  const privateKey = decodeBase64Url(vapid.privateKey, 'vapid.json privateKey')
  if (publicKey.length !== 65 || publicKey[0] !== 4) {
    throw new Error('vapid.json publicKey must be an uncompressed P-256 public key')
  }
  if (privateKey.length !== 32) {
    throw new Error('vapid.json privateKey must be a 256-bit P-256 private key')
  }
  let derivedPublicKey
  try {
    const ecdh = createECDH('prime256v1')
    ecdh.setPrivateKey(privateKey)
    derivedPublicKey = ecdh.getPublicKey()
  } catch {
    throw new Error('vapid.json privateKey is not a valid P-256 private key')
  }
  if (derivedPublicKey.length !== publicKey.length || !timingSafeEqual(derivedPublicKey, publicKey)) {
    throw new Error('vapid.json publicKey and privateKey do not match')
  }
}

function validateSqlite(root) {
  const file = requiredFile(root, 'mygym.sqlite')
  let db
  try {
    db = new DatabaseSync(file, { readOnly: true })
    const integrity = db.prepare('PRAGMA integrity_check').all()
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') {
      throw new Error('PRAGMA integrity_check did not return ok')
    }
    const foreignKeyErrors = db.prepare('PRAGMA foreign_key_check').all()
    if (foreignKeyErrors.length) throw new Error('PRAGMA foreign_key_check found violations')

    const normalizeSql = sql => String(sql || '')
      .replace(/\s+/g, ' ')
      .replace(/\s*([(),])\s*/g, '$1')
      .trim()
      .toLowerCase()
    const readSchema = db.prepare(
      'SELECT type, sql FROM sqlite_schema WHERE name = ? AND name NOT LIKE \'sqlite_%\''
    )
    for (const [name, expected] of Object.entries(REQUIRED_SQLITE_SCHEMA)) {
      const actual = readSchema.get(name)
      if (!actual) throw new Error(`required schema object ${name} is missing`)
      if (actual.type !== expected.type || normalizeSql(actual.sql) !== normalizeSql(expected.sql)) {
        throw new Error(`incompatible schema for ${name}`)
      }
    }

    const versions = db.prepare('SELECT version FROM schema_migrations ORDER BY version')
      .all().map(row => Number(row.version))
    if (versions.length !== 2 || versions[0] !== 1 || versions[1] !== 2) {
      throw new Error(`unsupported schema migrations: ${versions.join(',') || 'none'}`)
    }
    return 2
  } catch (error) {
    throw new Error(`mygym.sqlite validation failed: ${error.message}`)
  } finally {
    try { db?.close() } catch {}
  }
}

export function validateRestoreData(root) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) {
    throw new Error('restore data root must be an absolute path')
  }
  const identity = validateLegacyDatabase(root)
  validateSecret(root)
  validateVapid(root)
  const sqliteSchemaVersion = validateSqlite(root)
  return { ...identity, sqliteSchemaVersion }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : ''
if (invokedPath === import.meta.url) {
  try {
    const result = validateRestoreData(process.argv[2])
    process.stdout.write(
      `MY_GYM_RESTORE_VALIDATION users=${result.users} credentials=${result.credentials}\n`
    )
  } catch (error) {
    process.stderr.write(`restore data validation failed: ${error.message}\n`)
    process.exitCode = 1
  }
}
