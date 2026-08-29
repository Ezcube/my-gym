# Built-in Exercise Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every external exercise image/GIF request with an offline target-muscle visual and remove the runtime paths that could download or serve unlicensed Gym visual files.

**Architecture:** Keep `Media` and `Thumb` as the stable interfaces used by workout, sheets, library, and routine editor views. `Media` derives normalized target weights with `musclesOf(ex)` and delegates drawing to the existing lazy-loaded `BodyMap`; `Thumb` becomes a cheap icon tile. A repository policy probe prevents Compose, CI, mobile, or component code from reintroducing `/img`, `/gif`, or `VITE_*_BASE` media dependencies.

**Tech Stack:** React 19, Zustand, Vitest + happy-dom, existing SVG `BodyMap`, CSS, Vite 8, Docker Compose, nginx.

---

### Task 1: Pin the replacement behavior with a failing component test

**Files:**
- Create: `frontend/src/components/Media.test.jsx`
- Create: `frontend/src/components/BodyMap.test.jsx`
- Read: `frontend/src/components/Media.jsx`
- Read: `frontend/src/lib/muscles.js`
- Read: `frontend/src/lib/exercises.js`

- [ ] **Step 1: Create the component regression test**

Create `frontend/src/components/Media.test.jsx` with this complete test fixture:

```jsx
/* @vitest-environment happy-dom */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Media, { Thumb } from './Media.jsx'
import { EXIDX } from '../lib/exercises.js'
import ru from '../locales/ru.js'

const mocks = vi.hoisted(() => ({
  S: { gifSize: 'full', body: 'male' },
  update: vi.fn(mutator => mutator(mocks.S)),
}))

vi.mock('../store/useStore.js', () => ({
  useStore: selector => selector({ S: mocks.S, update: mocks.update }),
}))

vi.mock('./BodyMap.jsx', async () => {
  const ReactModule = await import('react')
  return {
    default: props => ReactModule.createElement('div', {
      'data-body-map': 'true',
      'data-body': props.body,
      'data-load': JSON.stringify(props.load),
      className: props.className,
    }),
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
  mocks.S.body = 'male'
  vi.clearAllMocks()
})

afterEach(async () => {
  if (root) await act(async () => { root.unmount() })
  root = null
  container?.remove()
  container = null
})

describe('built-in exercise visuals', () => {
  it('renders the bench-press muscle map without requesting an external image', async () => {
    await render(<Media ex={EXIDX['0025']} minimizable />)

    expect(container.querySelector('img')).toBeNull()
    const map = container.querySelector('[data-body-map="true"]')
    expect(map).toBeTruthy()
    expect(map.dataset.body).toBe('male')
    expect(JSON.parse(map.dataset.load)).toMatchObject({
      chest: 1,
      triceps: 0.4,
      deltoids: 0.4,
    })
    expect(container.textContent).toContain('Target muscles')
  })

  it('keeps the persisted minimize control', async () => {
    await render(<Media ex={EXIDX['0025']} minimizable />)

    const button = container.querySelector('.giftoggle')
    expect(button).toBeTruthy()
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(mocks.update).toHaveBeenCalledOnce()
    expect(mocks.S.gifSize).toBe('mini')
  })

  it('uses non-empty local fallbacks for unknown exercises and list thumbnails', async () => {
    const custom = { id: 'custom-1', n: 'Custom lift', bp: '', eq: '', tg: '', sm: [] }
    await render(<><Media ex={custom} /><Thumb ex={custom} /></>)

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.exvisual-empty')).toBeTruthy()
    expect(container.querySelector('.thumb-viz')).toBeTruthy()
    expect(container.textContent).toContain('Target information unavailable')
  })

  it('defines the new Russian labels', () => {
    expect(ru['Target muscles']).toBe('Целевые мышцы')
    expect(ru['Target information unavailable']).toBe('Нет данных о целевых мышцах')
    expect(ru['Muscle target visual for {0}']).toBe('Схема целевых мышц: {0}')
  })
})
```

Create `frontend/src/components/BodyMap.test.jsx` to pin the geometry-failure fallback:

```jsx
/* @vitest-environment happy-dom */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BodyMap from './BodyMap.jsx'

vi.mock('../lib/body-paths.js', () => { throw new Error('geometry unavailable') })

let root
let container

afterEach(async () => {
  if (root) await act(async () => { root.unmount() })
  root = null
  container?.remove()
  container = null
})

describe('BodyMap fallback', () => {
  it('keeps caller-provided content visible when geometry cannot load', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root.render(<BodyMap load={{ chest: 1 }} fallback={<div data-map-fallback="true">Fallback</div>} />)
      await Promise.resolve()
    })

    expect(container.querySelector('[data-map-fallback="true"]')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the focused test and verify the RED state**

Run from `frontend/`:

```powershell
npm test -- --run src/components/Media.test.jsx src/components/BodyMap.test.jsx
```

Expected: FAIL because current `Media` renders an `<img>`, never renders `BodyMap`, returns `null` for the custom exercise, and the Russian strings do not exist; `BodyMap` also ignores the supplied fallback. If Windows reports `spawn EPERM` under `node_modules/.vite-temp`, rerun the identical command with the approved elevated test prefix; do not change the assertions.

- [ ] **Step 3: Commit only the failing regression test**

```powershell
git add frontend/src/components/Media.test.jsx frontend/src/components/BodyMap.test.jsx
git commit -m "test: define built-in exercise visuals"
```

Expected: two new test files committed while the focused tests remain red.

---

### Task 2: Implement the offline target-muscle visual

**Files:**
- Modify: `frontend/src/components/Media.jsx`
- Modify: `frontend/src/components/BodyMap.jsx:54-63`
- Modify: `frontend/src/index.css:533-547`
- Modify: `frontend/src/locales/ru.js:304-370`
- Test: `frontend/src/components/Media.test.jsx`
- Related test: `frontend/src/lib/muscles.test.js`

- [ ] **Step 1: Replace `Media` and `Thumb` with local-only rendering**

Replace `frontend/src/components/Media.jsx` with:

```jsx
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { musclesOf } from '../lib/muscles.js'
import BodyMap from './BodyMap.jsx'
import Icon from './Icon.jsx'

const targetText = ex => [...new Set([
  ex?.tg || ex?.bp,
  ex?.mg,
  ...(Array.isArray(ex?.sm) ? ex.sm : []),
].filter(Boolean))].map(value => t(value)).join(' · ')

export default function Media({ ex, id, compact, minimizable }) {
  const gifSize = useStore(s => s.S.gifSize)
  const body = useStore(s => s.S.body)
  const update = useStore(s => s.update)
  const load = musclesOf(ex || {})
  const hasTargets = Object.values(load).some(value => value > 0)
  const mini = minimizable && gifSize === 'mini'
  const target = targetText(ex)
  const toggleSize = event => {
    event.stopPropagation()
    update(state => { state.gifSize = mini ? 'full' : 'mini' })
  }

  return (
    <div className={'exmedia' + (compact ? ' compact' : '') + (mini ? ' mini' : '')} id={id}>
      <div className="exvisual" role="group" aria-label={t('Muscle target visual for {0}', ex?.n || '')}>
        {!mini && <div className="exvisual-copy">
          <strong>{t('Target muscles')}</strong>
          <span>{target || t('Target information unavailable')}</span>
          {ex?.eq && <small>{t(ex.eq)}</small>}
        </div>}
        {hasTargets
          ? <BodyMap
              load={load}
              body={body}
              className="exercise-target-map"
              fallback={<div className="exvisual-empty" aria-hidden="true">
                <Icon name="figureStrength" />
              </div>}
            />
          : <div className="exvisual-empty">
              <Icon name="figureStrength" />
              <span>{t('Target information unavailable')}</span>
            </div>}
      </div>
      {minimizable && (
        <button className="giftoggle" onClick={toggleSize}>
          <Icon name={mini ? 'expand' : 'minimize'} />{mini ? t('Expand') : t('Minimize')}
        </button>
      )}
    </div>
  )
}

