# Nutrition Photo Gallery Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit camera and gallery actions to nutrition photo analysis while preserving the current privacy and AI-analysis flow.

**Architecture:** Two hidden native file inputs feed one shared in-memory photo state. The camera input keeps capture="environment"; the gallery input omits capture. The existing prepareFoodPhoto and nutrition API path remain unchanged.

**Tech Stack:** React 19, Vitest 4, happy-dom, Vite 8, Docker Compose

---

## File map

- Modify frontend/src/views/Nutrition.jsx: coordinate the two inputs and render the selected filename.
- Modify frontend/src/lib/nutrition-locales.js: add English and Russian labels.
- Modify frontend/src/views/Nutrition.test.jsx: test attributes, gallery selection, analysis, and clearing.
- No API, database, Android companion, or CSS file changes.

### Task 1: Write the failing camera/gallery interaction test

**Files:**
- Modify: frontend/src/views/Nutrition.test.jsx
- Test: frontend/src/views/Nutrition.test.jsx

- [ ] **Step 1: Stub the browser image-preparation boundary**

Add after the imports:

    vi.mock('../lib/nutrition-photo.js', () => ({
      prepareFoodPhoto: vi.fn(async () => ({
        image: 'cHJlcGFyZWQ=',
        mime: 'image/jpeg',
        width: 1200,
        height: 900,
      })),
    }))

- [ ] **Step 2: Add the failing behavior test**

Add inside the existing `describe('NutritionContent')` block:

    it('offers separate camera and gallery pickers and clears them after analysis', async () => {
      const handlers = actions()
      const state = { ...baseState, entryMode: 'photo' }
      await act(async () => {
        root.render(<NutritionContent state={state} actions={handlers} localDate="2026-08-25" />)
      })

      const accept = 'image/jpeg,image/png,image/webp'
      const cameraInput = container.querySelector('input[data-photo-source="camera"]')
      const galleryInput = container.querySelector('input[data-photo-source="gallery"]')
      expect(cameraInput).toBeTruthy()
      expect(galleryInput).toBeTruthy()
      expect(cameraInput.getAttribute('capture')).toBe('environment')
      expect(galleryInput.hasAttribute('capture')).toBe(false)
      expect(cameraInput.getAttribute('accept')).toBe(accept)
      expect(galleryInput.getAttribute('accept')).toBe(accept)

      const galleryButton = [...container.querySelectorAll('button')]
        .find(button => button.textContent.trim() === 'Choose from gallery')
      const openGallery = vi.spyOn(galleryInput, 'click')
      await act(async () => { galleryButton.click() })
      expect(openGallery).toHaveBeenCalledOnce()

      const file = new dom.File(['meal'], 'meal.jpg', { type: 'image/jpeg' })
      Object.defineProperty(galleryInput, 'files', { configurable: true, value: [file] })
      Object.defineProperty(cameraInput, 'value', {
        configurable: true, writable: true, value: 'camera.jpg',
      })
      Object.defineProperty(galleryInput, 'value', {
        configurable: true, writable: true, value: 'meal.jpg',
      })
      await act(async () => {
        galleryInput.dispatchEvent(new dom.Event('change', { bubbles: true }))
      })

      expect(container.textContent).toContain('Selected photo: meal.jpg')
      const analyze = [...container.querySelectorAll('button')]
        .find(button => button.textContent.trim() === 'Analyze photo')
      expect(analyze.disabled).toBe(false)
      await act(async () => { analyze.click() })

      expect(handlers.analyzePhoto).toHaveBeenCalledOnce()
      expect(cameraInput.value).toBe('')
      expect(galleryInput.value).toBe('')
    })

- [ ] **Step 3: Prove the test is red**

Run:

    cd frontend
    npm test -- --run src/views/Nutrition.test.jsx

Expected: FAIL because the two data-photo-source inputs do not exist.

### Task 2: Implement the two sources and localization

**Files:**
- Modify: frontend/src/views/Nutrition.jsx:10-17
- Modify: frontend/src/views/Nutrition.jsx:169-205
- Modify: frontend/src/lib/nutrition-locales.js:47-52
- Modify: frontend/src/lib/nutrition-locales.js:200-205
- Test: frontend/src/views/Nutrition.test.jsx

