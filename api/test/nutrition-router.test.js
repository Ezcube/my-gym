import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { openAppDatabase } from '../src/database.js';
import * as nutritionRepositoryModule from '../src/nutrition/repository.js';

const {
  createNutritionRepository,
  MAX_LISTED_MEALS_PER_DAY
} = nutritionRepositoryModule;

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
    } catch {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'server error' }));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

function createTestRepository(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'mygym-router-'));
  const db = openAppDatabase(path.join(dir, 'mygym.sqlite'));
  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return createNutritionRepository(db);
}

test('nutrition routes reject requests without an authenticated user', async t => {
  let routerModule = null;
  try { routerModule = await import('../src/nutrition/router.js'); } catch {}
  assert.equal(typeof routerModule?.createNutritionRouter, 'function');

  const router = routerModule.createNutritionRouter({});
  const baseUrl = await startRouterServer(t, router);
  const response = await fetch(`${baseUrl}/api/nutrition/profile`);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'not signed in' });
});

test('profile PUT and GET persist confirmed targets for the authenticated user only', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  const repository = createTestRepository(t);
  const router = createNutritionRouter({ repository });
  const baseUrl = await startRouterServer(t, router);
  const payload = {
    profile: {
      birthDate: '1990-01-01', sex: 'male', heightCm: 180, weightKg: 80,
      activityLevel: 'moderate', goal: 'maintain', allergies: ['арахис'],
      preferences: [], exclusions: [], locale: 'ru', timezone: 'Europe/Moscow'
    },
    targets: {
      kcal: 2200, proteinG: 130, fatG: 70, carbsG: 260,
      confirmed: true, source: 'estimated', confirmedAt: '2026-08-25T09:00:00.000Z'
    }
  };

  const put = await fetch(`${baseUrl}/api/nutrition/profile`, {
    method: 'PUT', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' },
    body: JSON.stringify(payload)
  });
  assert.equal(put.status, 200);
  assert.deepEqual(await put.json(), payload);

  const own = await fetch(`${baseUrl}/api/nutrition/profile`, { headers: { 'x-test-user': 'user-a' } });
  assert.deepEqual(await own.json(), payload);
  const other = await fetch(`${baseUrl}/api/nutrition/profile`, { headers: { 'x-test-user': 'user-b' } });
  assert.deepEqual(await other.json(), { profile: null, targets: null });
});

test('profile PUT rejects calorie and macro targets that the user has not confirmed', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  const router = createNutritionRouter({ repository: createTestRepository(t) });
  const baseUrl = await startRouterServer(t, router);

  const response = await fetch(`${baseUrl}/api/nutrition/profile`, {
    method: 'PUT', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' },
    body: JSON.stringify({ profile: { locale: 'ru' }, targets: { kcal: 2200, confirmed: false } })
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: 'targets must be confirmed', code: 'TARGETS_NOT_CONFIRMED'
  });
});

test('profile PUT rejects unknown fields, invalid bounds, and users under 18', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  const router = createNutritionRouter({
    repository: createTestRepository(t),
    now: () => new Date('2026-08-25T12:00:00.000Z')
  });
  const baseUrl = await startRouterServer(t, router);
  const valid = {
    profile: {
      birthDate: '1990-01-01', sex: 'male', heightCm: 180, weightKg: 80,
      activityLevel: 'moderate', goal: 'maintain', allergies: [],
      preferences: [], exclusions: [], locale: 'ru', timezone: 'Europe/Moscow'
    },
    targets: {
      kcal: 2200, proteinG: 130, fatG: 70, carbsG: 260,
      confirmed: true, source: 'mifflin-st-jeor', formula: 'mifflin-st-jeor',
      confirmedAt: '2026-08-25T09:00:00.000Z'
    }
  };
  const invalidPayloads = [
    { ...valid, admin: true },
    { ...valid, profile: { ...valid.profile, birthDate: '2010-09-01' } },
    { ...valid, profile: { ...valid.profile, birthDate: '1990-02-30' } },
    { ...valid, profile: { ...valid.profile, heightCm: 999 } },
    { ...valid, targets: { ...valid.targets, kcal: 100000 } }
  ];

  for (const payload of invalidPayloads) {
    const response = await fetch(`${baseUrl}/api/nutrition/profile`, {
      method: 'PUT', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' },
      body: JSON.stringify(payload)
    });
    assert.equal(response.status, 400);
  }
});

