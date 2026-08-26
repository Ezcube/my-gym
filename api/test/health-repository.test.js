import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

async function loadHealthRepository() {
  try {
    return await import('../src/health/repository.js');
  } catch {
    return {};
  }
}

function openTestDatabase(t, migrateHealthSchema) {
  const db = new DatabaseSync(':memory:');
  migrateHealthSchema(db);
  t.after(() => db.close());
  return db;
}

test('health schema stores only pairing and device secret hashes and consumes a code once', async t => {
  const module = await loadHealthRepository();
  assert.equal(typeof module.migrateHealthSchema, 'function');
  assert.equal(typeof module.createHealthRepository, 'function');

  const db = openTestDatabase(t, module.migrateHealthSchema);
  const repository = module.createHealthRepository(db, {
    now: () => new Date('2026-08-25T12:00:00.000Z')
  });
  repository.createPairingCode('user-a', 'AB12CD34', '2026-08-25T12:10:00.000Z');
  const paired = repository.pairDevice('AB12CD34', {
    id: 'device-a', token: 'raw-device-token', deviceName: 'Galaxy Watch',
    platform: 'android', appVersion: '1.0.0'
  });

  assert.deepEqual(paired, {
    id: 'device-a', userId: 'user-a', deviceName: 'Galaxy Watch',
    platform: 'android', appVersion: '1.0.0', pairedAt: '2026-08-25T12:00:00.000Z'
  });
  assert.equal(repository.pairDevice('AB12CD34', {
    id: 'device-b', token: 'other-token', deviceName: 'Other',
    platform: 'android', appVersion: '1.0.0'
  }), null);

  const codeRow = db.prepare('SELECT * FROM health_pairing_codes').get();
  const deviceRow = db.prepare('SELECT * FROM health_devices').get();
  assert.equal(codeRow.code_hash.length, 64);
  assert.equal(deviceRow.token_hash.length, 64);
  assert.equal(JSON.stringify(codeRow).includes('AB12CD34'), false);
  assert.equal(JSON.stringify(deviceRow).includes('raw-device-token'), false);
});

test('an expired pairing code cannot create a device', async t => {
  const module = await loadHealthRepository();
  const db = openTestDatabase(t, module.migrateHealthSchema);
  const repository = module.createHealthRepository(db, {
    now: () => new Date('2026-08-25T12:00:00.000Z')
  });
  repository.createPairingCode('user-a', 'EXPIRED1', '2026-08-25T11:59:59.000Z');

  assert.equal(repository.pairDevice('EXPIRED1', {
    id: 'device-a', token: 'token-a', deviceName: 'Galaxy',
    platform: 'android', appVersion: '1.0.0'
  }), null);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM health_devices').get().count, 0);
});

test('device tokens authenticate only active devices and device lists are user isolated', async t => {
  const module = await loadHealthRepository();
  const db = openTestDatabase(t, module.migrateHealthSchema);
  const repository = module.createHealthRepository(db, {
    now: () => new Date('2026-08-25T12:00:00.000Z')
  });
  for (const [userId, code, id, token] of [
    ['user-a', 'AAAA1111', 'device-a', 'token-a'],
    ['user-b', 'BBBB2222', 'device-b', 'token-b']
  ]) {
    repository.createPairingCode(userId, code, '2026-08-25T12:10:00.000Z');
    repository.pairDevice(code, {
      id, token, deviceName: `Galaxy ${id}`, platform: 'android', appVersion: '1.0.0'
    });
  }

  assert.equal(repository.authenticateDevice('wrong-token'), null);
  assert.equal(repository.authenticateDevice('token-a').id, 'device-a');
  assert.deepEqual(repository.listDevices('user-a'), {
    devices: [repository.authenticateDevice('token-a')],
    limit: module.MAX_LISTED_HEALTH_DEVICES,
    truncated: false
  });
  assert.deepEqual(repository.listDevices('user-b'), {
    devices: [repository.authenticateDevice('token-b')],
    limit: module.MAX_LISTED_HEALTH_DEVICES,
    truncated: false
  });
  assert.equal(repository.revokeDevice('device-a'), true);
  assert.equal(repository.authenticateDevice('token-a'), null);
  assert.equal(repository.revokeDevice('device-a'), false);
});