- [ ] **Step 1: Add one shared accept constant**

Add beside MODES:

    const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp'

- [ ] **Step 2: Replace the single ref with two refs and shared helpers**

Use this block at the start of EntryPanel:

    const [photo, setPhoto] = useState(null)
    const cameraInput = useRef(null)
    const galleryInput = useRef(null)
    const [hint, setHint] = useState('')
    const [knownWeightG, setKnownWeightG] = useState('')
    const [barcode, setBarcode] = useState('')
    const [localError, setLocalError] = useState(null)
    const mode = state.entryMode

    const selectPhoto = event => {
      setPhoto(event.target.files?.[0] || null)
      setLocalError(null)
    }
    const openPhotoInput = ref => {
      if (!ref.current) return
      ref.current.value = ''
      ref.current.click()
    }
    const clearPhotoInputs = () => {
      for (const ref of [cameraInput, galleryInput]) {
        if (ref.current) ref.current.value = ''
      }
    }

In the success branch of analyse, keep the existing state resets and replace the old photoInput reset with:

    clearPhotoInputs()

- [ ] **Step 3: Render independent inputs and actions**

Replace the current visible file input with:

    <input
      ref={cameraInput}
      hidden
      data-photo-source="camera"
      type="file"
      accept={PHOTO_ACCEPT}
      capture="environment"
      onChange={selectPhoto}
    />
    <input
      ref={galleryInput}
      hidden
      data-photo-source="gallery"
      type="file"
      accept={PHOTO_ACCEPT}
      onChange={selectPhoto}
    />
    <div className="grid2">
      <Button variant="tinted" onClick={() => openPhotoInput(cameraInput)}>
        {t('Take photo')}
      </Button>
      <Button variant="tinted" onClick={() => openPhotoInput(galleryInput)}>
        {t('Choose from gallery')}
      </Button>
    </div>
    {photo && <div className="small muted" style={{ marginTop: 8 }}>
      {t('Selected photo: {0}', photo.name)}
    </div>}

Keep the hint, known weight, analyse button, and privacy note after this block.

- [ ] **Step 4: Add locale strings**

Add to EN:

    'Take photo': 'Take photo',
    'Choose from gallery': 'Choose from gallery',
    'Selected photo: {0}': 'Selected photo: {0}',

Add to RU:

    'Take photo': 'Снять фото',
    'Choose from gallery': 'Выбрать из галереи',
    'Selected photo: {0}': 'Выбрано фото: {0}',

- [ ] **Step 5: Prove the test is green**

Run:

    cd frontend
    npm test -- --run src/views/Nutrition.test.jsx

Expected: all NutritionContent tests PASS.

### Task 3: Verify and publish the implementation

**Files:**
- Modify: frontend/src/views/Nutrition.jsx
- Modify: frontend/src/lib/nutrition-locales.js
- Modify: frontend/src/views/Nutrition.test.jsx

- [ ] **Step 1: Run the related tests**

    cd frontend
    npm test -- --run src/views/Nutrition.test.jsx src/lib/nutrition-photo.test.js

Expected: all selected tests PASS.

- [ ] **Step 2: Build production frontend**

    cd frontend
    npm run build

Expected: Vite exits 0 and writes frontend/dist.

- [ ] **Step 3: Inspect only the intended diff**

    git diff --check
    git status --short
    git diff -- frontend/src/views/Nutrition.jsx frontend/src/lib/nutrition-locales.js frontend/src/views/Nutrition.test.jsx

Expected: no whitespace errors; only the three planned frontend files changed.

- [ ] **Step 4: Commit and push**

    git add -- frontend/src/views/Nutrition.jsx frontend/src/lib/nutrition-locales.js frontend/src/views/Nutrition.test.jsx
    git commit -m "feat: add nutrition gallery picker"
    git push origin main

Expected: the scoped implementation commit is on origin/main.

### Task 4: Deploy only web with rollback protection

**Files:**
- Deploy: frontend/src/views/Nutrition.jsx
- Deploy: frontend/src/lib/nutrition-locales.js
- Deploy for traceability: frontend/src/views/Nutrition.test.jsx

