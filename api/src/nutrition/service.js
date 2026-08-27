import crypto from 'node:crypto';
import fs from 'node:fs';

const NUTRIENT_KEYS = ['kcal', 'proteinG', 'fatG', 'carbsG'];
export const MAX_REVIEW_ACTIVITY_WORKOUTS = 20;
export const MAX_REVIEW_ACTIVITY_SCAN = 256;
export const MAX_REVIEW_HEALTH_WORKOUTS = 20;
export const MAX_REVIEW_CONTEXT_BYTES = 256 * 1024;
export const MAX_REVIEW_LEGACY_STATE_BYTES = 5 * 1024 * 1024;
const CLIENT_SOURCE_HASH_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const COMPOSITE_SOURCE_HASH_PREFIX = 'v2.';

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function portionTotals(per100g, grams) {
  return Object.fromEntries(NUTRIENT_KEYS.map(key => [
    key,
    round2((Number(per100g[key]) || 0) * grams / 100)
  ]));
}

function addTotals(items) {
  return Object.fromEntries(NUTRIENT_KEYS.map(key => [
    key,
    round2(items.reduce((sum, item) => sum + (Number(item.totals?.[key]) || 0), 0))
  ]));
}

function usableNutrients(value) {
  return value && typeof value === 'object'
    && NUTRIENT_KEYS.every(key => Number.isFinite(Number(value[key])) && Number(value[key]) >= 0)
    && NUTRIENT_KEYS.some(key => Number(value[key]) > 0);
}

function resolvedItem(item, match, nutritionSource, nutritionLookupError) {
  const result = {
    ...item,
    ...(match.barcode ? { barcode: match.barcode } : {}),
    matchedName: match.name,
    nutrientsPer100g: match.nutrientsPer100g,
    totals: portionTotals(match.nutrientsPer100g, item.estimatedGrams),
    requiresManualNutrition: false,
    nutritionSource
  };
  if (nutritionLookupError) result.nutritionLookupError = true;
  return result;
}

function projectedWorkout(workout, localDate) {
  const result = { date: localDate };
  if (typeof workout?.name === 'string' && workout.name.trim()) {
    result.name = workout.name.trim().slice(0, 120);
  }
  const start = Number(workout?.start);
  const end = Number(workout?.end);
  if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
    result.durationMinutes = round2(Math.min((end - start) / 60_000, 24 * 60));
  }
  if (Array.isArray(workout?.entries)) {
    result.exerciseCount = Math.min(workout.entries.length, 1_000);
  }
  return result;
}

function reviewActivity(state, localDate) {
  const workouts = [];
  const sourceWorkouts = Array.isArray(state?.workouts) ? state.workouts : [];
  for (let index = sourceWorkouts.length - 1, inspected = 0;
    index >= 0 && inspected < MAX_REVIEW_ACTIVITY_SCAN
      && workouts.length < MAX_REVIEW_ACTIVITY_WORKOUTS;
    index -= 1, inspected += 1) {
    const workout = sourceWorkouts[index];
    if (workout?.d === localDate) workouts.push(projectedWorkout(workout, localDate));
  }
  let latest = null;
  const bodyweight = Array.isArray(state?.bodyweight) ? state.bodyweight : [];
  for (let index = bodyweight.length - 1, inspected = 0;
    index >= 0 && inspected < MAX_REVIEW_ACTIVITY_SCAN;
    index -= 1, inspected += 1) {
    const entry = bodyweight[index];
    if (entry?.d && entry.d <= localDate && (!latest || entry.d > latest.d)) latest = entry;
  }
  const value = Number(latest?.v ?? latest?.kg ?? latest?.weight);
  return { workouts, bodyweightKg: Number.isFinite(value) ? value : null };
}

function reviewHealth(summary) {
  if (!summary || typeof summary !== 'object') return null;
  const daily = summary.daily && typeof summary.daily === 'object' ? {
    date: summary.daily.date,
    steps: summary.daily.steps,
    activeCaloriesKcal: summary.daily.activeCaloriesKcal,
    sleepMinutes: summary.daily.sleepMinutes,
    weightKg: summary.daily.weightKg,
    bodyFatPercent: summary.daily.bodyFatPercent,
    heartRateAvgBpm: summary.daily.heartRateAvgBpm,
    oxygenSaturationAvgPercent: summary.daily.oxygenSaturationAvgPercent
  } : null;
  const workouts = (Array.isArray(summary.workouts) ? summary.workouts : [])
    .slice(0, MAX_REVIEW_HEALTH_WORKOUTS)
    .map(workout => ({
      externalId: workout?.externalId,
      start: workout?.start,
      durationMinutes: workout?.durationMinutes,
      exerciseType: workout?.exerciseType,
      title: workout?.title,
      activeCaloriesKcal: workout?.activeCaloriesKcal
    }));
  return {
    daily,
    workouts,
    workoutsTruncated: Boolean(summary.workoutsTruncated)
      || (Array.isArray(summary.workouts) && summary.workouts.length > MAX_REVIEW_HEALTH_WORKOUTS),
    lastSyncAt: summary.lastSyncAt ?? null
  };
}

function serializeContext(context) {
  const serialized = JSON.stringify(context);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_REVIEW_CONTEXT_BYTES) {
    throw Object.assign(new Error('nutrition review context exceeds its limit'), {
      code: 'NUTRITION_AI_CONTEXT_LIMIT'
    });
  }
  return serialized;
}