test('profile PUT trims and canonicalizes bounded user-entered values', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  const router = createNutritionRouter({
    repository: createTestRepository(t),
    now: () => new Date('2026-08-25T12:00:00.000Z')
  });
  const baseUrl = await startRouterServer(t, router);
  const response = await fetch(`${baseUrl}/api/nutrition/profile`, {
    method: 'PUT', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' },
    body: JSON.stringify({
      profile: {
        birthDate: '1990-01-01', sex: 'male', heightCm: 180, weightKg: 80,
        activityLevel: 'moderate', goal: 'maintain', allergies: ['  арахис  ', 'арахис'],
        preferences: [' без мяса '], exclusions: [], locale: 'ru', timezone: 'Europe/Moscow'
      },
      targets: {
        kcal: 2200, proteinG: 130, fatG: 70, carbsG: 260,
        confirmed: true, source: 'mifflin-st-jeor', formula: 'mifflin-st-jeor',
        confirmedAt: '2026-08-25T09:00:00Z'
      }
    })
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    profile: {
      birthDate: '1990-01-01', sex: 'male', heightCm: 180, weightKg: 80,
      activityLevel: 'moderate', goal: 'maintain', allergies: ['арахис'],
      preferences: ['без мяса'], exclusions: [], locale: 'ru', timezone: 'Europe/Moscow'
    },
    targets: {
      kcal: 2200, proteinG: 130, fatG: 70, carbsG: 260,
      confirmed: true, source: 'mifflin-st-jeor', formula: 'mifflin-st-jeor',
      confirmedAt: '2026-08-25T09:00:00.000Z'
    }
  });
});

test('meals POST creates only a confirmed meal and GET lists it by local date', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  const router = createNutritionRouter({
    repository: createTestRepository(t), makeId: () => 'meal-server-id'
  });
  const baseUrl = await startRouterServer(t, router);
  const meal = {
    localDate: '2026-08-25', eatenAt: '2026-08-25T10:00:00.000Z',
    occasion: 'breakfast', source: 'photo', confirmed: true,
    items: [{ name: ' Овсянка ', grams: 250, per100: { kcal: 71, proteinG: 2.54, fatG: 1.52, carbsG: 12 } }],
    totals: { kcal: 9999, proteinG: 9999, fatG: 9999, carbsG: 9999 }
  };

  const created = await fetch(`${baseUrl}/api/nutrition/meals`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' },
    body: JSON.stringify({ meal })
  });
  assert.equal(created.status, 201);
  const savedMeal = {
    ...meal,
    id: 'meal-server-id',
    items: [{ name: 'Овсянка', grams: 250, per100: { kcal: 71, proteinG: 2.54, fatG: 1.52, carbsG: 12 } }],
    totals: { kcal: 177.5, proteinG: 6.4, fatG: 3.8, carbsG: 30 }
  };
  assert.deepEqual(await created.json(), { meal: savedMeal });

  const own = await fetch(`${baseUrl}/api/nutrition/meals?date=2026-08-25`, {
    headers: { 'x-test-user': 'user-a' }
  });
  assert.deepEqual(await own.json(), {
    meals: [savedMeal], limit: MAX_LISTED_MEALS_PER_DAY, truncated: false
  });
  const other = await fetch(`${baseUrl}/api/nutrition/meals?date=2026-08-25`, {
    headers: { 'x-test-user': 'user-b' }
  });
  assert.deepEqual(await other.json(), {
    meals: [], limit: MAX_LISTED_MEALS_PER_DAY, truncated: false
  });
});

