import test from 'node:test'
import assert from 'node:assert/strict'
import { EXERCISE_VISUAL_IDS } from '../frontend/src/lib/exercise-visuals.js'
import { promptFor } from './exercise-visual-prompts.mjs'

test('every approved id produces both complete prompts', () => {
  assert.equal(EXERCISE_VISUAL_IDS.length, 65)
  for (const id of EXERCISE_VISUAL_IDS) {
    const technique = promptFor(id, 'technique')
    const muscles = promptFor(id, 'muscles')
    assert.match(technique, /Use case: scientific-educational/)
    assert.match(technique, /three equal panels/i)
    assert.match(technique, /no text, labels, logos, or watermark/i)
    assert.match(muscles, /front view on the left and back view on the right/i)
    assert.match(muscles, /framed from head to feet/i)
    assert.match(muscles, /vivid emerald green/i)
  }
})

test('cardio and Pallof prompts lock the critical movement details', () => {
  assert.match(promptFor('3666', 'technique'), /inclined motorized treadmill/i)
  assert.match(promptFor('3666', 'technique'), /walking, not running/i)
  assert.match(promptFor('2138', 'technique'), /stationary exercise bike/i)
  assert.match(promptFor('2141', 'technique'), /elliptical cross trainer/i)
  assert.match(promptFor('2311', 'technique'), /rotating stepmill/i)
  assert.match(promptFor('0979', 'technique'), /anchored at chest height/i)
  assert.match(promptFor('0979', 'technique'), /resist torso rotation/i)
  assert.doesNotMatch(promptFor('0979', 'technique'), /waist height/i)
})

test('cardio muscle prompts name visible skeletal targets instead of none', () => {
  const expected = {
    '3666': /Primary muscles: Quads, Calves/i,
    '2138': /Primary muscles: Quads/i,
    '2141': /Primary muscles: Quads, Glutes/i,
    '2311': /Primary muscles: Quads, Glutes, Calves/i,
  }
  for (const [id, pattern] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    assert.doesNotMatch(prompt, /Primary muscles: none/i)
    assert.match(prompt, pattern)
    if (id === '3666' || id === '2138') assert.doesNotMatch(prompt, /Glutes/i)
  }
})

