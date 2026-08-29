# Exercise Technique and Human Muscle Visuals Design

## Goal

Make the active workout understandable without opening the small exercise-information sheet. For thirty common exercises, the workout must show an original human technique demonstration, concise localized instructions, and an original human target-muscle visual before the set controls.

The change extends the built-in exercise visual introduced in `2026-08-29-built-in-exercise-visuals-design.md`. It must not alter exercise identifiers, routines, workout history, set progression, synchronized user data, API behavior, or database state.

## Approved user experience

The active exercise is presented in this order:

1. exercise position and localized exercise name;
2. a `How to perform` card;
3. a `Target muscles` card;
4. weight, repetition, completion, and set-management controls.

For an exercise with approved generated assets, the technique card contains:

- one landscape triptych showing the same real adult athlete in the start, lower or working, and finish phases;
- short localized phase captions;
- the first three steps from the existing `instrFor(ex)` result;
- a `Show all` control when more than three steps exist.

The target-muscle card contains a front and rear view of a realistic adult athlete. Primary muscles are highlighted in vivid green. Secondary muscles, when useful for understanding the movement, use a visibly weaker green. Ordinary localized text lists the target muscles so color is not the only information carrier.

The generated visual style follows the approved bench-press mockup: a realistic human rather than a mannequin or abstract body map, neutral studio lighting, consistent framing, subdued non-target regions, no embedded text, logos, borders, or watermarks.

The existing exercise-information action remains available for metadata and the full detail sheet. The essential technique steps are no longer hidden behind that action.

## Initial catalogue scope

The first release contains two original generated images for each of these thirty catalogue IDs. The first seventeen are the complete built-in Push/Pull/Legs starter plan; the remaining thirteen add common compound, bodyweight, arm, glute, and core movements.

| ID | Catalogue exercise | Selection |
| --- | --- | --- |
| `0025` | barbell bench press | starter Push |
| `0047` | barbell incline bench press | starter Push |
| `0426` | dumbbell standing overhead press | starter Push |
| `0334` | dumbbell lateral raise | starter Push |
| `0241` | cable triceps pushdown (v-bar) | starter Push |
| `0251` | chest dip | starter Push |
| `2330` | cable lat pulldown full range of motion | starter Pull |
| `0027` | barbell bent over row | starter Pull |
| `1323` | cable rope seated row | starter Pull |
| `0031` | barbell curl | starter Pull |
| `0313` | dumbbell hammer curl | starter Pull |
| `0043` | barbell full squat | starter Legs |
| `0085` | barbell Romanian deadlift | starter Legs |
| `0739` | sled 45-degree leg press | starter Legs |
| `0585` | lever leg extension | starter Legs |
| `0586` | lever lying leg curl | starter Legs |
| `0605` | lever standing calf raise | starter Legs |
| `0032` | barbell deadlift | additional common exercise |
| `0091` | barbell seated overhead press | additional common exercise |
| `0292` | dumbbell one-arm bent-over row | additional common exercise |
| `0294` | dumbbell biceps curl | additional common exercise |
| `0054` | barbell lunge | additional common exercise |
| `0348` | dumbbell lying rear lateral raise | additional common exercise |
| `0060` | barbell lying triceps extension (skull crusher) | additional common exercise |
| `1269` | cable standing upright crossover | additional common exercise |
| `1429` | wide-grip pull-up | additional common exercise |
| `0662` | push-up | additional common exercise |
| `0472` | hanging leg raise | additional common exercise |
| `0175` | cable kneeling crunch | additional common exercise |
| `1409` | barbell glute bridge | additional common exercise |

The scope is keyed by catalogue ID, not translated name, so localization and import aliases cannot select the wrong asset.

## Asset production and provenance

All sixty visuals are generated specifically for this fork with the built-in OpenAI image-generation workflow. No third-party exercise photography, Gym visual file, remote image library, or runtime image URL is used.

Each exercise receives two independently reviewable deliverables:

- `technique.webp`: a landscape three-phase demonstration;
- `muscles.webp`: a landscape front-and-rear target-muscle visual.

Generation uses a shared production prompt template plus exercise-specific movement, equipment, pose, and muscle requirements. A style reference may be used to keep the adult athlete, lighting, and framing consistent, but every output must be an original generated asset. Source PNG outputs may be retained outside the runtime bundle for regeneration, while the checked-in runtime assets are optimized WebP files.

An asset is accepted only after visual review confirms:

- the exercise and equipment match the catalogue entry;
- start, working or lower, and finish phases are distinguishable;
- grip, stance, joint direction, bar or cable path, and body position are plausible;
- the same person and equipment remain consistent across the three phases;
- primary and secondary muscle highlights match the catalogue mapping and visible movement;
- no extra limbs, malformed hands, merged equipment, embedded text, logos, or watermarks are present.