test('meals GET returns bounded ordered results with truncation metadata', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  const repository = createTestRepository(t);
  for (let index = 0; index <= MAX_LISTED_MEALS_PER_DAY; index += 1) {
    repository.createMeal('user-a', {
      id: `meal-${String(index).padStart(3, '0')}`,
      localDate: '2026-08-25',
      eatenAt: new Date(Date.UTC(2026, 7, 25, 10, 0, index)).toISOString(),
      occasion: 'meal', source: 'manual', confirmed: true,
      items: [], totals: { kcal: index, proteinG: 0, fatG: 0, carbsG: 0 }
    });
  }
  repository.createMeal('user-b', {
    id: 'foreign-meal', localDate: '2026-08-25', eatenAt: '2026-08-25T09:00:00.000Z',
    occasion: 'meal', source: 'manual', confirmed: true,
    items: [], totals: { kcal: 1, proteinG: 0, fatG: 0, carbsG: 0 }
  });
  const baseUrl = await startRouterServer(t, createNutritionRouter({ repository }));

  const response = await fetch(`${baseUrl}/api/nutrition/meals?date=2026-08-25`, {
    headers: { 'x-test-user': 'user-a' }
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.meals.length, MAX_LISTED_MEALS_PER_DAY);
  assert.equal(body.limit, MAX_LISTED_MEALS_PER_DAY);
  assert.equal(body.truncated, true);
  assert.deepEqual(
    body.meals.map(meal => meal.id),
    Array.from(
      { length: MAX_LISTED_MEALS_PER_DAY },
      (_, index) => `meal-${String(index).padStart(3, '0')}`
    )
  );
  assert.equal(body.meals.some(meal => meal.id === 'foreign-meal'), false);
});

test('meals POST rejects unknown fields, more than 20 items, and out-of-range nutrients', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  const router = createNutritionRouter({ repository: createTestRepository(t) });
  const baseUrl = await startRouterServer(t, router);
  const item = {
    name: 'Каша', grams: 200,
    per100: { kcal: 100, proteinG: 3, fatG: 2, carbsG: 18 }
  };
  const meal = {
    localDate: '2026-08-25', eatenAt: '2026-08-25T10:00:00.000Z',
    occasion: 'meal', source: 'manual', confirmed: true,
    items: [item], totals: { kcal: 200, proteinG: 6, fatG: 4, carbsG: 36 }
  };
  const invalidMeals = [
    { ...meal, isAdmin: true },
    { ...meal, items: Array.from({ length: 21 }, () => item) },
    { ...meal, items: [{ ...item, per100: { ...item.per100, kcal: 1001 } }] },
    { ...meal, items: [{ ...item, name: 'x'.repeat(161) }] },
    { ...meal, items: [{ ...item, per100: { ...item.per100, sodium: 1 } }] }
  ];

  for (const candidate of invalidMeals) {
    const response = await fetch(`${baseUrl}/api/nutrition/meals`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' },
      body: JSON.stringify({ meal: candidate })
    });
    assert.equal(response.status, 400);
  }
});

test('non-photo nutrition JSON endpoints use a smaller body limit', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  const router = createNutritionRouter({ repository: createTestRepository(t) });
  const baseUrl = await startRouterServer(t, router);
  const response = await fetch(`${baseUrl}/api/nutrition/profile`, {
    method: 'PUT', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' },
    body: JSON.stringify({ profile: { padding: 'x'.repeat(64 * 1024) }, targets: { confirmed: true } })
  });

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: 'request body too large', code: 'BODY_TOO_LARGE' });
});

test('meals PATCH and DELETE cannot mutate another user meal', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  const repository = createTestRepository(t);
  const original = {
    id: 'meal-1', localDate: '2026-08-25', eatenAt: '2026-08-25T10:00:00.000Z',
    occasion: 'breakfast', source: 'manual', confirmed: true,
    items: [{ id: 'item-1', name: 'Каша', grams: 200, per100: { kcal: 100, proteinG: 3, fatG: 1.5, carbsG: 19 } }],
    totals: { kcal: 200, proteinG: 6, fatG: 3, carbsG: 38 }
  };
  repository.createMeal('user-a', original);
  const router = createNutritionRouter({ repository });
  const baseUrl = await startRouterServer(t, router);
  const changed = { ...original, id: 'attacker-id', occasion: 'lunch' };

  const foreignPatch = await fetch(`${baseUrl}/api/nutrition/meals?id=meal-1`, {
    method: 'PATCH', headers: { 'content-type': 'application/json', 'x-test-user': 'user-b' },
    body: JSON.stringify({ meal: changed })
  });
  assert.equal(foreignPatch.status, 404);
  const foreignDelete = await fetch(`${baseUrl}/api/nutrition/meals?id=meal-1`, {
    method: 'DELETE', headers: { 'x-test-user': 'user-b' }
  });
  assert.equal(foreignDelete.status, 404);

  const ownPatch = await fetch(`${baseUrl}/api/nutrition/meals?id=meal-1`, {
    method: 'PATCH', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' },
    body: JSON.stringify({ meal: changed })
  });
  assert.equal(ownPatch.status, 200);
  assert.deepEqual(await ownPatch.json(), { meal: { ...changed, id: 'meal-1' } });
  const ownDelete = await fetch(`${baseUrl}/api/nutrition/meals?id=meal-1`, {
    method: 'DELETE', headers: { 'x-test-user': 'user-a' }
  });
  assert.equal(ownDelete.status, 200);
  assert.deepEqual(await ownDelete.json(), { ok: true });
});

