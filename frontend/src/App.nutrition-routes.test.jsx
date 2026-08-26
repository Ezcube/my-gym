import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'

const mocks = vi.hoisted(() => ({
  user: { id: 'u1', name: 'Alex' },
  guest: false,
  boot: vi.fn(),
}))

vi.mock('./store/useStore.js', () => ({
  useStore: (selector = value => value) => selector({
    S: { theme: 'dark', accent: 'lime', lang: 'en', active: null, keepAwake: true },
    user: mocks.user,
    ready: true,
    boot: mocks.boot,
    isGuest: () => mocks.guest,
  }),
}))
vi.mock('./store/useUI.js', () => ({ useUI: {} }))
vi.mock('./components/ui.jsx', () => ({ bindUI: () => {} }))
vi.mock('./lib/i18n.js', () => ({ setLang: () => {}, useLang: () => 0 }))
vi.mock('./lib/nav.js', () => ({ setNav: () => {} }))
vi.mock('./lib/back.js', () => ({ initBackButton: async () => () => {} }))
vi.mock('./lib/wakelock.js', () => ({ useWakeLock: () => {} }))
vi.mock('./sheets.jsx', () => ({ startFlow: () => {} }))
vi.mock('./components/Icon.jsx', () => ({ default: () => React.createElement('span') }))
vi.mock('./components/TabBar.jsx', () => ({ default: () => null }))
vi.mock('./components/ErrorBoundary.jsx', () => ({ default: ({ children }) => children }))
vi.mock('./components/Modals.jsx', () => ({ default: () => null }))
vi.mock('./components/Toast.jsx', () => ({ default: () => null }))
vi.mock('./components/RestTimer.jsx', () => ({ default: () => null }))
vi.mock('./views/Login.jsx', () => ({ default: () => React.createElement('div', { 'data-view': 'login' }) }))
vi.mock('./views/Home.jsx', () => ({ default: () => React.createElement('div', { 'data-view': 'home' }) }))
vi.mock('./views/Plan.jsx', () => ({ default: () => null }))
vi.mock('./views/RoutineEdit.jsx', () => ({ default: () => null }))
vi.mock('./views/Workout.jsx', () => ({ default: () => null }))
vi.mock('./views/Stats.jsx', () => ({ default: () => null }))
vi.mock('./views/History.jsx', () => ({ default: () => null }))
vi.mock('./views/Library.jsx', () => ({ default: () => null }))
vi.mock('./views/Settings.jsx', () => ({ default: () => null }))
vi.mock('./views/Admin.jsx', () => ({ default: () => null }))
vi.mock('./views/Nutrition.jsx', () => ({ default: () => React.createElement('div', { 'data-view': 'nutrition' }) }))
vi.mock('./views/HealthSummary.jsx', () => ({ default: () => React.createElement('div', { 'data-view': 'health' }) }))
vi.mock('./lib/mobile.js', () => ({ MOBILE: false }))
vi.mock('./lib/demo.js', () => ({ DEMO: false }))

let dom
let root
let container

async function mount(hash) {
  dom = new Window({ url: `https://gym.innu.ru/${hash}` })
  dom.scrollTo = vi.fn()
  globalThis.window = dom
  globalThis.document = dom.document
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.navigator })
  for (const key of ['HTMLElement', 'Node', 'Element', 'Event']) globalThis[key] = dom[key]
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => { root.render(<App />) })
}

beforeEach(() => {
  mocks.user = { id: 'u1', name: 'Alex' }
  mocks.guest = false
  mocks.boot.mockReset()
})

afterEach(async () => {
  if (root) await act(async () => { root.unmount() })
  root = null
  dom?.close()
})

describe('authenticated nutrition routes', () => {
  it('opens nutrition and health routes for a signed-in web profile', async () => {
    await mount('#/nutrition')
    expect(container.querySelector('[data-view="nutrition"]')).toBeTruthy()
    await act(async () => { root.unmount() })
    root = null
    dom.close()
    await mount('#/health')
    expect(container.querySelector('[data-view="health"]')).toBeTruthy()
  })

  it('redirects a guest away from nutrition', async () => {
    mocks.user = null
    mocks.guest = true
    await mount('#/nutrition')
    expect(container.querySelector('[data-view="home"]')).toBeTruthy()
    expect(container.querySelector('[data-view="nutrition"]')).toBeNull()
  })
})
