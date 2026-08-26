import crypto from 'node:crypto';

export const MAX_HEALTH_WORKOUTS_PER_DAY = 100;
export const MAX_HEALTH_SUMMARY_DEVICES = 10;
export const MAX_LISTED_HEALTH_DEVICES = 32;

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function safeEqualHex(left, right) {
  const leftBytes = Buffer.from(String(left), 'hex');
  const rightBytes = Buffer.from(String(right), 'hex');
  return leftBytes.length === rightBytes.length && crypto.timingSafeEqual(leftBytes, rightBytes);
}

function mapDevice(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    deviceName: row.device_name,
    platform: row.platform,
    appVersion: row.app_version,
    pairedAt: row.paired_at,
    lastSyncAt: row.last_sync_at,
    revokedAt: row.revoked_at
  };
}

export function migrateHealthSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS health_pairing_codes (
      code_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      consumed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS health_pairing_codes_expiry
      ON health_pairing_codes (expires_at);

    CREATE TABLE IF NOT EXISTS health_devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      platform TEXT NOT NULL,
      app_version TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      paired_at TEXT NOT NULL,
      last_sync_at TEXT,
      revoked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS health_devices_user
      ON health_devices (user_id, revoked_at);

    CREATE TABLE IF NOT EXISTS health_daily (
      user_id TEXT NOT NULL,
      local_date TEXT NOT NULL,
      source_device_id TEXT NOT NULL,
      steps INTEGER,
      active_calories_kcal REAL,
      sleep_minutes INTEGER,
      weight_kg REAL,
      body_fat_percent REAL,
      heart_rate_avg_bpm REAL,
      heart_rate_min_bpm REAL,
      heart_rate_max_bpm REAL,
      oxygen_saturation_avg_percent REAL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, local_date),
      FOREIGN KEY (source_device_id) REFERENCES health_devices(id)
    );

    CREATE TABLE IF NOT EXISTS health_workouts (
      user_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      external_id TEXT NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      duration_minutes REAL NOT NULL,
      timezone TEXT NOT NULL,
      exercise_type TEXT NOT NULL,
      title TEXT,
      active_calories_kcal REAL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, device_id, external_id),
      FOREIGN KEY (device_id) REFERENCES health_devices(id)
    );
    CREATE INDEX IF NOT EXISTS health_workouts_user_start
      ON health_workouts (user_id, start_at);

    CREATE TABLE IF NOT EXISTS health_workout_tombstones (
      user_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      external_id TEXT NOT NULL,
      deleted_at TEXT NOT NULL,
      PRIMARY KEY (user_id, device_id, external_id),
      FOREIGN KEY (device_id) REFERENCES health_devices(id)
    );

    CREATE TABLE IF NOT EXISTS health_sync_batches (
      device_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      digest TEXT NOT NULL,
      synced_at TEXT NOT NULL,
      PRIMARY KEY (device_id, batch_id),
      FOREIGN KEY (device_id) REFERENCES health_devices(id)
    );
    CREATE INDEX IF NOT EXISTS health_sync_batches_user_time
      ON health_sync_batches (user_id, synced_at);
  `);
}

function cutoffLocalDate(date, retentionDays) {
  const cutoff = new Date(date);
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  return cutoff.toISOString().slice(0, 10);
}

function nextLocalDate(localDate) {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function mapDaily(row, localDate) {
  return {
    date: localDate,
    steps: row?.steps ?? null,
    activeCaloriesKcal: row?.active_calories_kcal ?? null,
    sleepMinutes: row?.sleep_minutes ?? null,
    weightKg: row?.weight_kg ?? null,
    bodyFatPercent: row?.body_fat_percent ?? null,
    heartRateAvgBpm: row?.heart_rate_avg_bpm ?? null,
    heartRateMinBpm: row?.heart_rate_min_bpm ?? null,
    heartRateMaxBpm: row?.heart_rate_max_bpm ?? null,
    oxygenSaturationAvgPercent: row?.oxygen_saturation_avg_percent ?? null,
    updatedAt: row?.updated_at ?? null
  };
}

function mapWorkout(row) {
  return {
    externalId: row.external_id,
    start: row.start_at,
    end: row.end_at,
    durationMinutes: row.duration_minutes,
    timezone: row.timezone,
    exerciseType: row.exercise_type,
    title: row.title,
    activeCaloriesKcal: row.active_calories_kcal,
    updatedAt: row.updated_at
  };
}

export function createHealthRepository(db, { now = () => new Date(), retentionDays = 365 } = {}) {
  const insertPairingCode = db.prepare(`
    INSERT INTO health_pairing_codes
      (code_hash, user_id, expires_at, created_at, consumed_at)
    VALUES (?, ?, ?, ?, NULL)
  `);
  const findPairingCode = db.prepare(`
    SELECT user_id
    FROM health_pairing_codes
    WHERE code_hash = ? AND consumed_at IS NULL AND expires_at > ?
  `);
  const consumePairingCode = db.prepare(`
    UPDATE health_pairing_codes
    SET consumed_at = ?
    WHERE code_hash = ? AND consumed_at IS NULL AND expires_at > ?
  `);
  const insertDevice = db.prepare(`
    INSERT INTO health_devices
      (id, user_id, device_name, platform, app_version, token_hash, paired_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const findActiveDeviceByToken = db.prepare(`
    SELECT * FROM health_devices WHERE token_hash = ? AND revoked_at IS NULL
  `);
  const listDevices = db.prepare(`
    SELECT * FROM health_devices
    WHERE user_id = ?
    ORDER BY paired_at DESC, id
    LIMIT ?
  `);
  const listSummaryDevices = db.prepare(`
    SELECT * FROM health_devices
    WHERE user_id = ?
    ORDER BY paired_at DESC, id
    LIMIT ?
  `);
  const revokeDevice = db.prepare(`
    UPDATE health_devices SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL
  `);
  const revokeOwnedDevice = db.prepare(`
    UPDATE health_devices SET revoked_at = ?
    WHERE user_id = ? AND id = ? AND revoked_at IS NULL
  `);
  const findActiveDeviceById = db.prepare(`
    SELECT id FROM health_devices WHERE id = ? AND user_id = ? AND revoked_at IS NULL
  `);
  const findSyncBatch = db.prepare(`
    SELECT digest, synced_at FROM health_sync_batches WHERE device_id = ? AND batch_id = ?
  `);
  const insertSyncBatch = db.prepare(`
    INSERT INTO health_sync_batches (device_id, user_id, batch_id, digest, synced_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const updateDeviceSyncTime = db.prepare(`
    UPDATE health_devices SET last_sync_at = ? WHERE id = ? AND revoked_at IS NULL
  `);
  const upsertDaily = db.prepare(`
    INSERT INTO health_daily (
      user_id, local_date, source_device_id, steps, active_calories_kcal,
      sleep_minutes, weight_kg, body_fat_percent, heart_rate_avg_bpm,
      heart_rate_min_bpm, heart_rate_max_bpm, oxygen_saturation_avg_percent, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, local_date) DO UPDATE SET
      source_device_id = excluded.source_device_id,
      steps = excluded.steps,
      active_calories_kcal = excluded.active_calories_kcal,
      sleep_minutes = excluded.sleep_minutes,
      weight_kg = excluded.weight_kg,
      body_fat_percent = excluded.body_fat_percent,
      heart_rate_avg_bpm = excluded.heart_rate_avg_bpm,
      heart_rate_min_bpm = excluded.heart_rate_min_bpm,
      heart_rate_max_bpm = excluded.heart_rate_max_bpm,
      oxygen_saturation_avg_percent = excluded.oxygen_saturation_avg_percent,
      updated_at = excluded.updated_at
  `);
  const hasWorkoutTombstone = db.prepare(`
    SELECT 1 AS found FROM health_workout_tombstones
    WHERE user_id = ? AND device_id = ? AND external_id = ?
  `);
  const upsertWorkout = db.prepare(`
    INSERT INTO health_workouts (
      user_id, device_id, external_id, start_at, end_at, duration_minutes,
      timezone, exercise_type, title, active_calories_kcal, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, device_id, external_id) DO UPDATE SET
      start_at = excluded.start_at,
      end_at = excluded.end_at,
      duration_minutes = excluded.duration_minutes,
      timezone = excluded.timezone,
      exercise_type = excluded.exercise_type,
      title = excluded.title,
      active_calories_kcal = excluded.active_calories_kcal,
      updated_at = excluded.updated_at
  `);
  const upsertTombstone = db.prepare(`
    INSERT INTO health_workout_tombstones (user_id, device_id, external_id, deleted_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, device_id, external_id) DO UPDATE SET deleted_at = excluded.deleted_at
  `);
  const deleteWorkout = db.prepare(`
    DELETE FROM health_workouts WHERE user_id = ? AND device_id = ? AND external_id = ?
  `);
  const deleteOldDaily = db.prepare(`DELETE FROM health_daily WHERE user_id = ? AND local_date < ?`);
  const deleteOldWorkouts = db.prepare(`
    DELETE FROM health_workouts WHERE user_id = ? AND substr(start_at, 1, 10) < ?
  `);
  const deleteOldTombstones = db.prepare(`
    DELETE FROM health_workout_tombstones WHERE user_id = ? AND deleted_at < ?
  `);
  const deleteOldBatches = db.prepare(`
    DELETE FROM health_sync_batches WHERE user_id = ? AND synced_at < ?
  `);
  const deleteExpiredPairingCodes = db.prepare(`
    DELETE FROM health_pairing_codes WHERE expires_at <= ?
  `);
  const deleteAllOldDaily = db.prepare(`DELETE FROM health_daily WHERE local_date < ?`);
  const deleteAllOldWorkouts = db.prepare(`
    DELETE FROM health_workouts WHERE substr(start_at, 1, 10) < ?
  `);
  const deleteAllOldTombstones = db.prepare(`
    DELETE FROM health_workout_tombstones WHERE deleted_at < ?
  `);
  const deleteAllOldBatches = db.prepare(`DELETE FROM health_sync_batches WHERE synced_at < ?`);
  const getDaily = db.prepare(`SELECT * FROM health_daily WHERE user_id = ? AND local_date = ?`);
  const getWorkouts = db.prepare(`
    SELECT * FROM health_workouts
    WHERE user_id = ? AND start_at >= ? AND start_at < ?
    ORDER BY start_at, external_id
    LIMIT ?
  `);
  const countWorkoutsForDate = db.prepare(`
    SELECT COUNT(*) AS count
    FROM health_workouts
    WHERE user_id = ? AND start_at >= ? AND start_at < ?
  `);
  const getLastSync = db.prepare(`
    SELECT MAX(last_sync_at) AS last_sync_at FROM health_devices WHERE user_id = ?
  `);

  return {
    createPairingCode(userId, code, expiresAt) {
      insertPairingCode.run(sha256(code), userId, expiresAt, now().toISOString());
    },

    pairDevice(code, device) {
      const timestamp = now().toISOString();
      const codeHash = sha256(code);
      db.exec('BEGIN IMMEDIATE');
      try {
        const pairing = findPairingCode.get(codeHash, timestamp);
        if (!pairing) {
          db.exec('ROLLBACK');
          return null;
        }
        const consumed = consumePairingCode.run(timestamp, codeHash, timestamp);
        if (!consumed.changes) {
          db.exec('ROLLBACK');
          return null;
        }
        insertDevice.run(
          device.id, pairing.user_id, device.deviceName, device.platform,
          device.appVersion, sha256(device.token), timestamp
        );
        db.exec('COMMIT');
        return {
          id: device.id,
          userId: pairing.user_id,
          deviceName: device.deviceName,
          platform: device.platform,
          appVersion: device.appVersion,
          pairedAt: timestamp
        };
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
      }
    },

    authenticateDevice(token) {
      const tokenHash = sha256(token);
      const row = findActiveDeviceByToken.get(tokenHash);
      if (!row || !safeEqualHex(tokenHash, row.token_hash)) return null;
      return mapDevice(row);
    },

    listDevices(userId) {
      const rows = listDevices.all(userId, MAX_LISTED_HEALTH_DEVICES + 1);
      return {
        devices: rows.slice(0, MAX_LISTED_HEALTH_DEVICES).map(mapDevice),
        limit: MAX_LISTED_HEALTH_DEVICES,
        truncated: rows.length > MAX_LISTED_HEALTH_DEVICES
      };
    },

    revokeDevice(deviceId) {
      return revokeDevice.run(now().toISOString(), deviceId).changes > 0;
    },

    revokeOwnedDevice(userId, deviceId) {
      return revokeOwnedDevice.run(now().toISOString(), userId, deviceId).changes > 0;
    },

    pruneExpired() {
      const timestamp = now().toISOString();
      const cutoff = cutoffLocalDate(now(), retentionDays);
      const cutoffTimestamp = `${cutoff}T00:00:00.000Z`;
      db.exec('BEGIN IMMEDIATE');
      try {
        const deleted = [
          deleteExpiredPairingCodes.run(timestamp).changes,
          deleteAllOldDaily.run(cutoff).changes,
          deleteAllOldWorkouts.run(cutoff).changes,
          deleteAllOldTombstones.run(cutoffTimestamp).changes,
          deleteAllOldBatches.run(cutoffTimestamp).changes
        ].reduce((sum, count) => sum + count, 0);
        db.exec('COMMIT');
        return { deleted, cutoff };
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
      }
    },

    applySync(device, batch) {
      const timestamp = now().toISOString();
      const cutoff = cutoffLocalDate(now(), retentionDays);
      const cutoffTimestamp = `${cutoff}T00:00:00.000Z`;
      db.exec('BEGIN IMMEDIATE');
      try {
        if (!findActiveDeviceById.get(device.id, device.userId)) {
          db.exec('ROLLBACK');
          return { status: 'revoked', syncedAt: null };
        }
        deleteOldDaily.run(device.userId, cutoff);
        deleteOldWorkouts.run(device.userId, cutoff);
        deleteOldTombstones.run(device.userId, cutoffTimestamp);
        deleteOldBatches.run(device.userId, cutoffTimestamp);

        const previous = findSyncBatch.get(device.id, batch.batchId);
        if (previous) {
          db.exec('COMMIT');
          return {
            status: previous.digest === batch.digest ? 'duplicate' : 'conflict',
            syncedAt: previous.synced_at
          };
        }

        for (const externalId of batch.tombstones) {
          upsertTombstone.run(device.userId, device.id, externalId, timestamp);
          deleteWorkout.run(device.userId, device.id, externalId);
        }
        for (const daily of batch.daily) {
          if (daily.date < cutoff) continue;
          upsertDaily.run(
            device.userId, daily.date, device.id,
            daily.steps ?? null, daily.activeCaloriesKcal ?? null,
            daily.sleepMinutes ?? null, daily.weightKg ?? null,
            daily.bodyFatPercent ?? null, daily.heartRateAvgBpm ?? null,
            daily.heartRateMinBpm ?? null, daily.heartRateMaxBpm ?? null,
            daily.oxygenSaturationAvgPercent ?? null, timestamp
          );
        }
        const affectedWorkoutDates = new Set();
        for (const workout of batch.workouts) {
          if (workout.start.slice(0, 10) < cutoff) continue;
          if (hasWorkoutTombstone.get(device.userId, device.id, workout.externalId)) continue;
          affectedWorkoutDates.add(workout.start.slice(0, 10));
          upsertWorkout.run(
            device.userId, device.id, workout.externalId, workout.start, workout.end,
            workout.durationMinutes, workout.timezone, workout.exerciseType,
            workout.title ?? null, workout.activeCaloriesKcal ?? null, timestamp
          );
        }
        for (const localDate of affectedWorkoutDates) {
          const dayStart = `${localDate}T`;
          const dayEnd = `${nextLocalDate(localDate)}T`;
          if (countWorkoutsForDate.get(device.userId, dayStart, dayEnd).count
            > MAX_HEALTH_WORKOUTS_PER_DAY) {
            db.exec('ROLLBACK');
            return { status: 'day_limit', syncedAt: null };
          }
        }
        insertSyncBatch.run(device.id, device.userId, batch.batchId, batch.digest, timestamp);
        updateDeviceSyncTime.run(timestamp, device.id);
        db.exec('COMMIT');
        return { status: 'applied', syncedAt: timestamp };
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
      }
    },

    getSummary(userId, localDate) {
      const dayStart = `${localDate}T`;
      const dayEnd = `${nextLocalDate(localDate)}T`;
      const workoutRows = getWorkouts.all(
        userId, dayStart, dayEnd, MAX_HEALTH_WORKOUTS_PER_DAY + 1
      );
      const deviceRows = listSummaryDevices.all(userId, MAX_HEALTH_SUMMARY_DEVICES + 1);
      return {
        localDate,
        daily: mapDaily(getDaily.get(userId, localDate), localDate),
        workouts: workoutRows.slice(0, MAX_HEALTH_WORKOUTS_PER_DAY).map(mapWorkout),
        workoutLimit: MAX_HEALTH_WORKOUTS_PER_DAY,
        workoutsTruncated: workoutRows.length > MAX_HEALTH_WORKOUTS_PER_DAY,
        lastSyncAt: getLastSync.get(userId)?.last_sync_at ?? null,
        devices: deviceRows.slice(0, MAX_HEALTH_SUMMARY_DEVICES).map(mapDevice),
        deviceLimit: MAX_HEALTH_SUMMARY_DEVICES,
        devicesTruncated: deviceRows.length > MAX_HEALTH_SUMMARY_DEVICES
      };
    }
  };
}