export function Thumb({ ex }) {
  const cardio = ex?.bp === 'cardio'
  return (
    <div className="thumb thumb-viz" data-body-part={ex?.bp || ''} aria-hidden="true">
      <Icon name={cardio ? 'figureRun' : 'figureStrength'} />
    </div>
  )
}
```

This deliberately preserves the historic `gifSize` state key for backwards-compatible saved settings while removing all image/GIF behavior.

Update `BodyMap` so callers can provide the same stable content during lazy-load failure. Change its signature and the no-geometry branch to:

```jsx
export default function BodyMap({ load = {}, thresholds, body = 'male', onMuscle, selected, className = '', fallback }) {
  const paths = useBodyPaths()
  const levels = levelsOf(load, thresholds)
  const g = paths && (paths[body] || paths.male)
  return (
    <div className={'bodymap ' + className}>
      {g ? <>
        <View view={g.front} levels={levels} onMuscle={onMuscle} selected={selected} />
        <View view={g.back} levels={levels} onMuscle={onMuscle} selected={selected} />
      </> : (fallback || <div className="bm-ph" aria-hidden="true" />)}
    </div>
  )
}
```

- [ ] **Step 2: Add Russian labels**

Add these entries beside `Minimize`/`Expand` in `frontend/src/locales/ru.js`:

```js
  'Target muscles': 'Целевые мышцы',
  'Target information unavailable': 'Нет данных о целевых мышцах',
  'Muscle target visual for {0}': 'Схема целевых мышц: {0}',
