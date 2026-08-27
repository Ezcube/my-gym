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

test('Open Food Facts text search keeps a relevant product and normalizes its nutrients', async () => {
  const { createOpenFoodFactsClient } = await import('../src/providers/open-food-facts.js');
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response(JSON.stringify({
      hits: [{
        code: '1111111111111',
        product_name: 'Cookies',
        brands: ['Oatmeal'],
        nutriments: {
          'energy-kcal_100g': 480,
          proteins_100g: 6,
          fat_100g: 22,
          carbohydrates_100g: 65
        }
      }, {
        code: '2222222222222',
        product_name: 'Cooked oatmeal',
        brands: ['Example'],
        nutriments: {
          proteins_100g: 2.5,
          fat_100g: 1.8,
          carbohydrates_100g: 11.5
        }
      }],
      page: 1,
      page_size: 6,
      page_count: 2
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const client = createOpenFoodFactsClient({
    fetchImpl,
    userAgent: 'MyGym/1.0 (admin@example.test)'
  });

  assert.deepEqual(await client.search('oatmeal cooked', { limit: 1 }), [{
    barcode: '2222222222222',
    name: 'Cooked oatmeal',
    brand: 'Example',
    nutrientsPer100g: { kcal: 72.2, proteinG: 2.5, fatG: 1.8, carbsG: 11.5 }
  }]);
  assert.equal(requests.length, 1);
  const url = new URL(requests[0].url);
  assert.equal(url.origin + url.pathname, 'https://search.openfoodfacts.org/search');
  assert.equal(url.searchParams.get('q'), 'oatmeal cooked');
  assert.equal(requests[0].options.headers['User-Agent'], 'MyGym/1.0 (admin@example.test)');
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
      estimatedNutrientsPer100g: { kcal: 71, proteinG: 2.54, fatG: 1.52, carbsG: 12 },
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

test('OpenAI photo analysis requires a bounded per-100g nutrition estimate for fallback', async () => {
  const { createOpenAiNutritionClient } = await import('../src/providers/openai-nutrition.js');
  const requests = [];
  const analysis = {
    overallConfidence: 0.88,
    items: [{
      name: 'Эчпочмак', searchQuery: 'echpochmak meat pastry', estimatedGrams: 180,
      estimatedNutrientsPer100g: { kcal: 265, proteinG: 10, fatG: 15, carbsG: 22 },
      confidence: 0.88, preparation: 'печёный', alternatives: [], warnings: []
    }],
    warnings: []
  };
  const fetchImpl = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return openAiJsonResponse(analysis);
  };
  const client = createOpenAiNutritionClient({ apiKey: 'test-key', fetchImpl });

  assert.deepEqual(await client.analyzePhoto({
    base64: Buffer.from('image').toString('base64'), mimeType: 'image/jpeg', locale: 'ru'
  }), { ...analysis, model: 'gpt-5.6-luna' });
  const itemSchema = requests[0].text.format.schema.properties.items.items;
  assert.equal(itemSchema.required.includes('estimatedNutrientsPer100g'), true);
  assert.deepEqual(itemSchema.properties.estimatedNutrientsPer100g.required, [
    'kcal', 'proteinG', 'fatG', 'carbsG'
  ]);
});

test('OpenAI nutrition operations share a normalized custom base URL', async () => {
  const { createOpenAiNutritionClient } = await import('../src/providers/openai-nutrition.js');
  const urls = [];
  const photo = {
    overallConfidence: 0.9,
    items: [{
      name: 'Овсяная каша', searchQuery: 'oatmeal cooked', estimatedGrams: 250,
      estimatedNutrientsPer100g: { kcal: 71, proteinG: 2.54, fatG: 1.52, carbsG: 12 },
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

test('OpenAI nutrition accepts a completed SSE response from a compatible endpoint', async () => {
  const { createOpenAiNutritionClient } = await import('../src/providers/openai-nutrition.js');
  const analysis = {
    overallConfidence: 0.9,
    items: [{
      name: 'Овсяная каша', searchQuery: 'oatmeal cooked', estimatedGrams: 250,
      estimatedNutrientsPer100g: { kcal: 71, proteinG: 2.54, fatG: 1.52, carbsG: 12 },
      confidence: 0.9, preparation: 'варёная', alternatives: [], warnings: []
    }],
    warnings: []
  };
  const fetchImpl = async () => {
    const payload = await openAiJsonResponse(analysis).json();
    return new Response([
      'event: response.created',
      `data: ${JSON.stringify({ type: 'response.created', response: { status: 'in_progress' } })}`,
      '',
      'event: response.completed',
      `data: ${JSON.stringify({ type: 'response.completed', response: payload })}`,
      '',
      ''
    ].join('\n'), { status: 200 });
  };
  const client = createOpenAiNutritionClient({
    apiKey: 'test-key',
    baseUrl: 'https://ai.example.test/v1',
    fetchImpl
  });

  assert.deepEqual(await client.analyzePhoto({
    base64: Buffer.from('image').toString('base64'),
    mimeType: 'image/jpeg',
    locale: 'ru'
  }), { ...analysis, model: 'gpt-5.6-luna' });
});

test('OpenAI nutrition rebuilds an empty completed SSE output from output_item.done', async () => {
  const { createOpenAiNutritionClient } = await import('../src/providers/openai-nutrition.js');
  const analysis = {
    overallConfidence: 0.9,
    items: [{
      name: 'Овсяная каша', searchQuery: 'oatmeal cooked', estimatedGrams: 250,
      estimatedNutrientsPer100g: { kcal: 71, proteinG: 2.54, fatG: 1.52, carbsG: 12 },
      confidence: 0.9, preparation: 'варёная', alternatives: [], warnings: []
    }],
    warnings: []
  };
  const fetchImpl = async () => {
    const payload = await openAiJsonResponse(analysis).json();
    return new Response([
      'event: response.output_item.done',
      `data: ${JSON.stringify({
        type: 'response.output_item.done', output_index: 0, item: payload.output[0]
      })}`,
      '',
      'event: response.completed',
      `data: ${JSON.stringify({
        type: 'response.completed', response: { ...payload, output: [] }
      })}`,
      '',
      ''
    ].join('\n'), { status: 200 });
  };
  const client = createOpenAiNutritionClient({
    apiKey: 'test-key',
    baseUrl: 'https://ai.example.test/v1',
    fetchImpl
  });

  assert.deepEqual(await client.analyzePhoto({
    base64: Buffer.from('image').toString('base64'),
    mimeType: 'image/jpeg',
    locale: 'ru'
  }), { ...analysis, model: 'gpt-5.6-luna' });
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
      estimatedNutrientsPer100g: { kcal: 180, proteinG: 8, fatG: 9, carbsG: 16 },
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
        estimatedNutrientsPer100g: { kcal: 120, proteinG: 2, fatG: 8, carbsG: 10 },
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
      estimatedNutrientsPer100g: { kcal: 45, proteinG: 2, fatG: 1.5, carbsG: 6 },
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
      estimatedNutrientsPer100g: { kcal: 45, proteinG: 2, fatG: 1.5, carbsG: 6 },
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
      estimatedNutrientsPer100g: { kcal: 55, proteinG: 2, fatG: 3, carbsG: 5 },
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
