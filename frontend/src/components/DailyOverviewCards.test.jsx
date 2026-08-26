import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DailyOverviewCards from './DailyOverviewCards.jsx'

const mocks = vi.hoisted(() => ({
  nav: vi.fn(),
  loadDay: vi.fn(),
  user: { id: 'u1' },
  guest: false,
  nutrition: {
    targets: { kcal: 2100, proteinG: 130, fatG: 70, carbsG: 240, confirmed: true },
    meals: [{ totals: { kcal: 450, proteinG: 35, fatG: 16, carbsG: 42 } }],
    health: { steps: 7342, sleepMinutes: 450, exerciseCalories: 380, syncedAt: '2026-08-25T10:00:00Z' },
  },
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.nav }))
vi.mock('../store/useStore.js', () => ({
  useStore: selector => selector({ user: mocks.user, isGuest: () => mocks.guest }),
}))
vi.mock('../store/useNutrition.js', () => ({
  useNutrition: selector => selector({ ...mocks.nutrition, loadDay: mocks.loadDay }),
}))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false }))
vi.mock('../lib/demo.js', () => ({ DEMO: false }))
vi.mock('./Icon.jsx', () => ({ default: ({ name }) => React.createElement('span', { 'data-icon': name }) }))

let dom
let root
let container

beforeEach(async () => {
  dom = new Window({ url: 'https://gym.innu.ru/#/home' })
  globalThis.window = dom
  globalThis.document = dom.document
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.navigator })
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  mocks.user = { id: 'u1' }
  mocks.guest = false
  mocks.nav.mockReset()
  mocks.loadDay.mockReset()
})

afterEach(async () => {
  await act(async () => { root.unmount() })
  dom.close()
})

describe('DailyOverviewCards', () => {
  it('shows nutrition and activity summaries and opens their read-only routes', async () => {
    await act(async () => { root.render(<DailyOverviewCards />) })
    expect(container.textContent).toContain('450 / 2,100 kcal')
    expect(container.textContent).toContain('7,342 steps')
    expect(mocks.loadDay).toHaveBeenCalledTimes(1)

    const cards = container.querySelectorAll('button.card')
    await act(async () => { cards[0].click(); cards[1].click() })
    expect(mocks.nav.mock.calls).toEqual([['/nutrition'], ['/health']])
  })

  it('renders nothing for a guest profile', async () => {
    mocks.user = null
    mocks.guest = true
    await act(async () => { root.render(<DailyOverviewCards />) })
    expect(container.innerHTML).toBe('')
    expect(mocks.loadDay).not.toHaveBeenCalled()
  })
})
