import { afterEach, describe, expect, it } from 'vitest'
import { EXERCISE_VISUAL_IDS } from './exercise-visuals.js'
import { EXIDX } from './exercises.js'
import { _setLangState } from './i18n-core.js'
import { exerciseName } from './exercise-names.js'

afterEach(() => { _setLangState('en', {}, null) })

describe('exerciseName', () => {
  it('provides a readable Russian title for every generated exercise visual', () => {
    _setLangState('ru', {}, null)

    for (const id of EXERCISE_VISUAL_IDS) {
      const name = exerciseName(EXIDX[id])
      expect(name, id).toMatch(/[А-ЯЁа-яё]/)
      expect(name, id).not.toBe(EXIDX[id].n)
    }
  })

  it('falls back to a sentence-cased catalogue name outside the Russian visual set', () => {
    _setLangState('en', {}, null)

    expect(exerciseName({ id: 'custom', n: 'custom lift' })).toBe('Custom lift')
    expect(exerciseName({ id: '0001', n: '3/4 sit-up' })).toBe('3/4 sit-up')
  })
})