```

English needs no locale file because `t()` uses its source string as the English fallback.

- [ ] **Step 3: Replace the image-specific CSS with body-map presentation**

Replace the `.exmedia` media block in `frontend/src/index.css` with:

```css
.exmedia{
  position:relative;border:var(--hair) solid var(--sep-op);border-radius:var(--r-lg);
  overflow:hidden;background:var(--surface);margin-bottom:12px;
}
.exvisual{
  min-height:320px;padding:52px 56px 38px;display:flex;align-items:center;justify-content:center;
}
.exvisual-copy{position:absolute;top:14px;left:16px;right:16px;display:flex;flex-direction:column;gap:2px}
.exvisual-copy strong{font-size:12px;color:var(--label-3);font-weight:600;text-transform:uppercase;letter-spacing:.045em}
.exvisual-copy span{font-size:14px;color:var(--label-2);text-transform:capitalize}
.exvisual-copy small{font-size:12px;color:var(--label-3);text-transform:capitalize}
.exercise-target-map{width:min(100%,340px)}
.exercise-target-map .bm-v{max-height:240px}
.exercise-target-map .bm-m.l3,.exercise-target-map .bm-m.l4{
  animation:target-muscle-pulse 1.8s ease-in-out infinite;
}
@keyframes target-muscle-pulse{0%,100%{opacity:1}50%{opacity:.7}}
.exvisual-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--label-2)}
.exvisual-empty .icn{font-size:42px;color:var(--acc)}
.exmedia .giftoggle{
  position:absolute;bottom:9px;left:9px;display:inline-flex;align-items:center;gap:4px;
  background:color-mix(in srgb,var(--surface-3) 86%,transparent);color:var(--label);
  border-radius:99px;padding:5px 11px;font-size:12px;font-weight:500;
  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
}
.exmedia .giftoggle .icn{font-size:13px}
.exmedia.compact .exvisual{min-height:120px;padding:34px 46px 12px}
.exmedia.compact .exercise-target-map .bm-v{max-height:82px}
.exmedia.mini .exvisual{min-height:84px;padding:8px 54px}
.exmedia.mini .exercise-target-map .bm-v{max-height:68px}
.thumb-viz{display:flex;align-items:center;justify-content:center;background:var(--surface-2);color:var(--acc)}
.thumb-viz .icn{font-size:25px}
```

Delete the desktop-only `.exmedia img{height:380px}` rule. The existing global `@media (prefers-reduced-motion: reduce){*{animation:none!important;...}}` already disables the pulse.

- [ ] **Step 4: Run focused and related tests**

Run from `frontend/`:

```powershell
npm test -- --run src/components/Media.test.jsx src/components/BodyMap.test.jsx src/lib/muscles.test.js src/views/Workout.test.jsx
```

Expected: four test files pass; the Media tests contain no `<img>` and confirm `chest`, `triceps`, and `deltoids` reach `BodyMap`; the BodyMap test proves a geometry failure remains non-empty.

- [ ] **Step 5: Commit the component implementation**

```powershell
git add frontend/src/components/Media.jsx frontend/src/components/Media.test.jsx frontend/src/components/BodyMap.jsx frontend/src/components/BodyMap.test.jsx frontend/src/index.css frontend/src/locales/ru.js
git commit -m "feat: replace exercise media with muscle visuals"
```

---

### Task 3: Add a regression guard and remove external-media runtime paths

**Files:**
- Create: `scripts/check-exercise-visual-policy.mjs`
- Modify: `frontend/package.json`
- Modify: `frontend/src/lib/exercises.js:49-62`
- Modify: `docker-compose.yml:3-33,48-73`
- Modify: `.github/workflows/pages.yml:36-47`
- Modify: `.gitlab-ci.yml:312-322`
- Modify: `.gitignore:1-3`
- Modify: `web/Dockerfile:34-36`
- Delete: `scripts/fetch-media.sh`

- [ ] **Step 1: Write the repository policy probe**

Create `scripts/check-exercise-visual-policy.mjs`:

```js
import { existsSync, readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const failures = []

function reject(path, pattern, message) {
  if (pattern.test(read(path))) failures.push(`${path}: ${message}`)
}

reject('frontend/src/components/Media.jsx', /<img|imgSrc|gifSrc/, 'component requests external exercise media')
reject('frontend/src/lib/exercises.js', /VITE_IMG_BASE|VITE_GIF_BASE|export const (imgSrc|gifSrc)/, 'legacy media URL API remains')
reject('frontend/package.json', /VITE_IMG_BASE|VITE_GIF_BASE/, 'mobile build injects external media bases')
reject('docker-compose.yml', /(^|\n)\s{2}media:\s*\n|\.\/media\/(img|gif)/, 'Compose still downloads or mounts exercise media')
reject('.github/workflows/pages.yml', /VITE_IMG_BASE|VITE_GIF_BASE/, 'GitHub Pages still injects external media')
reject('.gitlab-ci.yml', /VITE_IMG_BASE|VITE_GIF_BASE/, 'GitLab Pages still injects external media')
reject('.github/workflows/pages.yml', /^\s*DATASET:/m, 'unused external media dataset remains configured')
reject('.gitlab-ci.yml', /^\s*DATASET:/m, 'unused external media dataset remains configured')

if (existsSync(new URL('scripts/fetch-media.sh', root))) {
  failures.push('scripts/fetch-media.sh: unlicensed media downloader still exists')
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('exercise visual policy: ok')
```

- [ ] **Step 2: Run the policy probe and verify the RED state**

Run from the repository root:

```powershell
node scripts/check-exercise-visual-policy.mjs
```

Expected: FAIL listing the legacy URL exports, mobile/Pages variables, Compose service/mounts, and fetch script. The Media component check should already be clean from Task 2.

- [ ] **Step 3: Remove media URL generation from frontend code and builds**

In `frontend/src/lib/exercises.js`, delete the complete `ENV`, `IMG_BASE`, `GIF_BASE`, `imgSrc`, and `gifSrc` block. Keep `EXDB`, `EXIDX`, muscle helpers, cardio, bodyweight, custom exercise, and `exOr` behavior unchanged.

In `frontend/package.json`, make the scripts block contain:

```json
    "build:mobile": "VITE_MOBILE=1 vite build && cap sync",
    "test:exercise-visual-policy": "node ../scripts/check-exercise-visual-policy.mjs",
```

In `.github/workflows/pages.yml`, add this step after `npm ci`:

```yaml
      - run: npm run test:exercise-visual-policy
        working-directory: frontend
```

Keep only `VITE_DEMO: '1'` in the build environment; delete `VITE_IMG_BASE` and `VITE_GIF_BASE`.
Delete the now-unused workflow-level `DATASET` variable as well.

In `.gitlab-ci.yml`, replace the Pages build commands with:

```yaml
    - cd frontend
    - npm ci
    - npm run test:exercise-visual-policy
    - npm run build
```

Delete the now-unused top-level `DATASET` variable from `.gitlab-ci.yml`.

- [ ] **Step 4: Remove the Compose downloader and web mounts**

Delete the entire `media` service from `docker-compose.yml`. The opening service structure becomes:

```yaml
name: my-gym

services:
  api:
    build: ./api
```

Update the web comment to say it serves the React frontend and proxies `/api`. Its dependency block must be exactly:

```yaml
    depends_on:
      api:
        condition: service_started
```

Delete both `./media/...:/usr/share/nginx/html/...` mounts. Do not change `./data:/data`, ports, backend variables, or restart policies.

Delete `scripts/fetch-media.sh` with `apply_patch`. In `.gitignore`, keep the two ignore rules as a safety shield but change their comment to:

```gitignore
# Legacy third-party exercise media must never be committed; this fork does not use it.
media/img/
media/gif/
```

Remove the obsolete runtime-mount comment from `web/Dockerfile`.

- [ ] **Step 5: Verify the policy and Compose model**

Run from the repository root:

```powershell
node scripts/check-exercise-visual-policy.mjs
docker compose config
```

Expected: the policy prints `exercise visual policy: ok`; Compose exits 0 and lists only `api` and `web`, with no `/img` or `/gif` mounts. It may warn about missing production environment values locally, but must still render a valid model.

- [ ] **Step 6: Commit the runtime cleanup**

```powershell
git add scripts/check-exercise-visual-policy.mjs frontend/package.json frontend/src/lib/exercises.js docker-compose.yml .github/workflows/pages.yml .gitlab-ci.yml .gitignore web/Dockerfile scripts/fetch-media.sh
git commit -m "chore: remove external exercise media runtime"
```

---

### Task 4: Update current documentation and attribution

**Files:**
- Modify: `README.md:120-137,226-232,285-298`
- Modify: `NOTICE.md:82-100`
- Modify: `docs/SELF_HOSTING.md:1-25,155-165,219-245`
- Modify: `frontend/src/views/Settings.jsx:198-203`
- Modify: `website/docs.html:100-115,170-198`
- Modify: `website/README.md:8-18`
- Modify: `CONTRIBUTING.md:36-40`

- [ ] **Step 1: Describe the new self-hosted behavior**

In `README.md`, remove the first-run 140 MB download paragraph and replace the old media note with:

```markdown
Exercise visuals are generated locally from the built-in front/back muscle map. The map geometry
is derived from the MIT-licensed MuscleMap project; no exercise image or animation library is
downloaded at runtime.
```

In the Tech section, replace the Gym visual media clause with `MIT metadata and instructions; built-in muscle-map visuals`.

In the License section, retain the MIT attribution for metadata/instructions and state:

```markdown
This fork does not download, redistribute, or display the separate Gym visual image/GIF files
referenced by the upstream dataset. Exercise visuals use the MIT-derived body diagram documented
in [NOTICE.md](NOTICE.md).
```

In `docs/SELF_HOSTING.md`, delete the first-start media bullet, the `VITE_IMG_BASE`/`VITE_GIF_BASE` environment explanation, the media-download troubleshooting row, and the complete build-time media-base subsection. Change `Your ./data and downloaded media are untouched` to `Your ./data is untouched`.

- [ ] **Step 2: Preserve the third-party notice while recording non-use**

Replace the current-use paragraphs under the Gym visual heading in `NOTICE.md` with:

```markdown
The upstream exercise dataset contains legacy filename references to thumbnails and animations
owned by **Gym visual**. Those media files are not covered by the dataset's MIT license or by
openGym's AGPL, and the permission granted to the upstream dataset is not transferable.

This fork does not contain, download, serve, or display those files. Its exercise visuals are
rendered from the MIT-derived body diagram described above. The legacy `img` and `gif` filename
fields remain only for source-data compatibility and are not read by the runtime.
```

Do not alter the existing MIT license text or MuscleMap attribution.

- [ ] **Step 3: Update in-app and website attribution**

Replace the last Settings footer line with:

```jsx
      exercise visuals: built-in muscle map (MuscleMap-derived, MIT)
```

Update `website/docs.html` to say the catalogue provides metadata/instructions and the UI draws target muscles from the built-in map. Remove the first-run download and Gym visual-use paragraphs. Replace the performance note that currently attributes normal traffic to a media CDN with: `After the app shell loads, normal use talks only to your own API.`

Update `website/README.md` so the demo description says it is a self-contained `VITE_DEMO=1` build with built-in visuals and no exercise-media CDN.

Change the CONTRIBUTING rule to:

```markdown
- **Never commit** third-party exercise media (`media/`) or runtime user data (`data/`).
```

Historical entries in `CHANGELOG.md` and already-committed implementation plans remain untouched because they describe prior releases rather than current behavior.

- [ ] **Step 4: Verify current documentation contains no active-use claim**

Run:

```powershell
rg -n --glob '!CHANGELOG.md' --glob '!docs/superpowers/**' "downloads the exercise media|VITE_IMG_BASE|VITE_GIF_BASE|fetch-media|used under that dataset's terms" README.md NOTICE.md docs website frontend/src/views/Settings.jsx CONTRIBUTING.md
```

Expected: no matches. Mentions explaining that the fork does **not** use Gym visual are allowed and should remain.

- [ ] **Step 5: Commit the documentation update**

```powershell
git add README.md NOTICE.md docs/SELF_HOSTING.md frontend/src/views/Settings.jsx website/docs.html website/README.md CONTRIBUTING.md
git commit -m "docs: document built-in exercise visuals"
```

---

### Task 5: Run the scoped release gates

**Files:**
- Verify: `frontend/src/components/Media.test.jsx`
- Verify: `frontend/src/components/BodyMap.test.jsx`
- Verify: `frontend/src/views/Workout.test.jsx`
- Verify: `frontend/src/lib/muscles.test.js`
- Verify: `scripts/check-exercise-visual-policy.mjs`
- Verify: production frontend bundle

- [ ] **Step 1: Run the focused regression set**

From `frontend/` run:

```powershell
npm test -- --run src/components/Media.test.jsx src/components/BodyMap.test.jsx src/views/Workout.test.jsx src/lib/muscles.test.js
```

Expected: all four files and all contained tests pass with no React errors.

- [ ] **Step 2: Run the policy and production build**

From the repository root:

```powershell
node scripts/check-exercise-visual-policy.mjs
docker compose config --services
```

Expected: `exercise visual policy: ok`, followed only by `api` and `web` service names.

From `frontend/` run:

```powershell
npm run build
```

Expected: Vite exits 0. The existing large-chunk warning is non-blocking; any compilation error is blocking.

- [ ] **Step 3: Review the exact release diff**

Run:

```powershell
git diff --check 764bd22..HEAD
git status --short
git log -6 --oneline
```

Expected: no whitespace errors, a clean worktree, and only the plan/test/feature/runtime/docs commits after the approved design commit `764bd22`.

- [ ] **Step 4: Push the verified commits**

```powershell
git push origin main
git ls-remote origin refs/heads/main
git rev-parse HEAD
```

Expected: the `origin/main` SHA equals local `HEAD`.

---

### Task 6: Deploy the web-only release with rollback protection

**Files deployed:**
- `frontend/src/components/Media.jsx`
- `frontend/src/components/Media.test.jsx`
- `frontend/src/components/BodyMap.jsx`
- `frontend/src/components/BodyMap.test.jsx`
- `frontend/src/index.css`
- `frontend/src/locales/ru.js`
- `frontend/src/lib/exercises.js`
- `frontend/src/views/Settings.jsx`
- `frontend/package.json`
- `docker-compose.yml`
- `.github/workflows/pages.yml`
- `.gitlab-ci.yml`
- `.gitignore`
- `web/Dockerfile`
- `scripts/check-exercise-visual-policy.mjs`
- Remove active `scripts/fetch-media.sh` only after its backup exists

Production host: `root@155.212.190.173`; application source: `/opt/my-gym`; release directory: `/opt/my-gym/releases/20260829-built-in-exercise-visuals`.

- [ ] **Step 1: Perform read-only production preflight**

Using `C:\Users\user\.ssh\mygym_deploy_ed25519`, verify:

```sh
cd /opt/my-gym
docker inspect -f 'state={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} restarts={{.RestartCount}} image={{.Image}}' my-gym-web-1
curl -fsS -o /dev/null -w 'site=%{http_code}\n' https://gym.innu.ru/
curl -fsS -o /dev/null -w 'api=%{http_code}\n' http://127.0.0.1:8080/api/health
test ! -e /opt/my-gym/releases/20260829-built-in-exercise-visuals
```

Expected: web running, zero restarts, both endpoints 200, and the release path absent. Stop if any preflight check fails.

- [ ] **Step 2: Stage files and create a bounded backup**

Create `new/` and `backup/` trees under the fixed release directory. Copy every existing active file from the deployment manifest into `backup/`, including `scripts/fetch-media.sh`. Record that `frontend/src/components/Media.test.jsx`, `frontend/src/components/BodyMap.test.jsx`, and `scripts/check-exercise-visual-policy.mjs` did not exist in the previous release. Upload the new manifest into `new/` with the same relative paths. Do not copy `.env`, `data/`, `media/`, or any secret.

Compare local `Get-FileHash -Algorithm SHA256` values with remote `sha256sum` for every uploaded file. Continue only if all hashes match.

- [ ] **Step 3: Build without interrupting the current container**

On the host:

```sh
cd /opt/my-gym
current_image=$(docker inspect -f '{{.Image}}' my-gym-web-1)
docker image tag "$current_image" my-gym-web:rollback-built-in-exercise-visuals
```

Install only staged manifest files into `/opt/my-gym`, then remove `/opt/my-gym/scripts/fetch-media.sh` after confirming its backup exists. Run:

```sh
node scripts/check-exercise-visual-policy.mjs
docker compose config --services
docker compose build web
```

Expected: policy passes, services are only `api` and `web`, and the new web image builds while the old container remains active.

- [ ] **Step 4: Switch only the web service**

```sh
cd /opt/my-gym
docker compose up -d --no-deps --force-recreate web
```

Do not run `docker compose down`, do not recreate `api`, and do not use `--remove-orphans`; the old exited media helper can remain until a separately approved cleanup.

- [ ] **Step 5: Run production postflight**

Verify:

```sh
docker inspect -f 'state={{.State.Status}} restarts={{.RestartCount}} image={{.Image}}' my-gym-web-1
port=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' my-gym-web-1 | sed -n 's/^NGINX_PORT=//p')
docker exec my-gym-web-1 wget --spider -q "http://127.0.0.1:${port}/"
curl -fsS -o /dev/null -w 'site=%{http_code}\n' https://gym.innu.ru/
curl -fsS -o /dev/null -w 'api=%{http_code}\n' http://127.0.0.1:8080/api/health
docker exec my-gym-web-1 grep -R -Fq 'Target muscles' /usr/share/nginx/html/assets
docker exec my-gym-web-1 grep -R -Fq 'Целевые мышцы' /usr/share/nginx/html/assets
```

Expected: running, zero restarts, exact container health command passes, both endpoints 200, and both labels exist in the active bundle. Confirm `docker logs --since 5m my-gym-web-1` contains no fatal nginx errors.

- [ ] **Step 6: Verify the authenticated workout surface**

Use the user's existing signed-in Chrome session to open `https://gym.innu.ru/#/workout`. Confirm the current exercise contains `.exercise-target-map`, contains no `.exmedia img`, displays `Целевые мышцы`, and the minimize button still works. Check new nginx logs after the page load and confirm there are no requests or errors for `/img/` or `/gif/`.

If no signed-in session or active workout is available, report this single UI proof as pending and ask the user to open a workout; do not infer it from bundle strings.

- [ ] **Step 7: Roll back immediately if switch or postflight fails**

Restore every prior manifest file from `backup/`, restore `scripts/fetch-media.sh`, remove the three newly introduced files recorded in Step 2, retag the saved image, and recreate only web:

```sh
cd /opt/my-gym
rm -f frontend/src/components/Media.test.jsx frontend/src/components/BodyMap.test.jsx scripts/check-exercise-visual-policy.mjs
docker image tag my-gym-web:rollback-built-in-exercise-visuals my-gym-web:latest
docker compose up -d --no-deps --force-recreate web
```

Re-run HTTPS, API, exact health, restart-count, and image checks. Keep `data/`, `.env`, API, and user history untouched in both forward and rollback paths.