Generated images are educational aids, not medical advice. A brief existing-style safety note tells the user to stop if an exercise causes pain and to seek qualified coaching when unsure.

## Asset paths and manifest

Runtime files live under stable local paths:

```text
frontend/public/exercise-visuals/<exercise-id>/technique.webp
frontend/public/exercise-visuals/<exercise-id>/muscles.webp
```

A focused client-side manifest maps an exercise ID to those two paths and records each image's intrinsic width and height. The manifest contains only approved pairs; generation prompts and rejected drafts do not enter the runtime mapping. The manifest is the single boundary between catalogue metadata and optional generated assets.

Each runtime WebP has a maximum width of 1,200 pixels and a maximum file size of 300 KiB. Explicit image dimensions prevent layout shifts. The active exercise images use asynchronous decoding and browser-native lazy loading. The app does not preload the other twenty-nine exercises.

Because assets are shipped by the existing web container and bundled into native web builds, the feature has no external-host availability or license dependency.

## Component boundaries and data flow

The UI is split into focused responsibilities:

- `exercise-visuals` owns the immutable ID-to-asset manifest, intrinsic dimensions, and lookup helper;
- a new exercise-guidance component owns the inline technique steps, expand/collapse state, generated-image rendering, and per-image error handling;
- the existing `Media` built-in muscle map remains the catalogue-wide fallback;
- `Workout` owns placement of the exercise name, guidance, and unchanged set controls;
- `instrFor(ex)` remains the only source of localized exercise steps.

For the active exercise, the guidance component looks up the ID. When an approved pair exists, it renders the generated technique and muscle cards. When no pair exists, it renders localized steps plus the existing built-in muscle map. No generated asset status is persisted in user state.

The detail sheet may reuse the same guidance component or its step subcomponent, but it must not create a second instruction source.

## Failure behavior

Missing assets never create a blank panel or broken-image icon.

- A missing manifest entry immediately uses localized steps and the built-in muscle map.
- A failed `technique.webp` request hides only that image; steps remain visible.
- A failed `muscles.webp` request replaces only that image with the built-in muscle map.
- Missing localized steps fall back through the existing `instrFor` behavior; the target-muscle visual and labels remain available.
- A body-map loading failure keeps the existing stable dumbbell placeholder.

Image failures do not block set entry, completion, exercise navigation, workout finishing, or synchronization.

## Accessibility and responsive behavior

Every informative image has localized alternative text derived from the exercise name and card purpose. Phase captions and muscle names provide a text equivalent to the green highlights. Expand and collapse controls are keyboard operable and expose their expanded state.

The approved stacked layout is used at desktop and mobile widths. On small screens, images shrink within their cards without horizontal scrolling, and the set controls remain below the guidance. Reduced-motion preferences remain respected; these static images introduce no animation.

## Verification

Focused automated checks cover the changed surface:

1. a manifest test asserts exactly the approved thirty unique IDs and two local `.webp` paths per ID;
2. an asset-policy test asserts that all sixty files exist, are non-empty WebP images, stay within the 1,200-pixel and 300-KiB limits, and use no external URL;
3. component tests verify three inline localized steps, `Show all`, generated visuals for a mapped exercise, catalogue fallback for an unmapped exercise, and independent fallback when either image emits an error;
4. the closest workout tests verify that set completion, rest timing, supersets, exercise navigation, and finish behavior remain unchanged;
5. the production frontend build verifies that all manifest paths resolve into the shipped web artifact.

Manual review checks all sixty accepted images against their exercise instructions and target-muscle mapping. Desktop and narrow-mobile smoke tests verify the approved hierarchy, readable captions, no horizontal overflow, and no broken image icons.

## Deployment and rollback

The production release changes only the web client. It does not migrate data, restart or replace the API, alter environment variables, or touch the unused legacy media directories.

Before deployment, record the running web image and tag it as the rollback image. After recreation, verify:

- the web container is running with zero restarts and its internal health check passes;
- `https://gym.innu.ru/` and `/api/health` return HTTP 200;
- an authenticated workout for a mapped exercise shows both generated cards and localized steps;
- an unmapped exercise shows steps and the built-in muscle map without a broken image;
- set completion and navigation still work on mobile and desktop;
- browser requests contain no third-party exercise-image host and no legacy `/img/` or `/gif/` dependency.

If any postflight check fails, restore the recorded web image. API and user data remain untouched throughout the rollback.

## Out of scope

- generating visuals for the remaining catalogue exercises;
- video or animated movement playback;
- camera-based form analysis;
- changing exercise instructions, muscle mappings, plans, history, or progression logic;
- adding a server-side asset service, database table, administrative generator, or external image CDN.
