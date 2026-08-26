import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HealthSummaryContent } from './HealthSummary.jsx'

let dom
let root
let container

beforeEach(() => {
  dom = new Window({ url: 'https://gym.innu.ru/#/health' })
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

describe('HealthSummaryContent', () => {
  it('renders Samsung Health aggregates as a read-only daily summary', async () => {
    const summary = {
      source: 'Samsung Health via Health Connect',
      steps: 7342,
      sleepMinutes: 450,
      exerciseCalories: 380,
      weightKg: 79.4,
      bodyFatPercent: 18.6,
      heartRateAvgBpm: 58,
      oxygenSaturationPercent: 97,
      syncedAt: '2026-08-25T10:00:00Z',
      workouts: [{ id: 'w1', name: 'Walking', durationMinutes: 42, calories: 210 }],
    }
    await act(async () => { root.render(<HealthSummaryContent summary={summary} localDate="2026-08-25" />) })

    expect(container.textContent).toContain('7,342')
    expect(container.textContent).toContain('7.5 h')
    expect(container.textContent).toContain('58 bpm')
    expect(container.textContent).toContain('97%')
    expect(container.textContent).toContain('Samsung Health via Health Connect')
    expect(container.textContent).toContain('Walking')
    expect(container.querySelector('input, select, textarea')).toBeNull()
  })

  it('explains that missing sync data does not block the rest of the app', async () => {
    await act(async () => { root.render(<HealthSummaryContent summary={null} localDate="2026-08-25" />) })
    expect(container.textContent).toContain('No health data for this day')
    expect(container.textContent).toContain('training and nutrition remain available')
  })
})
