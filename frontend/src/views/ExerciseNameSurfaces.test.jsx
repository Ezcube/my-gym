/* @vitest-environment happy-dom */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Library from './Library.jsx'
import RoutineEdit from './RoutineEdit.jsx'
import { _setLangState } from '../lib/i18n-core.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  S: null,
  navigate: vi.fn(),
  update: vi.fn(),
}))

vi.mock('../store/useStore.js', () => ({
  useStore: selector => selector({ S: mocks.S, update: mocks.update }),
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => ({ id: 'routine-1' }),
}))
vi.mock('../sheets.jsx', () => ({
  exerciseDetailSheet: vi.fn(),
  addToRoutineSheet: vi.fn(),
  customExSheet: vi.fn(),
  glyphPicker: vi.fn(),
  exercisePicker: vi.fn(),
  exConfigSheet: vi.fn(),
  confirmSheet: vi.fn(),
}))
vi.mock('../components/Media.jsx', async () => {
  const ReactModule = await import('react')
  return { Thumb: ({ ex }) => ReactModule.createElement('span', { 'data-thumb': ex?.id }) }
})
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null }))
vi.mock('../components/Icon.jsx', () => ({ default: () => null, ICON_NAMES: ['dumbbell'] }))
vi.mock('../components/ui.jsx', async () => {
  const ReactModule = await import('react')
  return {
    Button: ({ children, ...props }) => ReactModule.createElement('button', props, children),
    SelectRow: ({ title }) => ReactModule.createElement('div', null, title),
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
  _setLangState('ru', {}, null)
  mocks.S = {
    customEx: [], workouts: [], exWeights: {}, unit: 'kg', body: 'male',
    routines: [{
      id: 'routine-1', name: 'Push Day', emoji: 'dumbbell', prog: 'linear',
      ex: [{ id: '0025', sets: 4, reps: 8, weight: 60 }],
    }],
  }
  vi.clearAllMocks()
})

afterEach(async () => {
  if (root) await act(async () => { root.unmount() })
  root = null
  container?.remove()
  container = null
  _setLangState('en', {}, null)
})

describe('localized exercise names outside the active workout', () => {
  it('renders and searches the library by the Russian exercise name', async () => {
    await render(<Library />)

    const search = container.querySelector('input')
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setValue.call(search, 'жим штанги лёжа')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(container.textContent).toContain('Жим штанги лёжа')
    expect(container.textContent).not.toContain('No match')
  })

  it('renders the Russian exercise name in the routine editor', async () => {
    await render(<RoutineEdit />)

    expect(container.textContent).toContain('Жим штанги лёжа')
    expect(container.textContent).not.toContain('barbell bench press')
  })
})
