// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ExerciseGuidance from './ExerciseGuidance.jsx'
import { EXIDX } from '../lib/exercises.js'
import { _setLangState } from '../lib/i18n-core.js'
import ru from '../locales/ru.js'
import ruInstr from '../instr/ru.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: { gifSize: 'full' }, update: null }
  state.update = vi.fn(mutator => mutator(state.S))
  return state
})

vi.mock('../store/useStore.js', () => ({
  useStore: selector => selector({ S: mocks.S, update: mocks.update }),
}))

vi.mock('./Media.jsx', async () => {
  const ReactModule = await import('react')
  return {
    default: props => ReactModule.createElement('div', {
      'data-fallback-map': props.ex?.id || '',
      'data-minimizable': props.minimizable ? 'yes' : 'no',
    }),
    targetText: ex => [ex?.tg, ex?.mg].filter(Boolean).join(' · '),
  }
})

let root
let container

async function render(node) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => { root.render(node) })
}

beforeEach(() => {
  mocks.S.gifSize = 'full'
  vi.clearAllMocks()
  _setLangState('ru', ru, ruInstr)
})

afterEach(async () => {
  if (root) await act(async () => { root.unmount() })
  root = null
  container?.remove()
  container = null
  _setLangState('en', {}, null)
})

describe('ExerciseGuidance', () => {
  it('shows two generated visuals and three Russian steps, then expands all steps', async () => {
    await render(<ExerciseGuidance ex={EXIDX['0025']} minimizable />)
    expect(container.querySelectorAll('img')).toHaveLength(2)
    expect(container.textContent).toContain('Как выполнять')
    expect(container.textContent).toContain('Целевые мышцы')
    expect(container.querySelectorAll('.exercise-guidance-steps li')).toHaveLength(3)

    const showAll = [...container.querySelectorAll('button')]
      .find(button => button.textContent.includes('Показать все шаги'))
    expect(showAll).toBeTruthy()
    await act(async () => { showAll.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(container.querySelectorAll('.exercise-guidance-steps li')).toHaveLength(7)
    expect(container.textContent).toContain('Свернуть шаги')
  })

  it('shows localized generated guidance for the next cardio batch', async () => {
    await render(<ExerciseGuidance ex={EXIDX['3666']} />)

    const images = [...container.querySelectorAll('img')]
    expect(images).toHaveLength(2)
    expect(container.textContent).toContain(ruInstr['3666'][0])
    expect(images.every(image => image.alt.includes('Ходьба на наклонной беговой дорожке'))).toBe(true)
  })

  it('shows the corrected chest-height Pallof setup next to its technique image', async () => {
    await render(<ExerciseGuidance ex={EXIDX['0979']} />)

    expect(container.textContent).toContain('на уровне груди')
    expect(container.textContent).not.toContain('на высоте талии')
    expect([...container.querySelectorAll('img')].every(image => image.alt.includes('Горизонтальный жим Паллофа'))).toBe(true)
  })

  it('keeps steps when technique fails and replaces only a failed muscle image', async () => {
    await render(<ExerciseGuidance ex={EXIDX['0025']} />)
    const [technique] = container.querySelectorAll('img')
    await act(async () => { technique.dispatchEvent(new Event('error')) })
    expect(container.querySelectorAll('img')).toHaveLength(1)
    expect(container.querySelectorAll('.exercise-guidance-steps li')).toHaveLength(3)

    const muscles = container.querySelector('img')
    await act(async () => { muscles.dispatchEvent(new Event('error')) })
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[data-fallback-map="0025"]')).toBeTruthy()
  })

  it('uses instructions and the body-map fallback for an unmapped exercise', async () => {
    const custom = { id: 'custom-1', n: 'Custom lift', tg: 'chest', st: ['Step one'] }
    await render(<ExerciseGuidance ex={custom} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('Step one')
    expect(container.querySelector('[data-fallback-map="custom-1"]')).toBeTruthy()
  })

  it('preserves the existing persisted minimize setting', async () => {
    await render(<ExerciseGuidance ex={EXIDX['0025']} minimizable />)
    const toggle = container.querySelector('.exercise-guidance-toggle')
    expect(toggle).toBeTruthy()
    await act(async () => { toggle.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(mocks.update).toHaveBeenCalledOnce()
    expect(mocks.S.gifSize).toBe('mini')
  })

  it('delegates the minimized rendering to the existing body-map control', async () => {
    mocks.S.gifSize = 'mini'
    await render(<ExerciseGuidance ex={EXIDX['0025']} minimizable />)
    expect(container.querySelectorAll('img')).toHaveLength(0)
    expect(container.querySelector('[data-fallback-map="0025"][data-minimizable="yes"]')).toBeTruthy()
  })
})
