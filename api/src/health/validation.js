import { HttpError } from '../http.js';

const DAILY_KEYS = [
  'date', 'steps', 'activeCaloriesKcal', 'sleepMinutes', 'weightKg',
  'bodyFatPercent', 'heartRateAvgBpm', 'heartRateMinBpm', 'heartRateMaxBpm',
  'oxygenSaturationAvgPercent'
];
const WORKOUT_KEYS = [
  'externalId', 'start', 'end', 'durationMinutes', 'timezone', 'exerciseType',
  'title', 'activeCaloriesKcal'
];
const SYNC_KEYS = ['batchId', 'digest', 'timezone', 'daily', 'workouts', 'tombstones'];

function invalid(message) {
  throw new HttpError(400, message, 'INVALID_SYNC_PAYLOAD');
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, allowed, label) {
  if (!object(value)) invalid(`${label} must be an object`);
  const allowedSet = new Set(allowed);
  if (Object.keys(value).some(key => !allowedSet.has(key))) {
    invalid(`${label} contains unsupported fields`);
  }
}

export function validLocalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function boundedString(value, label, maxLength) {
  if (typeof value !== 'string') invalid(`${label} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/.test(normalized)) {
    invalid(`${label} is invalid`);
  }
  return normalized;
}

function timezone(value, label = 'timezone') {
  const normalized = boundedString(value, label, 64);
  if (!/^[A-Za-z0-9_+\-/:]+$/.test(normalized)) invalid(`${label} is invalid`);
  return normalized;
}

function optionalNumber(value, label, { min, max, integer = false }) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)
    || value < min || value > max || (integer && !Number.isInteger(value))) {
    invalid(`${label} is out of range`);
  }
  return value;
}

function isoTimestamp(value, label) {
  if (typeof value !== 'string' || value.length > 40
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    || !validLocalDate(value.slice(0, 10))
    || !Number.isFinite(Date.parse(value))) {
    invalid(`${label} must be an ISO timestamp`);
  }
  return value;
}

function validateDaily(value, maxLocalDate) {
  exactKeys(value, DAILY_KEYS, 'daily record');
  if (!validLocalDate(value.date)) invalid('daily date is invalid');
  if (value.date > maxLocalDate) invalid('daily date is too far in the future');
  const normalized = {
    date: value.date,
    steps: optionalNumber(value.steps, 'steps', { min: 0, max: 250000, integer: true }),
    activeCaloriesKcal: optionalNumber(value.activeCaloriesKcal, 'active calories', { min: 0, max: 20000 }),
    sleepMinutes: optionalNumber(value.sleepMinutes, 'sleep minutes', { min: 0, max: 1440, integer: true }),
    weightKg: optionalNumber(value.weightKg, 'weight', { min: 1, max: 500 }),
    bodyFatPercent: optionalNumber(value.bodyFatPercent, 'body fat', { min: 0, max: 100 }),
    heartRateAvgBpm: optionalNumber(value.heartRateAvgBpm, 'average heart rate', { min: 20, max: 300 }),
    heartRateMinBpm: optionalNumber(value.heartRateMinBpm, 'minimum heart rate', { min: 20, max: 300 }),
    heartRateMaxBpm: optionalNumber(value.heartRateMaxBpm, 'maximum heart rate', { min: 20, max: 300 }),
    oxygenSaturationAvgPercent: optionalNumber(
      value.oxygenSaturationAvgPercent, 'average oxygen saturation', { min: 50, max: 100 }
    )
  };
  const { heartRateMinBpm: min, heartRateAvgBpm: avg, heartRateMaxBpm: max } = normalized;
  if ((min !== null && avg !== null && min > avg)
    || (avg !== null && max !== null && avg > max)
    || (min !== null && max !== null && min > max)) {
    invalid('heart rate aggregates are inconsistent');
  }
  return normalized;
}

function validateWorkout(value, maxTimestamp) {
  exactKeys(value, WORKOUT_KEYS, 'workout');
  const start = isoTimestamp(value.start, 'workout start');
  const end = isoTimestamp(value.end, 'workout end');
  if (Date.parse(end) <= Date.parse(start)) invalid('workout end must follow its start');
  if (Date.parse(end) > maxTimestamp) invalid('workout date is too far in the future');
  const title = value.title === undefined || value.title === null
    ? null
    : boundedString(value.title, 'workout title', 160);
  const durationMinutes = optionalNumber(
    value.durationMinutes, 'workout duration', { min: 0, max: 1440 }
  );
  if (durationMinutes === null) invalid('workout duration is required');
  const exerciseType = Number.isInteger(value.exerciseType)
    && value.exerciseType >= 0 && value.exerciseType <= 10000
    ? String(value.exerciseType)
    : boundedString(value.exerciseType, 'exercise type', 80);
  return {
    externalId: boundedString(value.externalId, 'workout external id', 200),
    start,
    end,
    durationMinutes,
    timezone: timezone(value.timezone, 'workout timezone'),
    exerciseType,
    title,
    activeCaloriesKcal: optionalNumber(value.activeCaloriesKcal, 'workout active calories', { min: 0, max: 20000 })
  };
}

function unique(values, label) {
  if (new Set(values).size !== values.length) invalid(`${label} must be unique`);
}

export function validateSyncPayload(body, { now = new Date() } = {}) {
  const maxDate = new Date(now);
  maxDate.setUTCDate(maxDate.getUTCDate() + 2);
  const maxLocalDate = maxDate.toISOString().slice(0, 10);
  const maxTimestamp = now.getTime() + 48 * 60 * 60 * 1000;
  exactKeys(body, SYNC_KEYS, 'sync payload');
  const batchId = boundedString(body.batchId, 'batch id', 128);
  if (!/^[A-Za-z0-9._~-]+$/.test(batchId)) invalid('batch id is invalid');
  if (typeof body.digest !== 'string' || !/^[a-fA-F0-9]{64}$/.test(body.digest)) {
    invalid('digest must be a SHA-256 hex value');
  }
  if (!Array.isArray(body.daily) || body.daily.length > 366
    || !Array.isArray(body.workouts) || body.workouts.length > 1000
    || !Array.isArray(body.tombstones) || body.tombstones.length > 1000) {
    invalid('sync arrays exceed their limits');
  }
  const daily = body.daily.map(value => validateDaily(value, maxLocalDate));
  const workouts = body.workouts.map(value => validateWorkout(value, maxTimestamp));
  const tombstones = body.tombstones.map(value => boundedString(value, 'tombstone id', 200));
  unique(daily.map(value => value.date), 'daily dates');
  unique(workouts.map(value => value.externalId), 'workout ids');
  unique(tombstones, 'tombstone ids');
  const tombstoneSet = new Set(tombstones);
  if (workouts.some(workout => tombstoneSet.has(workout.externalId))) {
    invalid('a workout cannot also be tombstoned');
  }
  return {
    batchId,
    digest: body.digest.toLowerCase(),
    timezone: timezone(body.timezone),
    daily,
    workouts,
    tombstones
  };
}