test('meals POST rejects an unconfirmed AI draft', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  const router = createNutritionRouter({ repository: createTestRepository(t) });
  const baseUrl = await startRouterServer(t, router);
  const response = await fetch(`${baseUrl}/api/nutrition/meals`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' },
    body: JSON.stringify({ meal: {
      localDate: '2026-08-25', eatenAt: '2026-08-25T10:00:00.000Z', occasion: 'breakfast',
      source: 'photo', confirmed: false, items: [{ name: 'Каша' }], totals: { kcal: 200 }
    } })
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: 'a confirmed meal is required', code: 'MEAL_NOT_CONFIRMED'
  });
});

test('barcode GET returns a normalized Open Food Facts product', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  const product = {
    barcode: '4601234567890', name: 'Творог', brand: 'Пример', quantity: '200 g',
    servingSize: '100 g',
    nutrientsPer100g: { kcal: 121, proteinG: 17, fatG: 5, carbsG: 3 }
  };
  const requested = [];
  const barcodeClient = { async lookupBarcode(code) { requested.push(code); return product; } };
  const router = createNutritionRouter({ repository: createTestRepository(t), barcodeClient });
  const baseUrl = await startRouterServer(t, router);

  const response = await fetch(`${baseUrl}/api/nutrition/barcode?code=4601234567890`, {
    headers: { 'x-test-user': 'user-a' }
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { product });
  assert.deepEqual(requested, ['4601234567890']);
});

test('photo-analysis POST returns an unconfirmed draft and passes no data to persistence', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  const calls = [];
  const draft = {
    items: [{ name: 'Яблоко', estimatedGrams: 150, totals: { kcal: 78 } }],
    totals: { kcal: 78 }, confirmed: false, requiresConfirmation: true
  };
  const service = { async analyzePhoto(input) { calls.push(input); return draft; } };
  const router = createNutritionRouter({ repository: createTestRepository(t), service });
  const baseUrl = await startRouterServer(t, router);
  const image = { base64: Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00]).toString('base64'), mimeType: 'image/jpeg' };

  const response = await fetch(`${baseUrl}/api/nutrition/photo-analysis`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' },
    body: JSON.stringify({ image, hint: 'перекус', knownWeightG: 150, locale: 'ru' })
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { draft });
  assert.deepEqual(calls, [{ ...image, hint: 'перекус', knownWeightG: 150, locale: 'ru' }]);
});

test('photo-analysis accepts only bounded canonical prompt metadata and exact payload fields', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  const calls = [];
  const service = { async analyzePhoto(input) { calls.push(input); return { confirmed: false }; } };
  const router = createNutritionRouter({ repository: createTestRepository(t), service });
  const baseUrl = await startRouterServer(t, router);
  const image = {
    base64: Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00]).toString('base64'),
    mimeType: 'image/jpeg'
  };

  const accepted = await fetch(`${baseUrl}/api/nutrition/photo-analysis`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' },
    body: JSON.stringify({ image, hint: '  борщ   со сметаной  ', knownWeightG: 350.5, locale: 'EN-us' })
  });
  assert.equal(accepted.status, 200);
  assert.deepEqual(calls, [{
    ...image, hint: 'борщ со сметаной', knownWeightG: 350.5, locale: 'en-US'
  }]);

  const emptyHint = await fetch(`${baseUrl}/api/nutrition/photo-analysis`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' },
    body: JSON.stringify({ image, hint: '', locale: 'ru' })
  });
  assert.equal(emptyHint.status, 200);
  assert.deepEqual(calls[1], { ...image, locale: 'ru' });

  const rejectedPayloads = [
    { image, admin: true },
    { image: { ...image, filename: 'meal.jpg' } },
    { image, hint: 'x'.repeat(301) },
    { image, hint: ' '.repeat(301) },
    { image, hint: 'meal\u0000ignore' },
    { image, locale: 'not_a_locale' },
    { image, locale: `en-${'x'.repeat(40)}` },
    { image, knownWeightG: '350' },
    { image, knownWeightG: 0 },
    { image, knownWeightG: 10001 }
  ];
  for (const payload of rejectedPayloads) {
    const response = await fetch(`${baseUrl}/api/nutrition/photo-analysis`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' },
      body: JSON.stringify(payload)
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'INVALID_PHOTO_ANALYSIS');
  }
  assert.equal(calls.length, 2);
});

