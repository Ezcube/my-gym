import { describe, expect, it } from 'vitest'
import {
  calculateNutritionTargets,
  canUseNutrition,
  mealTotals,
  reviewForDate,
} from './nutrition.js'

describe('nutrition domain', () => {
  it('calculates a confirmed starting point with Mifflin-St Jeor', () => {
    expect(calculateNutritionTargets({
      sex: 'male',
      birthDate: '1996-06-15',
      heightCm: 180,
      weightKg: 80,
      activity: 'moderate',
      goal: 'lose',
    }, new Date('2026-08-25T12:00:00Z'))).toEqual({
      kcal: 2259,
      proteinG: 128,
      fatG: 64,
      carbsG: 293,
      formula: 'mifflin-st-jeor',
      confirmed: false,
    })
  })

  it('rejects a nutrition target calculation for a minor', () => {
    expect(() => calculateNutritionTargets({
      sex: 'female',
      birthDate: '2010-01-01',
      heightCm: 165,
      weightKg: 60,
      activity: 'sedentary',
      goal: 'maintain',
    }, new Date('2026-08-25T12:00:00Z'))).toThrow('adults')
  })

  it('keeps weight-loss estimates above the adult calorie floor', () => {
    const targets = calculateNutritionTargets({
      sex: 'female', birthDate: '1990-01-01', heightCm: 150, weightKg: 40,
      activity: 'sedentary', goal: 'lose',
    }, new Date('2026-08-25T12:00:00Z'))
    expect(targets.kcal).toBe(1200)
  })

  it('adds deterministic nutrients from editable per-100g values', () => {
    expect(mealTotals([
      { grams: 180, per100: { kcal: 165, proteinG: 31, fatG: 3.6, carbsG: 0 } },
      { grams: 120, per100: { kcal: 130, proteinG: 2.7, fatG: 0.3, carbsG: 28 } },
    ])).toEqual({ kcal: 453, proteinG: 59, fatG: 6.8, carbsG: 33.6 })
  })

  it('never emits infinite totals from an invalid editable number', () => {
    expect(mealTotals([{ grams: Infinity, per100: { kcal: Infinity } }])).toEqual({
      kcal: 0, proteinG: 0, fatG: 0, carbsG: 0,
    })
  })

  it('enables nutrition only for a signed-in server-backed web profile', () => {
    expect(canUseNutrition({ user: { id: 'u1' }, guest: false, mobile: false, demo: false })).toBe(true)
    expect(canUseNutrition({ user: null, guest: true, mobile: false, demo: false })).toBe(false)
    expect(canUseNutrition({ user: { id: 'u1' }, guest: false, mobile: true, demo: false })).toBe(false)
    expect(canUseNutrition({ user: { id: 'u1' }, guest: false, mobile: false, demo: true })).toBe(false)
  })

  it('returns at most the single review stored for a local day', () => {
    const reviews = [
      { localDate: '2026-08-24', summary: 'Yesterday' },
      { localDate: '2026-08-25', summary: 'Today' },
    ]
    expect(reviewForDate(reviews, '2026-08-25')).toEqual(reviews[1])
    expect(reviewForDate(reviews, '2026-08-26')).toBeNull()
  })
})
