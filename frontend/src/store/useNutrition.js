import { create } from 'zustand'
import { mealTotals, nutritionSnapshotHash } from '../lib/nutrition.js'
import { nutritionApi } from '../lib/nutrition-api.js'

const clone = value => JSON.parse(JSON.stringify(value))
const itemsOf = response => response?.items || response?.draft?.items || response?.analysis?.items || []
const mealOf = response => response?.meal || response

function draftItem(item = {}) {
  const per100 = item.per100 || item.nutrientsPer100g || {}
  const servingGrams = Number.parseFloat(String(item.servingSize || '').replace(',', '.'))
  return {
    name: String(item.name || ''),
    grams: Number(item.grams ?? item.estimatedGrams) || (Number.isFinite(servingGrams) ? servingGrams : 0),
    per100: {
      kcal: Number(per100.kcal) || 0,
      proteinG: Number(per100.proteinG) || 0,
      fatG: Number(per100.fatG) || 0,
      carbsG: Number(per100.carbsG) || 0,
    },
    ...(item.confidence == null ? {} : { confidence: item.confidence }),
    ...(item.foodId ? { foodId: item.foodId } : {}),
    ...(item.barcode ? { barcode: item.barcode } : {}),
    ...(item.nutritionSource ? { nutritionSource: item.nutritionSource } : {}),
    ...(item.nutritionEstimated ? { nutritionEstimated: true } : {}),
  }
}

function healthSummaryOf(response) {
  const summary = response?.summary || response
  if (!summary?.daily) return summary || null
  const daily = summary.daily
  return {
    localDate: summary.localDate || daily.date,
    steps: daily.steps,
    exerciseCalories: daily.activeCaloriesKcal,
    sleepMinutes: daily.sleepMinutes,
    weightKg: daily.weightKg,
    bodyFatPercent: daily.bodyFatPercent,
    heartRateAvgBpm: daily.heartRateAvgBpm,
    oxygenSaturationPercent: daily.oxygenSaturationAvgPercent,
    syncedAt: summary.lastSyncAt || daily.updatedAt,
    source: 'Samsung Health via Health Connect',
    workouts: (summary.workouts || []).map(workout => ({
      id: workout.externalId,
      name: workout.title || workout.exerciseType,
      durationMinutes: workout.durationMinutes,
      calories: workout.activeCaloriesKcal,
      startedAt: workout.start,
    })),
    devices: summary.devices || [],
  }
}

function validDraft(items) {
  return items.length > 0 && items.every(item => {
    const grams = Number(item.grams)
    const nutrients = ['kcal', 'proteinG', 'fatG', 'carbsG'].map(key => Number(item.per100?.[key]))
    return item.name.trim() && Number.isFinite(grams) && grams > 0 && grams <= 10000 &&
      nutrients.every((value, index) => Number.isFinite(value) && value >= 0 && value <= (index === 0 ? 1000 : 100))
  })
}

