/* @vitest-environment happy-dom */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EXIDX } from './lib/exercises.js'
import { _setLangState } from './lib/i18n-core.js'
import ru from './locales/ru.js'
import ruInstr from './instr/ru.js'
import {
  addToRoutineSheet,
  exConfigSheet,
  exerciseDetailSheet,
  exercisePicker,
  finishWorkout,
  topWeightSheet,
  workoutDetailSheet,
} from './sheets.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  S: null,
  renderSheet: null,
  openSheet: vi.fn(render => { mocks.renderSheet = render; return 'sheet' }),
  close: vi.fn(),
  update: vi.fn(mutator => mutator(mocks.S)),
}))

vi.mock('./store/useStore.js', () => {
  const snapshot = () => ({ S: mocks.S, user: null, update: mocks.update })
  const useStore = selector => selector(snapshot())
  useStore.getState = snapshot
  return { useStore }
})
vi.mock('./store/useUI.js', () => {
  const snapshot = () => ({
    openSheet: mocks.openSheet,
    toast: vi.fn(),
    stopRest: vi.fn(),
    startRest: vi.fn(),
  })
  const useUI = selector => selector ? selector(snapshot()) : snapshot()
  useUI.getState = snapshot
  return { useUI }
})
vi.mock('./components/Media.jsx', async () => {
  const ReactModule = await import('react')
  const Stub = ({ ex }) => ReactModule.createElement('span', { 'data-media': ex?.id })
  return { default: Stub, Thumb: Stub }
})
vi.mock('./components/BodyMap.jsx', () => ({ default: () => null }))
vi.mock('./components/Icon.jsx', () => ({ default: () => null, ICON_NAMES: ['dumbbell'] }))
vi.mock('./components/Stepper.jsx', () => ({ default: () => null }))
vi.mock('./components/ui.jsx', async () => {
  const ReactModule = await import('react')
  const Button = ({ children, ...props }) => ReactModule.createElement('button', props, children)
  const Empty = () => null
  return { Button, Slider: Empty, Switch: Empty, Segmented: Empty, SelectRow: Empty, Row: Empty }
})
vi.mock('./lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn() }))

let root
let container

async function renderCapturedSheet() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => { root.render(mocks.renderSheet(mocks.close)) })
}

async function closeRenderedSheet() {
  if (root) await act(async () => { root.unmount() })
  root = null
  container?.remove()
  container = null
}

beforeEach(() => {
  _setLangState('ru', {}, null)
  mocks.S = {
    unit: 'kg', body: 'male', gifSize: 'full', sound: false,
    workouts: [], exWeights: {}, customEx: [], bodyweight: [],
    routines: [{ id: 'push', name: 'Push Day', emoji: 'dumbbell', ex: [] }],
    active: {
      id: 'active', name: 'Push Day', d: '2026-08-29', start: Date.now(), routineId: 'push', cur: 0,
      entries: [{
        id: '0025', target: { mode: 'reps', sets: 1, reps: 8, weight: 60 },
        sets: [{ phase: 'work', w: 60, r: 8, done: true }],
      }],
    },
  }
  mocks.renderSheet = null
  vi.clearAllMocks()
})

afterEach(async () => {
  await closeRenderedSheet()
  _setLangState('en', {}, null)
})

async function expectRussianName(open) {
  open()
  expect(mocks.renderSheet).toBeTypeOf('function')
  await renderCapturedSheet()
  expect(container.textContent).toContain('Жим штанги лёжа')
  expect(container.textContent).not.toContain('barbell bench press')
  await closeRenderedSheet()
}

describe('localized exercise names in sheets', () => {
  it('uses corrected exercise instructions in the detail sheet', async () => {
    _setLangState('ru', ru, ruInstr)
    exerciseDetailSheet(EXIDX['0979'])
    await renderCapturedSheet()

    expect(container.textContent).toContain('на уровне груди')
    expect(container.textContent).not.toContain('на высоте талии')
  })

  it('uses the Russian name in detail, add, picker, and configuration sheets', async () => {
    const ex = EXIDX['0025']
    await expectRussianName(() => exerciseDetailSheet(ex))
    await expectRussianName(() => addToRoutineSheet(ex))
    exercisePicker(vi.fn())
    await renderCapturedSheet()
    const search = container.querySelector('input')
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setValue.call(search, 'жим штанги лёжа')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.textContent).toContain('Жим штанги лёжа')
    expect(container.textContent).not.toContain('barbell bench press')
    await closeRenderedSheet()
    await expectRussianName(() => exConfigSheet(ex, null, vi.fn()))
  })

  it('uses the Russian name in workout history and completion sheets', async () => {
    await expectRussianName(() => workoutDetailSheet({
      id: 'done', name: 'Push Day', d: '2026-08-29', start: 1, end: 1001, vol: 480,
      entries: [{ id: '0025', target: { reps: 8 }, sets: [{ w: 60, r: 8, done: true }] }],
      prs: [],
    }))
    await expectRussianName(() => topWeightSheet(0))
  })

  it('keeps a deleted custom snapshot name in workout history', async () => {
    workoutDetailSheet({
      id: 'deleted', name: 'Custom Day', d: '2026-08-29', start: 1, end: 1001, vol: 80,
      entries: [{
        id: 'deleted-custom',
        muscleSnapshot: { n: 'eBay curl', muscleWeights: { biceps: 1 } },
        target: { reps: 8 }, sets: [{ w: 10, r: 8, done: true }],
      }],
      prs: [],
    })
    await renderCapturedSheet()

    expect(container.textContent).toContain('eBay curl')
    expect(container.textContent).not.toContain('deleted-custom')
  })

  it('uses the Russian exercise name in the finish-summary PR row', async () => {
    finishWorkout()
    await renderCapturedSheet()

    expect(container.textContent).toContain('Жим штанги лёжа')
    expect(container.textContent).not.toContain('barbell bench press')
  })
})