- [ ] **Step 1: Create release staging and back up the active files**

    ssh root@gym.innu.ru 'set -eu; release=/opt/my-gym/releases/20260828-gallery-picker; test ! -e "$release"; mkdir -p "$release/new/frontend/src/views" "$release/new/frontend/src/lib" "$release/backup/frontend/src/views" "$release/backup/frontend/src/lib"; cp /opt/my-gym/frontend/src/views/Nutrition.jsx "$release/backup/frontend/src/views/Nutrition.jsx"; cp /opt/my-gym/frontend/src/views/Nutrition.test.jsx "$release/backup/frontend/src/views/Nutrition.test.jsx"; cp /opt/my-gym/frontend/src/lib/nutrition-locales.js "$release/backup/frontend/src/lib/nutrition-locales.js"'
    scp frontend/src/views/Nutrition.jsx frontend/src/views/Nutrition.test.jsx root@gym.innu.ru:/opt/my-gym/releases/20260828-gallery-picker/new/frontend/src/views/
    scp frontend/src/lib/nutrition-locales.js root@gym.innu.ru:/opt/my-gym/releases/20260828-gallery-picker/new/frontend/src/lib/

Expected: new and backup copies exist; active production remains unchanged.

- [ ] **Step 2: Verify hashes, install the scoped files, and build web**

    Get-FileHash -Algorithm SHA256 -LiteralPath frontend/src/views/Nutrition.jsx,frontend/src/views/Nutrition.test.jsx,frontend/src/lib/nutrition-locales.js
    ssh root@gym.innu.ru 'sha256sum /opt/my-gym/releases/20260828-gallery-picker/new/frontend/src/views/Nutrition.jsx /opt/my-gym/releases/20260828-gallery-picker/new/frontend/src/views/Nutrition.test.jsx /opt/my-gym/releases/20260828-gallery-picker/new/frontend/src/lib/nutrition-locales.js'
    ssh root@gym.innu.ru 'set -eu; cd /opt/my-gym; old_image=$(docker inspect --format="{{.Image}}" my-gym-web-1); docker image tag "$old_image" my-gym-web:rollback-gallery-picker; install -m 0644 releases/20260828-gallery-picker/new/frontend/src/views/Nutrition.jsx frontend/src/views/Nutrition.jsx; install -m 0644 releases/20260828-gallery-picker/new/frontend/src/views/Nutrition.test.jsx frontend/src/views/Nutrition.test.jsx; install -m 0644 releases/20260828-gallery-picker/new/frontend/src/lib/nutrition-locales.js frontend/src/lib/nutrition-locales.js; docker compose build web'

Expected: hashes match, rollback image exists, and build succeeds without stopping the active container.

- [ ] **Step 3: Switch only web and run postflight**

    ssh root@gym.innu.ru 'set -eu; cd /opt/my-gym; docker compose up -d --no-deps web; curl -fsS --max-time 10 http://127.0.0.1:8080/ >/dev/null; curl -fsS --max-time 10 https://gym.innu.ru/api/health; docker inspect --format="state={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} restarts={{.RestartCount}}" my-gym-web-1'

Expected: health JSON is returned, web is running with zero restarts, and the site is HTTP 200.

- [ ] **Step 4: Confirm both locale labels are in the deployed bundle**

    ssh root@gym.innu.ru 'set -eu; docker exec my-gym-web-1 grep -R -Fq "Choose from gallery" /usr/share/nginx/html/assets; docker exec my-gym-web-1 grep -R -Fq "Выбрать из галереи" /usr/share/nginx/html/assets; echo gallery_bundle=ok'

Expected: gallery_bundle=ok.

- [ ] **Step 5: Roll back only if switch or postflight fails**

    ssh root@gym.innu.ru 'set -eu; cd /opt/my-gym; install -m 0644 releases/20260828-gallery-picker/backup/frontend/src/views/Nutrition.jsx frontend/src/views/Nutrition.jsx; install -m 0644 releases/20260828-gallery-picker/backup/frontend/src/views/Nutrition.test.jsx frontend/src/views/Nutrition.test.jsx; install -m 0644 releases/20260828-gallery-picker/backup/frontend/src/lib/nutrition-locales.js frontend/src/lib/nutrition-locales.js; docker image tag my-gym-web:rollback-gallery-picker my-gym-web:latest; docker compose up -d --no-deps --force-recreate web'

Expected: previous source and image are active and public HTTP is 200.