function hashContext(serialized) {
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function clientSourceHash(value) {
  return typeof value === 'string' && CLIENT_SOURCE_HASH_PATTERN.test(value) ? value : null;
}

function clientHashPrefix(value) {
  return `${COMPOSITE_SOURCE_HASH_PREFIX}${hashContext(value)}.`;
}

function storedContextHash(value) {
  if (typeof value !== 'string' || !value.startsWith(COMPOSITE_SOURCE_HASH_PREFIX)) return value;
  const parts = value.split('.');
  return parts.length === 3 ? parts[2] : value;
}

export function readLegacyStateFile(file, maxBytes, fileSystem = fs) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) return null;
  try {
    const stat = fileSystem.statSync(file);
    if (!stat.isFile() || !Number.isSafeInteger(stat.size) || stat.size > maxBytes) return null;
    const source = fileSystem.readFileSync(file, 'utf8');
    if (Buffer.byteLength(source, 'utf8') > maxBytes) return null;
    return JSON.parse(source);
  } catch {
    return null;
  }
}

export function createNutritionService({
  ai,
  foodData,
  repository,
  readState = () => null,
  getHealthSummary = async () => null,
  now = () => new Date(),
  reviewDailyLimit = 1
}) {
  const reviewInflight = new Map();
  return {
    async analyzePhoto(input) {
      const analysis = await ai.analyzePhoto(input);
      const items = await Promise.all(analysis.items.map(async item => {
        let nutritionLookupError = false;
        try {
          const [match] = await foodData.search(item.searchQuery, { limit: 1 });
          if (match && usableNutrients(match.nutrientsPer100g)) {
            return resolvedItem(item, match, 'open-food-facts', nutritionLookupError);
          }
        } catch { nutritionLookupError = true; }
        if (usableNutrients(item.estimatedNutrientsPer100g)) {
          const result = {
            ...item,
            nutrientsPer100g: item.estimatedNutrientsPer100g,
            totals: portionTotals(item.estimatedNutrientsPer100g, item.estimatedGrams),
            requiresManualNutrition: false,
            nutritionSource: 'ai-estimate',
            nutritionEstimated: true
          };
          if (nutritionLookupError) result.nutritionLookupError = true;
          return result;
        }
        return {
          ...item,
          requiresManualNutrition: true,
          ...(nutritionLookupError ? { nutritionLookupError: true } : {})
        };
      }));
      return {
        overallConfidence: analysis.overallConfidence,
        model: analysis.model,
        warnings: analysis.warnings,
        items,
        totals: addTotals(items),
        confirmed: false,
        requiresConfirmation: true
      };
    },

    async reviewDay({ userId, localDate, clientSourceHash: requestedSourceHash }) {
      const key = `${userId}\u0000${localDate}`;
      if (reviewInflight.has(key)) return reviewInflight.get(key);
      const operation = (async () => {
        const existing = repository.getDailyReview(userId, localDate);
        const requestedHash = clientSourceHash(requestedSourceHash);
        if (existing && requestedHash) {
          return {
            review: existing.review,
            sourceHash: existing.sourceHash,
            createdAt: existing.createdAt,
            cached: true,
            stale: !String(existing.sourceHash).startsWith(clientHashPrefix(requestedHash))
          };
        }
        if (!existing) {
          const usageDate = now().toISOString().slice(0, 10);
          if (!repository.claimAiUsage(userId, 'review', usageDate, reviewDailyLimit)) {
            throw Object.assign(new Error('daily AI review limit reached'), {
              code: 'NUTRITION_AI_RATE_LIMIT'
            });
          }
        }
        const storedProfile = repository.getProfile(userId);
        const reviewMeals = repository.listMealsForReview(userId, localDate);
        if (reviewMeals.overflow) {
          throw Object.assign(new Error('daily meal count exceeds review context limit'), {
            code: 'NUTRITION_AI_CONTEXT_LIMIT'
          });
        }
        const context = {
          localDate,
          profile: storedProfile?.profile || null,
          targets: storedProfile?.targets || null,
          meals: reviewMeals.meals,
          activity: reviewActivity(readState(userId, {
            maxBytes: MAX_REVIEW_LEGACY_STATE_BYTES
          }), localDate),
          health: reviewHealth(await getHealthSummary(userId, localDate))
        };
        const contextHash = hashContext(serializeContext(context));
        const sourceHash = requestedHash
          ? `${clientHashPrefix(requestedHash)}${contextHash}`
          : contextHash;
        if (existing) {
          return {
            review: existing.review,
            sourceHash: existing.sourceHash,
            createdAt: existing.createdAt,
            cached: true,
            stale: storedContextHash(existing.sourceHash) !== contextHash
          };
        }
        const generated = await ai.reviewDay(context);
        repository.createDailyReview(userId, localDate, sourceHash, generated);
        const saved = repository.getDailyReview(userId, localDate);
        return {
          review: saved.review,
          sourceHash: saved.sourceHash,
          createdAt: saved.createdAt,
          cached: false,
          stale: false
        };
      })();
      reviewInflight.set(key, operation);
      try { return await operation; }
      finally { reviewInflight.delete(key); }
    }
  };
}
