export const MAX_DAILY_REVIEW_MEALS = 32;
export const MAX_LISTED_MEALS_PER_DAY = 64;

export function createNutritionRepository(db, { now = () => new Date() } = {}) {
  const getProfileStatement = db.prepare(`
    SELECT profile_json, targets_json
    FROM nutrition_profiles
    WHERE user_id = ?
  `);
  const putProfileStatement = db.prepare(`
    INSERT INTO nutrition_profiles (user_id, profile_json, targets_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      profile_json = excluded.profile_json,
      targets_json = excluded.targets_json,
      updated_at = excluded.updated_at
  `);
  const createMealStatement = db.prepare(`
    INSERT INTO nutrition_meals
      (id, user_id, local_date, eaten_at, payload_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const listMealsStatement = db.prepare(`
    SELECT payload_json
    FROM nutrition_meals
    WHERE user_id = ? AND local_date = ?
    ORDER BY eaten_at, id
    LIMIT ?
  `);
  const listMealsForReviewStatement = db.prepare(`
    SELECT payload_json
    FROM nutrition_meals
    WHERE user_id = ? AND local_date = ?
    ORDER BY eaten_at, id
    LIMIT ?
  `);
  const updateMealStatement = db.prepare(`
    UPDATE nutrition_meals
    SET local_date = ?, eaten_at = ?, payload_json = ?, updated_at = ?
    WHERE user_id = ? AND id = ?
  `);
  const deleteMealStatement = db.prepare(`
    DELETE FROM nutrition_meals WHERE user_id = ? AND id = ?
  `);
  const createDailyReviewStatement = db.prepare(`
    INSERT OR IGNORE INTO nutrition_daily_reviews
      (user_id, local_date, source_hash, review_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const getDailyReviewStatement = db.prepare(`
    SELECT source_hash, review_json, created_at
    FROM nutrition_daily_reviews
    WHERE user_id = ? AND local_date = ?
  `);
  const claimAiUsageStatement = db.prepare(`
    INSERT INTO nutrition_ai_usage
      (user_id, usage_date, operation, used_count, updated_at)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(user_id, usage_date, operation) DO UPDATE SET
      used_count = nutrition_ai_usage.used_count + 1,
      updated_at = excluded.updated_at
    WHERE nutrition_ai_usage.used_count < ?
  `);

  return {
    getProfile(userId) {
      const row = getProfileStatement.get(userId);
      if (!row) return null;
      return {
        profile: JSON.parse(row.profile_json),
        targets: JSON.parse(row.targets_json)
      };
    },

    putProfile(userId, profile, targets) {
      putProfileStatement.run(
        userId,
        JSON.stringify(profile),
        JSON.stringify(targets),
        now().toISOString()
      );
      return { profile, targets };
    },

    createMeal(userId, meal) {
      const timestamp = now().toISOString();
      createMealStatement.run(
        meal.id, userId, meal.localDate, meal.eatenAt,
        JSON.stringify(meal), timestamp, timestamp
      );
      return meal;
    },

    listMeals(userId, localDate) {
      const rows = listMealsStatement.all(userId, localDate, MAX_LISTED_MEALS_PER_DAY + 1);
      return {
        meals: rows
          .slice(0, MAX_LISTED_MEALS_PER_DAY)
          .map(row => JSON.parse(row.payload_json)),
        limit: MAX_LISTED_MEALS_PER_DAY,
        truncated: rows.length > MAX_LISTED_MEALS_PER_DAY
      };
    },

    listMealsForReview(userId, localDate) {
      const rows = listMealsForReviewStatement.all(
        userId, localDate, MAX_DAILY_REVIEW_MEALS + 1
      );
      return {
        meals: rows.slice(0, MAX_DAILY_REVIEW_MEALS).map(row => JSON.parse(row.payload_json)),
        overflow: rows.length > MAX_DAILY_REVIEW_MEALS,
        limit: MAX_DAILY_REVIEW_MEALS
      };
    },

    updateMeal(userId, id, meal) {
      const result = updateMealStatement.run(
        meal.localDate, meal.eatenAt, JSON.stringify(meal), now().toISOString(), userId, id
      );
      return result.changes ? meal : null;
    },

    deleteMeal(userId, id) {
      return deleteMealStatement.run(userId, id).changes > 0;
    },

    createDailyReview(userId, localDate, sourceHash, review) {
      const result = createDailyReviewStatement.run(
        userId, localDate, sourceHash, JSON.stringify(review), now().toISOString()
      );
      return result.changes ? review : null;
    },

    getDailyReview(userId, localDate) {
      const row = getDailyReviewStatement.get(userId, localDate);
      if (!row) return null;
      return {
        sourceHash: row.source_hash,
        review: JSON.parse(row.review_json),
        createdAt: row.created_at
      };
    },

    claimAiUsage(userId, operation, usageDate, limit) {
      const boundedLimit = Math.floor(Number(limit));
      if (!['photo', 'review'].includes(operation) || !/^\d{4}-\d{2}-\d{2}$/.test(usageDate)
        || !Number.isInteger(boundedLimit) || boundedLimit < 1) return false;
      return claimAiUsageStatement.run(
        userId, usageDate, operation, now().toISOString(), boundedLimit
      ).changes > 0;
    }
  };
}