test('device listing fetches only its cap plus one while preserving order and user isolation', async t => {
  const module = await loadHealthRepository();
  const db = openTestDatabase(t, module.migrateHealthSchema);
  const repository = module.createHealthRepository(db, {
    now: () => new Date('2026-08-25T12:00:00.000Z')
  });
  assert.equal(Number.isInteger(module.MAX_LISTED_HEALTH_DEVICES), true);

  for (let index = 0; index <= module.MAX_LISTED_HEALTH_DEVICES; index += 1) {
    pair(
      repository,
      'user-a',
      `user-a-code-${index}`,
      `device-${String(index).padStart(3, '0')}`,
      `user-a-token-${index}`
    );
  }
  pair(repository, 'user-b', 'user-b-code', 'foreign-device', 'user-b-token');

  const result = repository.listDevices('user-a');
  assert.equal(result.devices.length, module.MAX_LISTED_HEALTH_DEVICES);
  assert.equal(result.limit, module.MAX_LISTED_HEALTH_DEVICES);
  assert.equal(result.truncated, true);
  assert.deepEqual(
    result.devices.map(device => device.id),
    Array.from(
      { length: module.MAX_LISTED_HEALTH_DEVICES },
      (_, index) => `device-${String(index).padStart(3, '0')}`
    )
  );
  assert.equal(result.devices.some(device => device.id === 'foreign-device'), false);
});

test('an owner can revoke only a device paired to that user', async t => {
  const module = await loadHealthRepository();
  const db = openTestDatabase(t, module.migrateHealthSchema);
  const repository = module.createHealthRepository(db, {
    now: () => new Date('2026-08-25T12:00:00.000Z')
  });
  pair(repository, 'user-a', 'AAAA1111', 'device-a', 'token-a');
  pair(repository, 'user-b', 'BBBB2222', 'device-b', 'token-b');

  assert.equal(repository.revokeOwnedDevice('user-a', 'device-b'), false);
  assert.equal(repository.authenticateDevice('token-b').id, 'device-b');
  assert.equal(repository.revokeOwnedDevice('user-a', 'device-a'), true);
  assert.equal(repository.authenticateDevice('token-a'), null);
});

function pair(repository, userId, code, id, token) {
  repository.createPairingCode(userId, code, '2026-08-25T12:10:00.000Z');
  repository.pairDevice(code, {
    id, token, deviceName: `Galaxy ${id}`, platform: 'android', appVersion: '1.0.0'
  });
  return repository.authenticateDevice(token);
}

test('sync is idempotent per device and rejects a changed digest for the same batch', async t => {
  const module = await loadHealthRepository();
  const db = openTestDatabase(t, module.migrateHealthSchema);
  const repository = module.createHealthRepository(db, {
    now: () => new Date('2026-08-25T12:00:00.000Z')
  });
  const device = pair(repository, 'user-a', 'AAAA1111', 'device-a', 'token-a');
  const batch = {
    batchId: 'batch-1', digest: 'a'.repeat(64), timezone: 'Europe/Moscow',
    daily: [{
      date: '2026-08-25', steps: 9876, activeCaloriesKcal: 640,
      sleepMinutes: 451, weightKg: 79.4, bodyFatPercent: 18.2,
      heartRateAvgBpm: 66, heartRateMinBpm: 48, heartRateMaxBpm: 151,
      oxygenSaturationAvgPercent: 97.4
    }],
    workouts: [{
      externalId: 'workout-1', start: '2026-08-25T06:00:00.000Z',
      end: '2026-08-25T06:45:00.000Z', durationMinutes: 45,
      timezone: 'Europe/Moscow', exerciseType: 'strength_training',
      title: 'Силовая', activeCaloriesKcal: 310
    }],
    tombstones: []
  };

  assert.deepEqual(repository.applySync(device, batch), {
    status: 'applied', syncedAt: '2026-08-25T12:00:00.000Z'
  });
  assert.deepEqual(repository.applySync(device, batch), {
    status: 'duplicate', syncedAt: '2026-08-25T12:00:00.000Z'
  });
  assert.deepEqual(repository.applySync(device, { ...batch, digest: 'b'.repeat(64) }), {
    status: 'conflict', syncedAt: '2026-08-25T12:00:00.000Z'
  });
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM health_daily').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM health_workouts').get().count, 1);
});

