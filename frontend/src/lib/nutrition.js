const ACTIVITY = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
}

const GOAL_KCAL = { lose: -500, maintain: 0, gain: 300 }

const finitePositive = (value, label) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${label} must be positive`)
  return n
}

export function ageOnDate(birthDate, onDate = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthDate || ''))
  if (!match) throw new Error('Birth date is required')
  const [, year, month, day] = match.map(Number)
  let age = onDate.getUTCFullYear() - year
  const beforeBirthday = onDate.getUTCMonth() + 1 < month ||
    (onDate.getUTCMonth() + 1 === month && onDate.getUTCDate() < day)
  if (beforeBirthday) age -= 1
  if (age < 18) throw new Error('Nutrition targets are available for adults only')
  if (age > 120) throw new Error('Birth date is invalid')
  return age
}

export function calculateNutritionTargets(profile, onDate = new Date()) {
  const weightKg = finitePositive(profile?.weightKg, 'Weight')
  const heightCm = finitePositive(profile?.heightCm, 'Height')
  const age = ageOnDate(profile?.birthDate, onDate)
  const sexOffset = profile?.sex === 'male' ? 5 : profile?.sex === 'female' ? -161 : null
  if (sexOffset === null) throw new Error('Sex is required for the formula')
  const activity = ACTIVITY[profile?.activityLevel || profile?.activity]
  if (!activity) throw new Error('Activity level is required')
  const goalAdjustment = GOAL_KCAL[profile?.goal]
  if (goalAdjustment === undefined) throw new Error('Goal is required')

  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset
  const calorieFloor = profile.sex === 'male' ? 1500 : 1200
  const kcal = Math.max(calorieFloor, Math.round(bmr * activity + goalAdjustment))
  const proteinG = Math.round(weightKg * 1.6)
  const fatG = Math.round(weightKg * 0.8)
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4))

  return { kcal, proteinG, fatG, carbsG, formula: 'mifflin-st-jeor', confirmed: false }
}

const round1 = value => Math.round((value + Number.EPSILON) * 10) / 10

export function mealTotals(items = []) {
  const totals = { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 }
  for (const item of items) {
    const grams = Number(item?.grams)
    const factor = (Number.isFinite(grams) ? Math.max(0, grams) : 0) / 100
    for (const key of Object.keys(totals)) {
      const nutrient = Number(item?.per100?.[key])
      totals[key] += (Number.isFinite(nutrient) ? Math.max(0, nutrient) : 0) * factor
    }
  }
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, round1(value)]))
}

export function canUseNutrition({ user, guest, mobile, demo }) {
  return !!user && !guest && !mobile && !demo
}

export function reviewForDate(reviews = [], localDate) {
  return reviews.find(review => review?.localDate === localDate) || null
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
  }
  return value
}

export function nutritionSnapshotHash(value) {
  const source = JSON.stringify(stable(value))
  let hash = 2166136261
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `v1-${(hash >>> 0).toString(16).padStart(8, '0')}`
}
