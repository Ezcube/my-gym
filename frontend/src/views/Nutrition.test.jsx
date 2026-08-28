import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NutritionContent } from './Nutrition.jsx'

vi.mock('../lib/nutrition-photo.js', () => ({
  prepareFoodPhoto: vi.fn(async () => ({
    image: 'cHJlcGFyZWQ=',
    mime: 'image/jpeg',
    width: 1200,
    height: 900,
  })),
}))

let dom
let root
let container

const actions = () => ({
  chooseEntry: vi.fn(),
  updateDraftItem: vi.fn(),
  addDraftItem: vi.fn(),
  removeDraftItem: vi.fn(),
  cancelDraft: vi.fn(),
  confirmDraft: vi.fn(async () => {}),
  analyzePhoto: vi.fn(async () => {}),
  lookupBarcode: vi.fn(async () => {}),
  repeatMeal: vi.fn(),
  requestDailyReview: vi.fn(async () => {}),
  saveProfile: vi.fn(async () => {}),
})

const baseState = {
  profile: { sex: 'male', birthDate: '1990-01-01', heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'maintain' },
  targets: { kcal: 2500, proteinG: 128, fatG: 64, carbsG: 353, confirmed: true },
  meals: [],
  health: null,
  reviews: {},
  entryMode: null,
  draft: null,
  loading: false,
  error: null,
}

beforeEach(() => {
  dom = new Window({ url: 'https://gym.innu.ru/#/nutrition' })
  globalThis.window = dom
  globalThis.document = dom.document
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.navigator })
  for (const key of ['HTMLElement', 'Event', 'MouseEvent']) globalThis[key] = dom[key]
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => { root.unmount() })
  dom.close()
})

describe('NutritionContent', () => {
  it('offers photo, barcode, manual, and repeat entry without saving on selection', async () => {
    const handlers = actions()
    await act(async () => { root.render(<NutritionContent state={baseState} actions={handlers} localDate="2026-08-25" />) })

    for (const label of ['Photo', 'Barcode', 'Manual', 'Repeat']) {
      expect([...container.querySelectorAll('button')].some(button => button.textContent.trim() === label)).toBe(true)
    }
    const manual = [...container.querySelectorAll('button')].find(button => button.textContent.trim() === 'Manual')
    await act(async () => { manual.click() })
    expect(handlers.chooseEntry).toHaveBeenCalledWith('manual')
    expect(handlers.confirmDraft).not.toHaveBeenCalled()
  })

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

  it('renders an editable draft and saves it only from the confirmation button', async () => {
    const handlers = actions()
    const state = {
      ...baseState,
      draft: { source: 'photo', items: [{
        name: 'Борщ', grams: 300, per100: { kcal: 49, proteinG: 2, fatG: 2, carbsG: 6 },
        nutritionSource: 'ai-estimate', nutritionEstimated: true,
      }] },
    }
    await act(async () => { root.render(<NutritionContent state={state} actions={handlers} localDate="2026-08-25" />) })

    const name = container.querySelector('input[aria-label="Food name 1"]')
    const grams = container.querySelector('input[aria-label="Grams 1"]')
    expect(name.value).toBe('Борщ')
    expect(grams.value).toBe('300')
    expect(container.textContent).toContain('147 kcal')
    expect(container.textContent).toContain('AI estimate — check values')

    const confirm = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Confirm meal'))
    await act(async () => { confirm.click() })
    expect(handlers.confirmDraft).toHaveBeenCalledWith('2026-08-25')
  })

  it('shows the cached daily review instead of offering another generation', async () => {
    const handlers = actions()
    const state = {
      ...baseState,
      reviews: { '2026-08-25': { summary: 'Баланс хороший', suggestions: ['Добавьте овощи'] } },
    }
    await act(async () => { root.render(<NutritionContent state={state} actions={handlers} localDate="2026-08-25" />) })
    expect(container.textContent).toContain('Баланс хороший')
    expect(container.textContent).toContain('Добавьте овощи')
    expect([...container.querySelectorAll('button')].some(button => button.textContent.includes('Generate daily review'))).toBe(false)
  })

  it('requires an explicit confirmation after calculating targets', async () => {
    const handlers = actions()
    const state = { ...baseState, targets: null }
    await act(async () => { root.render(<NutritionContent state={state} actions={handlers} localDate="2026-08-25" />) })

    expect(container.querySelector('input[placeholder="Preferences, comma separated"]')).toBeTruthy()
    const calculate = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Calculate targets'))
    await act(async () => { calculate.click() })
    expect(handlers.saveProfile).not.toHaveBeenCalled()
    expect(container.textContent).toContain('2,713 kcal')
    expect(container.querySelector('input[aria-label="Target kcal"]')).toMatchObject({ value: '2713', min: '1500' })

    const confirm = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Confirm targets'))
    await act(async () => { confirm.click() })
    expect(handlers.saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({ activityLevel: 'moderate', locale: 'en', timezone: expect.any(String) }),
      expect.objectContaining({ kcal: 2713, confirmed: true, source: 'mifflin-st-jeor', confirmedAt: expect.any(String) }),
    )
  })

  it('adopts a profile that arrives after the screen first renders', async () => {
    const handlers = actions()
    await act(async () => { root.render(<NutritionContent state={{ ...baseState, profile: null, targets: null }} actions={handlers} localDate="2026-08-25" />) })
    await act(async () => { root.render(<NutritionContent state={baseState} actions={handlers} localDate="2026-08-25" />) })
    expect(container.textContent).toContain('2,500 kcal')
    expect(container.textContent).not.toContain('Calculate targets')
  })
})
