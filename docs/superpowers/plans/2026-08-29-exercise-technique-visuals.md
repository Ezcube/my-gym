# Human Exercise Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline Russian technique guidance plus original human technique and target-muscle images for thirty common exercises, with the existing body map as a reliable catalogue-wide fallback.

**Architecture:** A pure client manifest maps the approved thirty exercise IDs to two local WebP assets with fixed dimensions. A focused `ExerciseGuidance` component reads existing `instrFor(ex)` steps, renders mapped assets with independent error fallbacks, and delegates unmapped muscle visuals to the existing `Media` body map. Generation and import tools produce deterministic prompts and enforce runtime dimensions and size before an asset can enter the repository.

**Tech Stack:** React 19, Vite 8, Vitest 4, existing i18n and Zustand stores, built-in OpenAI image generation, ImageMagick, Docker Compose, nginx.

---

## File structure

Create or modify only these responsibilities:

- Create `frontend/src/lib/exercise-visuals.js`: immutable ID-to-local-asset manifest and lookup.
- Create `frontend/src/lib/exercise-visuals.test.js`: exact thirty-ID manifest contract.
- Create `frontend/src/components/ExerciseGuidance.jsx`: inline steps, generated visuals, collapse state, and image fallbacks.
- Create `frontend/src/components/ExerciseGuidance.test.jsx`: localization, expansion, failure, and collapse behavior.
- Modify `frontend/src/components/Media.jsx`: export its existing target-text formatter for reuse; keep body-map behavior unchanged.
- Modify `frontend/src/views/Workout.jsx`: place title, guidance, then unchanged set controls.
- Modify `frontend/src/views/Workout.test.jsx`: protect the approved hierarchy.
- Modify `frontend/src/index.css`: responsive stacked cards and compact superset treatment.
- Modify `frontend/src/locales/ru.js`: Russian guidance, phase, accessibility, and safety strings.
- Create `scripts/exercise-visual-prompts.mjs`: complete per-ID generation prompts derived from the catalogue.
- Create `scripts/exercise-visual-prompts.test.mjs`: prompt and catalogue coverage checks.
- Create `scripts/import-exercise-visual.ps1`: non-overwriting conversion to fixed WebP geometry.
- Modify `scripts/check-exercise-visual-policy.mjs`: validate all sixty local runtime assets without external libraries.
- Create `frontend/public/exercise-visuals/0025/technique.webp` and the same `technique.webp`/`muscles.webp` pair under each of the other twenty-nine manifest ID directories: sixty reviewed runtime assets.
- Create `docs/EXERCISE_VISUALS.md`: provenance, regeneration, acceptance, and validation runbook.
- Modify `README.md`, `NOTICE.md`, `frontend/src/views/Settings.jsx`, and `website/docs.html`: describe original generated visuals plus the built-in fallback accurately.

Do not add `.superpowers/` mockups or default `$CODEX_HOME/generated_images` outputs to Git.

---

### Task 1: Define the thirty-exercise runtime manifest

**Files:**
- Create: `frontend/src/lib/exercise-visuals.test.js`
- Create: `frontend/src/lib/exercise-visuals.js`

- [ ] **Step 1: Write the failing manifest test**

Create `frontend/src/lib/exercise-visuals.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { EXERCISE_VISUAL_IDS, EXERCISE_VISUALS, exerciseVisualFor } from './exercise-visuals.js'

const APPROVED_IDS = [
  '0025', '0047', '0426', '0334', '0241', '0251',
  '2330', '0027', '1323', '0031', '0313',
  '0043', '0085', '0739', '0585', '0586', '0605',
  '0032', '0091', '0292', '0294', '0054', '0348',
  '0060', '1269', '1429', '0662', '0472', '0175', '1409',
]

describe('generated exercise visual manifest', () => {
  it('contains exactly the approved thirty unique catalogue ids', () => {
    expect(EXERCISE_VISUAL_IDS).toEqual(APPROVED_IDS)
    expect(new Set(EXERCISE_VISUAL_IDS).size).toBe(30)
    expect(Object.keys(EXERCISE_VISUALS).sort()).toEqual([...APPROVED_IDS].sort())
  })

  it('uses fixed local paths and intrinsic dimensions for both images', () => {
    for (const id of APPROVED_IDS) {
      const visual = exerciseVisualFor(id)
      expect(visual).toEqual({
        technique: {
          src: expect.stringMatching(new RegExp(`^\\./exercise-visuals/${id}/technique\\.webp$`)),
          width: 1200,
          height: 800,
        },
        muscles: {
          src: expect.stringMatching(new RegExp(`^\\./exercise-visuals/${id}/muscles\\.webp$`)),
          width: 1200,
          height: 675,
        },
      })
    }
    expect(exerciseVisualFor('custom-1')).toBeNull()
    expect(exerciseVisualFor('__proto__')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test and confirm the missing module failure**

Run from `frontend`:

```powershell
npm test -- src/lib/exercise-visuals.test.js
```

Expected: FAIL because `./exercise-visuals.js` does not exist.

- [ ] **Step 3: Implement the manifest**

Create `frontend/src/lib/exercise-visuals.js`:

```js
export const EXERCISE_VISUAL_IDS = Object.freeze([
  '0025', '0047', '0426', '0334', '0241', '0251',
  '2330', '0027', '1323', '0031', '0313',
  '0043', '0085', '0739', '0585', '0586', '0605',
  '0032', '0091', '0292', '0294', '0054', '0348',
  '0060', '1269', '1429', '0662', '0472', '0175', '1409',
])

const base = import.meta.env?.BASE_URL || './'
const asset = (id, kind, width, height) => Object.freeze({
  src: `${base}exercise-visuals/${id}/${kind}.webp`,
  width,
  height,
})

export const EXERCISE_VISUALS = Object.freeze(Object.fromEntries(
  EXERCISE_VISUAL_IDS.map(id => [id, Object.freeze({
    technique: asset(id, 'technique', 1200, 800),
    muscles: asset(id, 'muscles', 1200, 675),
  })])
))

export const exerciseVisualFor = id => Object.prototype.hasOwnProperty.call(EXERCISE_VISUALS, id)
  ? EXERCISE_VISUALS[id]
  : null
```

- [ ] **Step 4: Run the focused test**

```powershell
npm test -- src/lib/exercise-visuals.test.js
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit the manifest contract**

```powershell
git add frontend/src/lib/exercise-visuals.js frontend/src/lib/exercise-visuals.test.js
git commit -m "feat: define generated exercise visual manifest"
```

---

### Task 2: Add deterministic prompt and asset-import tooling

**Files:**
- Create: `scripts/exercise-visual-prompts.test.mjs`
- Create: `scripts/exercise-visual-prompts.mjs`
- Create: `scripts/import-exercise-visual.ps1`

- [ ] **Step 1: Write the failing prompt-tool test**

