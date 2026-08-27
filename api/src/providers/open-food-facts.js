function finiteOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function nutrientsPer100g(product) {
  const nutrients = product?.nutriments || {};
  const proteinG = finiteOrZero(nutrients.proteins_100g);
  const fatG = finiteOrZero(nutrients.fat_100g);
  const carbsG = finiteOrZero(nutrients.carbohydrates_100g);
  const reportedKcal = finiteOrZero(nutrients['energy-kcal_100g']);
  return {
    kcal: reportedKcal || round2(proteinG * 4 + fatG * 9 + carbsG * 4),
    proteinG,
    fatG,
    carbsG
  };
}

function text(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(', ');
  return typeof value === 'string' ? value.trim() : '';
}

function tokens(value) {
  return new Set(String(value || '').normalize('NFKD').toLocaleLowerCase('en')
    .match(/[\p{L}\p{N}]{3,}/gu) || []);
}

function relevantName(query, name) {
  const queryTokens = tokens(query);
  const nameTokens = tokens(name);
  return queryTokens.size > 0 && [...queryTokens].some(token => nameTokens.has(token));
}

function normalizedProduct(product, fallbackCode = '') {
  const name = text(product?.product_name_ru) || text(product?.product_name)
    || text(product?.generic_name);
  const nutrients = nutrientsPer100g(product);
  if (!name || !Object.values(nutrients).some(value => value > 0)) return null;
  return {
    barcode: text(product?.code) || fallbackCode,
    name,
    brand: text(product?.brands),
    nutrientsPer100g: nutrients
  };
}

export function createOpenFoodFactsClient({
  fetchImpl = fetch,
  userAgent = 'MyGym/1.0 (https://gym.innu.ru)',
  timeoutMs = 8000
} = {}) {
  return {
    async lookupBarcode(barcode) {
      const code = String(barcode || '').trim();
      if (!/^\d{8,14}$/.test(code)) return null;
      const fields = [
        'code', 'product_name', 'product_name_ru', 'brands', 'quantity',
        'serving_size', 'nutriments'
      ].join(',');
      const url = new URL(`https://world.openfoodfacts.org/api/v2/product/${code}.json`);
      url.searchParams.set('fields', fields);
      const response = await fetchImpl(url, {
        headers: { Accept: 'application/json', 'User-Agent': userAgent },
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (response.status === 404) return null;
      if (!response.ok) throw Object.assign(new Error('Open Food Facts request failed'), {
        code: 'OFF_UPSTREAM_ERROR', status: response.status
      });
      const payload = await response.json();
      if (payload.status !== 1 || !payload.product) return null;
      const product = payload.product;
      const normalized = normalizedProduct(product, code);
      if (!normalized) return null;
      return {
        ...normalized,
        quantity: String(product.quantity || '').trim(),
        servingSize: String(product.serving_size || '').trim()
      };
    },

    async search(query, { limit = 3 } = {}) {
      const normalizedQuery = String(query || '').trim();
      if (!normalizedQuery) return [];
      const resultLimit = Math.max(1, Math.min(10, Number(limit) || 3));
      const url = new URL('https://search.openfoodfacts.org/search');
      url.searchParams.set('q', normalizedQuery);
      url.searchParams.set('fields', [
        'code', 'product_name', 'product_name_ru', 'generic_name', 'brands', 'nutriments'
      ].join(','));
      url.searchParams.set('page_size', String(Math.min(30, resultLimit * 6)));
      const response = await fetchImpl(url, {
        headers: { Accept: 'application/json', 'User-Agent': userAgent },
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) throw Object.assign(new Error('Open Food Facts search failed'), {
        code: 'OFF_UPSTREAM_ERROR', status: response.status
      });
      const payload = await response.json();
      const products = Array.isArray(payload.hits) ? payload.hits
        : (Array.isArray(payload.products) ? payload.products : []);
      return products.map(product => normalizedProduct(product))
        .filter(product => product && relevantName(normalizedQuery, product.name))
        .slice(0, resultLimit);
    }
  };
}
