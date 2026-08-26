import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HealthPairingCard, canShowHealthPairing } from './HealthPairingCard.jsx'

let dom
let root
let container

beforeEach(() => {
  dom = new Window({ url: 'https://gym.innu.ru/#/settings' })
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

async function renderCard(Component, client, props = {}) {
  await act(async () => {
    root.render(React.createElement(Component, { client, ...props }))
    await Promise.resolve()
  })
}

describe('HealthPairingCard', () => {
  it('is enabled only for a signed-in browser profile', () => {
    expect(canShowHealthPairing({ user: { id: 'user-1' }, demo: false, mobile: false })).toBe(true)
    expect(canShowHealthPairing({ user: null, demo: false, mobile: false })).toBe(false)
    expect(canShowHealthPairing({ user: { id: 'user-1' }, demo: true, mobile: false })).toBe(false)
    expect(canShowHealthPairing({ user: { id: 'user-1' }, demo: false, mobile: true })).toBe(false)
  })

  it('loads paired devices and explains the Samsung Health data path', async () => {
    const client = {
      createPairingCode: vi.fn(),
      listDevices: vi.fn(async () => ({
        devices: [{
          id: 'device-1', deviceName: 'Galaxy S24', active: true,
          lastSyncAt: '2026-08-25T10:00:00.000Z', pairedAt: '2026-08-24T10:00:00.000Z',
        }],
      })),
    }

    await renderCard(HealthPairingCard, client)

    expect(client.listDevices).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Samsung Health → Health Connect')
    expect(container.textContent).toContain('Galaxy S24')
    expect(container.textContent).toContain('Active')
    expect(container.querySelector('time[datetime="2026-08-25T10:00:00.000Z"]')).toBeTruthy()
  })

  it('creates an expiring code and lets the user refresh the device list', async () => {
    const client = {
      createPairingCode: vi.fn(async () => ({ code: 'AB12CD34', expiresAt: '2026-08-25T12:10:00.000Z' })),
      listDevices: vi.fn(async () => ({ devices: [] })),
    }
    await renderCard(HealthPairingCard, client)

    const create = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Create pairing code'))
    await act(async () => { create.click(); await Promise.resolve() })

    expect(client.createPairingCode).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('AB12 CD34')
    expect(container.querySelector('time[datetime="2026-08-25T12:10:00.000Z"]')).toBeTruthy()

    const refresh = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Refresh devices'))
    await act(async () => { refresh.click(); await Promise.resolve() })
    expect(client.listDevices).toHaveBeenCalledTimes(2)
  })

  it('revokes an owned active device only after confirmation and refreshes the list', async () => {
    const client = {
      createPairingCode: vi.fn(),
      listDevices: vi.fn()
        .mockResolvedValueOnce({ devices: [{ id: 'device-1', deviceName: 'Galaxy S24', active: true, lastSyncAt: null }] })
        .mockResolvedValueOnce({ devices: [] }),
      revokeDevice: vi.fn(async () => ({ ok: true })),
    }
    const confirm = vi.fn(options => options.onConfirm())
    await renderCard(HealthPairingCard, client, { confirm })

    const revoke = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Revoke'))
    await act(async () => { revoke.click(); await Promise.resolve(); await Promise.resolve() })

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ danger: true, confirmText: 'Revoke' }))
    expect(client.revokeDevice).toHaveBeenCalledWith('device-1')
    expect(client.listDevices).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('No paired devices')
  })
})
