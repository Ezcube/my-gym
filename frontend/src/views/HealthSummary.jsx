import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNutrition } from '../store/useNutrition.js'
import { fmtNum, todayISO } from '../lib/format.js'
import { dateLocale, t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'

function Metric({ icon, label, value, unit }) {
  return <div className="card">
    <div className="row" style={{ marginBottom: 8 }}><span className="lrow-i"><Icon name={icon} /></span><h2 style={{ margin: 0 }}>{label}</h2></div>
    <div style={{ fontSize: 24, fontWeight: 600 }}>{value == null ? '—' : fmtNum(value)}{value == null ? '' : unit}</div>
  </div>
}

export function HealthSummaryContent({ summary, localDate }) {
  if (!summary) return <div className="narrow">
    <div className="hdr"><div><h1>{t('Activity and recovery')}</h1><div className="sub">{localDate}</div></div></div>
    <div className="card">
      <h2>{t('No health data for this day')}</h2>
      <p className="small muted" style={{ lineHeight: 1.5 }}>{t('Open the Android companion and sync when convenient; training and nutrition remain available without it.')}</p>
    </div>
  </div>

  const sleepHours = summary.sleepMinutes == null ? null : Math.round(summary.sleepMinutes / 6) / 10
  const workouts = summary.workouts || []
  const synced = summary.syncedAt ? new Date(summary.syncedAt).toLocaleString(dateLocale(), { dateStyle: 'medium', timeStyle: 'short' }) : null

  return <div className="narrow">
    <div className="hdr"><div><h1>{t('Activity and recovery')}</h1><div className="sub">{localDate}</div></div></div>
    <div className="grid2">
      <Metric icon="figureRun" label={t('Steps')} value={summary.steps} unit="" />
      <Metric icon="moon" label={t('Sleep')} value={sleepHours} unit={t(' h')} />
      <Metric icon="flame" label={t('Exercise calories')} value={summary.exerciseCalories} unit={t(' kcal')} />
      <Metric icon="scale" label={t('Weight')} value={summary.weightKg} unit={t(' kg')} />
      <Metric icon="heart" label={t('Average heart rate')} value={summary.heartRateAvgBpm} unit={t(' bpm')} />
      <Metric icon="heart" label={t('Oxygen saturation')} value={summary.oxygenSaturationPercent} unit="%" />
      <Metric icon="person" label={t('Body fat')} value={summary.bodyFatPercent} unit="%" />
    </div>

    <div className="card">
      <h2>{t('Health workouts')}</h2>
      {workouts.length ? workouts.map(workout => <div className="lrow" key={workout.id || `${workout.name}-${workout.startedAt}`}>
        <span className="lrow-i" style={{ background: 'var(--orange)' }}><Icon name="figureRun" /></span>
        <span className="lrow-m"><span className="lrow-t">{workout.name || t('Workout')}</span><span className="lrow-s">{t('{0} min', fmtNum(workout.durationMinutes || 0))}</span></span>
        <span className="lrow-v">{workout.calories == null ? '' : t('{0} kcal', fmtNum(workout.calories))}</span>
      </div>) : <div className="small muted">{t('No synced workouts')}</div>}
    </div>

    <div className="card small muted" style={{ lineHeight: 1.5 }}>
      <div>{t('Source: {0}', summary.source || 'Samsung Health / Health Connect')}</div>
      <div>{synced ? t('Last synced: {0}', synced) : t('Sync time is unavailable')}</div>
      <div style={{ marginTop: 6 }}>{t('Watch calories do not automatically increase your nutrition target.')}</div>
    </div>
  </div>
}

export default function HealthSummary() {
  const localDate = todayISO()
  const summary = useNutrition(state => state.health)
  const loadDay = useNutrition(state => state.loadDay)
  const nav = useNavigate()
  useEffect(() => { loadDay(localDate) }, [loadDay, localDate])
  return <>
    <button className="iconbtn" style={{ position: 'fixed', top: 12, left: 12, zIndex: 2 }} onClick={() => nav('/home')} aria-label={t('Home')}><Icon name="chevronLeft" /></button>
    <HealthSummaryContent summary={summary} localDate={localDate} />
  </>
}
