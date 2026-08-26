import crypto from 'node:crypto';
import { HttpError, readJsonBody, sendJson } from '../http.js';
import { validLocalDate, validateSyncPayload } from './validation.js';

const PAIRING_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function defaultPairingCode() {
  let value = '';
  for (let index = 0; index < 8; index += 1) {
    value += PAIRING_ALPHABET[crypto.randomInt(PAIRING_ALPHABET.length)];
  }
  return value;
}

function normalizePairingCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '');
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function validatePairRequest(body) {
  const allowed = new Set(['code', 'deviceName', 'platform', 'appVersion']);
  if (!object(body) || Object.keys(body).some(key => !allowed.has(key))) {
    throw new HttpError(400, 'pairing request contains unsupported fields', 'INVALID_PAIR_REQUEST');
  }
  const code = normalizePairingCode(body?.code);
  const deviceName = String(body?.deviceName || '').trim();
  const appVersion = String(body?.appVersion || '').trim();
  if (!/^[A-Z0-9]{8}$/.test(code)) {
    throw new HttpError(400, 'valid pairing code is required', 'INVALID_PAIRING_CODE');
  }
  if (!deviceName || deviceName.length > 80) {
    throw new HttpError(400, 'valid device name is required', 'INVALID_DEVICE_NAME');
  }
  if (body.platform !== 'android') {
    throw new HttpError(400, 'android platform is required', 'INVALID_PLATFORM');
  }
  if (!appVersion || appVersion.length > 64) {
    throw new HttpError(400, 'valid app version is required', 'INVALID_APP_VERSION');
  }
  return { code, deviceName, platform: 'android', appVersion };
}

function publicDevice(device) {
  return {
    id: device.id,
    active: !device.revokedAt,
    deviceName: device.deviceName,
    platform: device.platform,
    appVersion: device.appVersion,
    pairedAt: device.pairedAt,
    lastSyncAt: device.lastSyncAt,
    revokedAt: device.revokedAt
  };
}

function publicSummary(summary) {
  const daily = summary.daily;
  const hasDaily = [
    daily.steps,
    daily.activeCaloriesKcal,
    daily.sleepMinutes,
    daily.weightKg,
    daily.bodyFatPercent,
    daily.heartRateAvgBpm,
    daily.heartRateMinBpm,
    daily.heartRateMaxBpm,
    daily.oxygenSaturationAvgPercent
  ].some(value => value !== null);
  if (!hasDaily && !summary.workouts.length) return null;
  return {
    localDate: summary.localDate,
    steps: daily.steps,
    sleepMinutes: daily.sleepMinutes,
    exerciseCalories: daily.activeCaloriesKcal,
    weightKg: daily.weightKg,
    bodyFatPercent: daily.bodyFatPercent,
    heartRateAvgBpm: daily.heartRateAvgBpm,
    oxygenSaturationPercent: daily.oxygenSaturationAvgPercent,
    syncedAt: summary.lastSyncAt || daily.updatedAt,
    source: 'Samsung Health via Health Connect',
    workoutLimit: summary.workoutLimit,
    workoutsTruncated: summary.workoutsTruncated,
    deviceLimit: summary.deviceLimit,
    devicesTruncated: summary.devicesTruncated,
    workouts: summary.workouts.map(workout => ({
      id: workout.externalId,
      name: workout.title || workout.exerciseType,
      startedAt: workout.start,
      durationMinutes: workout.durationMinutes,
      calories: workout.activeCaloriesKcal
    })),
    devices: summary.devices.map(publicDevice)
  };
}

function authenticateDevice(req, repository) {
  const authorization = String(req.headers.authorization || '');
  const match = /^Bearer ([A-Za-z0-9._~-]{1,256})$/.exec(authorization);
  const device = match ? repository.authenticateDevice(match[1]) : null;
  if (!device) {
    throw new HttpError(401, 'valid device token is required', 'DEVICE_AUTH_REQUIRED');
  }
  return device;
}

function deviceIdFromPath(pathname) {
  const encoded = pathname.slice('/api/health/devices/'.length);
  if (!encoded || encoded.includes('/')) return null;
  try {
    const value = decodeURIComponent(encoded);
    return value && value.length <= 128 && !value.includes('/') ? value : null;
  } catch {
    return null;
  }
}

