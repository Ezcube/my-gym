# Nutrition Source Fallback Design

## Goal

Keep photo-based calorie and macro calculation useful from Russian networks without depending on USDA, and without presenting an approximate value as authoritative database data.

## Chosen approach

Photo analysis uses one ordered source chain per recognized food item:

1. Open Food Facts Search-a-licious is queried first. Only a candidate with a usable name and at least calories or one macro is accepted.
2. The structured photo-analysis response includes a bounded per-100-gram AI estimate. It is used only when Open Food Facts does not produce a usable candidate.

Every resolved item carries `nutritionSource` with either `open-food-facts` or `ai-estimate`. AI-derived values also carry `nutritionEstimated: true`. All photo results remain editable, unconfirmed drafts and require explicit user confirmation before persistence.

## Provider boundaries

`open-food-facts.js` owns barcode lookup and text search normalization. Text search uses `https://search.openfoodfacts.org/search`, sends the configured identifying User-Agent, requests only the required fields, caps the result count, and rejects products without a non-empty display name or useful nutrient data.

`openai-nutrition.js` owns the AI estimate schema and validation. Each recognized item contains `estimatedNutrientsPer100g` with finite, non-negative, bounded `kcal`, `proteinG`, `fatG`, and `carbsG` values. This adds no second AI request.

`nutrition/service.js` owns source ordering and portion totals. Provider errors are contained per item. An Open Food Facts failure must not prevent use of the AI estimate, and no source match must never make the whole photo request fail. FoodData Central, its environment variable, and its runtime client are removed.

## Matching and safety

Open Food Facts is a packaged-product database, so its top result is accepted only when normalized query/name tokens overlap. Tokens shorter than three characters are ignored. This conservative check prevents a generic query such as `oatmeal cooked` from silently accepting an unrelated cookie solely because it contains an oatmeal brand.

All returned nutrient numbers are normalized to non-negative finite values. Database entries with no positive calories or macros are skipped. The existing editable confirmation screen remains the final safety gate and displays the selected source, with AI estimates explicitly labelled as approximate.

## Error handling

- Open Food Facts error, empty result, or weak name match: continue to AI estimate.
- Missing/invalid AI estimate: keep the current manual-nutrition draft behavior.
- The response records lookup degradation without exposing upstream response bodies or secrets.

## Verification

Targeted tests cover Open Food Facts search normalization, rejection of weak matches, AI fallback, and preservation of manual drafts when all sources fail. Frontend tests cover retention and visible labelling of `nutritionSource`. A local provider smoke checks the live Search-a-licious endpoint before deployment. Production verification removes `FDC_API_KEY` from a backup-protected `.env`, checks API health, and checks an authenticated photo-analysis response without logging image data or secrets.
