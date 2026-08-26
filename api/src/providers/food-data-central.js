const NUTRIENTS = {
  1008: 'kcal',
  1003: 'proteinG',
  1004: 'fatG',
  1005: 'carbsG'
};

function nutrientsPer100g(food) {
  const out = { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 };
  for (const nutrient of food.foodNutrients || []) {
    const key = NUTRIENTS[nutrient.nutrientId];
    const value = Number(nutrient.value);
    if (key && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

export function createFoodDataCentralClient({ apiKey, fetchImpl = fetch, timeoutMs = 8000 }) {
  return {
    async search(query, { limit = 3 } = {}) {
      if (!apiKey) throw Object.assign(new Error('FoodData Central is not configured'), { code: 'FDC_NOT_CONFIGURED' });
      const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
      url.searchParams.set('api_key', apiKey);
      url.searchParams.set('query', String(query || '').trim());
      url.searchParams.set('pageSize', String(Math.max(1, Math.min(10, limit))));
      const response = await fetchImpl(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) throw Object.assign(new Error('FoodData Central request failed'), {
        code: 'FDC_UPSTREAM_ERROR', status: response.status
      });
      const payload = await response.json();
      return (payload.foods || []).slice(0, limit).map(food => ({
        fdcId: food.fdcId,
        name: food.description,
        nutrientsPer100g: nutrientsPer100g(food)
      }));
    }
  };
}