export function createHealthRouter({
  repository,
  now = () => new Date(),
  makePairingCode = defaultPairingCode,
  makeDeviceId = () => crypto.randomUUID(),
  makeDeviceToken = () => crypto.randomBytes(32).toString('base64url')
} = {}) {
  return {
    async handle(req, res, user) {
      const url = new URL(req.url, 'http://localhost');
      if (!url.pathname.startsWith('/api/health/')) return false;
      const key = `${req.method} ${url.pathname}`;
      try {
        if (key === 'POST /api/health/pairing-code') {
          if (!user) throw new HttpError(401, 'not signed in', 'AUTH_REQUIRED');
          const code = normalizePairingCode(makePairingCode());
          if (!/^[A-Z0-9]{8}$/.test(code)) throw new Error('pairing code generator returned an invalid code');
          const expiresAt = new Date(now().getTime() + 10 * 60 * 1000).toISOString();
          repository.createPairingCode(user.id, code, expiresAt);
          sendJson(res, 201, { code, expiresAt });
          return true;
        }
        if (key === 'POST /api/health/devices/pair') {
          const input = validatePairRequest(await readJsonBody(req, { maxBytes: 32 * 1024 }));
          const token = makeDeviceToken();
          const deviceId = makeDeviceId();
          const paired = repository.pairDevice(input.code, {
            id: deviceId,
            token,
            deviceName: input.deviceName,
            platform: input.platform,
            appVersion: input.appVersion
          });
          if (!paired) {
            throw new HttpError(400, 'invalid or expired pairing code', 'INVALID_PAIRING_CODE');
          }
          sendJson(res, 201, { deviceId, token });
          return true;
        }
        if (key === 'GET /api/health/devices') {
          if (!user) throw new HttpError(401, 'not signed in', 'AUTH_REQUIRED');
          const result = repository.listDevices(user.id);
          sendJson(res, 200, {
            devices: result.devices.map(publicDevice),
            limit: result.limit,
            truncated: result.truncated
          });
          return true;
        }
        if (key === 'POST /api/health/sync') {
          const device = authenticateDevice(req, repository);
          const batch = validateSyncPayload(
            await readJsonBody(req, { maxBytes: 1024 * 1024 }),
            { now: now() }
          );
          const headerBatchId = String(req.headers['idempotency-key'] || '');
          const headerDigest = String(req.headers['x-content-sha256'] || '').toLowerCase();
          if (headerBatchId !== batch.batchId || headerDigest !== batch.digest) {
            throw new HttpError(
              400,
              'idempotency headers must match the batch body',
              'SYNC_HEADER_MISMATCH'
            );
          }
          const result = repository.applySync(device, batch);
          if (result.status === 'conflict') {
            throw new HttpError(
              409,
              'batch id already used with a different digest',
              'IDEMPOTENCY_CONFLICT'
            );
          }
          if (result.status === 'revoked') {
            throw new HttpError(401, 'valid device token is required', 'DEVICE_AUTH_REQUIRED');
          }
          if (result.status === 'day_limit') {
            throw new HttpError(
              422,
              'daily workout limit exceeded',
              'HEALTH_WORKOUT_DAY_LIMIT'
            );
          }
          sendJson(res, 200, {
            ok: true,
            idempotent: result.status === 'duplicate',
            syncedAt: result.syncedAt
          });
          return true;
        }
        if (key === 'GET /api/health/summary') {
          if (!user) throw new HttpError(401, 'not signed in', 'AUTH_REQUIRED');
          const localDate = url.searchParams.get('localDate');
          if (!validLocalDate(localDate)) {
            throw new HttpError(400, 'valid localDate is required', 'INVALID_LOCAL_DATE');
          }
          const summary = repository.getSummary(user.id, localDate);
          sendJson(res, 200, publicSummary(summary));
          return true;
        }
        if (url.pathname.startsWith('/api/health/devices/')) {
          const requestedDeviceId = deviceIdFromPath(url.pathname);
          if (!requestedDeviceId) throw new HttpError(404, 'device not found', 'DEVICE_NOT_FOUND');
          if (req.method === 'DELETE' && user) {
            if (!repository.revokeOwnedDevice(user.id, requestedDeviceId)) {
              throw new HttpError(404, 'device not found', 'DEVICE_NOT_FOUND');
            }
            sendJson(res, 200, { ok: true });
            return true;
          }
          const device = authenticateDevice(req, repository);
          if (device.id !== requestedDeviceId) {
            throw new HttpError(404, 'device not found', 'DEVICE_NOT_FOUND');
          }
          if (req.method === 'GET') {
            const value = publicDevice(device);
            sendJson(res, 200, {
              active: true,
              deviceId: value.id,
              deviceName: value.deviceName,
              platform: value.platform,
              appVersion: value.appVersion,
              pairedAt: value.pairedAt,
              lastSyncAt: value.lastSyncAt
            });
            return true;
          }
          if (req.method === 'DELETE') {
            if (!repository.revokeDevice(device.id)) {
              throw new HttpError(404, 'device not found', 'DEVICE_NOT_FOUND');
            }
            sendJson(res, 200, { ok: true });
            return true;
          }
        }
      } catch (error) {
        if (error instanceof HttpError) {
          sendJson(res, error.status, { error: error.message, code: error.code });
          return true;
        }
        throw error;
      }
      sendJson(res, 404, { error: 'not found', code: 'NOT_FOUND' });
      return true;
    }
  };
}
