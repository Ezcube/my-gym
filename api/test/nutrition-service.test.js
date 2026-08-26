import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { openAppDatabase } from '../src/database.js';
import { createNutritionRepository } from '../src/nutrition/repository.js';

function createTestRepository(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'mygym-service-'));
  const db = openAppDatabase(path.join(dir, 'mygym.sqlite'));
  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return createNutritionRepository(db, { now: () => new Date('2026-08-25T12:00:00.000Z') });
}

test('photo analysis calculates portion totals from FoodData Central per-100g values', async () => {
  let serviceModule = null;
  try { serviceModule = await import('../src/nutrition/service.js'); } catch {}
  assert.equal(typeof serviceModule?.createNutritionService, 'function');

  const ai = {
    async analyzePhoto() {
      return {
        overallConfidence: 0.9, model: 'gpt-5.6-luna', warnings: [],
        items: [{
          name: 'Овсяная каша', searchQuery: 'oatmeal cooked', estimatedGrams: 250,
          confidence: 0.9, preparation: 'варёная', alternatives: [], warnings: []
        }]
      };
    }
  };
  const foodData = {
    async search() {
      return [{
        fdcId: 171705, name: 'Oatmeal, cooked',
        nutrientsPer100g: { kcal: 71, proteinG: 2.54, fatG: 1.52, carbsG: 12 }
      }];
    }
  };
  const service = serviceModule.createNutritionService({ ai, foodData });

  const result = await service.analyzePhoto({ base64: 'aW1hZ2U=', mimeType: 'image/jpeg', locale: 'ru' });

  assert.equal(result.requiresConfirmation, true);
  assert.equal(result.confirmed, false);
  assert.deepEqual(result.items[0], {
    name: 'Овсяная каша', searchQuery: 'oatmeal cooked', estimatedGrams: 250,
    confidence: 0.9, preparation: 'варёная', alternatives: [], warnings: [],
    fdcId: 171705, matchedName: 'Oatmeal, cooked',
    nutrientsPer100g: { kcal: 71, proteinG: 2.54, fatG: 1.52, carbsG: 12 },
    totals: { kcal: 177.5, proteinG: 6.35, fatG: 3.8, carbsG: 30 },
    requiresManualNutrition: false
  });
  assert.deepEqual(result.totals, { kcal: 177.5, proteinG: 6.35, fatG: 3.8, carbsG: 30 });
});

test('photo analysis keeps unmatched foods as an editable manual-nutrition draft', async () => {
  const { createNutritionService } = await import('../src/nutrition/service.js');
  const ai = {
    async analyzePhoto() {
      return {
        overallConfidence: 0.7, model: 'gpt-5.6-luna', warnings: [],
        items: [{
          name: 'Домашний эчпочмак', searchQuery: 'echpochmak meat pastry', estimatedGrams: 180,
          confidence: 0.7, preparation: 'печёный', alternatives: [], warnings: []
        }]
      };
    }
  };
  const service = createNutritionService({ ai, foodData: { async search() { return []; } } });

  const result = await service.analyzePhoto({ base64: 'aW1hZ2U=', mimeType: 'image/jpeg', locale: 'ru' });

  assert.equal(result.items[0].requiresManualNutrition, true);
  assert.equal(result.items[0].fdcId, undefined);
  assert.deepEqual(result.totals, { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 });
  assert.equal(result.requiresConfirmation, true);
});

test('photo analysis does not discard the AI draft when FoodData Central is unavailable', async () => {
  const { createNutritionService } = await import('../src/nutrition/service.js');
  const item = {
    name: 'Салат', searchQuery: 'mixed vegetable salad', estimatedGrams: 200,
    confidence: 0.8, preparation: 'сырой', alternatives: [], warnings: []
  };
  const ai = { async analyzePhoto() {
    return { overallConfidence: 0.8, model: 'gpt-5.6-luna', warnings: [], items: [item] };
  } };
  const foodData = { async search() { throw Object.assign(new Error('timeout'), { code: 'FDC_UPSTREAM_ERROR' }); } };
  const service = createNutritionService({ ai, foodData });

  const result = await service.analyzePhoto({ base64: 'aW1hZ2U=', mimeType: 'image/jpeg' });

  assert.deepEqual(result.items[0], {
    ...item, requiresManualNutrition: true, nutritionLookupError: true
  });
});