Create `scripts/exercise-visual-prompts.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { EXERCISE_VISUAL_IDS } from '../frontend/src/lib/exercise-visuals.js'
import { promptFor } from './exercise-visual-prompts.mjs'

test('every approved id produces both complete prompts', () => {
  assert.equal(EXERCISE_VISUAL_IDS.length, 30)
  for (const id of EXERCISE_VISUAL_IDS) {
    const technique = promptFor(id, 'technique')
    const muscles = promptFor(id, 'muscles')
    assert.match(technique, /Use case: scientific-educational/)
    assert.match(technique, /three equal panels/i)
    assert.match(technique, /no text, labels, logos, or watermark/i)
    assert.match(muscles, /front view on the left and back view on the right/i)
    assert.match(muscles, /vivid emerald green/i)
  }
})

test('bench press prompts contain catalogue movement and muscle facts', () => {
  assert.match(promptFor('0025', 'technique'), /barbell bench press/i)
  assert.match(promptFor('0025', 'technique'), /middle of (?:your|the) chest/i)
  assert.match(promptFor('0025', 'muscles'), /Primary muscles: Chest/i)
  assert.match(promptFor('0025', 'muscles'), /Shoulders, Triceps/i)
})

test('unknown ids and kinds fail closed', () => {
  assert.throws(() => promptFor('nope', 'technique'), /Unknown exercise id/)
  assert.throws(() => promptFor('0025', 'video'), /Unknown visual kind/)
})
```

- [ ] **Step 2: Run the test and confirm the missing module failure**

From the repository root:

```powershell
node --test scripts/exercise-visual-prompts.test.mjs
```

Expected: FAIL because `exercise-visual-prompts.mjs` does not exist.

- [ ] **Step 3: Implement complete prompt generation**

Create `scripts/exercise-visual-prompts.mjs`:

```js
import { pathToFileURL } from 'node:url'
import { EXERCISE_VISUAL_IDS } from '../frontend/src/lib/exercise-visuals.js'
import { EXIDX } from '../frontend/src/lib/exercises.js'
import { MUSCLE_NAME, musclesOf } from '../frontend/src/lib/muscles.js'

const approved = new Set(EXERCISE_VISUAL_IDS)
const list = values => values.length ? values.join(', ') : 'none'

function exerciseFor(id) {
  if (!approved.has(id) || !EXIDX[id]) throw new Error(`Unknown exercise id: ${id}`)
  return EXIDX[id]
}

function movementInstructions(ex) {
  return (ex.st || []).map((step, index) => `${index + 1}. ${step}`).join('\n')
}

function muscleGroups(ex) {
  const entries = Object.entries(musclesOf(ex))
  const names = rows => rows.map(([slug]) => MUSCLE_NAME[slug] || slug)
  return {
    primary: names(entries.filter(([, weight]) => weight >= 0.75)),
    secondary: names(entries.filter(([, weight]) => weight > 0 && weight < 0.75)),
  }
}

function techniquePrompt(ex) {
  return `Use case: scientific-educational
