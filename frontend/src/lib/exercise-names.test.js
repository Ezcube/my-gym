import { afterEach, describe, expect, it } from 'vitest'
import { EXERCISE_VISUAL_IDS } from './exercise-visuals.js'
import { EXIDX } from './exercises.js'
import { _setLangState } from './i18n-core.js'
import { exerciseName } from './exercise-names.js'

const EXPECTED_RU_VISUAL_NAMES = {
  '0025': 'Жим штанги лёжа',
  '0047': 'Жим штанги на наклонной скамье',
  '0426': 'Жим гантелей стоя над головой',
  '0334': 'Разведение гантелей в стороны',
  '0241': 'Разгибание рук на верхнем блоке с V-рукоятью',
  '0251': 'Отжимания на брусьях на грудь',
  '2330': 'Тяга верхнего блока полной амплитудой',
  '0027': 'Тяга штанги в наклоне',
  '1323': 'Горизонтальная тяга каната сидя',
  '0031': 'Сгибание рук со штангой',
  '0313': 'Молотковые сгибания с гантелями',
  '0043': 'Приседания со штангой',
  '0085': 'Румынская тяга со штангой',
  '0739': 'Жим ногами под углом 45°',
  '0585': 'Разгибание ног в тренажёре',
  '0586': 'Сгибание ног лёжа в тренажёре',
  '0605': 'Подъём на носки стоя в тренажёре',
  '0032': 'Становая тяга со штангой',
  '0091': 'Жим штанги сидя над головой',
  '0292': 'Тяга гантели одной рукой в наклоне',
  '0294': 'Сгибание рук с гантелями',
  '0054': 'Выпады со штангой',
  '0348': 'Разведение гантелей лёжа на заднюю дельту',
  '0060': 'Французский жим штанги лёжа',
  '1269': 'Сведение рук в кроссовере стоя',
  '1429': 'Подтягивания широким хватом',
  '0662': 'Отжимания от пола',
  '0472': 'Подъём ног в висе',
  '0175': 'Скручивания на верхнем блоке с колен',
  '1409': 'Ягодичный мост со штангой',
  '3666': 'Ходьба на наклонной беговой дорожке',
  '2138': 'Велотренажёр',
  '2141': 'Ходьба на эллиптическом тренажёре',
  '2311': 'Ходьба на лестничном тренажёре',
  '0979': 'Горизонтальный жим Паллофа с эспандером',
}

afterEach(() => { _setLangState('en', {}, null) })

describe('exerciseName', () => {
  it('provides a readable Russian title for every generated exercise visual', () => {
    _setLangState('ru', {}, null)
    expect(new Set(Object.keys(EXPECTED_RU_VISUAL_NAMES))).toEqual(new Set(EXERCISE_VISUAL_IDS))

    for (const id of EXERCISE_VISUAL_IDS) {
      const name = exerciseName(EXIDX[id])
      expect(name, id).toBe(EXPECTED_RU_VISUAL_NAMES[id])
    }
  })

  it('preserves user-entered exercise names exactly in every locale', () => {
    _setLangState('ru', { Plan: 'План' }, null)

    expect(exerciseName({ id: 'imported-custom', n: 'Plan' })).toBe('Plan')
    expect(exerciseName({ id: 'user-created', n: 'eBay curl' })).toBe('eBay curl')
  })

  it('sentence-cases built-in catalogue names and preserves custom names', () => {
    _setLangState('en', {}, null)

    expect(exerciseName({ id: 'custom', n: 'custom lift' })).toBe('custom lift')
    expect(exerciseName(EXIDX['0003'])).toBe('Air bike')
    expect(exerciseName({ id: '0001', n: '3/4 sit-up' })).toBe('3/4 sit-up')
  })
})
