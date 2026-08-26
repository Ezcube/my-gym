import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import * as healthRepositoryModule from '../src/health/repository.js';

const {
  createHealthRepository,
  MAX_LISTED_HEALTH_DEVICES,
  migrateHealthSchema
} = healthRepositoryModule;

async function loadHealthRouter() {
  try {
    return await import('../src/health/router.js');
  } catch {
    return {};
  }
}

async function startRouterServer(t, router) {
  const server = http.createServer(async (req, res) => {
    try {
      const userId = req.headers['x-test-user'];
      const user = userId ? { id: String(userId) } : null;
      const handled = await router.handle(req, res, user);
      if (!handled) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
      }
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

function createRepository(t, options = {}) {
  const db = new DatabaseSync(':memory:');
  migrateHealthSchema(db);
  t.after(() => db.close());
  return { db, repository: createHealthRepository(db, options) };
}

test('pairing endpoint requires a user and a normalized code can be consumed only once', async t => {
  const module = await loadHealthRouter();
  assert.equal(typeof module.createHealthRouter, 'function');
  const now = () => new Date('2026-08-25T12:00:00.000Z');
  const { db, repository } = createRepository(t, { now });
  const router = module.createHealthRouter({
    repository, now,
    makePairingCode: () => 'ab12-cd34',
    makeDeviceId: () => 'device-a',
    makeDeviceToken: () => 'issued-device-token'
  });
  const baseUrl = await startRouterServer(t, router);

  const unauthenticated = await fetch(`${baseUrl}/api/health/pairing-code`, { method: 'POST' });
  assert.equal(unauthenticated.status, 401);
  assert.deepEqual(await unauthenticated.json(), { error: 'not signed in', code: 'AUTH_REQUIRED' });

  const created = await fetch(`${baseUrl}/api/health/pairing-code`, {
    method: 'POST', headers: { 'x-test-user': 'user-a' }
  });
  assert.equal(created.status, 201);
  assert.deepEqual(await created.json(), {
    code: 'AB12CD34', expiresAt: '2026-08-25T12:10:00.000Z'
  });
  assert.equal(db.prepare('SELECT code_hash FROM health_pairing_codes').get().code_hash.length, 64);

  const pairBody = {
    code: 'ab12 cd34', deviceName: 'Galaxy S24', platform: 'android', appVersion: '1.0.0'
  };
  const paired = await fetch(`${baseUrl}/api/health/devices/pair`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(pairBody)
  });
  assert.equal(paired.status, 201);
  assert.deepEqual(await paired.json(), { deviceId: 'device-a', token: 'issued-device-token' });

  const repeated = await fetch(`${baseUrl}/api/health/devices/pair`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(pairBody)
  });
  assert.equal(repeated.status, 400);
  assert.deepEqual(await repeated.json(), {
    error: 'invalid or expired pairing code', code: 'INVALID_PAIRING_CODE'
  });
});

function pairDirect(repository, userId, code, id, token) {
  repository.createPairingCode(userId, code, '2026-08-25T12:10:00.000Z');
  repository.pairDevice(code, {
    id, token, deviceName: `Galaxy ${id}`, platform: 'android', appVersion: '1.0.0'
  });
}

test('bearer device endpoint exposes only itself and DELETE revokes its token', async t => {
  const { createHealthRouter } = await loadHealthRouter();
  const now = () => new Date('2026-08-25T12:00:00.000Z');
  const { repository } = createRepository(t, { now });
  pairDirect(repository, 'user-a', 'AAAA1111', 'device-a', 'test-token-a');
  pairDirect(repository, 'user-b', 'BBBB2222', 'device-b', 'test-token-b');
  const baseUrl = await startRouterServer(t, createHealthRouter({ repository, now }));

  const missing = await fetch(`${baseUrl}/api/health/devices/device-a`);
  assert.equal(missing.status, 401);
  assert.deepEqual(await missing.json(), {
    error: 'valid device token is required', code: 'DEVICE_AUTH_REQUIRED'
  });

  const headers = { authorization: 'Bearer test-token-a' };
  const own = await fetch(`${baseUrl}/api/health/devices/device-a`, { headers });
  assert.equal(own.status, 200);
  const ownBody = await own.json();
  assert.equal(ownBody.active, true);
  assert.equal(ownBody.deviceId, 'device-a');
  assert.equal(ownBody.lastSyncAt, null);
  assert.equal(ownBody.userId, undefined);
  assert.equal(JSON.stringify(ownBody).includes('test-token-a'), false);

  const foreign = await fetch(`${baseUrl}/api/health/devices/device-b`, { headers });
  assert.equal(foreign.status, 404);

  const revoked = await fetch(`${baseUrl}/api/health/devices/device-a`, {
    method: 'DELETE', headers
  });
  assert.equal(revoked.status, 200);
  assert.deepEqual(await revoked.json(), { ok: true });
  const afterRevoke = await fetch(`${baseUrl}/api/health/devices/device-a`, { headers });
  assert.equal(afterRevoke.status, 401);
});

test('authenticated web device list is isolated by cookie user', async t => {
  const { createHealthRouter } = await loadHealthRouter();
  const now = () => new Date('2026-08-25T12:00:00.000Z');
  const { repository } = createRepository(t, { now });
  pairDirect(repository, 'user-a', 'AAAA1111', 'device-a', 'test-token-a');
  pairDirect(repository, 'user-b', 'BBBB2222', 'device-b', 'test-token-b');
  const baseUrl = await startRouterServer(t, createHealthRouter({ repository, now }));

  const response = await fetch(`${baseUrl}/api/health/devices`, {
    headers: { 'x-test-user': 'user-a' }
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.devices.map(device => device.id), ['device-a']);
  assert.equal(body.limit, MAX_LISTED_HEALTH_DEVICES);
  assert.equal(body.truncated, false);
  assert.equal(body.devices[0].active, true);
  assert.equal(body.devices[0].userId, undefined);
});

test('authenticated web device list is bounded and reports truncation', async t => {
  const { createHealthRouter } = await loadHealthRouter();
  const now = () => new Date('2026-08-25T12:00:00.000Z');
  const { repository } = createRepository(t, { now });
  for (let index = 0; index <= MAX_LISTED_HEALTH_DEVICES; index += 1) {
    pairDirect(
      repository,
      'user-a',
      `user-a-code-${index}`,
      `device-${String(index).padStart(3, '0')}`,
      `user-a-token-${index}`
    );
  }
  pairDirect(repository, 'user-b', 'user-b-code', 'foreign-device', 'user-b-token');
  const baseUrl = await startRouterServer(t, createHealthRouter({ repository, now }));

  const response = await fetch(`${baseUrl}/api/health/devices`, {
    headers: { 'x-test-user': 'user-a' }
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.devices.length, MAX_LISTED_HEALTH_DEVICES);
  assert.equal(body.limit, MAX_LISTED_HEALTH_DEVICES);
  assert.equal(body.truncated, true);
  assert.deepEqual(
    body.devices.map(device => device.id),
    Array.from(
      { length: MAX_LISTED_HEALTH_DEVICES },
      (_, index) => `device-${String(index).padStart(3, '0')}`
    )
  );
  assert.equal(body.devices.some(device => device.id === 'foreign-device'), false);
});

test('authenticated owner can remotely revoke only their paired device', async t => {
  const { createHealthRouter } = await loadHealthRouter();
  const now = () => new Date('2026-08-25T12:00:00.000Z');
  const { repository } = createRepository(t, { now });
  pairDirect(repository, 'user-a', 'AAAA1111', 'device-a', 'test-token-a');
  pairDirect(repository, 'user-b', 'BBBB2222', 'device-b', 'test-token-b');
  const baseUrl = await startRouterServer(t, createHealthRouter({ repository, now }));

  const foreign = await fetch(`${baseUrl}/api/health/devices/device-b`, {
    method: 'DELETE', headers: { 'x-test-user': 'user-a' }
  });
  assert.equal(foreign.status, 404);
  const own = await fetch(`${baseUrl}/api/health/devices/device-a`, {
    method: 'DELETE', headers: { 'x-test-user': 'user-a' }
  });
  assert.equal(own.status, 200);
  assert.deepEqual(await own.json(), { ok: true });
  assert.equal(repository.authenticateDevice('test-token-a'), null);
  assert.equal(repository.authenticateDevice('test-token-b').id, 'device-b');
});

function syncHeaders(token, batchId, digest) {
  return {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'idempotency-key': batchId,
    'x-content-sha256': digest
  };
}

function validSyncPayload(overrides = {}) {
  return {
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
    tombstones: [],
    ...overrides
  };
}

test('sync requires matching idempotency headers and returns idempotent success or conflict', async t => {
  const { createHealthRouter } = await loadHealthRouter();
  const now = () => new Date('2026-08-25T12:00:00.000Z');
  const { repository } = createRepository(t, { now });
  pairDirect(repository, 'user-a', 'AAAA1111', 'device-a', 'test-token-a');
  const baseUrl = await startRouterServer(t, createHealthRouter({ repository, now }));
  const payload = validSyncPayload();

  const missingHeaders = await fetch(`${baseUrl}/api/health/sync`, {
    method: 'POST', headers: {
      authorization: 'Bearer test-token-a', 'content-type': 'application/json'
    }, body: JSON.stringify(payload)
  });
  assert.equal(missingHeaders.status, 400);
  assert.equal((await missingHeaders.json()).code, 'SYNC_HEADER_MISMATCH');

  const first = await fetch(`${baseUrl}/api/health/sync`, {
    method: 'POST', headers: syncHeaders('test-token-a', payload.batchId, payload.digest),
    body: JSON.stringify(payload)
  });
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), {
    ok: true, idempotent: false, syncedAt: '2026-08-25T12:00:00.000Z'
  });

  const duplicate = await fetch(`${baseUrl}/api/health/sync`, {
    method: 'POST', headers: syncHeaders('test-token-a', payload.batchId, payload.digest),
    body: JSON.stringify(payload)
  });
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).idempotent, true);

  const changed = { ...payload, digest: 'b'.repeat(64) };
  const conflict = await fetch(`${baseUrl}/api/health/sync`, {
    method: 'POST', headers: syncHeaders('test-token-a', changed.batchId, changed.digest),
    body: JSON.stringify(changed)
  });
  assert.equal(conflict.status, 409);
  assert.deepEqual(await conflict.json(), {
    error: 'batch id already used with a different digest', code: 'IDEMPOTENCY_CONFLICT'
  });
});

