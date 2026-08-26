import { describe, expect, it, vi } from 'vitest'
import { createHealthDevicesApi } from './health-devices-api.js'

describe('health devices API client', () => {
  it('uses the authenticated web pairing and device-list endpoints', async () => {
    const request = vi.fn(async () => ({ devices: [] }))
    const client = createHealthDevicesApi(request)

    await client.createPairingCode()
    expect(request).toHaveBeenNthCalledWith(1, '/api/health/pairing-code', {
      method: 'POST',
      body: '{}',
    })

    await client.listDevices()
    expect(request).toHaveBeenNthCalledWith(2, '/api/health/devices')

    await client.revokeDevice('device 1')
    expect(request).toHaveBeenNthCalledWith(3, '/api/health/devices/device%201', {
      method: 'DELETE',
    })
  })
})
