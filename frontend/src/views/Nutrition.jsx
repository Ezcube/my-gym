import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNutrition } from '../store/useNutrition.js'
import { calculateNutritionTargets, mealTotals } from '../lib/nutrition.js'
import { prepareFoodPhoto } from '../lib/nutrition-photo.js'
import { fmtNum, todayISO } from '../lib/format.js'
import { getLang, t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

const EMPTY_PROFILE = {
  sex: 'male', birthDate: '', heightCm: '', weightKg: '', activityLevel: 'moderate', goal: 'maintain',
  allergies: '', preferences: '', exclusions: '',
}

const MODES = [
  { value: 'photo', label: 'Photo', icon: 'sparkles' },
  { value: 'barcode', label: 'Barcode', icon: 'magnifier' },
  { value: 'manual', label: 'Manual', icon: 'pencil' },
  { value: 'repeat', label: 'Repeat', icon: 'history' },
]

const number = event => {
  const value = Number(event.target.value)
  return Number.isFinite(value) ? Math.max(0, value) : 0
}
const validDraft = draft => !!draft?.items?.length && draft.items.every(item => item.name?.trim() && Number(item.grams) > 0)

function NutrientLine({ totals }) {
  return <div className="small muted" style={{ lineHeight: 1.5 }}>
    {t('{0} kcal', fmtNum(totals.kcal))} · {t('P {0} g', fmtNum(totals.proteinG))} · {t('F {0} g', fmtNum(totals.fatG))} · {t('C {0} g', fmtNum(totals.carbsG))}
  </div>
}

function TargetCard({ profile, targets, saveProfile, loading }) {
  const [editing, setEditing] = useState(!targets?.confirmed)
  const [profileDraft, setProfileDraft] = useState({ ...EMPTY_PROFILE, ...(profile || {}) })
  const [targetDraft, setTargetDraft] = useState(targets || null)
  const [error, setError] = useState(null)
  const field = key => event => setProfileDraft(current => ({ ...current, [key]: event.target.value }))
  const targetField = key => event => {
    const value = Number(event.target.value)
    setTargetDraft(current => ({ ...current, [key]: Number.isFinite(value) ? Math.max(0, value) : 0 }))
  }

  useEffect(() => {
    if (profile) setProfileDraft({ ...EMPTY_PROFILE, ...profile })
    if (targets) {
      setTargetDraft(targets)
      setEditing(!targets.confirmed)
    }
  }, [profile, targets])

  if (!editing && targets?.confirmed) return <div className="card">
    <div className="row between">
      <div>
        <h2>{t('Daily targets')}</h2>
        <div className="big">{fmtNum(targets.kcal)} {t('kcal')}</div>
        <NutrientLine totals={targets} />
      </div>
      <Button size="sm" onClick={() => setEditing(true)}>{t('Edit')}</Button>
    </div>
  </div>

  const calculate = () => {
    try {
      setTargetDraft(calculateNutritionTargets({
        ...profileDraft,
        heightCm: Number(profileDraft.heightCm),
        weightKg: Number(profileDraft.weightKg),
      }))
      setError(null)
    } catch (cause) { setError(cause.message) }
  }
  const confirm = async () => {
    if (!targetDraft) return
    const calorieFloor = profileDraft.sex === 'male' ? 1500 : 1200
    if (targetDraft.kcal < calorieFloor || targetDraft.kcal > 10000 ||
      ['proteinG', 'fatG', 'carbsG'].some(key => !Number.isFinite(targetDraft[key]) || targetDraft[key] < 0 || targetDraft[key] > 1000)) {
      setError(t('Review target values'))
      return
    }
    try {
      await saveProfile({
        ...profileDraft,
        heightCm: Number(profileDraft.heightCm),
        weightKg: Number(profileDraft.weightKg),
        allergies: String(profileDraft.allergies || '').split(',').map(value => value.trim()).filter(Boolean),
        preferences: String(profileDraft.preferences || '').split(',').map(value => value.trim()).filter(Boolean),
        exclusions: String(profileDraft.exclusions || '').split(',').map(value => value.trim()).filter(Boolean),
        locale: getLang(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      }, { ...targetDraft, confirmed: true, source: 'mifflin-st-jeor', confirmedAt: new Date().toISOString() })
      setEditing(false)
    } catch { setError(t('Could not save targets')) }
  }

  return <div className="card">
    <h2>{t('Nutrition profile and targets')}</h2>
    <div className="grid2">
      <label className="small muted">{t('Sex for formula')}<select className="field" value={profileDraft.sex} onChange={field('sex')}><option value="male">{t('Male')}</option><option value="female">{t('Female')}</option></select></label>
      <label className="small muted">{t('Birth date')}<input className="field" type="date" value={profileDraft.birthDate} onChange={field('birthDate')} /></label>
      <label className="small muted">{t('Height, cm')}<input className="field" inputMode="decimal" value={profileDraft.heightCm} onChange={field('heightCm')} /></label>
      <label className="small muted">{t('Weight, kg')}<input className="field" inputMode="decimal" value={profileDraft.weightKg} onChange={field('weightKg')} /></label>
      <label className="small muted">{t('Activity')}<select className="field" value={profileDraft.activityLevel || profileDraft.activity} onChange={field('activityLevel')}><option value="sedentary">{t('Sedentary')}</option><option value="light">{t('Light')}</option><option value="moderate">{t('Moderate')}</option><option value="very">{t('Very active')}</option></select></label>
      <label className="small muted">{t('Nutrition goal')}<select className="field" value={profileDraft.goal} onChange={field('goal')}><option value="lose">{t('Lose weight')}</option><option value="maintain">{t('Maintain weight')}</option><option value="gain">{t('Gain weight')}</option></select></label>
    </div>
    <div style={{ height: 10 }} />
    <input className="field" placeholder={t('Allergies, comma separated')} value={Array.isArray(profileDraft.allergies) ? profileDraft.allergies.join(', ') : profileDraft.allergies} onChange={field('allergies')} />
    <div style={{ height: 8 }} />
    <input className="field" placeholder={t('Preferences, comma separated')} value={Array.isArray(profileDraft.preferences) ? profileDraft.preferences.join(', ') : profileDraft.preferences} onChange={field('preferences')} />
    <div style={{ height: 8 }} />
    <input className="field" placeholder={t('Preferences and exclusions')} value={Array.isArray(profileDraft.exclusions) ? profileDraft.exclusions.join(', ') : profileDraft.exclusions} onChange={field('exclusions')} />
    <div style={{ height: 10 }} />
    <Button variant="tinted" onClick={calculate}>{t('Calculate targets')}</Button>
    {targetDraft && <div className="card" style={{ background: 'var(--surface-2)', margin: '10px 0 0' }}>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{fmtNum(targetDraft.kcal)} {t('kcal')}</div>
      <NutrientLine totals={targetDraft} />
      <div className="grid2" style={{ marginTop: 10 }}>
        <label className="small muted">{t('Calories')}<input className="field" type="number" aria-label="Target kcal" min={profileDraft.sex === 'male' ? 1500 : 1200} max="10000" value={targetDraft.kcal} onChange={targetField('kcal')} /></label>
        <label className="small muted">{t('Protein, g')}<input className="field" type="number" min="0" max="1000" value={targetDraft.proteinG} onChange={targetField('proteinG')} /></label>
        <label className="small muted">{t('Fat, g')}<input className="field" type="number" min="0" max="1000" value={targetDraft.fatG} onChange={targetField('fatG')} /></label>
        <label className="small muted">{t('Carbs, g')}<input className="field" type="number" min="0" max="1000" value={targetDraft.carbsG} onChange={targetField('carbsG')} /></label>
      </div>
      <div className="small muted" style={{ marginTop: 6 }}>{t('Mifflin-St Jeor estimate. Review and confirm it before use.')}</div>
      <div style={{ height: 10 }} /><Button variant="primary" disabled={loading} onClick={confirm}>{t('Confirm targets')}</Button>
    </div>}
    {error && <div className="small" role="alert" style={{ color: 'var(--red)', marginTop: 8 }}>{error}</div>}
  </div>
}

function DraftEditor({ draft, actions, localDate, loading }) {
  const totals = mealTotals(draft.items)
  return <div className="card">
    <div className="row between" style={{ marginBottom: 10 }}><h2 style={{ margin: 0 }}>{t('Check the meal before saving')}</h2><button className="iconbtn" onClick={actions.cancelDraft} aria-label={t('Cancel')}><Icon name="xmark" /></button></div>
    {draft.items.map((item, index) => <div key={index} className="card" style={{ background: 'var(--surface-2)', marginBottom: 10 }}>
      <div className="row">
        <input className="field" aria-label={`Food name ${index + 1}`} value={item.name} placeholder={t('Food name')} onChange={event => actions.updateDraftItem(index, { name: event.target.value })} />
        {draft.items.length > 1 && <button className="iconbtn" aria-label={t('Remove food')} onClick={() => actions.removeDraftItem(index)}><Icon name="trash" /></button>}
      </div>
      <div className="grid2" style={{ marginTop: 8 }}>
        <label className="small muted">{t('Grams')}<input className="field" aria-label={`Grams ${index + 1}`} inputMode="decimal" value={item.grams} onChange={event => actions.updateDraftItem(index, { grams: number(event) })} /></label>
        <label className="small muted">{t('kcal / 100 g')}<input className="field" inputMode="decimal" value={item.per100.kcal} onChange={event => actions.updateDraftItem(index, { per100: { kcal: number(event) } })} /></label>
        <label className="small muted">{t('Protein / 100 g')}<input className="field" inputMode="decimal" value={item.per100.proteinG} onChange={event => actions.updateDraftItem(index, { per100: { proteinG: number(event) } })} /></label>
        <label className="small muted">{t('Fat / 100 g')}<input className="field" inputMode="decimal" value={item.per100.fatG} onChange={event => actions.updateDraftItem(index, { per100: { fatG: number(event) } })} /></label>
        <label className="small muted">{t('Carbs / 100 g')}<input className="field" inputMode="decimal" value={item.per100.carbsG} onChange={event => actions.updateDraftItem(index, { per100: { carbsG: number(event) } })} /></label>
      </div>
    </div>)}
    <Button size="sm" icon="plus" onClick={actions.addDraftItem}>{t('Add food')}</Button>
    <div className="divider" />
    <div className="row between"><strong>{t('Meal total')}</strong><strong>{fmtNum(totals.kcal)} {t('kcal')}</strong></div>
    <NutrientLine totals={totals} />
    <div style={{ height: 12 }} /><Button variant="primary" disabled={loading || !validDraft(draft)} onClick={() => actions.confirmDraft(localDate).catch(() => {})}>{t('Confirm meal')}</Button>
    <div className="small muted" style={{ marginTop: 8 }}>{t('AI estimates are a draft. Check foods and portions before saving.')}</div>
  </div>
}

function EntryPanel({ state, actions }) {
  const [photo, setPhoto] = useState(null)
  const photoInput = useRef(null)
  const [hint, setHint] = useState('')
  const [knownWeightG, setKnownWeightG] = useState('')
  const [barcode, setBarcode] = useState('')
  const [localError, setLocalError] = useState(null)
  const mode = state.entryMode

  const analyse = async () => {
    if (!photo) return
    setLocalError(null)
    try {
      const prepared = await prepareFoodPhoto(photo)
      await actions.analyzePhoto({ image: { base64: prepared.image, mimeType: prepared.mime }, locale: getLang(), hint: hint.trim(), knownWeightG: Number(knownWeightG) || undefined })
      setPhoto(null)
      setHint('')
      setKnownWeightG('')
      if (photoInput.current) photoInput.current.value = ''
    } catch { setLocalError(t('Could not prepare or analyze the photo')) }
  }

  return <>
    <div className="card">
      <h2>{t('Add a meal')}</h2>
      <div className="grid2">
        {MODES.map(option => <Button key={option.value} variant={mode === option.value ? 'tinted' : 'plain'} icon={option.icon} onClick={() => actions.chooseEntry(option.value)}>{t(option.label)}</Button>)}
      </div>
    </div>
    {mode === 'photo' && !state.draft && <div className="card">
      <h2>{t('Photo analysis')}</h2>
      <input ref={photoInput} className="field" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event => setPhoto(event.target.files?.[0] || null)} />
      <div style={{ height: 8 }} /><input className="field" value={hint} onChange={event => setHint(event.target.value)} placeholder={t('Optional hint, for example “borscht with sour cream”')} />
      <div style={{ height: 8 }} /><input className="field" inputMode="decimal" value={knownWeightG} onChange={event => setKnownWeightG(event.target.value)} placeholder={t('Known total weight, g (optional)')} />
      <div style={{ height: 10 }} /><Button variant="primary" disabled={!photo || state.loading} onClick={analyse}>{t('Analyze photo')}</Button>
      <p className="small muted">{t('The photo is re-encoded without EXIF and is not saved by the app.')}</p>
    </div>}
    {mode === 'barcode' && !state.draft && <div className="card">
      <h2>{t('Find by barcode')}</h2>
      <input className="field" inputMode="numeric" value={barcode} onChange={event => setBarcode(event.target.value.replace(/\D/g, ''))} placeholder={t('Enter barcode digits')} />
      <div style={{ height: 10 }} /><Button variant="primary" disabled={!/^\d{8,14}$/.test(barcode) || state.loading} onClick={() => actions.lookupBarcode(barcode).catch(() => {})}>{t('Find product')}</Button>
    </div>}
    {mode === 'repeat' && !state.draft && <div className="card">
      <h2>{t('Repeat a recent meal')}</h2>
      {state.meals.length ? state.meals.slice(0, 10).map(meal => <button key={meal.id || meal.eatenAt} className="lrow tap" onClick={() => actions.repeatMeal(meal)}><span className="lrow-m"><span className="lrow-t">{meal.occasion || t('Meal')}</span><span className="lrow-s">{fmtNum(meal.totals?.kcal || 0)} {t('kcal')}</span></span><Icon name="chevronRight" className="lrow-c" /></button>) : <div className="small muted">{t('No meals to repeat yet')}</div>}
    </div>}
    {localError && <div className="card small" role="alert" style={{ color: 'var(--red)' }}>{localError}</div>}
  </>
}

export function NutritionContent({ state, actions, localDate }) {
  const review = state.reviews?.[localDate]
  return <div className="narrow">
    <div className="hdr"><div><h1>{t('Nutrition')}</h1><div className="sub">{localDate}</div></div></div>
    <TargetCard profile={state.profile} targets={state.targets} saveProfile={actions.saveProfile} loading={state.loading} />
    <EntryPanel state={state} actions={actions} />
    {state.draft && <DraftEditor draft={state.draft} actions={actions} localDate={localDate} loading={state.loading} />}

    <div className="card">
      <h2>{t('Today’s meals')}</h2>
      {state.meals.length ? state.meals.map(meal => <div className="lrow" key={meal.id || meal.eatenAt}><span className="lrow-m"><span className="lrow-t">{meal.occasion || t('Meal')}</span><NutrientLine totals={meal.totals || mealTotals(meal.items)} /></span><span className="lrow-v">{fmtNum(meal.totals?.kcal || mealTotals(meal.items).kcal)} {t('kcal')}</span></div>) : <div className="small muted">{t('Nothing logged today')}</div>}
    </div>

    <div className="card">
      <h2>{t('Daily AI review')}</h2>
      {review ? <><p style={{ lineHeight: 1.45 }}>{review.summary}</p>{review.suggestions?.length > 0 && <ul className="small" style={{ lineHeight: 1.55 }}>{review.suggestions.map((suggestion, index) => <li key={index}>{suggestion}</li>)}</ul>}</> : <Button variant="tinted" icon="sparkles" disabled={state.loading || !state.meals.length} onClick={() => actions.requestDailyReview(localDate).catch(() => {})}>{t('Generate daily review')}</Button>}
      <div className="small muted" style={{ marginTop: 8 }}>{t('General wellness guidance only — not medical advice or a diagnosis.')}</div>
    </div>
    {state.error && <div className="card small" role="alert" style={{ color: 'var(--red)' }}>{state.error}</div>}
  </div>
}

export default function Nutrition() {
  const localDate = todayISO()
  const state = {
    profile: useNutrition(value => value.profile),
    targets: useNutrition(value => value.targets),
    meals: useNutrition(value => value.meals),
    health: useNutrition(value => value.health),
    reviews: useNutrition(value => value.reviews),
    entryMode: useNutrition(value => value.entryMode),
    draft: useNutrition(value => value.draft),
    loading: useNutrition(value => value.loading),
    error: useNutrition(value => value.error),
  }
  const actions = {
    chooseEntry: useNutrition(value => value.chooseEntry),
    updateDraftItem: useNutrition(value => value.updateDraftItem),
    addDraftItem: useNutrition(value => value.addDraftItem),
    removeDraftItem: useNutrition(value => value.removeDraftItem),
    cancelDraft: useNutrition(value => value.cancelDraft),
    confirmDraft: useNutrition(value => value.confirmDraft),
    analyzePhoto: useNutrition(value => value.analyzePhoto),
    lookupBarcode: useNutrition(value => value.lookupBarcode),
    repeatMeal: useNutrition(value => value.repeatMeal),
    requestDailyReview: useNutrition(value => value.requestDailyReview),
    saveProfile: useNutrition(value => value.saveProfile),
  }
  const loadDay = useNutrition(value => value.loadDay)
  const nav = useNavigate()
  useEffect(() => { loadDay(localDate) }, [loadDay, localDate])

  return <>
    <button className="iconbtn" style={{ position: 'fixed', top: 12, left: 12, zIndex: 2 }} onClick={() => nav('/home')} aria-label={t('Home')}><Icon name="chevronLeft" /></button>
    <NutritionContent state={state} actions={actions} localDate={localDate} />
  </>
}