test('photo-analysis enforces a persistent per-user daily AI quota', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  let calls = 0;
  const service = { async analyzePhoto() { calls += 1; return { confirmed: false }; } };
  const router = createNutritionRouter({
    repository: createTestRepository(t), service, photoDailyLimit: 1,
    now: () => new Date('2026-08-25T12:00:00.000Z')
  });
  const baseUrl = await startRouterServer(t, router);
  const body = JSON.stringify({
    image: {
      base64: Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00]).toString('base64'),
      mimeType: 'image/jpeg'
    }
  });

  const first = await fetch(`${baseUrl}/api/nutrition/photo-analysis`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' }, body
  });
  const limited = await fetch(`${baseUrl}/api/nutrition/photo-analysis`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' }, body
  });

  assert.equal(first.status, 200);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '86400');
  assert.deepEqual(await limited.json(), {
    error: 'daily nutrition AI limit reached', code: 'NUTRITION_AI_RATE_LIMIT'
  });
  assert.equal(calls, 1);
});

test('photo-analysis rejects a decoded image larger than 4 MiB before calling OpenAI', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  let calls = 0;
  const service = { async analyzePhoto() { calls += 1; return {}; } };
  const router = createNutritionRouter({ repository: createTestRepository(t), service });
  const baseUrl = await startRouterServer(t, router);
  const base64 = Buffer.alloc(4 * 1024 * 1024 + 1).toString('base64');

  const response = await fetch(`${baseUrl}/api/nutrition/photo-analysis`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' },
    body: JSON.stringify({ image: { base64, mimeType: 'image/jpeg' } })
  });

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: 'decoded image is too large', code: 'IMAGE_TOO_LARGE' });
  assert.equal(calls, 0);
});

test('nutrition JSON endpoints reject request bodies larger than 6 MiB', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  let calls = 0;
  const service = { async analyzePhoto() { calls += 1; return {}; } };
  const router = createNutritionRouter({ repository: createTestRepository(t), service });
  const baseUrl = await startRouterServer(t, router);
  const body = JSON.stringify({
    image: { base64: Buffer.from('small').toString('base64'), mimeType: 'image/jpeg' },
    padding: 'x'.repeat(6 * 1024 * 1024)
  });

  const response = await fetch(`${baseUrl}/api/nutrition/photo-analysis`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' }, body
  });

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: 'request body too large', code: 'BODY_TOO_LARGE' });
  assert.equal(calls, 0);
});

test('photo-analysis rejects invalid base64 without forwarding it to a provider', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  let calls = 0;
  const service = { async analyzePhoto() { calls += 1; return {}; } };
  const router = createNutritionRouter({ repository: createTestRepository(t), service });
  const baseUrl = await startRouterServer(t, router);

  const response = await fetch(`${baseUrl}/api/nutrition/photo-analysis`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' },
    body: JSON.stringify({ image: { base64: '%%%not-base64%%%', mimeType: 'image/jpeg' } })
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'invalid image encoding', code: 'INVALID_IMAGE_ENCODING' });
  assert.equal(calls, 0);
});

test('photo-analysis rejects a MIME-spoofed image before calling OpenAI', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  let calls = 0;
  const service = { async analyzePhoto() { calls += 1; return {}; } };
  const router = createNutritionRouter({ repository: createTestRepository(t), service });
  const baseUrl = await startRouterServer(t, router);
  const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const response = await fetch(`${baseUrl}/api/nutrition/photo-analysis`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' },
    body: JSON.stringify({ image: { base64: pngBytes.toString('base64'), mimeType: 'image/jpeg' } })
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'image bytes do not match MIME type', code: 'INVALID_IMAGE' });
  assert.equal(calls, 0);
});

