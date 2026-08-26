import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createNutritionStore } from './useNutrition.js'

function fakeApi() {
  return {
    getProfile: vi.fn(async () => ({ profile: { goal: 'maintain' }, targets: { kcal: 2100, confirmed: true } })),
    saveProfile: vi.fn(async payload => payload),
    listMeals: vi.fn(async () => ({ meals: [{ id: 'meal-1', localDate: '2026-08-25', totals: { kcal: 400 } }] })),
    createMeal: vi.fn(async meal => ({ meal: { id: 'created', ...meal } })),
    analyzePhoto: vi.fn(async () => ({ draft: { items: [{ name: 'Борщ', estimatedGrams: 300, nutrientsPer100g: { kcal: 49, proteinG: 2, fatG: 2, carbsG: 6 } }] } })),
    lookupBarcode: vi.fn(async () => ({ product: { name: 'Кефир', servingSize: '250 g', nutrientsPer100g: { kcal: 53, proteinG: 3, fatG: 2.5, carbsG: 4 } } })),
    requestReview: vi.fn(async ({ localDate, sourceHash }) => ({ review: { localDate, sourceHash, summary: 'Баланс хороший', suggestions: ['Добавьте овощи'] } })),
    getHealthSummary: vi.fn(async () => ({ summary: { localDate: '2026-08-25', steps: 7342 } })),
  }
}

describe('nutrition store', () => {
  let client
  let store

  beforeEach(() => {
    client = fakeApi()
    store = createNutritionStore(client, () => new Date('2026-08-25T12:00:00Z'))
  })

  it('loads profile, meals, and read-only health summary for the selected day', async () => {
    await store.getState().loadDay('2026-08-25')
    expect(store.getState()).toMatchObject({
      profile: { goal: 'maintain' },
      targets: { kcal: 2100, confirmed: true },
      meals: [{ id: 'meal-1', localDate: '2026-08-25', totals: { kcal: 400 } }],
      health: { localDate: '2026-08-25', steps: 7342 },
      loading: false,
    })
  })

  it('keeps nutrition available when the optional health summary fails', async () => {
    client.getHealthSummary.mockRejectedValueOnce(new Error('Health unavailable'))
    await store.getState().loadDay('2026-08-25')
    expect(store.getState().profile).toEqual({ goal: 'maintain' })
    expect(store.getState().meals).toHaveLength(1)
    expect(store.getState().health).toBeNull()
  })

  it('normalizes the nested health summary returned by the companion backend', async () => {
    client.getHealthSummary.mockResolvedValueOnce({ summary: {
      localDate: '2026-08-25',
      daily: { steps: 8000, activeCaloriesKcal: 420, heartRateAvgBpm: 72, oxygenSaturationAvgPercent: 98 },
      workouts: [{ externalId: 'walk-1', title: 'Walking', durationMinutes: 30, activeCaloriesKcal: 180 }],
      lastSyncAt: '2026-08-25T11:00:00Z',
    } })
    await store.getState().loadDay('2026-08-25')
    expect(store.getState().health).toMatchObject({
      steps: 8000, exerciseCalories: 420, heartRateAvgBpm: 72, oxygenSaturationPercent: 98,
      syncedAt: '2026-08-25T11:00:00Z',
      workouts: [{ id: 'walk-1', name: 'Walking', calories: 180 }],
    })
  })

  it('keeps an AI photo result editable until the user explicitly confirms it', async () => {
    await store.getState().analyzePhoto({ image: 'abc', mime: 'image/jpeg' })
    expect(client.createMeal).not.toHaveBeenCalled()
    expect(store.getState().draft.items[0]).toMatchObject({ name: 'Борщ', grams: 300, per100: { kcal: 49 } })

    store.getState().updateDraftItem(0, { grams: 350 })
    await store.getState().confirmDraft('2026-08-25')

    expect(client.createMeal).toHaveBeenCalledWith(expect.objectContaining({
      localDate: '2026-08-25',
      source: 'photo',
      items: [expect.objectContaining({ name: 'Борщ', grams: 350 })],
      totals: { kcal: 171.5, proteinG: 7, fatG: 7, carbsG: 21 },
    }))
    expect(store.getState().draft).toBeNull()
  })

  it('turns barcode and repeated meals into drafts instead of saving immediately', async () => {
    await store.getState().lookupBarcode('460123')
    expect(store.getState().draft).toMatchObject({ source: 'barcode', items: [{ name: 'Кефир', grams: 250, per100: { kcal: 53 } }] })

    store.getState().repeatMeal({ items: [{ name: 'Овсянка', grams: 200, per100: { kcal: 90 } }] })
    expect(store.getState().draft).toMatchObject({ source: 'repeat', items: [{ name: 'Овсянка' }] })
    expect(client.createMeal).not.toHaveBeenCalled()
  })

  it('opens manual entry as an editable blank draft without saving it', () => {
    store.getState().chooseEntry('manual')
    expect(store.getState().draft).toEqual({
      source: 'manual',
      items: [{ name: '', grams: 0, per100: { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 } }],
    })
    expect(client.createMeal).not.toHaveBeenCalled()
  })

  it('reuses the first generated review for a local day without a second AI call', async () => {
    await store.getState().loadDay('2026-08-25')
    const first = await store.getState().requestDailyReview('2026-08-25')
    const second = await store.getState().requestDailyReview('2026-08-25')

    expect(second).toBe(first)
    expect(client.requestReview).toHaveBeenCalledTimes(1)
    expect(client.requestReview).toHaveBeenCalledWith(expect.objectContaining({
      localDate: '2026-08-25', sourceHash: expect.stringMatching(/^v1-/),
    }))
  })

  it('never persists non-finite or implausible editable meal numbers', async () => {
    store.getState().setDraftItems('manual', [{
      name: 'Test', grams: Infinity,
      per100: { kcal: 100, proteinG: 10, fatG: 2, carbsG: 4 },
    }])
    await expect(store.getState().confirmDraft('2026-08-25')).rejects.toThrow('Complete every food item')
    expect(client.createMeal).not.toHaveBeenCalled()
  })
})
