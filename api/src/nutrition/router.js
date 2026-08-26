import crypto from 'node:crypto';
import { HttpError, readJsonBody, sendJson } from '../http.js';

const NON_PHOTO_BODY_MAX_BYTES = 64 * 1024;
const REVIEW_BODY_MAX_BYTES = 4 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;
const NUTRIENT_KEYS = ['kcal', 'proteinG', 'fatG', 'carbsG'];
const PROFILE_KEYS = [
  'birthDate', 'sex', 'heightCm', 'weightKg', 'activityLevel', 'goal',
  'allergies', 'preferences', 'exclusions', 'locale', 'timezone'
];
const TARGET_KEYS = [
  'kcal', 'proteinG', 'fatG', 'carbsG', 'confirmed', 'source', 'formula', 'confirmedAt'
];
const MEAL_KEYS = ['id', 'localDate', 'eatenAt', 'occasion', 'source', 'confirmed', 'items', 'totals'];
const MEAL_ITEM_KEYS = ['id', 'name', 'grams', 'per100', 'confidence', 'foodId', 'barcode'];
const PHOTO_ANALYSIS_KEYS = ['image', 'hint', 'knownWeightG', 'locale'];
const PHOTO_IMAGE_KEYS = ['base64', 'mimeType'];

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function reject(message, code) {
  throw new HttpError(400, message, code);
}

function assertAllowedKeys(value, allowed, message, code) {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) {
    reject(message, code);
  }
}

function boundedNumber(value, min, max, message, code) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    reject(message, code);
  }
  return value;
}

function boundedString(value, max, message, code, { pattern, min = 1, collapseWhitespace = true } = {}) {
  if (typeof value !== 'string') reject(message, code);
  let result = value.normalize('NFC').trim();
  if (collapseWhitespace) result = result.replace(/\s+/gu, ' ');
  if (result.length < min || result.length > max || /[\u0000-\u001f\u007f]/u.test(result)
    || (pattern && !pattern.test(result))) {
    reject(message, code);
  }
  return result;
}

function canonicalLocalDate(value, message = 'valid localDate is required', code = 'INVALID_LOCAL_DATE') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) reject(message, code);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) reject(message, code);
  return value;
}

function canonicalInstant(value, message, code) {
  if (typeof value !== 'string' || value.length > 40
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    reject(message, code);
  }
  canonicalLocalDate(value.slice(0, 10), message, code);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) reject(message, code);
  return parsed.toISOString();
}

function canonicalStringList(value, field) {
  if (!Array.isArray(value) || value.length > 20) {
    reject(`${field} must be a bounded list`, 'INVALID_PROFILE');
  }
  const values = value.map(entry => boundedString(
    entry, 100, `${field} contains an invalid value`, 'INVALID_PROFILE'
  ));
  return [...new Set(values)];
}

function ageOnDate(birthDate, now) {
  const [year, month, day] = birthDate.split('-').map(Number);
  let age = now.getUTCFullYear() - year;
  if (now.getUTCMonth() + 1 < month
    || (now.getUTCMonth() + 1 === month && now.getUTCDate() < day)) age -= 1;
  return age;
}

function canonicalLocale(value, code = 'INVALID_PROFILE') {
  const locale = boundedString(value, 35, 'invalid locale', code, {
    pattern: /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/,
    collapseWhitespace: false
  });
  try { return Intl.getCanonicalLocales(locale)[0]; }
  catch { reject('invalid locale', code); }
}

function canonicalTimezone(value) {
  const timezone = boundedString(value, 64, 'invalid timezone', 'INVALID_PROFILE', {
    pattern: /^[A-Za-z0-9_+\-/]+$/,
    collapseWhitespace: false
  });
  try { return new Intl.DateTimeFormat('en-US', { timeZone: timezone }).resolvedOptions().timeZone; }
  catch { reject('invalid timezone', 'INVALID_PROFILE'); }
}

