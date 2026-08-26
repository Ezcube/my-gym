function finiteOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
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
      const nutrients = product.nutriments || {};
      return {
        barcode: String(product.code || code),
        name: String(product.product_name_ru || product.product_name || '').trim(),
        brand: String(product.brands || '').trim(),
        quantity: String(product.quantity || '').trim(),
        servingSize: String(product.serving_size || '').trim(),
        nutrientsPer100g: {
          kcal: finiteOrZero(nutrients['energy-kcal_100g']),
          proteinG: finiteOrZero(nutrients.proteins_100g),
          fatG: finiteOrZero(nutrients.fat_100g),
          carbsG: finiteOrZero(nutrients.carbohydrates_100g)
        }
      };
    }
  };
}