test('sync accepts the Android companion shape with numeric exercise type and an empty aggregate day', async t => {
  const { createHealthRouter } = await loadHealthRouter();
  const now = () => new Date('2026-08-25T12:00:00.000Z');
  const { repository } = createRepository(t, { now });
  pairDirect(repository, 'user-a', 'AAAA1111', 'device-a', 'test-token-a');
  const baseUrl = await startRouterServer(t, createHealthRouter({ repository, now }));
  const workout = { ...validSyncPayload().workouts[0], exerciseType: 13, title: undefined };
  const payload = validSyncPayload({
    batchId: 'android-batch', digest: 'e'.repeat(64),
    daily: [{ date: '2026-08-24' }], workouts: [workout]
  });

  const response = await fetch(`${baseUrl}/api/health/sync`, {
    method: 'POST', headers: syncHeaders('test-token-a', payload.batchId, payload.digest),
    body: JSON.stringify(payload)
  });
  assert.equal(response.status, 200);
  assert.equal(repository.getSummary('user-a', '2026-08-24').daily.steps, null);
  assert.equal(repository.getSummary('user-a', '2026-08-25').workouts[0].exerciseType, '13');
});

test('summary returns normalized data only to its authenticated owner', async t => {
  const { createHealthRouter } = await loadHealthRouter();
  const now = () => new Date('2026-08-25T12:00:00.000Z');
  const { repository } = createRepository(t, { now });
  pairDirect(repository, 'user-a', 'AAAA1111', 'device-a', 'test-token-a');
  const payload = validSyncPayload();
  repository.applySync(repository.authenticateDevice('test-token-a'), payload);
  const baseUrl = await startRouterServer(t, createHealthRouter({ repository, now }));

  const unauthenticated = await fetch(`${baseUrl}/api/health/summary?localDate=2026-08-25`);
  assert.equal(unauthenticated.status, 401);
  const owner = await fetch(`${baseUrl}/api/health/summary?localDate=2026-08-25`, {
    headers: { 'x-test-user': 'user-a' }
  });
  assert.equal(owner.status, 200);
  const ownerBody = await owner.json();
  assert.equal(ownerBody.localDate, '2026-08-25');
  assert.equal(ownerBody.steps, 9876);
  assert.equal(ownerBody.exerciseCalories, 640);
  assert.equal(ownerBody.oxygenSaturationPercent, 97.4);
  assert.equal(ownerBody.syncedAt, '2026-08-25T12:00:00.000Z');
  assert.deepEqual(ownerBody.workouts[0], {
    id: 'workout-1', name: 'Силовая', startedAt: '2026-08-25T06:00:00.000Z',
    durationMinutes: 45, calories: 310
  });
  assert.equal(ownerBody.devices[0].userId, undefined);
  const other = await fetch(`${baseUrl}/api/health/summary?localDate=2026-08-25`, {
    headers: { 'x-test-user': 'user-b' }
  });
  assert.equal(await other.json(), null);
});