test('daily summaries use last-write values and isolate users, workouts, and tombstones', async t => {
  const module = await loadHealthRepository();
  const db = openTestDatabase(t, module.migrateHealthSchema);
  const repository = module.createHealthRepository(db, {
    now: () => new Date('2026-08-25T12:00:00.000Z')
  });
  const deviceA = pair(repository, 'user-a', 'AAAA1111', 'device-a', 'token-a');
  const deviceB = pair(repository, 'user-b', 'BBBB2222', 'device-b', 'token-b');
  const workout = {
    externalId: 'shared-id', start: '2026-08-25T06:00:00.000Z',
    end: '2026-08-25T06:30:00.000Z', durationMinutes: 30,
    timezone: 'Europe/Moscow', exerciseType: 'running', title: null,
    activeCaloriesKcal: 250
  };
  repository.applySync(deviceA, {
    batchId: 'batch-a1', digest: 'a'.repeat(64), timezone: 'Europe/Moscow',
    daily: [{ date: '2026-08-25', steps: 8000, activeCaloriesKcal: 500 }],
    workouts: [workout], tombstones: []
  });
  repository.applySync(deviceB, {
    batchId: 'batch-b1', digest: 'b'.repeat(64), timezone: 'Europe/Moscow',
    daily: [{ date: '2026-08-25', steps: 12000, activeCaloriesKcal: 700 }],
    workouts: [workout], tombstones: []
  });
  repository.applySync(deviceA, {
    batchId: 'batch-a2', digest: 'c'.repeat(64), timezone: 'Europe/Moscow',
    daily: [{ date: '2026-08-25', steps: 9000 }], workouts: [], tombstones: ['shared-id']
  });

  const summaryA = repository.getSummary('user-a', '2026-08-25');
  const summaryB = repository.getSummary('user-b', '2026-08-25');
  assert.equal(summaryA.daily.steps, 9000);
  assert.equal(summaryA.daily.activeCaloriesKcal, null);
  assert.deepEqual(summaryA.workouts, []);
  assert.equal(summaryB.daily.steps, 12000);
  assert.equal(summaryB.workouts.length, 1);
  assert.equal(summaryB.workouts[0].externalId, 'shared-id');
  assert.deepEqual(summaryA.devices.map(device => device.id), ['device-a']);
  assert.deepEqual(summaryB.devices.map(device => device.id), ['device-b']);
});

test('sync prunes and refuses health records older than the configured retention window', async t => {
  const module = await loadHealthRepository();
  const db = openTestDatabase(t, module.migrateHealthSchema);
  const repository = module.createHealthRepository(db, {
    now: () => new Date('2026-08-25T12:00:00.000Z')
  });
  const device = pair(repository, 'user-a', 'AAAA1111', 'device-a', 'token-a');
  repository.applySync(device, {
    batchId: 'batch-old', digest: 'd'.repeat(64), timezone: 'Europe/Moscow',
    daily: [
      { date: '2025-08-24', steps: 100 },
      { date: '2025-08-25', steps: 200 }
    ],
    workouts: [{
      externalId: 'too-old', start: '2025-08-24T06:00:00.000Z',
      end: '2025-08-24T06:30:00.000Z', durationMinutes: 30,
      timezone: 'Europe/Moscow', exerciseType: 'walking', title: null,
      activeCaloriesKcal: 100
    }],
    tombstones: []
  });

  assert.equal(repository.getSummary('user-a', '2025-08-24').daily.steps, null);
  assert.equal(repository.getSummary('user-a', '2025-08-25').daily.steps, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM health_workouts').get().count, 0);
});

test('global retention pruning removes stale data without another device sync', async t => {
  const module = await loadHealthRepository();
  const db = openTestDatabase(t, module.migrateHealthSchema);
  let clock = new Date('2026-08-25T12:00:00.000Z');
  const repository = module.createHealthRepository(db, { now: () => clock });
  const device = pair(repository, 'user-a', 'AAAA1111', 'device-a', 'token-a');
  repository.applySync(device, {
    batchId: 'batch-boundary', digest: 'e'.repeat(64), timezone: 'Europe/Moscow',
    daily: [{ date: '2025-08-25', steps: 123 }],
    workouts: [{
      externalId: 'boundary-workout', start: '2025-08-25T06:00:00.000Z',
      end: '2025-08-25T06:30:00.000Z', durationMinutes: 30,
      timezone: 'Europe/Moscow', exerciseType: 'walking', title: null,
      activeCaloriesKcal: 100
    }],
    tombstones: []
  });
  repository.createPairingCode('user-a', 'EXPIRED1', '2026-08-25T12:01:00.000Z');
  db.prepare('UPDATE health_sync_batches SET synced_at = ?').run('2025-08-25T12:00:00.000Z');
  clock = new Date('2026-08-26T12:00:00.000Z');

  const result = repository.pruneExpired();

  assert.ok(result.deleted >= 4);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM health_daily').get().count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM health_workouts').get().count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM health_sync_batches').get().count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM health_pairing_codes').get().count, 0);
});

