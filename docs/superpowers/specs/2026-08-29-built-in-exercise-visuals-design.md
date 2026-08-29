# Built-in Exercise Visuals Replacement Design

## Goal

Replace the unavailable Gym visual images and GIF animations with an offline visual that is safe to ship with this fork, useful for every catalogue exercise, and incapable of leaving the workout screen with a broken white media panel.

The change must not alter exercise identifiers, workout plans, history, set logging, progression, or synchronized user data.

## Evidence and source decision

Production currently has no exercise assets: `media/img` and `media/gif` contain only `.license-pending`, and their `0750 root:root` permissions also prevent the nginx worker from traversing them. The media bootstrap service treats either marker as evidence that the directory is populated, skips its download, and the workout receives HTTP 403 for both `/img/...` and `/gif/...`.

The existing Gym visual files are not covered by openGym's AGPL license or the exercise metadata's MIT license. They will not be downloaded or displayed by this fork.

Two replacement catalogues were evaluated:

- wger exposes individually licensed exercise content, but an exact normalized-name comparison against the current 1,324-exercise catalogue matched 35 exercises and found an image for only 14; it did not cover the reported `barbell bench press` case;
- Free Exercise DB describes itself as public domain, but the provenance and licensing of its images are not documented clearly enough for this production use.

Neither external catalogue is part of this implementation. The replacement uses the existing body geometry derived from the MIT-licensed MuscleMap project and the current exercise-to-muscle mapping already shipped by openGym.

## Main workout visual

`Media` keeps its existing public component interface so workout and exercise-detail callers do not change. Instead of an `<img>` sourced from `/gif/` or `/img/`, it renders a dedicated exercise-target visual containing:

- the existing front and back `BodyMap` silhouettes;
- primary muscles at the strongest accent level;
- secondary muscles at a lower accent level;
- a short localized `Target muscles` label;
- the exercise's translated primary target and equipment labels when available.

The highlighted muscles receive a subtle CSS pulse so the panel still has a live visual cue without pretending to demonstrate the movement itself. The animation is disabled by the existing `prefers-reduced-motion` rule.

The existing workout minimize/expand control remains and continues to persist `gifSize`, preserving user settings and the compact workout layout. The obsolete play/pause hint and click-to-pause behavior are removed because the new visual is not a movement recording.

If the exercise has no recognized muscle mapping, the panel renders a stable dumbbell placeholder plus the available exercise metadata. A body-geometry loading failure keeps that same placeholder rather than producing an empty or broken box.

## Catalogue thumbnails

`Thumb` stops creating image requests. It renders a compact, deterministic tile using the existing dumbbell icon and the exercise's target/body-part styling. This avoids mounting hundreds of body-map SVGs in long catalogue lists while ensuring every row has a visible thumbnail.

Custom exercises and missing catalogue entries use the same compact fallback.

## Media and licensing cleanup

The web runtime no longer depends on the external media directories:

- remove the one-time `media` downloader service from `docker-compose.yml`;
- remove the web service's `/img` and `/gif` bind mounts and its dependency on that service;
- retire the manual Gym visual fetch script so a later deployment cannot silently reintroduce those files;
- update README, third-party notice, and Settings attribution text to say that this fork uses the MIT-derived body map and does not distribute or download Gym visual media.

The production `media` directories and `.license-pending` markers are not deleted. They become unused after the web container is recreated, which keeps the deployment reversible and avoids an unrelated destructive operation.

The generated exercise dataset may retain its legacy `img` and `gif` filename fields for source compatibility, but no runtime component reads those fields.

## Component boundaries and data flow

The visual derives its load from `musclesOf(ex)` and passes that normalized weight map to `BodyMap`. No API request, external URL, image preload, or new persisted state is introduced.

The responsibilities remain separated:

- `musclesOf` owns normalization of catalogue muscle names;
- `BodyMap` owns lazy loading and drawing the licensed geometry;
- `Media` owns the full workout presentation and minimize/expand behavior;
- `Thumb` owns the cheap list representation.

This keeps a future explicitly licensed media manifest possible without coupling it to the workout or user data, but such a manifest is outside this change.

## Accessibility and localization

The body map is accompanied by ordinary localized text, so color is not the only carrier of information. The visual container has an accessible label derived from the exercise name and target muscles. Decorative catalogue thumbnails are hidden from assistive technology.

New user-facing strings are added to English and Russian locales. Other locales use the existing English fallback behavior.

## Verification

A focused component test is written before implementation and must first fail because current `Media` and `Thumb` render external `<img>` elements. After implementation it verifies that:

- the full workout visual renders a body map and no external image element;
- primary and secondary muscle data reaches the visual;
- minimize/expand still updates the persisted setting;
- the compact thumbnail renders without an image request;
- an exercise without recognized muscles gets the non-empty placeholder.

Run the focused Media test and the closest workout test, then build the production frontend. Validate the Compose model to confirm that web has no media service dependency or media mounts.

Production deployment is web-only and rollback protected. Postflight checks must confirm:

- the web container is running with zero restarts and its exact health command passes;
- `https://gym.innu.ru/` and `/api/health` return HTTP 200;
- the active bundle contains the new target-visual labels;
- an authenticated workout view renders the body map without requests to `/img/` or `/gif/` and without new nginx media errors.

If an authenticated browser session is unavailable to the deployment process, that final UI proof is reported as pending rather than inferred from build output.
