/* @vitest-environment happy-dom */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Media, { Thumb } from './Media.jsx'
import { EXIDX } from '../lib/exercises.js'
import { _setLangState } from '../lib/i18n-core.js'
import ru from '../locales/ru.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = {
    S: { gifSize: 'full', body: 'male' },
    update: null,
  }
  state.update = vi.fn(mutator => mutator(state.S))
  return state
})

vi.mock('../store/useStore.js', () => ({
  useStore: selector => selector({ S: mocks.S, update: mocks.update }),
}))

vi.mock('./BodyMap.jsx', async () => {
  const ReactModule = await import('react')
  return {
    default: props => ReactModule.createElement('div', {
      'data-body-map': 'true',
      'data-body': props.body,
      'data-load': JSON.stringify(props.load),
      className: props.className,
    }),
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
  mocks.S.body = 'male'
  vi.clearAllMocks()
})

afterEach(async () => {
  if (root) await act(async () => { root.unmount() })
  root = null
  container?.remove()
  container = null
  _setLangState('en', {}, null)
})

describe('built-in exercise visuals', () => {
  it('renders the bench-press muscle map without requesting an external image', async () => {
    await render(<Media ex={EXIDX['0025']} minimizable />)
    expect(container.querySelector('img')).toBeNull()
    const map = container.querySelector('[data-body-map="true"]')
    expect(map).toBeTruthy()
    expect(map.dataset.body).toBe('male')
    expect(JSON.parse(map.dataset.load)).toMatchObject({
      chest: 1,
      triceps: 0.4,
      deltoids: 0.4,
    })
    expect(container.textContent).toContain('Target muscles')
  })

  it('keeps the persisted minimize control', async () => {
    await render(<Media ex={EXIDX['0025']} minimizable />)
    const button = container.querySelector('.giftoggle')
    expect(button).toBeTruthy()
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(mocks.update).toHaveBeenCalledOnce()
    expect(mocks.S.gifSize).toBe('mini')
  })

  it('uses non-empty local fallbacks for unknown exercises and list thumbnails', async () => {
    const custom = { id: 'custom-1', n: 'Custom lift', bp: '', eq: '', tg: '', sm: [] }
    await render(<><Media ex={custom} /><Thumb ex={custom} /></>)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.exvisual-empty')).toBeTruthy()
    expect(container.querySelector('.thumb-viz')).toBeTruthy()
    expect(container.textContent).toContain('Target information unavailable')
  })

  it('uses the localized exercise name in the target visual label', async () => {
    _setLangState('ru', {}, null)
    await render(<Media ex={EXIDX['0025']} />)

    const visual = container.querySelector('.exvisual')
    expect(visual.getAttribute('aria-label')).toContain('Жим штанги лёжа')
    expect(visual.getAttribute('aria-label')).not.toContain('barbell bench press')
  })

  it('defines the new Russian labels', () => {
    expect(ru['Target muscles']).toBe('Целевые мышцы')
    expect(ru['Target information unavailable']).toBe('Нет данных о целевых мышцах')
    expect(ru['Muscle target visual for {0}']).toBe('Схема целевых мышц: {0}')
  })
})
