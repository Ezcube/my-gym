import { api } from './api.js'

const json = (method, body) => ({ method, body: JSON.stringify(body) })
const query = (name, value) => `${name}=${encodeURIComponent(String(value || ''))}`

export const nutritionApi = {
  getProfile: () => api('/api/nutrition/profile'),
  saveProfile: payload => api('/api/nutrition/profile', json('PUT', payload)),
  analyzePhoto: payload => api('/api/nutrition/photo-analysis', json('POST', payload)),
  lookupBarcode: code => api(`/api/nutrition/barcode?${query('code', code)}`),
  listMeals: localDate => api(`/api/nutrition/meals?${query('date', localDate)}`),
  createMeal: meal => api('/api/nutrition/meals', json('POST', { meal })),
  updateMeal: (id, patch) => api(`/api/nutrition/meals?${query('id', id)}`, json('PATCH', { meal: { id, ...patch } })),
  deleteMeal: id => api(`/api/nutrition/meals?${query('id', id)}`, { method: 'DELETE' }),
  requestReview: payload => api('/api/nutrition/review', json('POST', payload)),
  getHealthSummary: localDate => api(`/api/health/summary?${query('localDate', localDate)}`),
}