test('sync maps the per-day workout cap to a stable client error', async t => {
  const { createHealthRouter } = await loadHealthRouter();
  const { MAX_HEALTH_WORKOUTS_PER_DAY } = await import('../src/health/repository.js');
  const now = () => new Date('2026-08-25T12:00:00.000Z');
  const { repository } = createRepository(t, { now });
  pairDirect(repository, 'user-a', 'AAAA1111', 'device-a', 'test-token-a');
  const workout = validSyncPayload().workouts[0];
  const payload = validSyncPayload({
    batchId: 'daily-overflow', digest: 'd'.repeat(64), daily: [],
    workouts: Array.from({ length: MAX_HEALTH_WORKOUTS_PER_DAY + 1 }, (_, index) => ({
      ...workout, externalId: `workout-${index}`
    }))
  });
  const baseUrl = await startRouterServer(t, createHealthRouter({ repository, now }));

  const response = await fetch(`${baseUrl}/api/health/sync`, {
    method: 'POST', headers: syncHeaders('test-token-a', payload.batchId, payload.digest),
    body: JSON.stringify(payload)
  });
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    error: 'daily workout limit exceeded', code: 'HEALTH_WORKOUT_DAY_LIMIT'
  });
});

test('sync rejects raw samples, GPS fields, and unknown JSON without storing a row', async t => {
  const { createHealthRouter } = await loadHealthRouter();
  const now = () => new Date('2026-08-25T12:00:00.000Z');
  const { db, repository } = createRepository(t, { now });
  pairDirect(repository, 'user-a', 'AAAA1111', 'device-a', 'test-token-a');
  const baseUrl = await startRouterServer(t, createHealthRouter({ repository, now }));
  const cases = [
    { gps: [{ lat: 55.7, lon: 49.1 }] },
    { daily: [{ ...validSyncPayload().daily[0], heartRateSamples: [60, 61] }] },
    { daily: [{ ...validSyncPayload().daily[0], oxygenSaturationSamples: [98, 97] }] },
    { workouts: [{ ...validSyncPayload().workouts[0], route: [{ lat: 55.7, lon: 49.1 }] }] }
  ];
  for (let index = 0; index < cases.length; index += 1) {
    const payload = validSyncPayload({
      batchId: `unsafe-${index}`,
      digest: String(index + 1).repeat(64),
      ...cases[index]
    });
    const response = await fetch(`${baseUrl}/api/health/sync`, {
      method: 'POST', headers: syncHeaders('test-token-a', payload.batchId, payload.digest),
      body: JSON.stringify(payload)
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'INVALID_SYNC_PAYLOAD');
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM health_daily').get().count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM health_workouts').get().count, 0);
});

