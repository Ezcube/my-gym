# Nutrition Source Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calculate an editable calorie and macro draft without USDA by using Open Food Facts and then a clearly labelled AI estimate.

**Architecture:** Extend the existing Open Food Facts provider with bounded full-text search, extend the existing structured AI photo result with a per-100-gram estimate, and remove FoodData Central from runtime/configuration. Preserve the existing explicit confirmation gate and carry source metadata into the draft editor.

**Tech Stack:** Node.js 22, native `fetch`, `node:test`, React, Zustand, Vitest.

---

### Task 1: Open Food Facts text search

**Files:**
- Modify: `api/test/providers.test.js`
- Modify: `api/src/providers/open-food-facts.js`

- [x] **Step 1: Write the failing provider test**

Add a test whose fake Search-a-licious response contains one matching product and one unrelated product. Assert that `search('oatmeal cooked', { limit: 1 })` returns only the matching normalized record, uses `/search`, sends the configured User-Agent, and calculates missing kcal from macros.

- [x] **Step 2: Run the provider test and verify RED**

Run: `node --disable-warning=ExperimentalWarning --test test/providers.test.js`

Expected: FAIL because `client.search` does not exist.

- [x] **Step 3: Implement the provider method**

Add shared nutrient normalization, Unicode token normalization, conservative token-overlap matching, bounded `page_size`, and a `search()` method using `https://search.openfoodfacts.org/search` with fields `code,product_name,product_name_ru,generic_name,brands,nutriments`.

- [x] **Step 4: Run the provider test and verify GREEN**

Run: `node --disable-warning=ExperimentalWarning --test test/providers.test.js`

Expected: PASS.

### Task 2: AI estimate and source chain

**Files:**
- Modify: `api/test/providers.test.js`
- Modify: `api/test/nutrition-service.test.js`
- Modify: `api/src/providers/openai-nutrition.js`
- Modify: `api/src/nutrition/service.js`
- Modify: `api/server.js`
- Delete: `api/src/providers/food-data-central.js`
- Modify: `.env.example`
- Modify: `docs/PRODUCTION.md`

- [x] **Step 1: Write failing schema and service tests**

Update photo fixtures with `estimatedNutrientsPer100g`. Add service tests for these exact outcomes: a valid Open Food Facts match wins; Open Food Facts failure uses the AI estimate with `nutritionSource: 'ai-estimate'` and `nutritionEstimated: true`; invalid AI nutrient data keeps the manual draft.

- [x] **Step 2: Run targeted tests and verify RED**

Run: `node --disable-warning=ExperimentalWarning --test test/providers.test.js test/nutrition-service.test.js`

Expected: FAIL because the schema and source chain do not yet expose the new fields.

- [x] **Step 3: Implement the minimal chain**

Require and runtime-validate the bounded four-field AI nutrient estimate. Resolve each item in the order Open Food Facts → AI, calculate portion totals once, and preserve manual behavior if both are unusable. Pass the existing Open Food Facts client into the service, remove the FoodData Central provider/import/configuration, and remove `FDC_API_KEY` from examples and production documentation.

- [x] **Step 4: Run targeted API tests and verify GREEN**

Run: `npm run test:nutrition`

Expected: PASS with no warnings or unhandled rejections.

### Task 3: Visible nutrition source

**Files:**
- Modify: `frontend/src/store/useNutrition.test.js`
- Modify: `frontend/src/views/Nutrition.test.jsx`
- Modify: `frontend/src/store/useNutrition.js`
- Modify: `frontend/src/views/Nutrition.jsx`
- Modify: `frontend/src/lib/nutrition-locales.js`

- [x] **Step 1: Write failing store and view assertions**

Assert that draft normalization preserves `nutritionSource` and `nutritionEstimated`, and that the editor renders `AI estimate — check values` for AI-derived values.

- [x] **Step 2: Run the two frontend tests and verify RED**

Run: `npm test -- --run src/store/useNutrition.test.js src/views/Nutrition.test.jsx`

Expected: FAIL because source metadata is currently discarded and not rendered.

- [x] **Step 3: Implement source preservation and labels**

Preserve the two source fields in `draftItem`, render database/AI source labels below each food name, and add English/Russian nutrition translations. Do not change confirmation behavior.

- [x] **Step 4: Run the two frontend tests and verify GREEN**

Run: `npm test -- --run src/store/useNutrition.test.js src/views/Nutrition.test.jsx`

Expected: PASS.

### Task 4: Release and production proof

**Files:**
- Modify: only files above and this plan

- [x] **Step 1: Run scoped release checks**

Run API nutrition tests, the two frontend tests, frontend locale/source-string checks, and `git diff --check`.

- [ ] **Step 2: Commit and push the scoped change**

Commit only the fallback implementation, tests, translations, spec, and plan. Push the checked commit to the configured public repository.

- [ ] **Step 3: Deploy only My Gym services**

Activate the checked commit in `/opt/my-gym`, preserve `/opt/my-gym/data`, make a root-only backup of `/opt/my-gym/.env`, remove only the `FDC_API_KEY` line, rebuild the `api` and `web` services, and verify rollback metadata.

- [ ] **Step 4: Verify production**

Check `docker compose ps`, `/api/health`, the exact public host, and one authenticated photo-analysis result showing non-zero totals plus the expected source without logging image bytes, credentials, or API keys.
