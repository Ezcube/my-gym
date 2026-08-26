import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { openAppDatabase } from '../src/database.js';

function withRepository(t, createRepository, options) {
  const dir = mkdtempSync(path.join(tmpdir(), 'mygym-nutrition-'));
  const db = openAppDatabase(path.join(dir, 'mygym.sqlite'));
  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return createRepository(db, options);
}

test('nutrition profiles are isolated by authenticated user id', async t => {
  let repositoryModule = null;
  try { repositoryModule = await import('../src/nutrition/repository.js'); } catch {}
  assert.equal(typeof repositoryModule?.createNutritionRepository, 'function');

  const repository = withRepository(t, repositoryModule.createNutritionRepository);
  repository.putProfile('user-a', { locale: 'ru' }, { kcal: 2200, confirmed: true });
  repository.putProfile('user-b', { locale: 'en' }, { kcal: 1800, confirmed: true });

  assert.deepEqual(repository.getProfile('user-a'), {
    profile: { locale: 'ru' },
    targets: { kcal: 2200, confirmed: true }
  });
  assert.deepEqual(repository.getProfile('user-b'), {
    profile: { locale: 'en' },
    targets: { kcal: 1800, confirmed: true }
  });
});

test('confirmed meals can only be read, changed, or deleted by their owner', async t => {
  const module = await import('../src/nutrition/repository.js');
  const repository = withRepository(t, module.createNutritionRepository, {
    now: () => new Date('2026-08-25T00:00:00.000Z')
  });
  assert.equal(typeof repository.createMeal, 'function');

  const meal = {
    id: 'meal-1', localDate: '2026-08-25', eatenAt: '2026-08-25T10:00:00.000Z',
    occasion: 'breakfast', source: 'manual', confirmed: true,
    items: [{ id: 'item-1', name: 'Овсянка', grams: 200, kcal: 240 }],
    totals: { kcal: 240, proteinG: 8, fatG: 4, carbsG: 42 }
  };
  repository.createMeal('user-a', meal);

  assert.deepEqual(repository.listMeals('user-a', '2026-08-25'), {
    meals: [meal], limit: module.MAX_LISTED_MEALS_PER_DAY, truncated: false
  });
  assert.deepEqual(repository.listMeals('user-b', '2026-08-25'), {
    meals: [], limit: module.MAX_LISTED_MEALS_PER_DAY, truncated: false
  });
  assert.equal(repository.updateMeal('user-b', 'meal-1', { ...meal, occasion: 'lunch' }), null);
  assert.equal(repository.deleteMeal('user-b', 'meal-1'), false);
  assert.equal(repository.updateMeal('user-a', 'meal-1', { ...meal, occasion: 'lunch' }).occasion, 'lunch');
  assert.equal(repository.deleteMeal('user-a', 'meal-1'), true);
  assert.deepEqual(repository.listMeals('user-a', '2026-08-25'), {
    meals: [], limit: module.MAX_LISTED_MEALS_PER_DAY, truncated: false
  });
});

test('meal listing fetches only its cap plus one while preserving order and user isolation', async t => {
  const module = await import('../src/nutrition/repository.js');
  const repository = withRepository(t, module.createNutritionRepository);
  assert.equal(Number.isInteger(module.MAX_LISTED_MEALS_PER_DAY), true);

  for (let index = 0; index <= module.MAX_LISTED_MEALS_PER_DAY; index += 1) {
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

  const result = repository.listMeals('user-a', '2026-08-25');
  assert.equal(result.meals.length, module.MAX_LISTED_MEALS_PER_DAY);
  assert.equal(result.limit, module.MAX_LISTED_MEALS_PER_DAY);
  assert.equal(result.truncated, true);
  assert.deepEqual(
    result.meals.map(meal => meal.id),
    Array.from(
      { length: module.MAX_LISTED_MEALS_PER_DAY },
      (_, index) => `meal-${String(index).padStart(3, '0')}`
    )
  );
  assert.equal(result.meals.some(meal => meal.id === 'foreign-meal'), false);
});

test('daily-review meal loading materializes at most its explicit SQL context limit', async t => {
  const module = await import('../src/nutrition/repository.js');
  const repository = withRepository(t, module.createNutritionRepository);
  assert.equal(Number.isInteger(module.MAX_DAILY_REVIEW_MEALS), true);
  assert.equal(typeof repository.listMealsForReview, 'function');

  for (let index = 0; index <= module.MAX_DAILY_REVIEW_MEALS; index += 1) {
    repository.createMeal('user-a', {
      id: `meal-${index}`, localDate: '2026-08-25',
      eatenAt: `2026-08-25T10:${String(index % 60).padStart(2, '0')}:00.000Z`,
      occasion: 'meal', source: 'manual', confirmed: true,
      items: [], totals: { kcal: index, proteinG: 0, fatG: 0, carbsG: 0 }
    });
  }

  const result = repository.listMealsForReview('user-a', '2026-08-25');
  assert.equal(result.meals.length, module.MAX_DAILY_REVIEW_MEALS);
  assert.equal(result.limit, module.MAX_DAILY_REVIEW_MEALS);
  assert.equal(result.overflow, true);
});

test('daily reviews are immutable per user and local date', async t => {
  const { createNutritionRepository } = await import('../src/nutrition/repository.js');
  const repository = withRepository(t, createNutritionRepository, {
    now: () => new Date('2026-08-25T00:00:00.000Z')
  });
  assert.equal(typeof repository.createDailyReview, 'function');

  const first = { summary: 'Баланс хороший', suggestions: ['Добавьте овощи', 'Пейте воду'] };
  const second = { summary: 'Другой ответ', suggestions: ['Не должен сохраниться'] };
  assert.deepEqual(repository.createDailyReview('user-a', '2026-08-25', 'hash-1', first), first);
  assert.equal(repository.createDailyReview('user-a', '2026-08-25', 'hash-2', second), null);
  assert.deepEqual(repository.getDailyReview('user-a', '2026-08-25'), {
    sourceHash: 'hash-1', review: first, createdAt: '2026-08-25T00:00:00.000Z'
  });
  assert.equal(repository.getDailyReview('user-b', '2026-08-25'), null);
});

test('AI usage claims are atomic and isolated by user, operation, and UTC day', async t => {
  const { createNutritionRepository } = await import('../src/nutrition/repository.js');
  const repository = withRepository(t, createNutritionRepository, {
    now: () => new Date('2026-08-25T12:00:00.000Z')
  });

  assert.equal(repository.claimAiUsage('user-a', 'photo', '2026-08-25', 2), true);
  assert.equal(repository.claimAiUsage('user-a', 'photo', '2026-08-25', 2), true);
  assert.equal(repository.claimAiUsage('user-a', 'photo', '2026-08-25', 2), false);
  assert.equal(repository.claimAiUsage('user-a', 'review', '2026-08-25', 1), true);
  assert.equal(repository.claimAiUsage('user-b', 'photo', '2026-08-25', 2), true);
  assert.equal(repository.claimAiUsage('user-a', 'photo', '2026-08-26', 2), true);
});
