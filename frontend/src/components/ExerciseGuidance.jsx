import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { instrFor, t } from '../lib/i18n.js'
import { exerciseVisualFor } from '../lib/exercise-visuals.js'
import { exerciseName } from '../lib/exercise-names.js'
import Media, { targetText } from './Media.jsx'
import Icon from './Icon.jsx'

const phaseLabels = ['Start position', 'Working phase', 'Completion']

export default function ExerciseGuidance({ ex, compact = false, minimizable = false }) {
  const gifSize = useStore(state => state.S.gifSize)
  const update = useStore(state => state.update)
  const [expanded, setExpanded] = useState(false)
  const [failed, setFailed] = useState({})
  const visual = exerciseVisualFor(ex?.id)
  const steps = instrFor(ex || {})
  const visibleSteps = expanded ? steps : steps.slice(0, 3)
  const mini = minimizable && gifSize === 'mini'
  const name = exerciseName(ex)

  useEffect(() => {
    setExpanded(false)
    setFailed({})
  }, [ex?.id])

  const fail = kind => setFailed(current => ({ ...current, [kind]: true }))
  const toggleSize = event => {
    event.stopPropagation()
    update(state => { state.gifSize = mini ? 'full' : 'mini' })
  }

  if (mini) {
    return <div className="exercise-guidance mini">
      <Media ex={ex} compact minimizable />
    </div>
  }

  return <div className={'exercise-guidance' + (compact ? ' compact' : '')}>
    <section className="exercise-guidance-card technique-card" aria-label={t('Technique demonstration for {0}', name)}>
      <strong className="exercise-guidance-label">{t('How to perform')}</strong>
      {visual?.technique && !failed.technique && <>
        <img
          className="exercise-guidance-image technique-image"
          src={visual.technique.src}
          width={visual.technique.width}
          height={visual.technique.height}
          loading="lazy"
          decoding="async"
          alt={t('Technique demonstration for {0}', name)}
          onError={() => fail('technique')}
        />
        <div className="exercise-guidance-phases" aria-hidden="true">
          {phaseLabels.map(label => <span key={label}>{t(label)}</span>)}
        </div>
      </>}
      {visibleSteps.length > 0 && <ol className="exercise-guidance-steps">
        {visibleSteps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}
      </ol>}
      {steps.length > 3 && <button type="button" className="exercise-guidance-more" aria-expanded={expanded}
        onClick={() => setExpanded(value => !value)}>
        {expanded ? t('Show fewer steps') : t('Show all steps')}
      </button>}
    </section>

    {visual?.muscles && !failed.muscles
      ? <section className="exercise-guidance-card muscles-card" aria-label={t('Target muscles for {0}', name)}>
          <strong className="exercise-guidance-label">{t('Target muscles')}</strong>
          <span className="exercise-guidance-targets">{targetText(ex)}</span>
          <img
            className="exercise-guidance-image muscles-image"
            src={visual.muscles.src}
            width={visual.muscles.width}
            height={visual.muscles.height}
            loading="lazy"
            decoding="async"
            alt={t('Target muscles for {0}', name)}
            onError={() => fail('muscles')}
          />
        </section>
      : <Media ex={ex} compact={compact} />}

    <p className="exercise-guidance-safety">{t('Stop if the movement causes pain. Ask a qualified coach if you are unsure about technique.')}</p>
    {minimizable && <button type="button" className="exercise-guidance-toggle" onClick={toggleSize}>
      <Icon name="minimize" />{t('Minimize')}
    </button>}
  </div>
}