function canonicalProfile(profile, now) {
  assertAllowedKeys(profile, PROFILE_KEYS, 'invalid profile fields', 'INVALID_PROFILE');
  const birthDate = canonicalLocalDate(profile.birthDate, 'invalid birth date', 'INVALID_PROFILE');
  const age = ageOnDate(birthDate, now);
  if (age < 18 || age > 120) reject('nutrition profiles are available for adults only', 'INVALID_PROFILE');
  const sex = boundedString(profile.sex, 6, 'invalid sex', 'INVALID_PROFILE');
  const activityLevel = boundedString(profile.activityLevel, 12, 'invalid activity level', 'INVALID_PROFILE');
  const goal = boundedString(profile.goal, 8, 'invalid goal', 'INVALID_PROFILE');
  if (!['male', 'female'].includes(sex)) reject('invalid sex', 'INVALID_PROFILE');
  if (!['sedentary', 'light', 'moderate', 'very'].includes(activityLevel)) {
    reject('invalid activity level', 'INVALID_PROFILE');
  }
  if (!['lose', 'maintain', 'gain'].includes(goal)) reject('invalid goal', 'INVALID_PROFILE');
  return {
    birthDate,
    sex,
    heightCm: boundedNumber(profile.heightCm, 100, 250, 'invalid height', 'INVALID_PROFILE'),
    weightKg: boundedNumber(profile.weightKg, 25, 500, 'invalid weight', 'INVALID_PROFILE'),
    activityLevel,
    goal,
    allergies: canonicalStringList(profile.allergies, 'allergies'),
    preferences: canonicalStringList(profile.preferences, 'preferences'),
    exclusions: canonicalStringList(profile.exclusions, 'exclusions'),
    locale: canonicalLocale(profile.locale),
    timezone: canonicalTimezone(profile.timezone)
  };
}

function canonicalTargets(targets, profile) {
  assertAllowedKeys(targets, TARGET_KEYS, 'invalid target fields', 'INVALID_TARGETS');
  if (targets.confirmed !== true) {
    throw new HttpError(400, 'targets must be confirmed', 'TARGETS_NOT_CONFIRMED');
  }
  const source = boundedString(targets.source, 32, 'invalid target source', 'INVALID_TARGETS');
  if (!['estimated', 'manual', 'mifflin-st-jeor'].includes(source)) {
    reject('invalid target source', 'INVALID_TARGETS');
  }
  const calorieFloor = profile.sex === 'male' ? 1500 : 1200;
  const result = {
    kcal: boundedNumber(targets.kcal, calorieFloor, 10000, 'invalid calorie target', 'INVALID_TARGETS'),
    proteinG: boundedNumber(targets.proteinG, 0, 1000, 'invalid protein target', 'INVALID_TARGETS'),
    fatG: boundedNumber(targets.fatG, 0, 1000, 'invalid fat target', 'INVALID_TARGETS'),
    carbsG: boundedNumber(targets.carbsG, 0, 1000, 'invalid carb target', 'INVALID_TARGETS'),
    confirmed: true,
    source
  };
  if (targets.formula !== undefined) {
    const formula = boundedString(targets.formula, 32, 'invalid target formula', 'INVALID_TARGETS');
    if (formula !== 'mifflin-st-jeor') reject('invalid target formula', 'INVALID_TARGETS');
    result.formula = formula;
  }
  result.confirmedAt = canonicalInstant(
    targets.confirmedAt, 'invalid target confirmation time', 'INVALID_TARGETS'
  );
  return result;
}

function validateProfilePayload(body, now) {
  assertAllowedKeys(body, ['profile', 'targets'], 'invalid profile payload', 'INVALID_PROFILE');
  if (!object(body.profile) || !object(body.targets)) {
    throw new HttpError(400, 'profile and targets are required', 'INVALID_PROFILE');
  }
  if (body.targets.confirmed !== true) {
    throw new HttpError(400, 'targets must be confirmed', 'TARGETS_NOT_CONFIRMED');
  }
  const profile = canonicalProfile(body.profile, now);
  return { profile, targets: canonicalTargets(body.targets, profile) };
}

function validLocalDate(value) {
  try {
    canonicalLocalDate(value);
    return true;
  } catch {
    return false;
  }
}

