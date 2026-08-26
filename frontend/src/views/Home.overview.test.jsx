import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Home from './Home.jsx'

const mocks = vi.hoisted(() => ({
  S: { dayPlan: {}, bodyweight: [], workouts: [], routines: [], week: {}, active: null, targetW: null, unit: 'kg' },
  user: null,
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../store/useStore.js', () => ({ useStore: selector => selector({ S: mocks.S, user: mocks.user }) }))
vi.mock('../lib/history.js', () => ({
  effectiveRoutine: () => null, effectiveRoutineId: () => null, streakWeeks: () => 0, lastBW: () => null, setsDoneActive: () => 0,
}))
vi.mock('../sheets.jsx', () => ({
  bwSheet: () => {}, goalSheet: () => {}, dayOverrideSheet: () => {}, calendarSheet: () => {}, startFlow: () => {}, loadStarterPlan: () => {}, bwDeltaColor: () => '',
}))
vi.mock('../components/LineChart.jsx', () => ({ default: () => null }))
vi.mock('../components/Icon.jsx', () => ({ default: () => React.createElement('span') }))
vi.mock('../components/ui.jsx', () => ({ Button: ({ children, ...props }) => React.createElement('button', props, children) }))
vi.mock('../lib/glyphs.js', () => ({ glyphOf: () => 'dumbbell' }))
vi.mock('../components/DailyOverviewCards.jsx', () => ({ default: () => React.createElement('div', { 'data-daily-overview': true }) }))

let dom
let root
let container

beforeEach(() => {
  dom = new Window({ url: 'https://gym.innu.ru/#/home' })
  globalThis.window = dom
  globalThis.document = dom.document
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.navigator })
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => { root.unmount() })
  dom.close()
})

describe('Home daily overview', () => {
  it('mounts the nutrition/activity cards and uses the My Gym fallback brand', async () => {
    await act(async () => { root.render(<Home />) })
    expect(container.querySelector('[data-daily-overview]')).toBeTruthy()
    expect(container.querySelector('h1').textContent).toBe('My Gym')
    expect(container.textContent).not.toContain('openGym')
  })
})