test('dumbbell batch prompts lock the critical movement details', () => {
  const expected = {
    '0289': [/flat horizontal bench/i, /two separate dumbbells/i, /descends beside the chest/i],
    '0293': [/bilateral row/i, /stable hip hinge/i, /no one-arm stance or torso swing/i],
    '1760': [/one dumbbell held vertically at the chest/i, /heels stay planted/i, /not a barbell squat/i],
    '0432': [/two dumbbells travel close to the legs/i, /slight knee bend/i, /hip hinge rather than a squat/i],
    '0410': [/rear foot elevated on a bench/i, /front foot stays fully planted/i, /dumbbells hang at the sides/i, /not a standard forward lunge/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('dumbbell batch muscle prompts match the catalogue targets', () => {
  const expected = {
    '0289': [/Primary muscles: Chest/i, /Secondary muscles: Triceps, Shoulders/i],
    '0293': [/Primary muscles: Upper back/i, /Secondary muscles: Biceps, Forearms, Shoulders/i],
    '1760': [/Primary muscles: Quads/i, /Secondary muscles: Glutes, Hamstrings, Calves/i],
    '0432': [/Primary muscles: Glutes/i, /Secondary muscles: Hamstrings, Lower back/i],
    '0410': [/Primary muscles: Quads/i, /Secondary muscles: Glutes, Hamstrings, Calves/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('dumbbell upper-body batch prompts lock the critical movement details', () => {
  const expected = {
    '0314': [/incline bench set to 45 degrees/i, /two separate dumbbells/i, /not a flat bench or barbell press/i],
    '0308': [/flat bench fly/i, /fixed slight elbow bend/i, /wide arc/i, /not a dumbbell press/i],
    '0405': [/seated against an upright back support/i, /press both dumbbells vertically/i, /not a standing or Arnold press/i],
    '0310': [/raise both dumbbells forward together/i, /stop at shoulder height/i, /not overhead or out to the sides/i],
    '0406': [/elevate both shoulders straight upward/i, /arms remain straight/i, /no elbow curl or shoulder rolling/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('dumbbell upper-body batch muscle prompts match the catalogue targets', () => {
  const expected = {
    '0314': [/Primary muscles: Chest/i, /Secondary muscles: Shoulders, Triceps/i],
    '0308': [/Primary muscles: Chest/i, /Secondary muscles: Shoulders/i],
    '0405': [/Primary muscles: Shoulders/i, /Secondary muscles: Triceps, Upper back/i],
    '0310': [/Primary muscles: Shoulders/i, /Secondary muscles: Biceps, Traps/i],
    '0406': [/Primary muscles: Traps/i, /Secondary muscles: Shoulders/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('dumbbell isolation batch prompts lock the critical movement details', () => {
  const expected = {
    '0333': [/stable hip hinge/i, /upper arms stay beside the torso/i, /extend only the forearms backward/i, /not a row/i],
    '0383': [/raise both dumbbells out to the sides/i, /fixed slight elbow bend/i, /not a row or shrug/i],
    '0297': [/one dumbbell/i, /working elbow against the inner thigh/i, /upper arm remains stationary/i],
    '2188': [/one dumbbell held with both hands/i, /upper arms close to the ears/i, /only the elbows move/i],
    '0375': [/one dumbbell held with both hands/i, /flat bench/i, /lower.*behind the head/i, /not a press/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('dumbbell isolation batch muscle prompts match the catalogue targets', () => {
  const expected = {
    '0333': [/Primary muscles: Triceps/i, /Secondary muscles: Shoulders/i],
    '0383': [/Primary muscles: Shoulders/i, /Secondary muscles: Traps, Upper back/i],
    '0297': [/Primary muscles: Biceps/i, /Secondary muscles: Forearms/i],
    '2188': [/Primary muscles: Triceps/i, /Secondary muscles: Shoulders/i],
    '0375': [/Primary muscles: Chest/i, /Secondary muscles: Upper back, Triceps/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('dumbbell lower-body batch prompts lock the critical movement details', () => {
  const expected = {
    '0413': [/two dumbbells hang at the sides/i, /hips move down and back/i, /heels stay planted/i, /not a goblet or barbell squat/i],
    '1459': [/two dumbbells travel close to the legs/i, /soft fixed knee bend/i, /hips move backward/i, /not a squat/i],
    '0336': [/step forward into an alternating lunge/i, /front foot stays fully planted/i, /rear knee lowers under control/i, /not a reverse or static split squat/i],
    '0431': [/stable knee-height platform/i, /entire lead foot stays on the platform/i, /drive through the lead leg/i, /no jump or push-off from the trailing foot/i],
    '0417': [/two dumbbells hang at the sides/i, /raise both heels together/i, /knees remain straight but not locked/i, /no bouncing or knee bend/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('dumbbell lower-body batch muscle prompts match the catalogue targets', () => {
  const expected = {
    '0413': [/Primary muscles: Glutes/i, /Secondary muscles: Quads, Hamstrings, Calves/i],
    '1459': [/Primary muscles: Glutes/i, /Secondary muscles: Hamstrings, Lower back/i],
    '0336': [/Primary muscles: Glutes/i, /Secondary muscles: Quads, Hamstrings, Calves/i],
    '0431': [/Primary muscles: Glutes/i, /Secondary muscles: Quads, Hamstrings, Calves/i],
    '0417': [/Primary muscles: Calves/i, /Secondary muscles: none/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('core batch prompts lock the critical movement details', () => {
  const expected = {
    '0003': [/supine bicycle crunch/i, /opposite elbow toward the bent knee/i, /other leg extends/i, /not a stationary exercise bike/i],
    '0687': [/feet lifted off the floor/i, /torso leaned back/i, /rotate the ribcage and shoulders/i, /not just the hands/i],
    '0630': [/high plank/i, /alternate one knee toward the chest/i, /hips stay low/i, /not a standing run or squat thrust/i],
    '0276': [/supine tabletop position/i, /lower back pressed into the floor/i, /opposite arm and leg/i, /without arching the lumbar spine/i],
    '0464': [/high plank/i, /rotate the whole torso/i, /top arm toward the ceiling/i, /not a forearm plank/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('core batch muscle prompts match the intended targets', () => {
  const expected = {
    '0003': [/Primary muscles: Abs/i, /Secondary muscles: Hip flexors/i],
    '0687': [/Primary muscles: Abs/i, /Secondary muscles: Obliques/i],
    '0630': [/Primary muscles: Abs, Hip flexors/i, /Secondary muscles: Shoulders, Triceps, Quads/i],
    '0276': [/Primary muscles: Abs/i, /Secondary muscles: Hip flexors, Lower back/i],
    '0464': [/Primary muscles: Abs/i, /Secondary muscles: Obliques, Shoulders/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('dumbbell arms and shoulders batch prompts lock the critical movement details', () => {
  const expected = {
    '2137': [/seated against an upright back support/i, /palms face the athlete/i, /rotate.*palms face forward/i, /not a standard shoulder press/i],
    '0296': [/flat bench/i, /dumbbells stay close together above the chest/i, /elbows remain tucked/i, /not a wide chest press or fly/i],
    '0351': [/upper arms remain vertical and stationary/i, /lower both dumbbells toward the forehead/i, /only the elbows move/i, /not a pullover or press/i],
    '0315': [/incline bench set to 45 degrees/i, /arms hang slightly behind the torso/i, /upper arms remain stationary/i, /not a shoulder press/i],
    '0437': [/dumbbells begin in front of the thighs/i, /lead upward with the elbows/i, /elbows stay above the hands/i, /not a shrug or biceps curl/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('dumbbell arms and shoulders batch muscle prompts match the catalogue targets', () => {
  const expected = {
    '2137': [/Primary muscles: Shoulders/i, /Secondary muscles: Triceps, Chest/i],
    '0296': [/Primary muscles: Triceps/i, /Secondary muscles: Chest, Shoulders/i],
    '0351': [/Primary muscles: Triceps/i, /Secondary muscles: Shoulders/i],
    '0315': [/Primary muscles: Biceps/i, /Secondary muscles: Forearms/i],
    '0437': [/Primary muscles: Shoulders/i, /Secondary muscles: Traps, Biceps/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('bench press prompts contain catalogue movement and muscle facts', () => {
  assert.match(promptFor('0025', 'technique'), /barbell bench press/i)
  assert.match(promptFor('0025', 'technique'), /middle of (?:your|the) chest/i)
  const muscles = promptFor('0025', 'muscles')
  assert.match(muscles, /Primary muscles: Chest/i)
  assert.match(muscles, /Secondary muscles:.*Shoulders/i)
  assert.match(muscles, /Secondary muscles:.*Triceps/i)
})

test('muscle prompts keep the athlete fully clothed for reliable generation', () => {
  const muscles = promptFor('0047', 'muscles')
  assert.match(muscles, /opaque fitted charcoal short-sleeve athletic top/i)
  assert.match(muscles, /full-length training tights/i)
  assert.match(muscles, /no bare torso/i)
  assert.doesNotMatch(muscles, /compression shorts/i)
})

test('unknown ids and kinds fail closed', () => {
  assert.throws(() => promptFor('nope', 'technique'), /Unknown exercise id/)
  assert.throws(() => promptFor('__proto__', 'technique'), /Unknown exercise id/)
  assert.throws(() => promptFor('0025', 'video'), /Unknown visual kind/)
})
