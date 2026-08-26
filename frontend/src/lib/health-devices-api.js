import { api } from './api.js'

export function createHealthDevicesApi(request = api) {
  return {
    createPairingCode: () => request('/api/health/pairing-code', {
      method: 'POST',
      body: '{}',
    }),
    listDevices: () => request('/api/health/devices'),
    revokeDevice: deviceId => request(`/api/health/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
    }),
  }
}

export const healthDevicesApi = createHealthDevicesApi()
