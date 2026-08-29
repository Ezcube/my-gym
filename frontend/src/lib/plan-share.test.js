import { afterEach, describe, expect, it } from 'vitest'
import { _setLangState } from './i18n-core.js'
import { planPrintHTML } from './plan-share.js'

afterEach(() => { _setLangState('en', {}, null) })

describe('planPrintHTML exercise names', () => {
  it('prints a generated exercise with its Russian interface name', () => {
    _setLangState('ru', {}, null)
    const html = planPrintHTML({
      unit: 'kg',
      week: { 1: 'push' },
      routines: [{
        id: 'push', name: 'Push Day',
        ex: [{ id: '0025', sets: 4, reps: 8, weight: 60 }],
      }],
    }, '')

    expect(html).toContain('Жим штанги лёжа')
    expect(html).not.toContain('barbell bench press')
  })
})