test('daily review is generated once per user and date and reports when its source snapshot is stale', async t => {
  const { createNutritionService } = await import('../src/nutrition/service.js');
  const repository = createTestRepository(t);
  repository.putProfile('user-a', { allergies: [], exclusions: [] }, {
    kcal: 2200, proteinG: 130, fatG: 70, carbsG: 260, confirmed: true
  });
  repository.createMeal('user-a', {
    id: 'meal-1', localDate: '2026-08-25', eatenAt: '2026-08-25T10:00:00.000Z',
    occasion: 'breakfast', source: 'manual', confirmed: true,
    items: [{ id: 'item-1', name: 'Каша', grams: 200, totals: { kcal: 200 } }],
    totals: { kcal: 200, proteinG: 6, fatG: 3, carbsG: 38 }
  });
  const calls = [];
  const review = {
    summary: 'Начало дня.', suggestions: ['Добавьте овощи.', 'Следите за водой.'],
    warnings: [], disclaimer: 'Не медицинская рекомендация.', model: 'gpt-5.6-luna'
  };
  const ai = { async reviewDay(context) { calls.push(context); return review; } };
  const service = createNutritionService({
    ai, foodData: {}, repository,
    readState: () => ({
      active: { photo: 'must-not-leak' },
      workouts: [{ d: '2026-08-25', id: 'workout-1' }],
      bodyweight: [{ d: '2026-08-24', v: 80 }]
    })
  });

  const first = await service.reviewDay({ userId: 'user-a', localDate: '2026-08-25' });
  const second = await service.reviewDay({ userId: 'user-a', localDate: '2026-08-25' });
  repository.createMeal('user-a', {
    id: 'meal-2', localDate: '2026-08-25', eatenAt: '2026-08-25T14:00:00.000Z',
    occasion: 'lunch', source: 'manual', confirmed: true,
    items: [{ id: 'item-2', name: 'Суп', grams: 300, totals: { kcal: 250 } }],
    totals: { kcal: 250, proteinG: 15, fatG: 8, carbsG: 30 }
  });
  const changed = await service.reviewDay({ userId: 'user-a', localDate: '2026-08-25' });

  assert.equal(calls.length, 1);
  assert.equal(first.cached, false);
  assert.equal(first.stale, false);
  assert.equal(second.cached, true);
  assert.equal(second.stale, false);
  assert.equal(changed.cached, true);
  assert.equal(changed.stale, true);
  assert.deepEqual(first.review, review);
  assert.deepEqual(calls[0].activity, {
    workouts: [{ date: '2026-08-25' }], bodyweightKg: 80
  });
  assert.doesNotMatch(JSON.stringify(calls[0]), /must-not-leak|photo/);
});

test('concurrent daily review requests share one OpenAI generation', async t => {
  const { createNutritionService } = await import('../src/nutrition/service.js');
  const repository = createTestRepository(t);
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const review = {
    summary: 'Итог.', suggestions: ['Совет один.', 'Совет два.'], warnings: [],
    disclaimer: 'Не медицинская рекомендация.', model: 'gpt-5.6-luna'
  };
  const ai = { async reviewDay() { calls += 1; await gate; return review; } };
  const service = createNutritionService({ ai, foodData: {}, repository });

  const first = service.reviewDay({ userId: 'user-a', localDate: '2026-08-25' });
  await new Promise(resolve => setImmediate(resolve));
  const second = service.reviewDay({ userId: 'user-a', localDate: '2026-08-25' });
  await new Promise(resolve => setImmediate(resolve));
  release();
  const results = await Promise.all([first, second]);

  assert.equal(calls, 1);
  assert.deepEqual(results.map(result => result.review), [review, review]);
});

test('daily review generation is limited to one paid call per user and UTC day', async t => {
  const { createNutritionService } = await import('../src/nutrition/service.js');
  const repository = createTestRepository(t);
  let calls = 0;
  const review = {
    summary: 'Итог.', suggestions: ['Совет один.', 'Совет два.'], warnings: [],
    disclaimer: 'Не медицинская рекомендация.', model: 'gpt-5.6-luna'
  };
  const ai = { async reviewDay() { calls += 1; return review; } };
  const service = createNutritionService({
    ai, foodData: {}, repository,
    now: () => new Date('2026-08-25T12:00:00.000Z')
  });

  await service.reviewDay({ userId: 'user-a', localDate: '2026-08-25' });
  await assert.rejects(
    service.reviewDay({ userId: 'user-a', localDate: '2026-08-24' }),
    error => error?.code === 'NUTRITION_AI_RATE_LIMIT'
  );
  assert.equal(calls, 1);
});

