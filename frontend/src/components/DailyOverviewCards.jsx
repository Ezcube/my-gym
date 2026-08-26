import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useNutrition } from '../store/useNutrition.js'
import { canUseNutrition } from '../lib/nutrition.js'
import { DEMO } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import { fmtNum, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

const sumOf = (meals, key) => (meals || []).reduce((sum, meal) => sum + (Number(meal?.totals?.[key]) || 0), 0)

export default function DailyOverviewCards() {
  const nav = useNavigate()
  const user = useStore(state => state.user)
  const guest = useStore(state => state.isGuest())
  const targets = useNutrition(state => state.targets)
  const meals = useNutrition(state => state.meals)
  const health = useNutrition(state => state.health)
  const loadDay = useNutrition(state => state.loadDay)
  const enabled = canUseNutrition({ user, guest, mobile: MOBILE, demo: DEMO })
  const localDate = todayISO()

  useEffect(() => {
    if (enabled) loadDay(localDate)
  }, [enabled, loadDay, localDate])

  if (!enabled) return null
  const kcal = sumOf(meals, 'kcal')
  const protein = sumOf(meals, 'proteinG')
  const sleepHours = health?.sleepMinutes ? Math.round(health.sleepMinutes / 6) / 10 : null

  return <div className="grid2" aria-label={t('Daily overview')}>
    <button className="card tappable" style={{ textAlign: 'left', width: '100%' }} onClick={() => nav('/nutrition')}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <span className="lrow-i" style={{ background: 'var(--orange)' }}><Icon name="plate" /></span>
        <Icon name="chevronRight" className="chev" />
      </div>
      <h2>{t('Nutrition today')}</h2>
      <div style={{ fontSize: 20, fontWeight: 600 }}>{fmtNum(kcal)} / {targets?.confirmed ? fmtNum(targets.kcal) : '—'} {t('kcal')}</div>
      <div className="small muted" style={{ marginTop: 4 }}>{t('{0} g protein', fmtNum(protein))}</div>
    </button>

    <button className="card tappable" style={{ textAlign: 'left', width: '100%' }} onClick={() => nav('/health')}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <span className="lrow-i" style={{ background: 'var(--teal)' }}><Icon name="heart" /></span>
        <Icon name="chevronRight" className="chev" />
      </div>
      <h2>{t('Activity and recovery')}</h2>
      <div style={{ fontSize: 20, fontWeight: 600 }}>{health?.steps == null ? '—' : fmtNum(health.steps)} {t('steps')}</div>
      <div className="small muted" style={{ marginTop: 4 }}>{sleepHours == null ? t('No sleep data') : t('{0} h sleep', fmtNum(sleepHours))}</div>
    </button>
  </div>
}
