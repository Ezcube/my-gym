export const EXERCISE_VISUAL_IDS = Object.freeze([
  '0025', '0047', '0426', '0334', '0241', '0251',
  '2330', '0027', '1323', '0031', '0313',
  '0043', '0085', '0739', '0585', '0586', '0605',
  '0032', '0091', '0292', '0294', '0054', '0348',
  '0060', '1269', '1429', '0662', '0472', '0175', '1409',
  '3666', '2138', '2141', '2311', '0979',
  '0289', '0293', '1760', '0432', '0410',
  '0314', '0308', '0405', '0310', '0406',
  '0333', '0383', '0297', '2188', '0375',
  '0413', '1459', '0336', '0431', '0417',
])

const base = import.meta.env?.BASE_URL || './'
const asset = (id, kind, width, height) => Object.freeze({
  src: `${base}exercise-visuals/${id}/${kind}.webp`,
  width,
  height,
})

export const EXERCISE_VISUALS = Object.freeze(Object.fromEntries(
  EXERCISE_VISUAL_IDS.map(id => [id, Object.freeze({
    technique: asset(id, 'technique', 1200, 800),
    muscles: asset(id, 'muscles', 1200, 675),
  })])
))

export const exerciseVisualFor = id => Object.prototype.hasOwnProperty.call(EXERCISE_VISUALS, id)
  ? EXERCISE_VISUALS[id]
  : null
