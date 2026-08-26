import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nutritionApi } from './nutrition-api.js'

const ok = payload => Promise.resolve({ ok: true, json: () => Promise.resolve(payload) })

describe('nutrition API client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => ok({ ok: true })))
  })

  it('reads and saves the nutrition profile on the fixed endpoint', async () => {
    await nutritionApi.getProfile()
    expect(fetch).toHaveBeenLastCalledWith('/api/nutrition/profile', expect.any(Object))

    const payload = { profile: { goal: 'maintain' }, targets: { kcal: 2100, confirmed: true } }
    await nutritionApi.saveProfile(payload)
    expect(fetch).toHaveBeenLastCalledWith('/api/nutrition/profile', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify(payload),
    }))
  })

  it('sends transient photo data to the photo-analysis endpoint', async () => {
    const payload = { image: { base64: 'abc', mimeType: 'image/jpeg' }, locale: 'ru', hint: 'борщ' }
    await nutritionApi.analyzePhoto(payload)
    expect(fetch).toHaveBeenLastCalledWith('/api/nutrition/photo-analysis', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(payload),
    }))
  })

  it('puts barcode and local date in encoded query parameters', async () => {
    await nutritionApi.lookupBarcode('460 123')
    expect(fetch).toHaveBeenLastCalledWith('/api/nutrition/barcode?code=460%20123', expect.any(Object))

    await nutritionApi.listMeals('2026-08-25')
    expect(fetch).toHaveBeenLastCalledWith('/api/nutrition/meals?date=2026-08-25', expect.any(Object))
  })

  it('uses one fixed meals path and carries ids in the request body', async () => {
    await nutritionApi.createMeal({ localDate: '2026-08-25', source: 'manual', items: [] })
    expect(fetch).toHaveBeenLastCalledWith('/api/nutrition/meals', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ meal: { localDate: '2026-08-25', source: 'manual', items: [] } }),
    }))

    await nutritionApi.updateMeal('meal-1', { occasion: 'dinner' })
    expect(fetch).toHaveBeenLastCalledWith('/api/nutrition/meals?id=meal-1', expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ meal: { id: 'meal-1', occasion: 'dinner' } }),
    }))

    await nutritionApi.deleteMeal('meal-1')
    expect(fetch).toHaveBeenLastCalledWith('/api/nutrition/meals?id=meal-1', expect.objectContaining({ method: 'DELETE' }))
  })

  it('requests the daily review on a fixed path with an idempotent snapshot key', async () => {
    await nutritionApi.requestReview({ localDate: '2026-08-25', sourceHash: 'snapshot-1' })
    expect(fetch).toHaveBeenLastCalledWith('/api/nutrition/review', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ localDate: '2026-08-25', sourceHash: 'snapshot-1' }),
    }))
  })

  it('reads the health summary without exposing a profile id', async () => {
    await nutritionApi.getHealthSummary('2026-08-25')
    expect(fetch).toHaveBeenLastCalledWith('/api/health/summary?localDate=2026-08-25', expect.any(Object))
  })
})