test('review POST scopes the daily review to the authenticated user and local date', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  const calls = [];
  const result = {
    review: { summary: 'Итог', suggestions: ['Совет 1', 'Совет 2'] },
    sourceHash: 'server-hash', createdAt: '2026-08-25T12:00:00.000Z',
    cached: false, stale: false
  };
  const service = { async reviewDay(input) { calls.push(input); return result; } };
  const router = createNutritionRouter({
    repository: createTestRepository(t), service,
    now: () => new Date('2026-08-25T12:00:00.000Z')
  });
  const baseUrl = await startRouterServer(t, router);

  const response = await fetch(`${baseUrl}/api/nutrition/review`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' },
    body: JSON.stringify({ localDate: '2026-08-25', sourceHash: 'client-hash' })
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), result);
  assert.deepEqual(calls, [{ userId: 'user-a', localDate: '2026-08-25', clientSourceHash: 'client-hash' }]);
});

test('review POST accepts only real dates within one UTC day of now', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  let calls = 0;
  const service = { async reviewDay() { calls += 1; return {}; } };
  const router = createNutritionRouter({
    repository: createTestRepository(t), service,
    now: () => new Date('2026-08-25T23:59:59.000Z')
  });
  const baseUrl = await startRouterServer(t, router);

  for (const localDate of ['2026-02-30', '2026-08-23', '2026-08-27']) {
    const response = await fetch(`${baseUrl}/api/nutrition/review`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' },
      body: JSON.stringify({ localDate, sourceHash: 'client-hash' })
    });
    assert.equal(response.status, 400);
  }
  assert.equal(calls, 0);

  for (const localDate of ['2026-08-24', '2026-08-26']) {
    const response = await fetch(`${baseUrl}/api/nutrition/review`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' },
      body: JSON.stringify({ localDate, sourceHash: 'client-hash' })
    });
    assert.equal(response.status, 200);
  }
  assert.equal(calls, 2);
});

test('review POST maps the persistent daily AI limit to a retryable 429', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  const service = { async reviewDay() {
    throw Object.assign(new Error('limit'), { code: 'NUTRITION_AI_RATE_LIMIT' });
  } };
  const router = createNutritionRouter({
    repository: createTestRepository(t), service,
    now: () => new Date('2026-08-25T12:00:00.000Z')
  });
  const baseUrl = await startRouterServer(t, router);

  const response = await fetch(`${baseUrl}/api/nutrition/review`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' },
    body: JSON.stringify({ localDate: '2026-08-25', sourceHash: 'client-hash' })
  });

  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '86400');
  assert.equal((await response.json()).code, 'NUTRITION_AI_RATE_LIMIT');
});

test('review POST maps an oversized stored day to 422 without exposing internals', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  const service = { async reviewDay() {
    throw Object.assign(new Error('internal context details'), { code: 'NUTRITION_AI_CONTEXT_LIMIT' });
  } };
  const router = createNutritionRouter({
    repository: createTestRepository(t), service,
    now: () => new Date('2026-08-25T12:00:00.000Z')
  });
  const baseUrl = await startRouterServer(t, router);

  const response = await fetch(`${baseUrl}/api/nutrition/review`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' },
    body: JSON.stringify({ localDate: '2026-08-25', sourceHash: 'client-hash' })
  });
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    error: 'nutrition review context exceeds its daily limit',
    code: 'NUTRITION_REVIEW_CONTEXT_LIMIT'
  });
});

test('photo-analysis maps provider failures to a safe retryable response', async t => {
  const { createNutritionRouter } = await import('../src/nutrition/router.js');
  const service = { async analyzePhoto() {
    throw Object.assign(new Error('upstream payload must not be exposed'), { code: 'OPENAI_UPSTREAM_ERROR' });
  } };
  const router = createNutritionRouter({ repository: createTestRepository(t), service });
  const baseUrl = await startRouterServer(t, router);

  const response = await fetch(`${baseUrl}/api/nutrition/photo-analysis`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': 'user-a' },
    body: JSON.stringify({
      image: { base64: Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00]).toString('base64'), mimeType: 'image/jpeg' }
    })
  });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: 'nutrition AI is temporarily unavailable', code: 'NUTRITION_AI_UNAVAILABLE'
  });
});