export function createNutritionStore(client = nutritionApi, now = () => new Date()) {
  return create((set, get) => ({
    localDate: null,
    profile: null,
    targets: null,
    meals: [],
    health: null,
    reviews: {},
    entryMode: null,
    draft: null,
    loading: false,
    error: null,

    async loadDay(localDate) {
      set({ loading: true, error: null, localDate })
      try {
        const [profileData, mealsData, healthData] = await Promise.all([
          client.getProfile(), client.listMeals(localDate), client.getHealthSummary(localDate).catch(() => null),
        ])
        const review = mealsData?.review || null
        set(state => ({
          profile: profileData?.profile || null,
          targets: profileData?.targets || null,
          meals: Array.isArray(mealsData) ? mealsData : mealsData?.meals || [],
          health: healthSummaryOf(healthData),
          reviews: review ? { ...state.reviews, [localDate]: review } : state.reviews,
          loading: false,
        }))
      } catch (error) {
        set({ loading: false, error: error.message || String(error) })
      }
    },

    async saveProfile(profile, targets) {
      set({ loading: true, error: null })
      try {
        const saved = await client.saveProfile({ profile, targets })
        set({
          profile: saved?.profile || profile,
          targets: saved?.targets || targets,
          loading: false,
        })
        return saved
      } catch (error) {
        set({ loading: false, error: error.message || String(error) })
        throw error
      }
    },

    chooseEntry(entryMode) {
      set({ entryMode, draft: entryMode === 'manual' ? { source: 'manual', items: [draftItem()] } : null, error: null })
    },

    setDraftItems(source, items) {
      set({ entryMode: source, draft: { source, items: (items || []).map(draftItem) }, error: null })
    },

    updateDraftItem(index, patch) {
      set(state => {
        if (!state.draft?.items[index]) return state
        const items = clone(state.draft.items)
        items[index] = {
          ...items[index],
          ...patch,
          per100: patch.per100 ? { ...items[index].per100, ...patch.per100 } : items[index].per100,
        }
        return { draft: { ...state.draft, items } }
      })
    },

    addDraftItem() {
      set(state => ({
        draft: state.draft ? { ...state.draft, items: [...state.draft.items, draftItem()] } : { source: 'manual', items: [draftItem()] },
      }))
    },

    removeDraftItem(index) {
      set(state => state.draft ? ({
        draft: { ...state.draft, items: state.draft.items.filter((_, itemIndex) => itemIndex !== index) },
      }) : state)
    },

    cancelDraft() { set({ draft: null, error: null }) },

    async analyzePhoto(payload) {
      set({ loading: true, error: null })
      try {
        const result = await client.analyzePhoto(payload)
        const items = itemsOf(result).map(draftItem)
        if (!items.length) throw new Error('No food was recognised')
        set({ entryMode: 'photo', draft: { source: 'photo', items }, loading: false })
        return result
      } catch (error) {
        set({ loading: false, error: error.message || String(error) })
        throw error
      }
    },

    async lookupBarcode(code) {
      set({ loading: true, error: null })
      try {
        const result = await client.lookupBarcode(code)
        const item = result?.item || result?.product
        if (!item) throw new Error('Product was not found')
        set({ entryMode: 'barcode', draft: { source: 'barcode', items: [draftItem(item)] }, loading: false })
        return result
      } catch (error) {
        set({ loading: false, error: error.message || String(error) })
        throw error
      }
    },

    repeatMeal(meal) {
      set({
        entryMode: 'repeat',
        draft: { source: 'repeat', items: (meal?.items || []).map(draftItem) },
        error: null,
      })
    },

    async confirmDraft(localDate, occasion = 'meal') {
      const draft = get().draft
      if (!draft || !validDraft(draft.items)) throw new Error('Complete every food item before saving')
      const payload = {
        localDate,
        eatenAt: now().toISOString(),
        occasion,
        source: draft.source,
        confirmed: true,
        items: clone(draft.items),
        totals: mealTotals(draft.items),
      }
      set({ loading: true, error: null })
      try {
        const result = await client.createMeal(payload)
        const meal = mealOf(result)
        set(state => ({ meals: [meal, ...state.meals], draft: null, loading: false }))
        return meal
      } catch (error) {
        set({ loading: false, error: error.message || String(error) })
        throw error
      }
    },

    async requestDailyReview(localDate) {
      const existing = get().reviews[localDate]
      if (existing) return existing
      const state = get()
      const sourceHash = nutritionSnapshotHash({
        localDate,
        meals: state.meals,
        targets: state.targets,
        health: state.health,
      })
      set({ loading: true, error: null })
      try {
        const result = await client.requestReview({ localDate, sourceHash })
        const review = { localDate, sourceHash, ...(result?.review || result) }
        set(stateNow => ({ reviews: { ...stateNow.reviews, [localDate]: review }, loading: false }))
        return review
      } catch (error) {
        set({ loading: false, error: error.message || String(error) })
        throw error
      }
    },
  }))
}

export const useNutrition = createNutritionStore()