function round1(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function canonicalMealItem(item) {
  assertAllowedKeys(item, MEAL_ITEM_KEYS, 'invalid meal item fields', 'INVALID_MEAL');
  assertAllowedKeys(item.per100, NUTRIENT_KEYS, 'invalid per-100 nutrients', 'INVALID_MEAL');
  if (NUTRIENT_KEYS.some(key => !Object.hasOwn(item.per100, key))) {
    reject('all per-100 nutrients are required', 'INVALID_MEAL');
  }
  const result = {
    name: boundedString(item.name, 160, 'invalid meal item name', 'INVALID_MEAL'),
    grams: boundedNumber(item.grams, 0.1, 10000, 'invalid meal item weight', 'INVALID_MEAL'),
    per100: {
      kcal: boundedNumber(item.per100.kcal, 0, 1000, 'invalid meal item calories', 'INVALID_MEAL'),
      proteinG: boundedNumber(item.per100.proteinG, 0, 100, 'invalid meal item protein', 'INVALID_MEAL'),
      fatG: boundedNumber(item.per100.fatG, 0, 100, 'invalid meal item fat', 'INVALID_MEAL'),
      carbsG: boundedNumber(item.per100.carbsG, 0, 100, 'invalid meal item carbs', 'INVALID_MEAL')
    }
  };
  if (item.id !== undefined) {
    result.id = boundedString(item.id, 128, 'invalid meal item id', 'INVALID_MEAL', {
      pattern: /^[A-Za-z0-9._:-]+$/,
      collapseWhitespace: false
    });
  }
  if (item.confidence !== undefined) {
    result.confidence = boundedNumber(item.confidence, 0, 1, 'invalid meal item confidence', 'INVALID_MEAL');
  }
  if (item.foodId !== undefined) {
    if (typeof item.foodId !== 'string'
      && !(Number.isSafeInteger(item.foodId) && item.foodId > 0)) {
      reject('invalid food id', 'INVALID_MEAL');
    }
    result.foodId = boundedString(String(item.foodId), 64, 'invalid food id', 'INVALID_MEAL', {
      pattern: /^[A-Za-z0-9._:-]+$/,
      collapseWhitespace: false
    });
  }
  if (item.barcode !== undefined) {
    result.barcode = boundedString(item.barcode, 14, 'invalid barcode', 'INVALID_MEAL', {
      pattern: /^\d{8,14}$/,
      collapseWhitespace: false
    });
  }
  return result;
}

function calculateMealTotals(items) {
  const totals = Object.fromEntries(NUTRIENT_KEYS.map(key => [key, 0]));
  for (const item of items) {
    for (const key of NUTRIENT_KEYS) totals[key] += item.per100[key] * item.grams / 100;
  }
  return Object.fromEntries(NUTRIENT_KEYS.map(key => [key, round1(totals[key])]));
}

function validateMealPayload(body) {
  assertAllowedKeys(body, ['meal'], 'invalid meal payload', 'INVALID_MEAL');
  const meal = body?.meal;
  if (!object(meal) || meal.confirmed !== true) {
    throw new HttpError(400, 'a confirmed meal is required', 'MEAL_NOT_CONFIRMED');
  }
  assertAllowedKeys(meal, MEAL_KEYS, 'invalid meal fields', 'INVALID_MEAL');
  const localDate = canonicalLocalDate(meal.localDate, 'valid localDate and eatenAt are required', 'INVALID_MEAL_DATE');
  const eatenAt = canonicalInstant(meal.eatenAt, 'valid localDate and eatenAt are required', 'INVALID_MEAL_DATE');
  if (!['photo', 'barcode', 'manual', 'repeat'].includes(meal.source)) {
    throw new HttpError(400, 'invalid meal source', 'INVALID_MEAL_SOURCE');
  }
  if (!['breakfast', 'lunch', 'dinner', 'snack', 'meal'].includes(meal.occasion)) {
    throw new HttpError(400, 'invalid meal occasion', 'INVALID_MEAL');
  }
  if (!Array.isArray(meal.items) || !meal.items.length || meal.items.length > 20) {
    throw new HttpError(400, 'meal items and totals are required', 'INVALID_MEAL');
  }
  if (meal.totals !== undefined) {
    assertAllowedKeys(meal.totals, NUTRIENT_KEYS, 'invalid meal totals', 'INVALID_MEAL');
    if (NUTRIENT_KEYS.some(key => !Object.hasOwn(meal.totals, key))) {
      reject('invalid meal totals', 'INVALID_MEAL');
    }
    for (const value of Object.values(meal.totals)) {
      boundedNumber(value, 0, 2_000_000, 'invalid meal totals', 'INVALID_MEAL');
    }
  }
  if (meal.id !== undefined) {
    boundedString(meal.id, 128, 'invalid meal id', 'INVALID_MEAL', {
      pattern: /^[A-Za-z0-9._:-]+$/,
      collapseWhitespace: false
    });
  }
  const items = meal.items.map(canonicalMealItem);
  return {
    localDate,
    eatenAt,
    occasion: meal.occasion,
    source: meal.source,
    confirmed: true,
    items,
    totals: calculateMealTotals(items)
  };
}

function decodeImageBase64(value) {
  if (!value || value.length % 4 !== 0) {
    throw new HttpError(400, 'invalid image encoding', 'INVALID_IMAGE_ENCODING');
  }
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const contentLength = value.length - padding;
  for (let index = 0; index < contentLength; index += 1) {
    const code = value.charCodeAt(index);
    const valid = (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
      || (code >= 48 && code <= 57) || code === 43 || code === 47;
    if (!valid) throw new HttpError(400, 'invalid image encoding', 'INVALID_IMAGE_ENCODING');
  }
  for (let index = contentLength; index < value.length; index += 1) {
    if (value.charCodeAt(index) !== 61) {
      throw new HttpError(400, 'invalid image encoding', 'INVALID_IMAGE_ENCODING');
    }
  }
  return Buffer.from(value, 'base64');
}

function imageMatchesMime(bytes, mimeType) {
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }
  return bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
    && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
}

function validatePhotoAnalysisPayload(body) {
  assertAllowedKeys(
    body, PHOTO_ANALYSIS_KEYS, 'photo analysis contains unsupported fields', 'INVALID_PHOTO_ANALYSIS'
  );
  assertAllowedKeys(
    body.image, PHOTO_IMAGE_KEYS, 'image contains unsupported fields', 'INVALID_PHOTO_ANALYSIS'
  );
  if (typeof body.image.base64 !== 'string'
    || !['image/jpeg', 'image/png', 'image/webp'].includes(body.image.mimeType)) {
    throw new HttpError(400, 'valid JPEG, PNG, or WebP image is required', 'INVALID_IMAGE');
  }
  const result = { base64: body.image.base64, mimeType: body.image.mimeType };
  if (body.hint !== undefined) {
    if (typeof body.hint !== 'string' || body.hint.length > 300) {
      reject('invalid photo hint', 'INVALID_PHOTO_ANALYSIS');
    }
    const normalized = body.hint.normalize('NFC').trim().replace(/\s+/gu, ' ');
    if (normalized) {
      result.hint = boundedString(
        normalized, 300, 'invalid photo hint', 'INVALID_PHOTO_ANALYSIS'
      );
    }
  }
  if (body.knownWeightG !== undefined) {
    result.knownWeightG = boundedNumber(
      body.knownWeightG, 1, 10000, 'invalid known weight', 'INVALID_PHOTO_ANALYSIS'
    );
  }
  if (body.locale !== undefined) {
    result.locale = canonicalLocale(body.locale, 'INVALID_PHOTO_ANALYSIS');
  }
  return result;
}

function assertReviewDate(localDate, now) {
  const value = canonicalLocalDate(localDate);
  const current = now();
  if (!(current instanceof Date) || !Number.isFinite(current.getTime())) {
    throw new Error('nutrition router now() returned an invalid date');
  }
  const requestedDay = Date.parse(`${value}T00:00:00.000Z`);
  const currentDay = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate());
  if (Math.abs(requestedDay - currentDay) > DAY_MS) {
    reject('localDate must be within one UTC day of today', 'REVIEW_DATE_OUT_OF_RANGE');
  }
  return value;
}