test('sync validates real dates, aggregate ranges, required workout fields, and array bounds', async t => {
  const { createHealthRouter } = await loadHealthRouter();
  const now = () => new Date('2026-08-25T12:00:00.000Z');
  const { db, repository } = createRepository(t, { now });
  pairDirect(repository, 'user-a', 'AAAA1111', 'device-a', 'test-token-a');
  const baseUrl = await startRouterServer(t, createHealthRouter({ repository, now }));
  const daily = validSyncPayload().daily[0];
  const workout = validSyncPayload().workouts[0];
  const cases = [
    { daily: [{ ...daily, date: '2026-02-30' }] },
    { daily: [{ ...daily, date: '2099-01-01' }] },
    { daily: [{ ...daily, steps: -1 }] },
    { daily: [{ ...daily, heartRateMinBpm: 90, heartRateAvgBpm: 70 }] },
    { daily: Array.from({ length: 367 }, () => daily) },
    { workouts: [{ ...workout, durationMinutes: undefined }] },
    { workouts: [{ ...workout, start: '2026-02-30T06:00:00.000Z' }] },
    { workouts: [{ ...workout, end: '2026-08-25T05:59:00.000Z' }] },
    { tombstones: Array.from({ length: 1001 }, (_, index) => `deleted-${index}`) }
  ];
  for (let index = 0; index < cases.length; index += 1) {
    const payload = validSyncPayload({
      batchId: `invalid-${index}`,
      digest: (index + 1).toString(16).repeat(64),
      ...cases[index]
    });
    const response = await fetch(`${baseUrl}/api/health/sync`, {
      method: 'POST', headers: syncHeaders('test-token-a', payload.batchId, payload.digest),
      body: JSON.stringify(payload)
    });
    assert.equal(response.status, 400, `case ${index} must be rejected`);
    assert.equal((await response.json()).code, 'INVALID_SYNC_PAYLOAD');
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM health_sync_batches').get().count, 0);
});

test('public pairing rejects unsupported input fields and oversized device metadata', async t => {
  const { createHealthRouter } = await loadHealthRouter();
  const now = () => new Date('2026-08-25T12:00:00.000Z');
  const { repository } = createRepository(t, { now });
  repository.createPairingCode('user-a', 'AAAA1111', '2026-08-25T12:10:00.000Z');
  const baseUrl = await startRouterServer(t, createHealthRouter({ repository, now }));

  for (const body of [
    {
      code: 'AAAA1111', deviceName: 'Galaxy', platform: 'android', appVersion: '1.0.0',
      token: 'caller-selected-token'
    },
    {
      code: 'AAAA1111', deviceName: 'x'.repeat(81), platform: 'android', appVersion: '1.0.0'
    },
    { code: 'AAAA1111', deviceName: 'Galaxy', platform: 'ios', appVersion: '1.0.0' }
  ]) {
    const response = await fetch(`${baseUrl}/api/health/devices/pair`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    assert.equal(response.status, 400);
  }
  assert.equal(repository.listDevices('user-a').devices.length, 0);
});
