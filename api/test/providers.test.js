import assert from 'node:assert/strict';
import test from 'node:test';

function openAiJsonResponse(analysis, model = 'gpt-5.6-luna') {
  return new Response(JSON.stringify({
    id: 'resp_1', object: 'response', created_at: 1787616000, status: 'completed',
    background: false, error: null, incomplete_details: null, instructions: null,
    max_output_tokens: 1200, model, parallel_tool_calls: true,
    previous_response_id: null, prompt_cache_key: null,
    reasoning: { effort: null, summary: null }, safety_identifier: null,
    service_tier: 'default', store: false, temperature: 1,
    text: { format: { type: 'json_schema' }, verbosity: 'medium' },
    tool_choice: 'auto', tools: [], top_logprobs: 0, top_p: 1,
    truncation: 'disabled', usage: {
      input_tokens: 100, input_tokens_details: { cached_tokens: 0 },
      output_tokens: 60, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 160
    }, user: null, metadata: {},
    output: [{
      id: 'msg_1', type: 'message', status: 'completed', role: 'assistant',
      content: [{ type: 'output_text', annotations: [], logprobs: [], text: JSON.stringify(analysis) }]
    }]
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

test('FoodData Central search normalizes kcal and macros per 100 grams', async () => {
  let providerModule = null;
  try { providerModule = await import('../src/providers/food-data-central.js'); } catch {}
  assert.equal(typeof providerModule?.createFoodDataCentralClient, 'function');

  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response(JSON.stringify({
      totalHits: 1,
      currentPage: 1,
      totalPages: 1,
      foods: [{
        fdcId: 171705,
        description: 'Oatmeal, cooked',
        dataType: 'Foundation',
        foodCode: '',
        foodNutrients: [
          { nutrientId: 1008, nutrientName: 'Energy', unitName: 'KCAL', value: 71 },
          { nutrientId: 1003, nutrientName: 'Protein', unitName: 'G', value: 2.54 },
          { nutrientId: 1004, nutrientName: 'Total lipid (fat)', unitName: 'G', value: 1.52 },
          { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', unitName: 'G', value: 12 }
        ]
      }],
      aggregations: {}
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const client = providerModule.createFoodDataCentralClient({ apiKey: 'test-key', fetchImpl });
  const result = await client.search('cooked oatmeal');

  assert.deepEqual(result, [{
    fdcId: 171705,
    name: 'Oatmeal, cooked',
    nutrientsPer100g: { kcal: 71, proteinG: 2.54, fatG: 1.52, carbsG: 12 }
  }]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options?.signal instanceof AbortSignal, true);
});

test('Open Food Facts lookup returns a normalized barcode product', async () => {
  let providerModule = null;
  try { providerModule = await import('../src/providers/open-food-facts.js'); } catch {}
  assert.equal(typeof providerModule?.createOpenFoodFactsClient, 'function');

  const fetchImpl = async () => new Response(JSON.stringify({
    code: '4601234567890',
    status: 1,
    status_verbose: 'product found',
    product: {
      code: '4601234567890',
      product_name: 'Творог 5%',
      product_name_ru: 'Творог 5%',
      brands: 'Пример',
      quantity: '200 g',
      serving_size: '100 g',
      nutriments: {
        'energy-kcal_100g': 121,
        proteins_100g: 17,
        fat_100g: 5,
        carbohydrates_100g: 3
      }
    }
  }), { status: 200, headers: { 'content-type': 'application/json' } });

  const client = providerModule.createOpenFoodFactsClient({
    fetchImpl,
    userAgent: 'MyGym/1.0 (admin@example.test)'
  });

  assert.deepEqual(await client.lookupBarcode('4601234567890'), {
    barcode: '4601234567890',
    name: 'Творог 5%',
    brand: 'Пример',
    quantity: '200 g',
    servingSize: '100 g',
    nutrientsPer100g: { kcal: 121, proteinG: 17, fatG: 5, carbsG: 3 }
  });
});

test('OpenAI photo analysis uses Luna, high image detail, structured output, and store false', async () => {
  let providerModule = null;
  try { providerModule = await import('../src/providers/openai-nutrition.js'); } catch {}
  assert.equal(typeof providerModule?.createOpenAiNutritionClient, 'function');

  const requests = [];
  const analysis = {
    overallConfidence: 0.9,
    items: [{
      name: 'Овсяная каша', searchQuery: 'oatmeal cooked', estimatedGrams: 250,
      confidence: 0.9, preparation: 'варёная', alternatives: [], warnings: []
    }],
    warnings: []
  };
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), options, body: JSON.parse(options.body) });
    return openAiJsonResponse(analysis);
  };

  const client = providerModule.createOpenAiNutritionClient({ apiKey: 'test-key', fetchImpl });
  assert.deepEqual(await client.analyzePhoto({
    base64: Buffer.from('image').toString('base64'), mimeType: 'image/jpeg',
    hint: 'завтрак', knownWeightG: 250, locale: 'ru'
  }), { ...analysis, model: 'gpt-5.6-luna' });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.openai.com/v1/responses');
  assert.equal(requests[0].body.model, 'gpt-5.6-luna');
  assert.equal(requests[0].body.store, false);
  assert.equal(requests[0].body.text.format.type, 'json_schema');
  assert.equal(requests[0].body.input[0].content[1].detail, 'high');
  assert.match(requests[0].body.input[0].content[1].image_url, /^data:image\/jpeg;base64,/);
  assert.match(requests[0].body.input[0].content[0].text, /untrusted data/i);
});

test('OpenAI nutrition operations share a normalized custom base URL', async () => {
  const { createOpenAiNutritionClient } = await import('../src/providers/openai-nutrition.js');
  const urls = [];
  const photo = {
    overallConfidence: 0.9,
    items: [{
      name: 'Овсяная каша', searchQuery: 'oatmeal cooked', estimatedGrams: 250,
      confidence: 0.9, preparation: 'варёная', alternatives: [], warnings: []
    }],
    warnings: []
  };
  const review = {
    summary: 'День сбалансирован.',
    suggestions: ['Добавьте овощи.', 'Сохраните режим питания.'],
    warnings: [],
    disclaimer: 'Это справочная информация, не медицинская рекомендация.'
  };
  const fetchImpl = async (url, options) => {
    urls.push(String(url));
    const body = JSON.parse(options.body);
    return openAiJsonResponse(
      body.text.format.name === 'meal_photo_analysis' ? photo : review,
      body.model
    );
  };
  const client = createOpenAiNutritionClient({
    apiKey: 'test-key',
    baseUrl: 'https://ai.example.test/v1/',
    fetchImpl
  });

  await client.analyzePhoto({
    base64: Buffer.from('image').toString('base64'),
    mimeType: 'image/jpeg',
    locale: 'ru'
  });
  await client.reviewDay({ localDate: '2026-08-26', meals: [] });

  assert.deepEqual(urls, [
    'https://ai.example.test/v1/responses',
    'https://ai.example.test/v1/responses'
  ]);
});

test('OpenAI nutrition rejects plaintext non-loopback base URLs', async () => {
  const { createOpenAiNutritionClient } = await import('../src/providers/openai-nutrition.js');

  assert.throws(
    () => createOpenAiNutritionClient({ apiKey: 'test-key', baseUrl: 'http://ai.example.test/v1' }),
    error => error?.code === 'OPENAI_INVALID_BASE_URL'
  );
  assert.doesNotThrow(() => createOpenAiNutritionClient({
    apiKey: 'test-key',
    baseUrl: 'http://127.0.0.1:9000/v1'
  }));
});

test('OpenAI photo analysis retries once with Terra when Luna confidence is below 0.65', async () => {
  const { createOpenAiNutritionClient } = await import('../src/providers/openai-nutrition.js');
  const models = [];
  const base = {
    items: [{
      name: 'Сложное блюдо', searchQuery: 'mixed dish', estimatedGrams: 300,
      confidence: 0.5, preparation: '', alternatives: [], warnings: ['Состав неясен']
    }],
    warnings: ['Нужно подтверждение']
  };
  const fetchImpl = async (_url, options) => {
    const { model } = JSON.parse(options.body);
    models.push(model);
    return openAiJsonResponse({ ...base, overallConfidence: model.endsWith('luna') ? 0.5 : 0.82 }, model);
  };
  const client = createOpenAiNutritionClient({ apiKey: 'test-key', fetchImpl });

  const result = await client.analyzePhoto({
    base64: Buffer.from('image').toString('base64'), mimeType: 'image/jpeg', locale: 'ru'
  });

  assert.deepEqual(models, ['gpt-5.6-luna', 'gpt-5.6-terra']);
  assert.equal(result.model, 'gpt-5.6-terra');
  assert.equal(result.overallConfidence, 0.82);
});

test('OpenAI photo analysis retries with Terra when any identified item is below 0.65 confidence', async () => {
  const { createOpenAiNutritionClient } = await import('../src/providers/openai-nutrition.js');
  const models = [];
  const fetchImpl = async (_url, options) => {
    const { model } = JSON.parse(options.body);
    models.push(model);
    const confidence = model.endsWith('luna') ? 0.5 : 0.85;
    return openAiJsonResponse({
      overallConfidence: 0.9,
      items: [{
        name: 'Соус', searchQuery: 'mixed sauce', estimatedGrams: 50,
        confidence, preparation: '', alternatives: [], warnings: []
      }], warnings: []
    }, model);
  };
  const client = createOpenAiNutritionClient({ apiKey: 'test-key', fetchImpl });

  const result = await client.analyzePhoto({
    base64: Buffer.from('image').toString('base64'), mimeType: 'image/jpeg', locale: 'ru'
  });

  assert.deepEqual(models, ['gpt-5.6-luna', 'gpt-5.6-terra']);
  assert.equal(result.model, 'gpt-5.6-terra');
});

test('OpenAI photo analysis retries once with Terra when Luna output violates the schema', async () => {
  const { createOpenAiNutritionClient } = await import('../src/providers/openai-nutrition.js');
  const models = [];
  const valid = {
    overallConfidence: 0.8,
    items: [{
      name: 'Суп', searchQuery: 'vegetable soup', estimatedGrams: 350,
      confidence: 0.8, preparation: 'варёный', alternatives: [], warnings: []
    }],
    warnings: []
  };
  const fetchImpl = async (_url, options) => {
    const { model } = JSON.parse(options.body);
    models.push(model);
    return openAiJsonResponse(model.endsWith('luna') ? { invalid: true } : valid, model);
  };
  const client = createOpenAiNutritionClient({ apiKey: 'test-key', fetchImpl });

  const result = await client.analyzePhoto({
    base64: Buffer.from('image').toString('base64'), mimeType: 'image/jpeg', locale: 'ru'
  });

  assert.deepEqual(models, ['gpt-5.6-luna', 'gpt-5.6-terra']);
  assert.equal(result.model, 'gpt-5.6-terra');
});

test('OpenAI runtime validation mirrors schema string and additional-property limits', async () => {
  const { createOpenAiNutritionClient } = await import('../src/providers/openai-nutrition.js');
  const models = [];
  const valid = {
    overallConfidence: 0.8,
    items: [{
      name: 'Суп', searchQuery: 'vegetable soup', estimatedGrams: 350,
      confidence: 0.8, preparation: 'варёный', alternatives: [], warnings: []
    }],
    warnings: []
  };
  const fetchImpl = async (_url, options) => {
    const { model } = JSON.parse(options.body);
    models.push(model);
    return openAiJsonResponse(model.endsWith('luna')
      ? { ...valid, items: [{ ...valid.items[0], hidden: 'unexpected', name: 'x'.repeat(121) }] }
      : valid, model);
  };
  const client = createOpenAiNutritionClient({ apiKey: 'test-key', fetchImpl });

  const result = await client.analyzePhoto({
    base64: Buffer.from('image').toString('base64'), mimeType: 'image/jpeg', locale: 'ru'
  });

  assert.deepEqual(models, ['gpt-5.6-luna', 'gpt-5.6-terra']);
  assert.equal(result.model, 'gpt-5.6-terra');
});

test('OpenAI photo analysis retries once with Terra when Luna is temporarily unavailable', async () => {
  const { createOpenAiNutritionClient } = await import('../src/providers/openai-nutrition.js');
  const models = [];
  const valid = {
    overallConfidence: 0.82,
    items: [{
      name: 'Салат', searchQuery: 'vegetable salad', estimatedGrams: 220,
      confidence: 0.82, preparation: '', alternatives: [], warnings: []
    }],
    warnings: []
  };
  const fetchImpl = async (_url, options) => {
    const { model } = JSON.parse(options.body);
    models.push(model);
    return model.endsWith('luna')
      ? { ok: false, status: 503, json: async () => ({}) }
      : openAiJsonResponse(valid, model);
  };
  const client = createOpenAiNutritionClient({ apiKey: 'test-key', fetchImpl });

  const result = await client.analyzePhoto({
    base64: Buffer.from('image').toString('base64'), mimeType: 'image/jpeg', locale: 'ru'
  });

  assert.deepEqual(models, ['gpt-5.6-luna', 'gpt-5.6-terra']);
  assert.equal(result.model, 'gpt-5.6-terra');
});

test('OpenAI daily review sends normalized context only and returns two or three suggestions', async () => {
  const { createOpenAiNutritionClient } = await import('../src/providers/openai-nutrition.js');
  const requests = [];
  const review = {
    summary: 'Белка достаточно, овощей мало.',
    suggestions: ['Добавьте овощи к ужину.', 'Сохраните текущий уровень белка.'],
    warnings: [],
    disclaimer: 'Информация носит справочный характер и не является медицинской рекомендацией.'
  };
  const fetchImpl = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return openAiJsonResponse(review);
  };
  const client = createOpenAiNutritionClient({ apiKey: 'test-key', fetchImpl });

  assert.deepEqual(await client.reviewDay({
    localDate: '2026-08-25', targets: { kcal: 2200, proteinG: 130 },
    meals: [{ totals: { kcal: 1900, proteinG: 125 } }],
    activity: { workouts: 1, bodyweightKg: 80 },
    preferences: { allergies: ['арахис'] }
  }), { ...review, model: 'gpt-5.6-luna' });

  assert.equal(requests[0].store, false);
  assert.equal(requests[0].text.format.name, 'nutrition_daily_review');
  assert.equal(requests[0].input[0].content.every(item => item.type === 'input_text'), true);
  assert.doesNotMatch(JSON.stringify(requests[0]), /image_url|input_image/);
  assert.match(requests[0].input[0].content[0].text, /untrusted data/i);
});

test('OpenAI daily review retries invalid Luna output once with Terra', async () => {
  const { createOpenAiNutritionClient } = await import('../src/providers/openai-nutrition.js');
  const models = [];
  const valid = {
    summary: 'День можно немного улучшить.',
    suggestions: ['Добавьте овощи.', 'Пейте воду.'], warnings: [],
    disclaimer: 'Это справочная информация, не медицинская рекомендация.'
  };
  const fetchImpl = async (_url, options) => {
    const { model } = JSON.parse(options.body);
    models.push(model);
    return openAiJsonResponse(model.endsWith('luna') ? { invalid: true } : valid, model);
  };
  const client = createOpenAiNutritionClient({ apiKey: 'test-key', fetchImpl });

  const result = await client.reviewDay({ localDate: '2026-08-25', meals: [] });

  assert.deepEqual(models, ['gpt-5.6-luna', 'gpt-5.6-terra']);
  assert.equal(result.model, 'gpt-5.6-terra');
});

test('OpenAI daily review retries Terra after a retryable Luna upstream response', async () => {
  const { createOpenAiNutritionClient } = await import('../src/providers/openai-nutrition.js');
  const models = [];
  const valid = {
    summary: 'День сбалансирован.',
    suggestions: ['Добавьте овощи.', 'Сохраните режим питания.'], warnings: [],
    disclaimer: 'Это справочная информация, не медицинская рекомендация.'
  };
  const fetchImpl = async (_url, options) => {
    const { model } = JSON.parse(options.body);
    models.push(model);
    return model.endsWith('luna')
      ? { ok: false, status: 429, json: async () => ({}) }
      : openAiJsonResponse(valid, model);
  };
  const client = createOpenAiNutritionClient({ apiKey: 'test-key', fetchImpl });

  const result = await client.reviewDay({ localDate: '2026-08-25', meals: [] });

  assert.deepEqual(models, ['gpt-5.6-luna', 'gpt-5.6-terra']);
  assert.equal(result.model, 'gpt-5.6-terra');
});