export function createNutritionRouter({
  repository,
  barcodeClient,
  service,
  makeId = () => crypto.randomUUID(),
  now = () => new Date(),
  photoDailyLimit = 20
} = {}) {
  return {
    async handle(req, res, user) {
      const url = new URL(req.url, 'http://localhost');
      if (!url.pathname.startsWith('/api/nutrition/')) return false;
      if (!user) {
        sendJson(res, 401, { error: 'not signed in' });
        return true;
      }
      const key = `${req.method} ${url.pathname}`;
      try {
        if (key === 'GET /api/nutrition/profile') {
          const value = repository.getProfile(user.id);
          sendJson(res, 200, value || { profile: null, targets: null });
          return true;
        }
        if (key === 'PUT /api/nutrition/profile') {
          const body = validateProfilePayload(await readJsonBody(req, { maxBytes: NON_PHOTO_BODY_MAX_BYTES }), now());
          sendJson(res, 200, repository.putProfile(user.id, body.profile, body.targets));
          return true;
        }
        if (key === 'GET /api/nutrition/meals') {
          const localDate = url.searchParams.get('date');
          if (!validLocalDate(localDate)) {
            throw new HttpError(400, 'valid date is required', 'INVALID_LOCAL_DATE');
          }
          sendJson(res, 200, repository.listMeals(user.id, localDate));
          return true;
        }
        if (key === 'POST /api/nutrition/meals') {
          const meal = validateMealPayload(await readJsonBody(req, { maxBytes: NON_PHOTO_BODY_MAX_BYTES }));
          const saved = repository.createMeal(user.id, { ...meal, id: makeId() });
          sendJson(res, 201, { meal: saved });
          return true;
        }
        if (key === 'PATCH /api/nutrition/meals') {
          const id = boundedString(
            url.searchParams.get('id'), 128, 'meal id is required', 'MEAL_ID_REQUIRED', {
              pattern: /^[A-Za-z0-9._:-]+$/,
              collapseWhitespace: false
            }
          );
          const meal = validateMealPayload(await readJsonBody(req, { maxBytes: NON_PHOTO_BODY_MAX_BYTES }));
          const saved = repository.updateMeal(user.id, id, { ...meal, id });
          if (!saved) {
            sendJson(res, 404, { error: 'meal not found' });
            return true;
          }
          sendJson(res, 200, { meal: saved });
          return true;
        }
        if (key === 'DELETE /api/nutrition/meals') {
          const id = boundedString(
            url.searchParams.get('id'), 128, 'meal id is required', 'MEAL_ID_REQUIRED', {
              pattern: /^[A-Za-z0-9._:-]+$/,
              collapseWhitespace: false
            }
          );
          if (!repository.deleteMeal(user.id, id)) {
            sendJson(res, 404, { error: 'meal not found' });
            return true;
          }
          sendJson(res, 200, { ok: true });
          return true;
        }
        if (key === 'GET /api/nutrition/barcode') {
          const code = String(url.searchParams.get('code') || '').trim();
          if (!/^\d{8,14}$/.test(code)) {
            throw new HttpError(400, 'valid barcode is required', 'INVALID_BARCODE');
          }
          const product = await barcodeClient.lookupBarcode(code);
          if (!product) {
            sendJson(res, 404, { error: 'product not found' });
            return true;
          }
          sendJson(res, 200, { product });
          return true;
        }
        if (key === 'POST /api/nutrition/photo-analysis') {
          const body = await readJsonBody(req);
          const input = validatePhotoAnalysisPayload(body);
          const imageBytes = decodeImageBase64(input.base64);
          if (imageBytes.length > 4 * 1024 * 1024) {
            throw new HttpError(413, 'decoded image is too large', 'IMAGE_TOO_LARGE');
          }
          if (!imageMatchesMime(imageBytes, input.mimeType)) {
            throw new HttpError(400, 'image bytes do not match MIME type', 'INVALID_IMAGE');
          }
          const usageDate = now().toISOString().slice(0, 10);
          if (!repository.claimAiUsage(user.id, 'photo', usageDate, photoDailyLimit)) {
            throw Object.assign(new Error('daily nutrition AI limit reached'), {
              code: 'NUTRITION_AI_RATE_LIMIT'
            });
          }
          const draft = await service.analyzePhoto(input);
          sendJson(res, 200, { draft });
          return true;
        }
        if (key === 'POST /api/nutrition/review') {
          const body = await readJsonBody(req, { maxBytes: REVIEW_BODY_MAX_BYTES });
          assertAllowedKeys(body, ['localDate', 'sourceHash'], 'invalid review payload', 'INVALID_REVIEW');
          const localDate = assertReviewDate(body.localDate, now);
          const sourceHash = boundedString(
            body.sourceHash, 128, 'sourceHash is required', 'SOURCE_HASH_REQUIRED', {
              pattern: /^[A-Za-z0-9._:-]+$/,
              collapseWhitespace: false
            }
          );
          const result = await service.reviewDay({
            userId: user.id,
            localDate,
            clientSourceHash: sourceHash
          });
          sendJson(res, 200, result);
          return true;
        }
      } catch (error) {
        if (error instanceof HttpError) {
          sendJson(res, error.status, { error: error.message, code: error.code });
          return true;
        }
        if (error?.code === 'NUTRITION_AI_RATE_LIMIT') {
          sendJson(res, 429, {
            error: 'daily nutrition AI limit reached',
            code: 'NUTRITION_AI_RATE_LIMIT'
          }, { 'Retry-After': '86400' });
          return true;
        }
        if (error?.code === 'NUTRITION_AI_CONTEXT_LIMIT') {
          sendJson(res, 422, {
            error: 'nutrition review context exceeds its daily limit',
            code: 'NUTRITION_REVIEW_CONTEXT_LIMIT'
          });
          return true;
        }
        if (String(error?.code || '').startsWith('OPENAI_')) {
          sendJson(res, 503, {
            error: 'nutrition AI is temporarily unavailable',
            code: 'NUTRITION_AI_UNAVAILABLE'
          });
          return true;
        }
        if (error?.code === 'OFF_UPSTREAM_ERROR') {
          sendJson(res, 502, {
            error: 'barcode lookup is temporarily unavailable',
            code: 'BARCODE_LOOKUP_UNAVAILABLE'
          });
          return true;
        }
        throw error;
      }
      sendJson(res, 404, { error: 'not found' });
      return true;
    }
  };
}