test('cached daily review uses the client snapshot hash without repeating unmetered context reads', async () => {
  const { createNutritionService } = await import('../src/nutrition/service.js');
  let saved = null;
  const calls = [];
  const repository = {
    getDailyReview() { calls.push('cache'); return saved; },
    claimAiUsage() { calls.push('quota'); return true; },
    getProfile() { calls.push('profile'); return null; },
    listMealsForReview() { calls.push('meals'); return { meals: [], overflow: false, limit: 32 }; },
    createDailyReview(_userId, _localDate, sourceHash, review) {
      saved = { sourceHash, review, createdAt: '2026-08-25T12:00:00.000Z' };
    }
  };
  const service = createNutritionService({
    ai: { async reviewDay() {
      calls.push('ai');
      return { summary: 'ok', suggestions: [], warnings: [], disclaimer: 'test' };
    } },
    foodData: {}, repository,
    readState: () => { calls.push('state'); return null; },
    getHealthSummary: async () => { calls.push('health'); return null; }
  });

  const first = await service.reviewDay({
    userId: 'user-a', localDate: '2026-08-25', clientSourceHash: 'v1-snapshot-a'
  });
  const afterGeneration = calls.length;
  const same = await service.reviewDay({
    userId: 'user-a', localDate: '2026-08-25', clientSourceHash: 'v1-snapshot-a'
  });
  const changed = await service.reviewDay({
    userId: 'user-a', localDate: '2026-08-25', clientSourceHash: 'v1-snapshot-b'
  });

  assert.equal(first.cached, false);
  assert.equal(same.cached, true);
  assert.equal(same.stale, false);
  assert.equal(changed.cached, true);
  assert.equal(changed.stale, true);
  assert.deepEqual(calls.slice(afterGeneration), ['cache', 'cache']);
});

test('bounded legacy state reader rejects oversized files before reading or parsing them', async () => {
  const { readLegacyStateFile } = await import('../src/nutrition/service.js');
  let reads = 0;
  const oversized = readLegacyStateFile('state.json', 16, {
    statSync() { return { isFile: () => true, size: 17 }; },
    readFileSync() { reads += 1; return '{"workouts":[]}'; }
  });
  assert.equal(oversized, null);
  assert.equal(reads, 0);

  const parsed = readLegacyStateFile('state.json', 16, {
    statSync() { return { isFile: () => true, size: 15 }; },
    readFileSync() { reads += 1; return '{"workouts":[]}'; }
  });
  assert.deepEqual(parsed, { workouts: [] });
  assert.equal(reads, 1);
});

test('daily review rejects meal overflow before hashing or calling AI', async () => {
  const { createNutritionService } = await import('../src/nutrition/service.js');
  const order = [];
  const repository = {
    getDailyReview() { order.push('cache'); return null; },
    claimAiUsage() { order.push('quota'); return true; },
    getProfile() { order.push('profile'); return null; },
    listMealsForReview() {
      order.push('meals');
      return { meals: [], overflow: true, limit: 32 };
    }
  };
  let calls = 0;
  const service = createNutritionService({
    ai: { async reviewDay() { calls += 1; return {}; } },
    foodData: {}, repository,
    getHealthSummary: async () => { order.push('health'); return null; }
  });

  await assert.rejects(
    service.reviewDay({ userId: 'user-a', localDate: '2026-08-25' }),
    error => error?.code === 'NUTRITION_AI_CONTEXT_LIMIT'
  );
  assert.deepEqual(order, ['cache', 'quota', 'profile', 'meals']);
  assert.equal(calls, 0);
});

