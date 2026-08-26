# OpenAI-Compatible Nutrition Endpoint Design

**Status:** approved in chat on 2026-08-26

## Goal

Route the two My Gym nutrition AI operations—meal photo analysis and daily
nutrition review—through the existing OpenAI-compatible endpoint at
`https://147.45.248.214/v1`, while keeping the official OpenAI API as the
portable default and keeping all credentials out of Git, logs, and chat.

## Scope

This change covers only the server-side nutrition AI client. It does not change
barcode lookup, FoodData Central, Health Connect synchronization, frontend
request formats, user quotas, prompt-injection defenses, structured-output
schemas, or the requirement that photo results remain unconfirmed drafts.

The public `gym.innu.ru` maintenance response remains enabled until the first
administrator is created through the existing IP-allowlisted bootstrap process.

## Current State

`api/src/providers/openai-nutrition.js` currently sends both operations to the
hard-coded URL `https://api.openai.com/v1/responses`. `api/server.js` passes the
API key and the primary/fallback model names but has no base-URL setting.

The target endpoint was verified without a secret: TLS validation succeeds,
`GET /healthz` returns `200`, and unauthenticated `GET /v1/models` returns `401`
with Bearer authentication required.

## Configuration Contract

Add a server-only environment variable:

```dotenv
OPENAI_BASE_URL=https://api.openai.com/v1
```

The default preserves existing installations. Production will set:

```dotenv
OPENAI_BASE_URL=https://147.45.248.214/v1
```

The client normalizes one trailing slash and constructs the request URL as
`<baseUrl>/responses`. The base URL must be an absolute HTTP(S) URL. Plain HTTP
is accepted only for loopback development addresses; non-loopback endpoints
must use HTTPS so the Bearer key cannot be sent in clear text.

`OPENAI_API_KEY`, `OPENAI_NUTRITION_MODEL_PRIMARY`, and
`OPENAI_NUTRITION_MODEL_FALLBACK` keep their existing meanings. The deployment
preflight queries authenticated `GET /v1/models`. If Terra is unavailable, the
fallback model is set to Luna rather than allowing a predictable fallback 404.

## Application Data Flow

1. `api/server.js` reads `OPENAI_BASE_URL` and passes it to
   `createOpenAiNutritionClient`.
2. The provider validates and normalizes the base URL once when the client is
   constructed.
3. Photo analysis and daily review use the same normalized `/responses` URL,
   Bearer header, timeout, `store: false`, schema, and fallback logic.
4. Provider failures continue to be mapped by the nutrition router to the safe
   `NUTRITION_AI_UNAVAILABLE` response; upstream bodies and credentials are not
   returned to clients.

An invalid production base URL is a fail-closed startup error. A valid but
unavailable upstream remains a retryable nutrition-AI failure and does not
affect manual meal tracking, barcode lookup, or Health Connect data.

## Secret Transfer and Production Update

The existing key remains the source of truth in the root-only file
`/etc/codex-ui/api-key` on the AI server. The deployment process uses the
already-authorized SSH credential without printing or embedding its value in a
command line, patch, Git object, or Codex message.

The key is transferred through restricted temporary files, checked only for
being non-empty, written atomically to `/opt/my-gym/.env`, and removed from all
temporary locations. The target `.env` retains root ownership and mode `0600`.
Only boolean checks such as `OPENAI_API_KEY=SET` may appear in verification
output.

Before the update, save a root-only `.env` backup and tag the currently running
API image for rollback. Rebuild and restart only the `api` Compose service; the
web container, data directory, host nginx, and unrelated VPS services remain
unchanged.

## Verification

Automated verification follows test-first development:

1. Add a provider test proving a custom base URL is used by both photo analysis
   and daily review; observe the test fail against the hard-coded URL.
2. Add tests for trailing-slash normalization, the official default, and
   rejection of non-loopback plain HTTP.
3. Implement the minimal provider and server wiring, then run the targeted
   provider test and release-contract test.

Production verification must prove each boundary separately:

1. Authenticated `GET /v1/models` from the My Gym VPS returns `200` and confirms
   the configured model names.
2. The rebuilt API container is healthy and has a non-empty key without printing
   it.
3. The exact `createOpenAiNutritionClient().reviewDay()` path returns a valid
   structured result through the external endpoint.
4. `http://gym.innu.ru` still redirects to HTTPS and the intentional HTTPS `503`
   maintenance response remains in place until administrator bootstrap.

## Rollback

If model discovery, build, container health, or live inference fails, restore
the previous root-only `.env`, retag the saved API image as the active image,
restart only the API service, and verify `/api/health`. Do not remove rollback
artifacts until the live provider smoke succeeds.