Asset type: landscape technique image for a dark fitness workout app
Primary request: Create a clear three-panel photorealistic demonstration of ${ex.n}.
Equipment: ${ex.eq || 'body weight'}.
Existing exercise instructions:
${movementInstructions(ex)}
Subject: the same real adult male athlete in every panel, realistic non-exaggerated physique, neutral charcoal training clothes that do not hide joint position.
Scene/backdrop: the correct gym setup and equipment on a clean matte near-black background (#0b0e0c).
Composition/framing: one 3:2 landscape image divided into three equal panels. Panel 1 shows the stable starting position. Panel 2 shows the most informative loaded, lowered, or peak-contraction position described by the instructions. Panel 3 shows the controlled completed repetition. Keep camera angle, person, equipment, scale, and direction identical across panels.
Style/medium: polished photorealistic sports photography with high anatomical and equipment clarity.
Lighting/mood: soft neutral studio lighting, crisp silhouette, no dramatic shadows.
Constraints: scientifically plausible joint alignment, grip, stance, range of motion, and equipment path; full relevant body and equipment remain visible; no unsafe invented motion.
Avoid: extra limbs or fingers, merged or bent equipment, inconsistent bar plates, different person between panels, extreme bodybuilding proportions, gore, exposed anatomy, text, labels, logos, or watermark.`
}

function musclesPrompt(ex) {
  const groups = muscleGroups(ex)
  return `Use case: scientific-educational
Asset type: landscape target-muscle image for a dark fitness workout app
Primary request: Show the muscles trained by ${ex.n} on a realistic adult male athlete.
Primary muscles: ${list(groups.primary)}.
Secondary muscles: ${list(groups.secondary)}.
Subject: the same real adult male athlete twice in a relaxed neutral anatomical pose, front view on the left and back view on the right, framed from head to feet so lower-leg targets remain visible, charcoal compression shorts, torso, arms, and legs unobstructed.
Scene/backdrop: clean matte near-black background (#0b0e0c), no floor or equipment.
Style/medium: photorealistic sports photography with a clean scientific fitness overlay; clearly a real human, not a mannequin.
Composition/framing: two equal figures with generous separation and consistent scale.
Color palette: subdued natural body tones. Highlight primary muscles in vivid emerald green with a precise semi-transparent anatomical overlay. Highlight secondary muscles in a clearly softer, darker green. Leave every other muscle neutral.
Constraints: anatomically plausible, symmetric highlights, muscle placement consistent with the named groups, clean edges, no exposed tissue or internal anatomy.
Avoid: highlighted unrelated muscles, extra limbs, different people between views, bodybuilding exaggeration, text, labels, arrows, numbers, logos, borders, checkerboard, or watermark.`
}

export function promptFor(id, kind) {
  const ex = exerciseFor(id)
  if (kind === 'technique') return techniquePrompt(ex)
  if (kind === 'muscles') return musclesPrompt(ex)
  throw new Error(`Unknown visual kind: ${kind}`)
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (invoked) {
  const [id, kind] = process.argv.slice(2)
  try {
    process.stdout.write(promptFor(id, kind) + '\n')
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
```

- [ ] **Step 4: Implement the non-overwriting WebP importer**

Create `scripts/import-exercise-visual.ps1`:

```powershell
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9]{4}$')]
  [string]$ExerciseId,

  [Parameter(Mandatory = $true)]
  [ValidateSet('technique', 'muscles')]
  [string]$Kind,

  [Parameter(Mandatory = $true)]
  [string]$Source
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$magick = (Get-Command magick -ErrorAction Stop).Source
$size = if ($Kind -eq 'technique') { '1200x800' } else { '1200x675' }
$destinationDir = Join-Path $repo "frontend\public\exercise-visuals\$ExerciseId"
$destination = Join-Path $destinationDir "$Kind.webp"
$temporary = Join-Path $destinationDir "$Kind.import-$PID.webp"

if (Test-Path -LiteralPath $destination) {
  throw "Refusing to overwrite accepted asset: $destination"
}

New-Item -ItemType Directory -Force -Path $destinationDir | Out-Null
try {
  $quality = $null
  foreach ($candidate in 78, 72, 66) {
    & $magick $sourcePath -auto-orient -resize "${size}>" -gravity center `
      -background '#0b0e0c' -extent $size -alpha remove -alpha off `
      -strip -quality $candidate $temporary
    if ($LASTEXITCODE -ne 0) { throw "ImageMagick failed with exit code $LASTEXITCODE" }
    $temporaryFile = Get-Item -LiteralPath $temporary
    if ($temporaryFile.Length -le 307200) { $quality = $candidate; break }
  }

  if ($null -eq $quality) {
    throw "Asset remains larger than 307200 bytes at WebP quality 66"
  }

  $geometry = (& $magick identify -format '%wx%h' $temporary).Trim()
  if ($geometry -ne $size) { throw "Unexpected geometry: $geometry; expected $size" }

  $file = Get-Item -LiteralPath $temporary
  if ($file.Length -le 0) { throw 'Asset is empty' }

  $header = [IO.File]::ReadAllBytes($temporary)
  if ($header.Length -lt 12 -or
      [Text.Encoding]::ASCII.GetString($header, 0, 4) -ne 'RIFF' -or
      [Text.Encoding]::ASCII.GetString($header, 8, 4) -ne 'WEBP') {
    throw 'Output is not a WebP RIFF file'
  }

  Move-Item -LiteralPath $temporary -Destination $destination
  Write-Output "accepted=$destination bytes=$($file.Length) geometry=$geometry quality=$quality"
} finally {
  if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
}
```

- [ ] **Step 5: Run the prompt tests and importer argument smoke**

```powershell
node --test scripts/exercise-visual-prompts.test.mjs
powershell -NoProfile -File scripts/import-exercise-visual.ps1 -ExerciseId bad -Kind technique -Source missing.png
```

Expected: prompt tests PASS; the importer exits non-zero at parameter validation without creating a file.

- [ ] **Step 6: Commit the generation tooling**

```powershell
git add scripts/exercise-visual-prompts.mjs scripts/exercise-visual-prompts.test.mjs scripts/import-exercise-visual.ps1
git commit -m "chore: add exercise visual generation tools"
```

---

### Task 3: Build the inline guidance component with fallbacks

**Files:**
- Create: `frontend/src/components/ExerciseGuidance.test.jsx`
- Create: `frontend/src/components/ExerciseGuidance.jsx`
- Modify: `frontend/src/components/Media.jsx`
- Modify: `frontend/src/locales/ru.js`

- [ ] **Step 1: Write the failing component tests**

Create `frontend/src/components/ExerciseGuidance.test.jsx`:

```jsx
// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ExerciseGuidance from './ExerciseGuidance.jsx'
import { EXIDX } from '../lib/exercises.js'
import { _setLangState } from '../lib/i18n-core.js'
import ru from '../locales/ru.js'
import ruInstr from '../instr/ru.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: { gifSize: 'full' }, update: null }
  state.update = vi.fn(mutator => mutator(state.S))
  return state
})

vi.mock('../store/useStore.js', () => ({
  useStore: selector => selector({ S: mocks.S, update: mocks.update }),
}))

vi.mock('./Media.jsx', async () => {
  const ReactModule = await import('react')
  return {
    default: props => ReactModule.createElement('div', {
      'data-fallback-map': props.ex?.id || '',
    }),
    targetText: ex => [ex?.tg, ex?.mg].filter(Boolean).join(' · '),
  }
})

let root
let container

async function render(node) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => { root.render(node) })
}

beforeEach(() => {
  mocks.S.gifSize = 'full'
  vi.clearAllMocks()
  _setLangState('ru', ru, ruInstr)
})

afterEach(async () => {
  if (root) await act(async () => { root.unmount() })
  root = null
  container?.remove()
  container = null
  _setLangState('en', {}, null)
})

describe('ExerciseGuidance', () => {
  it('shows two generated visuals and three Russian steps, then expands all steps', async () => {
    await render(<ExerciseGuidance ex={EXIDX['0025']} minimizable />)
    expect(container.querySelectorAll('img')).toHaveLength(2)
    expect(container.textContent).toContain('Как выполнять')
    expect(container.textContent).toContain('Целевые мышцы')
    expect(container.querySelectorAll('.exercise-guidance-steps li')).toHaveLength(3)

    const showAll = [...container.querySelectorAll('button')]
      .find(button => button.textContent.includes('Показать все шаги'))
    expect(showAll).toBeTruthy()
    await act(async () => { showAll.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(container.querySelectorAll('.exercise-guidance-steps li')).toHaveLength(7)
    expect(container.textContent).toContain('Свернуть шаги')
  })

  it('keeps steps when technique fails and replaces only a failed muscle image', async () => {
    await render(<ExerciseGuidance ex={EXIDX['0025']} />)
    const [technique] = container.querySelectorAll('img')
    await act(async () => { technique.dispatchEvent(new Event('error')) })
    expect(container.querySelectorAll('img')).toHaveLength(1)
    expect(container.querySelectorAll('.exercise-guidance-steps li')).toHaveLength(3)

    const muscles = container.querySelector('img')
    await act(async () => { muscles.dispatchEvent(new Event('error')) })
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[data-fallback-map="0025"]')).toBeTruthy()
  })

  it('uses instructions and the body-map fallback for an unmapped exercise', async () => {
    const custom = { id: 'custom-1', n: 'Custom lift', tg: 'chest', st: ['Step one'] }
    await render(<ExerciseGuidance ex={custom} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('Step one')
    expect(container.querySelector('[data-fallback-map="custom-1"]')).toBeTruthy()
  })

  it('preserves the existing persisted minimize setting', async () => {
    await render(<ExerciseGuidance ex={EXIDX['0025']} minimizable />)
    const toggle = container.querySelector('.exercise-guidance-toggle')
    expect(toggle).toBeTruthy()
    await act(async () => { toggle.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(mocks.update).toHaveBeenCalledOnce()
    expect(mocks.S.gifSize).toBe('mini')
  })
})
```

- [ ] **Step 2: Run the test and confirm the missing component failure**

```powershell
npm test -- src/components/ExerciseGuidance.test.jsx
```

Expected: FAIL because `ExerciseGuidance.jsx` does not exist.

- [ ] **Step 3: Export the existing target-text formatter**

In `frontend/src/components/Media.jsx`, change only the declaration:

```js
export const targetText = ex => [...new Set([
  ex?.tg || ex?.bp,
  ex?.mg,
  ...(Array.isArray(ex?.sm) ? ex.sm : []),
].filter(Boolean))].map(value => t(value)).join(' · ')
```

Keep the remainder of `Media` and `Thumb` unchanged.

- [ ] **Step 4: Implement `ExerciseGuidance`**

Create `frontend/src/components/ExerciseGuidance.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { instrFor, t } from '../lib/i18n.js'
import { exerciseVisualFor } from '../lib/exercise-visuals.js'
import Media, { targetText } from './Media.jsx'
import Icon from './Icon.jsx'

const phaseLabels = ['Start position', 'Working phase', 'Completion']

export default function ExerciseGuidance({ ex, compact = false, minimizable = false }) {
  const gifSize = useStore(state => state.S.gifSize)
  const update = useStore(state => state.update)
  const [expanded, setExpanded] = useState(false)
  const [failed, setFailed] = useState({})
  const visual = exerciseVisualFor(ex?.id)
  const steps = instrFor(ex || {})
  const visibleSteps = expanded ? steps : steps.slice(0, 3)
  const mini = minimizable && gifSize === 'mini'

  useEffect(() => {
    setExpanded(false)
    setFailed({})
  }, [ex?.id])

  const fail = kind => setFailed(current => ({ ...current, [kind]: true }))
  const toggleSize = event => {
    event.stopPropagation()
    update(state => { state.gifSize = mini ? 'full' : 'mini' })
  }

  if (mini) {
    return <div className="exercise-guidance mini">
      <Media ex={ex} compact minimizable />
    </div>
  }

  return <div className={'exercise-guidance' + (compact ? ' compact' : '')}>
    <section className="exercise-guidance-card technique-card" aria-label={t('Technique demonstration for {0}', ex?.n || '')}>
      <strong className="exercise-guidance-label">{t('How to perform')}</strong>
      {visual?.technique && !failed.technique && <>
        <img
          className="exercise-guidance-image technique-image"
          src={visual.technique.src}
          width={visual.technique.width}
          height={visual.technique.height}
          loading="lazy"
          decoding="async"
          alt={t('Technique demonstration for {0}', ex?.n || '')}
          onError={() => fail('technique')}
        />
        <div className="exercise-guidance-phases" aria-hidden="true">
          {phaseLabels.map(label => <span key={label}>{t(label)}</span>)}
        </div>
      </>}
      {visibleSteps.length > 0 && <ol className="exercise-guidance-steps">
        {visibleSteps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}
      </ol>}
      {steps.length > 3 && <button className="exercise-guidance-more" aria-expanded={expanded}
        onClick={() => setExpanded(value => !value)}>
        {expanded ? t('Show fewer steps') : t('Show all steps')}
      </button>}
    </section>

    {visual?.muscles && !failed.muscles
      ? <section className="exercise-guidance-card muscles-card" aria-label={t('Target muscles for {0}', ex?.n || '')}>
          <strong className="exercise-guidance-label">{t('Target muscles')}</strong>
          <span className="exercise-guidance-targets">{targetText(ex)}</span>
          <img
            className="exercise-guidance-image muscles-image"
            src={visual.muscles.src}
            width={visual.muscles.width}
            height={visual.muscles.height}
            loading="lazy"
            decoding="async"
            alt={t('Target muscles for {0}', ex?.n || '')}
            onError={() => fail('muscles')}
          />
        </section>
      : <Media ex={ex} compact={compact} />}

    <p className="exercise-guidance-safety">{t('Stop if the movement causes pain. Ask a qualified coach if you are unsure about technique.')}</p>
    {minimizable && <button className="exercise-guidance-toggle" onClick={toggleSize}>
      <Icon name="minimize" />{t('Minimize')}
    </button>}
  </div>
}
```

- [ ] **Step 5: Add the Russian strings**

Add these entries beside the existing exercise-visual strings in `frontend/src/locales/ru.js`:

```js
  'How to perform': 'Как выполнять',
  'Show all steps': 'Показать все шаги',
  'Show fewer steps': 'Свернуть шаги',
  'Start position': 'Старт',
  'Working phase': 'Рабочая фаза',
  'Completion': 'Завершение',
  'Technique demonstration for {0}': 'Техника выполнения: {0}',
  'Target muscles for {0}': 'Целевые мышцы: {0}',
  'Stop if the movement causes pain. Ask a qualified coach if you are unsure about technique.': 'Остановитесь, если движение вызывает боль. Если сомневаетесь в технике, обратитесь к квалифицированному тренеру.',
```

- [ ] **Step 6: Run the focused component and existing fallback tests**

```powershell
npm test -- src/components/ExerciseGuidance.test.jsx src/components/Media.test.jsx
```

Expected: all tests PASS; existing `Media` body-map and minimize assertions remain green.

- [ ] **Step 7: Commit the guidance behavior**

```powershell
git add frontend/src/components/ExerciseGuidance.jsx frontend/src/components/ExerciseGuidance.test.jsx frontend/src/components/Media.jsx frontend/src/locales/ru.js
git commit -m "feat: add inline exercise guidance"
```

---

### Task 4: Integrate guidance into the workout hierarchy and style it

**Files:**
- Modify: `frontend/src/views/Workout.test.jsx`
- Modify: `frontend/src/views/Workout.jsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add the failing hierarchy regression test**

In `frontend/src/views/Workout.test.jsx`, keep the existing `Media` mock for the red test run and add a focused guidance boundary:

```jsx
vi.mock('../components/ExerciseGuidance.jsx', () => ({
  default: ({ ex }) => React.createElement('div', {
    className: 'exercise-guidance',
    'data-exercise-id': ex?.id || '',
  }),
}))
```

Then append this test:

```jsx
describe('exercise guidance hierarchy', () => {
  it('places the exercise title and guidance before the set controls', async () => {
    await mount([exercise('0025', [false, false])])
    const title = container.querySelector('.exercise-title')
    const guidance = container.querySelector('.exercise-guidance')
    const sets = container.querySelector('.sethead')
    expect(title).toBeTruthy()
    expect(guidance).toBeTruthy()
    expect(sets).toBeTruthy()
    expect(title.compareDocumentPosition(guidance) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(guidance.compareDocumentPosition(sets) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the workout test and verify the hierarchy test fails**

```powershell
npm test -- src/views/Workout.test.jsx
```

Expected: existing flow tests PASS and the new test FAILS because `.exercise-title` and `.exercise-guidance` are absent.

- [ ] **Step 3: Replace the workout media placement**

In `frontend/src/views/Workout.jsx`, replace the `Media` import with:

```js
import ExerciseGuidance from '../components/ExerciseGuidance.jsx'
```

At the start of `ExerciseBlock`'s returned fragment, replace the existing `Media` and title row with:

```jsx
    <div className="row between exercise-title-row" style={{ marginBottom: 8 }}>
      <div className="exercise-title" style={{ fontSize: compact ? 17 : 20, fontWeight: 600, letterSpacing: '-.02em', textTransform: 'capitalize', lineHeight: 1.2 }}>{t(ex.n)}</div>
      <button className="iconbtn" aria-label={t('Details')} onClick={() => exerciseDetailSheet(ex)}><Icon name="info" /></button>
    </div>
    <ExerciseGuidance ex={ex} key={entry.id} compact={compact} minimizable={!compact} />
```

Do not move or change superset controls, tags, previous-performance text, progression text, or the set card.

- [ ] **Step 4: Add the approved responsive styles**

Insert after the existing `.thumb-viz` rules in `frontend/src/index.css`:

```css
.exercise-guidance{position:relative;margin-bottom:12px}
.exercise-guidance-card{
  background:var(--surface);border:var(--hair) solid var(--sep-op);border-radius:var(--r-lg);
  padding:14px;margin-bottom:10px;overflow:hidden;
}
.exercise-guidance-label{
  display:block;margin-bottom:8px;color:var(--label-3);font-size:12px;font-weight:600;
  text-transform:uppercase;letter-spacing:.045em;
}
.exercise-guidance-image{
  display:block;width:100%;height:auto;object-fit:contain;background:#0b0e0c;border-radius:calc(var(--r-lg) - 5px);
}
.exercise-guidance-phases{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:7px 0 10px}
.exercise-guidance-phases span{text-align:center;color:var(--label-2);font-size:11px}
.exercise-guidance-steps{margin:0;padding-left:22px;color:var(--label);font-size:14px;line-height:1.48}
.exercise-guidance-steps li{margin:7px 0;padding-left:2px}
.exercise-guidance-more{margin-top:5px;color:var(--acc);font-size:13px;font-weight:600}
.exercise-guidance-targets{display:block;margin:-3px 0 8px;color:var(--label-2);font-size:14px;text-transform:capitalize}
.exercise-guidance-safety{margin:4px 12px 10px;color:var(--label-3);font-size:12px;line-height:1.4}
.exercise-guidance-toggle{
  display:inline-flex;align-items:center;gap:4px;margin-left:9px;padding:5px 11px;border-radius:99px;
  background:color-mix(in srgb,var(--surface-3) 86%,transparent);color:var(--label);font-size:12px;font-weight:500;
}
.exercise-guidance-toggle .icn{font-size:13px}
.exercise-guidance.compact .exercise-guidance-card{padding:10px}
.exercise-guidance.compact .technique-image{max-height:160px}
.exercise-guidance.compact .muscles-image{max-height:140px}
.exercise-guidance.compact .exercise-guidance-steps{font-size:12px}
.exercise-guidance.mini>.exmedia{margin-bottom:0}
.exercise-title-row{align-items:flex-start}
@media(max-width:600px){
  .exercise-guidance-card{padding:11px}
  .exercise-guidance-steps{font-size:13px}
  .exercise-guidance-phases span{font-size:10px}
}
```

- [ ] **Step 5: Run the focused UI tests**

```powershell
npm test -- src/components/ExerciseGuidance.test.jsx src/components/Media.test.jsx src/views/Workout.test.jsx src/views/Workout.remove.test.jsx
```

Expected: all tests PASS, including set/rest/superset regressions.

- [ ] **Step 6: Commit the workout layout**

```powershell
git add frontend/src/views/Workout.jsx frontend/src/views/Workout.test.jsx frontend/src/index.css
git commit -m "feat: show technique before workout sets"
```

---

### Task 5: Generate and accept the bench-press reference pair

**Files:**
- Create: `frontend/public/exercise-visuals/0025/technique.webp`
- Create: `frontend/public/exercise-visuals/0025/muscles.webp`

- [ ] **Step 1: Generate and inspect the final technique source**

Run:

```powershell
node scripts/exercise-visual-prompts.mjs 0025 technique
```

Pass the exact stdout to the built-in `imagegen` tool with no reference image. Inspect the result at original detail. Do not accept it unless the same athlete, bench, rack, bar, and plate count remain consistent across all three panels; the bar path reaches the mid-chest; feet, hips, shoulders, hands, and elbows are plausible; and there is no text or watermark. If it fails, issue one targeted regeneration describing only the failed invariant, then inspect again.

- [ ] **Step 2: Import the accepted technique image**

Pass the concrete local path emitted by imagegen directly as the `-Source` value to `scripts/import-exercise-visual.ps1 -ExerciseId 0025 -Kind technique`.

Expected: `accepted=...technique.webp`, `geometry=1200x800`, and no overwrite warning.

- [ ] **Step 3: Generate and inspect the final muscle source**

Run:

```powershell
node scripts/exercise-visual-prompts.mjs 0025 muscles
```

Pass the exact stdout to built-in imagegen. Inspect at original detail. Accept only a front/rear view of the same real person with chest primary and shoulders/triceps secondary, no highlighted abs or back, no anatomical distortion, and no text or watermark. Use one targeted regeneration if an invariant fails.

- [ ] **Step 4: Import and visually re-check the final muscle image**

Pass the concrete local path emitted by imagegen directly as the `-Source` value to `scripts/import-exercise-visual.ps1 -ExerciseId 0025 -Kind muscles`. Open both final WebP files with `view_image`; confirm the dark-card crop has no clipped bar, hands, head, feet, or highlighted muscles.

- [ ] **Step 5: Commit the accepted reference pair**

```powershell
git add frontend/public/exercise-visuals/0025
git commit -m "assets: add bench press exercise guidance"
```

The accepted WebP files become style references for every remaining generation call.

---

### Task 6: Generate the remaining starter Push assets

**Files:**
- Create: `frontend/public/exercise-visuals/{0047,0426,0334,0241,0251}/{technique,muscles}.webp`

For every ID below, print both exact prompts, call built-in imagegen with the matching accepted `0025` WebP as a style-only reference, inspect at original detail, correct a failed invariant with one targeted regeneration, and run the non-overwriting importer for each accepted output.

- [ ] **Step 1: Accept pair `0047` — barbell incline bench press**
- [ ] **Step 2: Accept pair `0426` — dumbbell standing overhead press**
- [ ] **Step 3: Accept pair `0334` — dumbbell lateral raise**
- [ ] **Step 4: Accept pair `0241` — cable triceps pushdown (v-bar)**
- [ ] **Step 5: Accept pair `0251` — chest dip**
- [ ] **Step 6: Verify and commit the Push batch**

```powershell
$files = Get-ChildItem -LiteralPath frontend/public/exercise-visuals -Recurse -File -Filter *.webp
if ($files.Count -ne 12) { throw "Expected 12 accepted WebP files, found $($files.Count)" }
git add frontend/public/exercise-visuals/0047 frontend/public/exercise-visuals/0426 frontend/public/exercise-visuals/0334 frontend/public/exercise-visuals/0241 frontend/public/exercise-visuals/0251
git commit -m "assets: add starter push exercise guidance"
```

---

### Task 7: Generate the starter Pull assets

**Files:**
- Create: `frontend/public/exercise-visuals/{2330,0027,1323,0031,0313}/{technique,muscles}.webp`

For every ID below, use the exact prompt-builder output, the accepted `0025` reference of the same kind, original-detail inspection, targeted correction, and non-overwriting import.

- [ ] **Step 1: Accept pair `2330` — cable lat pulldown full range of motion**
- [ ] **Step 2: Accept pair `0027` — barbell bent-over row**
- [ ] **Step 3: Accept pair `1323` — cable rope seated row**
- [ ] **Step 4: Accept pair `0031` — barbell curl**
- [ ] **Step 5: Accept pair `0313` — dumbbell hammer curl**
- [ ] **Step 6: Verify and commit the Pull batch**

```powershell
$files = Get-ChildItem -LiteralPath frontend/public/exercise-visuals -Recurse -File -Filter *.webp
if ($files.Count -ne 22) { throw "Expected 22 accepted WebP files, found $($files.Count)" }
git add frontend/public/exercise-visuals/2330 frontend/public/exercise-visuals/0027 frontend/public/exercise-visuals/1323 frontend/public/exercise-visuals/0031 frontend/public/exercise-visuals/0313
git commit -m "assets: add starter pull exercise guidance"
```

---

### Task 8: Generate the starter Legs assets

**Files:**
- Create: `frontend/public/exercise-visuals/{0043,0085,0739,0585,0586,0605}/{technique,muscles}.webp`

For every ID below, use the exact prompt-builder output, the accepted `0025` reference of the same kind, original-detail inspection, targeted correction, and non-overwriting import.

- [ ] **Step 1: Accept pair `0043` — barbell full squat**
- [ ] **Step 2: Accept pair `0085` — barbell Romanian deadlift**
- [ ] **Step 3: Accept pair `0739` — sled 45-degree leg press**
- [ ] **Step 4: Accept pair `0585` — lever leg extension**
- [ ] **Step 5: Accept pair `0586` — lever lying leg curl**
- [ ] **Step 6: Accept pair `0605` — lever standing calf raise**
- [ ] **Step 7: Verify and commit the Legs batch**

```powershell
$files = Get-ChildItem -LiteralPath frontend/public/exercise-visuals -Recurse -File -Filter *.webp
if ($files.Count -ne 34) { throw "Expected 34 accepted WebP files, found $($files.Count)" }
git add frontend/public/exercise-visuals/0043 frontend/public/exercise-visuals/0085 frontend/public/exercise-visuals/0739 frontend/public/exercise-visuals/0585 frontend/public/exercise-visuals/0586 frontend/public/exercise-visuals/0605
git commit -m "assets: add starter legs exercise guidance"
```

---

### Task 9: Generate additional compound and upper-body assets

**Files:**
- Create: `frontend/public/exercise-visuals/{0032,0091,0292,0294}/{technique,muscles}.webp`

For every ID below, use the exact prompt-builder output, the accepted `0025` reference of the same kind, original-detail inspection, targeted correction, and non-overwriting import.

- [ ] **Step 1: Accept pair `0032` — barbell deadlift**
- [ ] **Step 2: Accept pair `0091` — barbell seated overhead press**
- [ ] **Step 3: Accept pair `0292` — dumbbell one-arm bent-over row**
- [ ] **Step 4: Accept pair `0294` — dumbbell biceps curl**
- [ ] **Step 5: Verify and commit the batch**

```powershell
$files = Get-ChildItem -LiteralPath frontend/public/exercise-visuals -Recurse -File -Filter *.webp
if ($files.Count -ne 42) { throw "Expected 42 accepted WebP files, found $($files.Count)" }
git add frontend/public/exercise-visuals/0032 frontend/public/exercise-visuals/0091 frontend/public/exercise-visuals/0292 frontend/public/exercise-visuals/0294
git commit -m "assets: add common compound exercise guidance"
```

---

### Task 10: Generate additional arm, shoulder, leg, and chest assets

**Files:**
- Create: `frontend/public/exercise-visuals/{0054,0348,0060,1269}/{technique,muscles}.webp`

For every ID below, use the exact prompt-builder output, the accepted `0025` reference of the same kind, original-detail inspection, targeted correction, and non-overwriting import.

- [ ] **Step 1: Accept pair `0054` — barbell lunge**
- [ ] **Step 2: Accept pair `0348` — dumbbell lying rear lateral raise**
- [ ] **Step 3: Accept pair `0060` — barbell lying triceps extension**
- [ ] **Step 4: Accept pair `1269` — cable standing upright crossover**
- [ ] **Step 5: Verify and commit the batch**

```powershell
$files = Get-ChildItem -LiteralPath frontend/public/exercise-visuals -Recurse -File -Filter *.webp
if ($files.Count -ne 50) { throw "Expected 50 accepted WebP files, found $($files.Count)" }
git add frontend/public/exercise-visuals/0054 frontend/public/exercise-visuals/0348 frontend/public/exercise-visuals/0060 frontend/public/exercise-visuals/1269
git commit -m "assets: add accessory exercise guidance"
```

---

### Task 11: Generate bodyweight, core, and glute assets

**Files:**
- Create: `frontend/public/exercise-visuals/{1429,0662,0472,0175,1409}/{technique,muscles}.webp`

For every ID below, use the exact prompt-builder output, the accepted `0025` reference of the same kind, original-detail inspection, targeted correction, and non-overwriting import.

- [ ] **Step 1: Accept pair `1429` — wide-grip pull-up**
- [ ] **Step 2: Accept pair `0662` — push-up**
- [ ] **Step 3: Accept pair `0472` — hanging leg raise**
- [ ] **Step 4: Accept pair `0175` — cable kneeling crunch**
- [ ] **Step 5: Accept pair `1409` — barbell glute bridge**
- [ ] **Step 6: Verify and commit the final generation batch**

```powershell
$files = Get-ChildItem -LiteralPath frontend/public/exercise-visuals -Recurse -File -Filter *.webp
if ($files.Count -ne 60) { throw "Expected 60 accepted WebP files, found $($files.Count)" }
git add frontend/public/exercise-visuals/1429 frontend/public/exercise-visuals/0662 frontend/public/exercise-visuals/0472 frontend/public/exercise-visuals/0175 frontend/public/exercise-visuals/1409
git commit -m "assets: complete exercise guidance catalogue"
```

---

### Task 12: Enforce the complete local-asset policy

**Files:**
- Modify: `scripts/check-exercise-visual-policy.mjs`

- [ ] **Step 1: Add the manifest and asset validation imports**

Replace the import line at the top of `scripts/check-exercise-visual-policy.mjs` with:

```js
import { existsSync, readFileSync, statSync } from 'node:fs'
import { EXERCISE_VISUAL_IDS, EXERCISE_VISUALS } from '../frontend/src/lib/exercise-visuals.js'
```

- [ ] **Step 2: Add a standard-library WebP dimension parser**

Insert after `const failures = []`:

```js
const read24LE = (buffer, offset) => buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16)

function webpDimensions(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('not a WebP RIFF file')
  }
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const tag = buffer.toString('ascii', offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)
    const data = offset + 8
    if (tag === 'VP8X' && data + 10 <= buffer.length) {
      return { width: read24LE(buffer, data + 4) + 1, height: read24LE(buffer, data + 7) + 1 }
    }
    if (tag === 'VP8L' && data + 5 <= buffer.length && buffer[data] === 0x2f) {
      const bits = buffer.readUInt32LE(data + 1)
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
    }
    if (tag === 'VP8 ' && data + 10 <= buffer.length && buffer[data + 3] === 0x9d && buffer[data + 4] === 0x01 && buffer[data + 5] === 0x2a) {
      return { width: buffer.readUInt16LE(data + 6) & 0x3fff, height: buffer.readUInt16LE(data + 8) & 0x3fff }
    }
    offset = data + size + (size % 2)
  }
  throw new Error('unsupported WebP payload')
}

function validateGeneratedAssets() {
  if (EXERCISE_VISUAL_IDS.length !== 30 || new Set(EXERCISE_VISUAL_IDS).size !== 30) {
    failures.push('exercise visual manifest must contain exactly 30 unique ids')
  }
  let files = 0
  for (const id of EXERCISE_VISUAL_IDS) {
    const pair = EXERCISE_VISUALS[id]
    for (const kind of ['technique', 'muscles']) {
      const visual = pair?.[kind]
      if (!visual || !visual.src.startsWith(`./exercise-visuals/${id}/`) || !visual.src.endsWith(`/${kind}.webp`)) {
        failures.push(`${id}/${kind}: invalid local manifest path`)
        continue
      }
      const relative = visual.src.replace(/^\.\//, '')
      const url = new URL(`frontend/public/${relative}`, root)
      if (!existsSync(url)) {
        failures.push(`${id}/${kind}: asset missing`)
        continue
      }
      files++
      const bytes = readFileSync(url)
      const size = statSync(url).size
      if (size <= 0 || size > 307200) failures.push(`${id}/${kind}: ${size} bytes exceeds policy`)
      try {
        const actual = webpDimensions(bytes)
        if (actual.width !== visual.width || actual.height !== visual.height) {
          failures.push(`${id}/${kind}: ${actual.width}x${actual.height} != ${visual.width}x${visual.height}`)
        }
        if (actual.width > 1200) failures.push(`${id}/${kind}: width exceeds 1200`)
      } catch (error) {
        failures.push(`${id}/${kind}: ${error.message}`)
      }
    }
  }
  if (files !== 60) failures.push(`expected 60 generated WebP files, found ${files}`)
}
```

- [ ] **Step 3: Invoke the validator and keep every existing legacy rejection**

Call `validateGeneratedAssets()` immediately before the existing `if (failures.length)` block. Keep every existing rejection for external media URLs, Compose mounts, CI variables, and `scripts/fetch-media.sh`. Change the success line to:

```js
console.log('exercise visual policy: ok (30 ids, 60 local WebP files)')
```

- [ ] **Step 4: Run generation and policy checks**

```powershell
node --test scripts/exercise-visual-prompts.test.mjs
Set-Location frontend
npm test -- src/lib/exercise-visuals.test.js
npm run test:exercise-visual-policy
```

Expected: tests PASS and policy reports 30 IDs and 60 local WebP files.

- [ ] **Step 5: Commit the final asset gate**

```powershell
Set-Location ..
git add scripts/check-exercise-visual-policy.mjs
git commit -m "test: enforce generated exercise visual assets"
```

---

### Task 13: Document provenance and update user-facing attribution

**Files:**
- Create: `docs/EXERCISE_VISUALS.md`
- Modify: `README.md`
- Modify: `NOTICE.md`
- Modify: `frontend/src/views/Settings.jsx`
- Modify: `website/docs.html`

- [ ] **Step 1: Write the generation runbook**

Create `docs/EXERCISE_VISUALS.md`:

```markdown
# Exercise visuals

This fork ships original generated technique and target-muscle images for the 30 exercise IDs listed in `frontend/src/lib/exercise-visuals.js`. The remaining catalogue uses the built-in MuscleMap-derived body diagram.

The generated files are not copied from the upstream Gym visual filenames, a stock library, or a remote exercise API. Runtime code never requests those legacy files.

## Regeneration

1. Print the complete prompt with `node scripts/exercise-visual-prompts.mjs 0025 technique` or `node scripts/exercise-visual-prompts.mjs 0025 muscles`, substituting the required manifest ID for `0025`.
2. Use the built-in OpenAI image-generation tool.
3. Inspect the original output against the movement, equipment, anatomy, target muscles, and artifact checklist in the implementation specification.
4. Import an accepted output with `scripts/import-exercise-visual.ps1`.
5. Run `cd frontend && npm run test:exercise-visual-policy`.

The importer refuses to overwrite an accepted asset. Replace an asset only through a reviewed change that removes or renames the old file explicitly.

## Runtime policy

- exactly 30 manifest IDs and 60 WebP files;
- technique images: 1200×800;
- muscle images: 1200×675;
- maximum 300 KiB per file;
- no external image URL, embedded label, logo, or watermark;
- generated images are educational aids, not medical advice.
```

- [ ] **Step 2: Update attribution text consistently**

Change current claims that all exercise visuals are generated from the body map to this meaning in `README.md`, `NOTICE.md`, and `website/docs.html`:

```text
Thirty common exercises include original generated human technique and target-muscle visuals. Every other exercise uses the built-in MuscleMap-derived body diagram. This fork does not download or display the separate upstream Gym image/GIF library.
```

In `frontend/src/views/Settings.jsx`, use:

```jsx
      exercise visuals: original generated guidance for 30 exercises + built-in MuscleMap fallback (MIT-derived)
```

Do not remove the MuscleMap MIT attribution or the explanation that upstream Gym images are not licensed by the metadata dataset.

- [ ] **Step 3: Verify documentation language**

```powershell
rg -n "30 exercises|Thirty common exercises|generated guidance" README.md NOTICE.md docs/EXERCISE_VISUALS.md frontend/src/views/Settings.jsx website/docs.html
```

Expected: every public description reports the same thirty-exercise scope and fallback.

- [ ] **Step 4: Commit documentation**

```powershell
git add docs/EXERCISE_VISUALS.md README.md NOTICE.md frontend/src/views/Settings.jsx website/docs.html
git commit -m "docs: document generated exercise guidance"
```

---

### Task 14: Run the complete local release gate and publish the code

**Files:**
- Verify all changed files and assets.

- [ ] **Step 1: Run focused tests**

From `frontend`:

```powershell
npm test -- src/lib/exercise-visuals.test.js src/components/ExerciseGuidance.test.jsx src/components/Media.test.jsx src/views/Workout.test.jsx src/views/Workout.remove.test.jsx
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run prompt, asset, and Compose checks**

From the repository root:

```powershell
node --test scripts/exercise-visual-prompts.test.mjs
Set-Location frontend
npm run test:exercise-visual-policy
Set-Location ..
docker compose config --services
```

Expected: prompt tests PASS; asset policy reports 30 IDs and 60 files; Compose lists only `api` and `web`.

- [ ] **Step 3: Build the production frontend**

```powershell
Set-Location frontend
npm run build
Set-Location ..
$built = Get-ChildItem -LiteralPath frontend/dist/exercise-visuals -Recurse -File -Filter *.webp
if ($built.Count -ne 60) { throw "Expected 60 built WebP files, found $($built.Count)" }
```

Expected: Vite exits 0 and the build contains 60 assets.

- [ ] **Step 4: Run a local browser smoke**

Start the existing local stack or Vite preview. For mapped bench press and one unmapped exercise at desktop and narrow-mobile widths, verify the approved hierarchy, expansion, fallback, minimize persistence, set completion, Next/Prev, no overflow, and no `/img/`, `/gif/`, or third-party image request.

- [ ] **Step 5: Verify the Git boundary**

```powershell
git status --short
git log --oneline --decorate -15
git diff --check 9c49625..HEAD
```

Expected: only `.superpowers/` may remain untracked; no application or asset change is uncommitted.

- [ ] **Step 6: Push and verify the exact public commit**

```powershell
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Expected: local `HEAD` and `origin/main` have the same SHA.

---

### Task 15: Deploy only the web client with rollback protection

**Files deployed:**
- Runtime, tests, tooling, 60 assets, and documentation listed in this plan.

Production host: `root@155.212.190.173`; SSH key: `C:\Users\user\.ssh\mygym_deploy_ed25519`; application source: `/opt/my-gym`; fixed release directory: `/opt/my-gym/releases/20260829-human-exercise-guidance`.

- [ ] **Step 1: Perform read-only production preflight**

```sh
cd /opt/my-gym
docker inspect -f 'state={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} restarts={{.RestartCount}} image={{.Image}}' my-gym-web-1
curl -fsS -o /dev/null -w 'site=%{http_code}\n' https://gym.innu.ru/
curl -fsS -o /dev/null -w 'api=%{http_code}\n' http://127.0.0.1:8080/api/health
test ! -e /opt/my-gym/releases/20260829-human-exercise-guidance
test ! -e /opt/my-gym/frontend/public/exercise-visuals
```

Expected: web running, zero restarts, both endpoints 200, and new paths absent. Stop if any check fails.

- [ ] **Step 2: Build and hash a bounded release archive locally**

```powershell
$releaseArchive = Join-Path $env:TEMP 'human-exercise-guidance.tgz'
git archive --format=tar.gz -o $releaseArchive HEAD `
  frontend/src/lib/exercise-visuals.js frontend/src/lib/exercise-visuals.test.js `
  frontend/src/components/ExerciseGuidance.jsx frontend/src/components/ExerciseGuidance.test.jsx `
  frontend/src/components/Media.jsx frontend/src/views/Workout.jsx frontend/src/views/Workout.test.jsx `
  frontend/src/index.css frontend/src/locales/ru.js frontend/src/views/Settings.jsx `
  frontend/public/exercise-visuals scripts/exercise-visual-prompts.mjs `
  scripts/exercise-visual-prompts.test.mjs scripts/import-exercise-visual.ps1 `
  scripts/check-exercise-visual-policy.mjs docs/EXERCISE_VISUALS.md `
  README.md NOTICE.md website/docs.html
Get-FileHash -Algorithm SHA256 -LiteralPath $releaseArchive
```

Upload only that archive to `/tmp/human-exercise-guidance.tgz`; compare local hash with remote `sha256sum` before extraction.

- [ ] **Step 3: Stage the archive and create a bounded source backup**

```sh
set -eu
cd /opt/my-gym
release=/opt/my-gym/releases/20260829-human-exercise-guidance
mkdir -p "$release/new" "$release/backup"
tar -xzf /tmp/human-exercise-guidance.tgz -C "$release/new"
for file in \
  frontend/src/components/Media.jsx \
  frontend/src/views/Workout.jsx \
  frontend/src/views/Workout.test.jsx \
  frontend/src/index.css \
  frontend/src/locales/ru.js \
  frontend/src/views/Settings.jsx \
  scripts/check-exercise-visual-policy.mjs \
  README.md NOTICE.md website/docs.html
do
  test -f "/opt/my-gym/$file"
  mkdir -p "$release/backup/$(dirname "$file")"
  cp -a "/opt/my-gym/$file" "$release/backup/$file"
done
find "$release/new/frontend/public/exercise-visuals" -type f -name '*.webp' | wc -l | grep -qx '60'
```

Expected: the backup contains only existing files; staging contains 60 WebP files; `.env`, `data/`, `media/`, and API files are absent.

- [ ] **Step 4: Tag rollback image, install staged files, and build without interruption**

```sh
set -eu
cd /opt/my-gym
current_image=$(docker inspect -f '{{.Image}}' my-gym-web-1)
docker image tag "$current_image" my-gym-web:rollback-human-exercise-guidance
cp -a /opt/my-gym/releases/20260829-human-exercise-guidance/new/. /opt/my-gym/
node scripts/check-exercise-visual-policy.mjs
docker compose config --services
docker compose build web
```

Expected: policy passes, Compose lists only `api` and `web`, rollback tag exists, and build finishes while the old container remains active.

- [ ] **Step 5: Switch only web**

```sh
cd /opt/my-gym
docker compose up -d --no-deps --force-recreate web
```

Do not run `docker compose down`, recreate `api`, use `--remove-orphans`, alter `.env`, or touch `data/` or `media/`.

- [ ] **Step 6: Run production postflight**

```sh
docker inspect -f 'state={{.State.Status}} restarts={{.RestartCount}} image={{.Image}}' my-gym-web-1
port=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' my-gym-web-1 | sed -n 's/^NGINX_PORT=//p')
docker exec my-gym-web-1 wget --spider -q "http://127.0.0.1:${port}/"
curl -fsS -o /dev/null -w 'site=%{http_code}\n' https://gym.innu.ru/
curl -fsS -o /dev/null -w 'api=%{http_code}\n' http://127.0.0.1:8080/api/health
docker exec my-gym-web-1 sh -c "find /usr/share/nginx/html/exercise-visuals -type f -name '*.webp' | wc -l | grep -qx 60"
docker exec my-gym-web-1 grep -R -Fq 'Show all steps' /usr/share/nginx/html/assets
docker exec my-gym-web-1 grep -R -Fq 'Показать все шаги' /usr/share/nginx/html/assets
docker logs --since 5m my-gym-web-1
```

Expected: running, zero restarts, internal health succeeds, site/API are 200, 60 images exist, both labels exist, and logs have no fatal nginx error.

- [ ] **Step 7: Verify the authenticated production workout**

Use the user's signed-in session at `https://gym.innu.ru/#/workout`. For mapped `0025`, verify two `.exercise-guidance-image` elements, three Russian steps, working expansion, target muscles, minimize/expand, set completion, and Next. For an unmapped exercise, verify instructions plus `.exercise-target-map` and no broken icon. Check desktop and narrow-mobile widths and confirm there are no third-party, `/img/`, or `/gif/` requests.

- [ ] **Step 8: Roll back immediately if switch or postflight fails**

```sh
set -eu
cd /opt/my-gym
release=/opt/my-gym/releases/20260829-human-exercise-guidance
asset_dir=/opt/my-gym/frontend/public/exercise-visuals
test "$(readlink -f "$release")" = "$release"
test "$(readlink -f "$asset_dir")" = "$asset_dir"
cp -a "$release/backup/." /opt/my-gym/
rm -f \
  frontend/src/lib/exercise-visuals.js \
  frontend/src/lib/exercise-visuals.test.js \
  frontend/src/components/ExerciseGuidance.jsx \
  frontend/src/components/ExerciseGuidance.test.jsx \
  scripts/exercise-visual-prompts.mjs \
  scripts/exercise-visual-prompts.test.mjs \
  scripts/import-exercise-visual.ps1 \
  docs/EXERCISE_VISUALS.md
rm -rf -- "$asset_dir"
docker image tag my-gym-web:rollback-human-exercise-guidance my-gym-web:latest
docker compose up -d --no-deps --force-recreate web
```

Re-run container state, restart count, internal health, HTTPS, API health, and browser checks. Keep the release backup and rollback image until authenticated production verification passes.

---

## Completion criteria

The work is complete only when:

- the exact thirty IDs have sixty reviewed local WebP assets;
- mapped exercises show generated technique, Russian steps, and generated target muscles before sets;
- unmapped and failed-image cases retain steps plus the built-in body map without broken panels;
- minimize, set completion, rest timing, supersets, navigation, and finish behavior remain green;
- focused tests, prompt tests, asset policy, Compose config, and production build pass;
- `origin/main` matches the deployed commit;
- production web is healthy with zero restarts, site/API return 200, and authenticated desktop/mobile proof passes;
- rollback remains available and API, `.env`, `data/`, `media/`, and user history are untouched.