test('daily review bounds workout arrays, removes device metadata, and caps serialized AI context', async () => {
  const module = await import('../src/nutrition/service.js');
  const captured = [];
  let saved = null;
  const repository = {
    getDailyReview() { return saved; },
    claimAiUsage() { return true; },
    getProfile() { return null; },
    listMealsForReview() { return { meals: [], overflow: false, limit: 32 }; },
    createDailyReview(_userId, _localDate, sourceHash, review) {
      saved = { sourceHash, review, createdAt: '2026-08-25T12:00:00.000Z' };
    }
  };
  const legacyWorkouts = Array.from({ length: 200 }, (_, index) => ({
    id: `workout-${index}`, d: '2026-08-25', title: `Workout ${index}`
  }));
  const healthWorkouts = Array.from({ length: 200 }, (_, index) => ({
    externalId: `health-${index}`, start: '2026-08-25T06:00:00.000Z',
    durationMinutes: 30, exerciseType: 'walking', title: `Health ${index}`,
    activeCaloriesKcal: 100
  }));
  const service = module.createNutritionService({
    ai: { async reviewDay(context) {
      captured.push(context);
      return { summary: 'ok', suggestions: [], warnings: [], disclaimer: 'test' };
    } },
    foodData: {}, repository,
    readState: () => ({ workouts: legacyWorkouts, bodyweight: [] }),
    getHealthSummary: async () => ({
      daily: { date: '2026-08-25', steps: 1000 }, workouts: healthWorkouts,
      devices: Array.from({ length: 100 }, (_, id) => ({ id, tokenHash: 'must-not-leak' })),
      lastSyncAt: '2026-08-25T11:00:00.000Z'
    })
  });

  await service.reviewDay({ userId: 'user-a', localDate: '2026-08-25' });
  assert.equal(captured[0].activity.workouts.length, module.MAX_REVIEW_ACTIVITY_WORKOUTS);
  assert.equal(captured[0].health.workouts.length, module.MAX_REVIEW_HEALTH_WORKOUTS);
  assert.equal(captured[0].health.devices, undefined);
  assert.doesNotMatch(JSON.stringify(captured[0]), /must-not-leak/);

  const oversizedRepository = {
    getDailyReview() { return null; }, claimAiUsage() { return true; }, getProfile() { return null; },
    listMealsForReview() {
      return {
        meals: [{ note: 'x'.repeat(module.MAX_REVIEW_CONTEXT_BYTES + 1) }],
        overflow: false,
        limit: 32
      };
    }
  };
  let oversizedCalls = 0;
  const oversizedService = module.createNutritionService({
    ai: { async reviewDay() { oversizedCalls += 1; } }, foodData: {}, repository: oversizedRepository
  });
  await assert.rejects(
    oversizedService.reviewDay({ userId: 'user-a', localDate: '2026-08-25' }),
    error => error?.code === 'NUTRITION_AI_CONTEXT_LIMIT'
  );
  assert.equal(oversizedCalls, 0);
});

test('daily review bounds inspected legacy rows and projects workouts before AI', async () => {
  const module = await import('../src/nutrition/service.js');
  let workoutReads = 0;
  let bodyweightReads = 0;
  const workouts = new Proxy(Array.from(
    { length: module.MAX_REVIEW_ACTIVITY_SCAN * 4 },
    (_, index) => ({ d: '2026-08-24', secret: `workout-secret-${index}` })
  ), {
    get(target, property, receiver) {
      if (/^\d+$/.test(String(property))) workoutReads += 1;
      return Reflect.get(target, property, receiver);
    }
  });
  const bodyweight = new Proxy(Array.from(
    { length: module.MAX_REVIEW_ACTIVITY_SCAN * 4 },
    () => ({ d: '2026-08-26', v: 80, secret: 'weight-secret' })
  ), {
    get(target, property, receiver) {
      if (/^\d+$/.test(String(property))) bodyweightReads += 1;
      return Reflect.get(target, property, receiver);
    }
  });
  const targetWorkout = {
    d: '2026-08-25', id: 'must-not-leak', name: 'Силовая', start: 1_000, end: 1_801_000,
    entries: [{ id: 'exercise-secret' }], vol: 12_345,
    device: { token: 'must-not-leak' }
  };
  workouts[workouts.length - 1] = targetWorkout;
  let captured;
  let readOptions;
  let saved;
  const repository = {
    getDailyReview() { return saved || null; }, claimAiUsage() { return true; },
    getProfile() { return null; },
    listMealsForReview() { return { meals: [], overflow: false, limit: 32 }; },
    createDailyReview(_userId, _localDate, sourceHash, review) {
      saved = { sourceHash, review, createdAt: '2026-08-25T12:00:00.000Z' };
    }
  };
  const service = module.createNutritionService({
    ai: { async reviewDay(context) {
      captured = context;
      return { summary: 'ok', suggestions: [], warnings: [], disclaimer: 'test' };
    } },
    foodData: {}, repository,
    readState: (_userId, options) => {
      readOptions = options;
      return { workouts, bodyweight };
    }
  });

  await service.reviewDay({ userId: 'user-a', localDate: '2026-08-25' });

  assert.deepEqual(readOptions, { maxBytes: module.MAX_REVIEW_LEGACY_STATE_BYTES });
  assert.ok(workoutReads <= module.MAX_REVIEW_ACTIVITY_SCAN);
  assert.ok(bodyweightReads <= module.MAX_REVIEW_ACTIVITY_SCAN);
  assert.deepEqual(captured.activity.workouts, [{
    date: '2026-08-25', name: 'Силовая', durationMinutes: 30, exerciseCount: 1
  }]);
  assert.doesNotMatch(JSON.stringify(captured.activity), /secret|must-not-leak|12345/);
});
