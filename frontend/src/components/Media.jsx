import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { musclesOf } from '../lib/muscles.js'
import BodyMap from './BodyMap.jsx'
import Icon from './Icon.jsx'

const targetText = ex => [...new Set([
  ex?.tg || ex?.bp,
  ex?.mg,
  ...(Array.isArray(ex?.sm) ? ex.sm : []),
].filter(Boolean))].map(value => t(value)).join(' · ')

export default function Media({ ex, id, compact, minimizable }) {
  const gifSize = useStore(s => s.S.gifSize)
  const body = useStore(s => s.S.body)
  const update = useStore(s => s.update)
  const load = musclesOf(ex || {})
  const hasTargets = Object.values(load).some(value => value > 0)
  const mini = minimizable && gifSize === 'mini'
  const target = targetText(ex)
  const toggleSize = event => {
    event.stopPropagation()
    update(state => { state.gifSize = mini ? 'full' : 'mini' })
  }

  return (
    <div className={'exmedia' + (compact ? ' compact' : '') + (mini ? ' mini' : '')} id={id}>
      <div className="exvisual" role="group" aria-label={t('Muscle target visual for {0}', ex?.n || '')}>
        {!mini && <div className="exvisual-copy">
          <strong>{t('Target muscles')}</strong>
          <span>{target || t('Target information unavailable')}</span>
          {ex?.eq && <small>{t(ex.eq)}</small>}
        </div>}
        {hasTargets
          ? <BodyMap
              load={load}
              body={body}
              className="exercise-target-map"
              fallback={<div className="exvisual-empty" aria-hidden="true">
                <Icon name="figureStrength" />
              </div>}
            />
          : <div className="exvisual-empty">
              <Icon name="figureStrength" />
              <span>{t('Target information unavailable')}</span>
            </div>}
      </div>
      {minimizable && (
        <button className="giftoggle" onClick={toggleSize}>
          <Icon name={mini ? 'expand' : 'minimize'} />{mini ? t('Expand') : t('Minimize')}
        </button>
      )}
    </div>
  )
}

export function Thumb({ ex }) {
  const cardio = ex?.bp === 'cardio'
  return (
    <div className="thumb thumb-viz" data-body-part={ex?.bp || ''} aria-hidden="true">
      <Icon name={cardio ? 'figureRun' : 'figureStrength'} />
    </div>
  )
}