test('sync rejects a per-user daily workout overflow atomically', async t => {
  const module = await loadHealthRepository();
  const db = openTestDatabase(t, module.migrateHealthSchema);
  const repository = module.createHealthRepository(db, {
    now: () => new Date('2026-08-25T12:00:00.000Z')
  });
  const device = pair(repository, 'user-a', 'AAAA1111', 'device-a', 'token-a');
  const workouts = Array.from({ length: module.MAX_HEALTH_WORKOUTS_PER_DAY + 1 }, (_, index) => ({
    externalId: `workout-${index}`, start: '2026-08-25T06:00:00.000Z',
    end: '2026-08-25T06:30:00.000Z', durationMinutes: 30,
    timezone: 'Europe/Moscow', exerciseType: 'walking', title: null,
    activeCaloriesKcal: 100
  }));

  assert.deepEqual(repository.applySync(device, {
    batchId: 'overflow', digest: 'f'.repeat(64), timezone: 'Europe/Moscow',
    daily: [], workouts, tombstones: []
  }), { status: 'day_limit', syncedAt: null });
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM health_workouts').get().count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM health_sync_batches').get().count, 0);
});

test('health summary bounds legacy workout rows with an indexed date-range query', async t => {
  const module = await loadHealthRepository();
  const db = openTestDatabase(t, module.migrateHealthSchema);
  const repository = module.createHealthRepository(db, {
    now: () => new Date('2026-08-25T12:00:00.000Z')
  });
  pair(repository, 'user-a', 'AAAA1111', 'device-a', 'token-a');
  const insert = db.prepare(`
    INSERT INTO health_workouts (
      user_id, device_id, external_id, start_at, end_at, duration_minutes,
      timezone, exercise_type, title, active_calories_kcal, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (let index = 0; index <= module.MAX_HEALTH_WORKOUTS_PER_DAY; index += 1) {
    insert.run(
      'user-a', 'device-a', `legacy-${index}`, `2026-08-25T06:${String(index % 60).padStart(2, '0')}:00.000Z`,
      `2026-08-25T07:${String(index % 60).padStart(2, '0')}:00.000Z`, 30,
      'Europe/Moscow', 'walking', null, 100, '2026-08-25T12:00:00.000Z'
    );
  }

  const summary = repository.getSummary('user-a', '2026-08-25');
  assert.equal(summary.workouts.length, module.MAX_HEALTH_WORKOUTS_PER_DAY);
  assert.equal(summary.workoutLimit, module.MAX_HEALTH_WORKOUTS_PER_DAY);
  assert.equal(summary.workoutsTruncated, true);
});

test('daily workout bounds include accepted offset timestamps at local midnight', async t => {
  const module = await loadHealthRepository();
  const db = openTestDatabase(t, module.migrateHealthSchema);
  const repository = module.createHealthRepository(db, {
    now: () => new Date('2026-08-25T12:00:00.000Z')
  });
  const device = pair(repository, 'user-a', 'AAAA1111', 'device-a', 'token-a');
  const workouts = Array.from({ length: module.MAX_HEALTH_WORKOUTS_PER_DAY + 1 }, (_, index) => ({
    externalId: `offset-${index}`, start: '2026-08-25T00:00:00+03:00',
    end: '2026-08-25T00:30:00+03:00', durationMinutes: 30,
    timezone: 'Europe/Moscow', exerciseType: 'walking', title: null,
    activeCaloriesKcal: 100
  }));

  assert.equal(repository.applySync(device, {
    batchId: 'offset-overflow', digest: '9'.repeat(64), timezone: 'Europe/Moscow',
    daily: [], workouts, tombstones: []
  }).status, 'day_limit');
  assert.equal(repository.getSummary('user-a', '2026-08-25').workouts.length, 0);
});

test('health summary bounds paired-device materialization independently of the device list', async t => {
  const module = await loadHealthRepository();
  const db = openTestDatabase(t, module.migrateHealthSchema);
  const repository = module.createHealthRepository(db, {
    now: () => new Date('2026-08-25T12:00:00.000Z')
  });
  for (let index = 0; index <= module.MAX_HEALTH_SUMMARY_DEVICES; index += 1) {
    pair(
      repository, 'user-a', `code-${index}`, `device-${index}`, `token-${index}`
    );
  }

  const summary = repository.getSummary('user-a', '2026-08-25');
  assert.equal(summary.devices.length, module.MAX_HEALTH_SUMMARY_DEVICES);
  assert.equal(summary.deviceLimit, module.MAX_HEALTH_SUMMARY_DEVICES);
  assert.equal(summary.devicesTruncated, true);
  const listed = repository.listDevices('user-a');
  assert.equal(listed.devices.length, module.MAX_HEALTH_SUMMARY_DEVICES + 1);
  assert.equal(listed.limit, module.MAX_LISTED_HEALTH_DEVICES);
  assert.equal(listed.truncated, false);
});
