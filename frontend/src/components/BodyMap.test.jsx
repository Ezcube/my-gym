/* @vitest-environment happy-dom */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BodyMap from './BodyMap.jsx'

vi.mock('../lib/body-paths.js', async () => {
  throw new Error('geometry unavailable')
})

let root
let container

afterEach(async () => {
  if (root) await act(async () => { root.unmount() })
  root = null
  container?.remove()
  container = null
})

describe('BodyMap fallback', () => {
  it('keeps caller-provided content visible when geometry cannot load', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(<BodyMap load={{ chest: 1 }} fallback={<div data-map-fallback="true">Fallback</div>} />)
      await Promise.resolve()
    })
    expect(container.querySelector('[data-map-fallback="true"]')).toBeTruthy()
  })
})
