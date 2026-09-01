import test from 'node:test'
import assert from 'node:assert/strict'
import { EXERCISE_VISUAL_IDS } from '../frontend/src/lib/exercise-visuals.js'
import { promptFor } from './exercise-visual-prompts.mjs'

test('every approved id produces both complete prompts', () => {
  assert.equal(EXERCISE_VISUAL_IDS.length, 311)
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

test('dumbbell accessory batch prompts lock the critical movement details', () => {
  const expected = {
    '0372': [/preacher bench/i, /upper arms.*supported.*pad/i, /palms face up/i, /not a standing curl/i],
    '0439': [/curl.*palms.*forward/i, /top.*rotate.*palms.*away/i, /lower.*pronated grip/i, /not an ordinary curl/i],
    '0381': [/step backward/i, /front foot stays fully planted/i, /push through the front heel/i, /not a forward lunge/i],
    '0407': [/one dumbbell/i, /bend only toward the weighted side/i, /outside of the thigh/i, /no torso rotation or hip shift/i],
    '0409': [/forefoot of one working leg.*edge/i, /other hand holds.*support/i, /heel below the step/i, /not a bilateral calf raise/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('dumbbell accessory batch muscle prompts match the catalogue targets', () => {
  const expected = {
    '0372': [/Primary muscles: Biceps/i, /Secondary muscles: Forearms/i],
    '0439': [/Primary muscles: Biceps/i, /Secondary muscles: Forearms/i],
    '0381': [/Primary muscles: Glutes/i, /Secondary muscles: Quads, Hamstrings, Calves/i],
    '0407': [/Primary muscles: Abs/i, /Secondary muscles: Obliques/i],
    '0409': [/Primary muscles: Calves/i, /Secondary muscles: none/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('machine and cable batch prompts lock the critical movement details', () => {
  const expected = {
    '0577': [/seated lever chest-press machine/i, /back and shoulder blades stay against the pad/i, /handles travel forward from chest height/i, /not a free-weight press/i],
    '0603': [/seated lever shoulder-press machine/i, /handles begin at shoulder level/i, /press overhead without locking the elbows/i, /no leg drive/i],
    '0599': [/knee joints align with the machine pivot/i, /thigh pad pins the thighs/i, /curl the heel roller down and back/i, /not a lying leg curl/i],
    '0178': [/between two low cable pulleys/i, /one handle in each hand/i, /raise.*out to the sides.*shoulder height/i, /do not shrug/i],
    '0203': [/rope attached to a low pulley/i, /stable hip hinge/i, /elbows travel wide/i, /not a face pull or biceps curl/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('machine and cable batch muscle prompts match the catalogue targets', () => {
  const expected = {
    '0577': [/Primary muscles: Chest/i, /Secondary muscles: Triceps, Shoulders/i],
    '0603': [/Primary muscles: Shoulders/i, /Secondary muscles: Triceps, Chest/i],
    '0599': [/Primary muscles: Hamstrings/i, /Secondary muscles: Calves/i],
    '0178': [/Primary muscles: Shoulders/i, /Secondary muscles: Traps, Triceps/i],
    '0203': [/Primary muscles: Shoulders/i, /Secondary muscles: Traps, Upper back, Biceps/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('assisted and seated machine batch prompts lock the critical movement details', () => {
  const expected = {
    '0009': [/kneeling assisted dip machine/i, /neutral grip, palms facing each other/i, /knees stay on the moving assistance pad/i, /slight forward torso lean/i, /not a bench dip or unsupported dip/i],
    '0017': [/kneeling assisted pull-up machine/i, /slightly wider than shoulder-width overhand grip/i, /chin rises above the handles/i, /knees stay on the moving assistance pad/i, /drive the elbows down/i, /no kipping or unsupported free hang/i],
    '0594': [/seated calf-raise machine/i, /knees secured under the thigh pads/i, /heels descend below the platform/i, /movement comes only from the ankles/i],
    '0597': [/seated hip-abduction machine/i, /outside of the knees/i, /press both knees outward/i, /no torso rocking/i],
    '0598': [/seated hip-adduction machine/i, /inside of the knees/i, /squeeze both knees inward/i, /do not lift the feet/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
  assert.doesNotMatch(promptFor('0009', 'technique'), /palms facing down/i)
  assert.doesNotMatch(promptFor('0594', 'technique'), /feet are flat on the footplate/i)
})

test('assisted and seated machine batch muscle prompts match the catalogue targets', () => {
  const expected = {
    '0009': [/Primary muscles: Chest/i, /Secondary muscles: Triceps, Shoulders/i],
    '0017': [/Primary muscles: Lats/i, /Secondary muscles: Biceps, Forearms/i],
    '0594': [/Primary muscles: Calves \(soleus emphasis\)/i, /Secondary muscles: none/i],
    '0597': [/Primary muscles: Hip abductors \(gluteus medius, gluteus minimus, TFL\)/i, /Secondary muscles: Hamstrings/i],
    '0598': [/Primary muscles: Adductors/i, /Secondary muscles: Hamstrings, Glutes/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('upper-body machine and cable batch prompts lock the critical movement details', () => {
  const expected = {
    '0868': [/cable attachment/i, /underhand.*palms up/i, /elbows close to (?:the|your) sides/i, /upper arms stationary/i],
    '0194': [/rope attached to a high pulley/i, /stand facing away/i, /feet shoulder-width apart/i, /not a split stance/i, /upper arms beside the ears/i, /not a cable pushdown/i],
    '0596': [/seated lever fly machine/i, /back stays against the pad/i, /handles with a pronated grip/i, /not vertical handles or a neutral grip/i, /not a chest press/i],
    '0602': [/reverse-fly machine/i, /chest stays against the pad/i, /handles with an overhand grip/i, /not vertical handles or a neutral grip/i, /not a row or shrug/i],
    '1350': [/chest-supported lever row/i, /pull the handles toward the body/i, /chest remains on the pad/i, /not a cable row/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('upper-body machine and cable batch muscle prompts match the catalogue targets', () => {
  const expected = {
    '0868': [/Primary muscles: Biceps/i, /Secondary muscles: Forearms/i],
    '0194': [/Primary muscles: Triceps/i, /Secondary muscles: Shoulders/i],
    '0596': [/Primary muscles: Chest/i, /Secondary muscles: Shoulders, Traps/i],
    '0602': [/Primary muscles: Shoulders/i, /Secondary muscles: Traps, Upper back/i],
    '1350': [/Primary muscles: Upper back/i, /Secondary muscles: Biceps, Forearms/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('smith machine batch prompts lock the guide rails and critical movement details', () => {
  const expected = {
    '0748': [/flat horizontal bench/i, /feet (?:firmly )?planted/i, /lower.*bar.*(?:middle of the )?chest/i, /bar remains inside the Smith guide rails/i, /not a free-weight bench press/i],
    '0757': [/30-45 degree incline/i, /upper chest/i, /bar remains inside the Smith guide rails/i, /not a vertical backrest/i, /not.*toward the neck/i],
    '0774': [/standing Smith machine press/i, /feet shoulder-width apart/i, /bar begins at shoulder level/i, /fixed vertical guide rails/i, /not.*behind the neck/i],
    '1359': [/bar starts at hip height/i, /hip hinge/i, /pull the bar toward the lower chest/i, /bar remains inside the Smith guide rails/i, /not an upright row or shrug/i],
    '0770': [/bar rests on the upper traps/i, /feet shoulder-width apart/i, /rotate the bar to release the Smith hooks/i, /feet planted/i, /inside the fixed guide rails/i, /not step backward/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('smith machine batch muscle prompts match the catalogue targets', () => {
  const expected = {
    '0748': [/Primary muscles: Chest/i, /Secondary muscles: Triceps, Shoulders/i],
    '0757': [/Primary muscles: Chest/i, /Secondary muscles: Shoulders, Triceps/i],
    '0774': [/Primary muscles: Shoulders/i, /Secondary muscles: Triceps, Upper back/i],
    '1359': [/Primary muscles: Upper back/i, /Secondary muscles: Biceps, Forearms/i],
    '0770': [/Primary muscles: Glutes/i, /Secondary muscles: Quads, Hamstrings, Calves/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('cable back batch prompts keep each attachment, grip, and cable path distinct', () => {
  const expected = {
    '0198': [/lat-pulldown station/i, /thighs secured/i, /pronated grip/i, /upper chest/i, /not.*behind-the-neck/i],
    '0180': [/low cable seated row/i, /footplates/i, /straight horizontal handle/i, /lower ribs or upper abdomen/i, /not.*V-bar/i],
    '0238': [/straight-arm high-cable pulldown/i, /soft elbows.*constant angle/i, /bar.*to the thighs/i, /not.*triceps pushdown/i],
    '0213': [/high cable row/i, /close V-bar/i, /neutral grip/i, /pull diagonally/i, /not.*low-pulley horizontal row/i],
    '0245': [/lat pulldown/i, /thighs secured/i, /supinated grip/i, /upper chest/i, /not.*behind-the-neck/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('cable back batch muscle prompts match the approved target hierarchy', () => {
  const expected = {
    '0198': [/Primary muscles: Lats/i, /Secondary muscles: Biceps, Forearms/i],
    '0180': [/Primary muscles: Upper back/i, /Secondary muscles: Biceps, Forearms/i],
    '0238': [/Primary muscles: Lats/i, /Secondary muscles: Shoulders, Biceps/i],
    '0213': [/Primary muscles: Lats/i, /Secondary muscles: Biceps, Rhomboids, Rear deltoids/i],
    '0245': [/Primary muscles: Lats/i, /Secondary muscles: Biceps, Forearms/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('bodyweight core batch prompts keep the five movement patterns distinct', () => {
  const expected = {
    '0274': [/floor crunch/i, /knees bent.*feet flat/i, /lift only the shoulder blades/i, /not a full sit-up/i, /do not pull on the neck/i],
    '0872': [/reverse crunch/i, /knees bent.*tabletop/i, /curl the pelvis/i, /not a straight-leg raise/i, /no leg swing/i],
    '0620': [/flat horizontal bench/i, /legs straight and together/i, /lower back stays pressed/i, /stop before.*below bench height/i, /not a reverse crunch/i],
    '0705': [/forearm side plank/i, /elbow directly below the shoulder/i, /legs straight and stacked/i, /straight line from head to heels/i, /static hold/i],
    '0507': [/jackknife sit-up/i, /arms extended.*overhead.*legs straight/i, /lift.*upper body and both legs simultaneously/i, /reach(?:ing)? toward the toes/i, /not a tucked crunch/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('bodyweight core batch muscle prompts match the approved target hierarchy', () => {
  const expected = {
    '0274': [/Primary muscles: Abs/i, /Secondary muscles: Hip flexors/i],
    '0872': [/Primary muscles: Abs/i, /Secondary muscles: Hip flexors/i],
    '0620': [/Primary muscles: Abs, Hip flexors/i, /Secondary muscles: none/i],
    '0705': [/Primary muscles: Obliques, Abs/i, /Secondary muscles: Glutes/i],
    '0507': [/Primary muscles: Abs, Hip flexors/i, /Secondary muscles: none/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('lower-leg batch prompts keep the support and range-of-motion details distinct', () => {
  const expected = {
    '1373': [/standing calf raise/i, /hands on a wall.*balance/i, /both heels together/i, /no bouncing/i],
    '1387': [/one[- ]leg.*calf raise/i, /lift one foot/i, /support/i, /switch legs/i],
    '1490': [/stair|step/i, /heels (?:hang )?(?:just )?below (?:the )?(?:edge|step)/i, /hold.*railing/i, /do not jump/i],
    '1397': [/standing .*calf raise/i, /both heels together/i, /knees remain straight/i, /controlled/i],
    '1377': [/calf stretch.*wall/i, /rear heel stay(?:s|ing) grounded/i, /bend the front knee/i, /do not bounce/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('lower-leg muscle prompts match the approved calf hierarchy', () => {
  const expected = {
    '1373': [/Primary muscles: Calves/i, /Secondary muscles: none/i],
    '1387': [/Primary muscles: Calves/i, /Secondary muscles: none/i],
    '1490': [/Primary muscles: Calves/i, /Secondary muscles: none/i],
    '1397': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Glutes/i],
    '1377': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('band, machine, mobility, and barbell calf prompts preserve equipment and range details', () => {
  const expected = {
    '1000': [/single-leg calf raise/i, /resistance band/i, /working foot/i, /switch legs/i],
    '1253': [/donkey calf raise/i, /leverage machine/i, /heels hanging/i, /machine supports/i],
    '1368': [/seated ankle circles/i, /lift one foot/i, /reverse direction/i, /switch legs/i],
    '1369': [/band running under both feet/i, /both heels together/i, /band slipping/i, /lower slowly/i],
    '1370': [/barbell floor calf raise/i, /barbell lying securely/i, /heels hanging/i, /stable support/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('band, machine, mobility, and barbell muscle prompts match the calf hierarchy', () => {
  const expected = {
    '1000': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Glutes/i],
    '1253': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Glutes/i],
    '1368': [/Primary muscles: Calves/i, /Secondary muscles: none/i],
    '1369': [/Primary muscles: Calves/i, /Secondary muscles: none/i],
    '1370': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('seated, standing, cable, and plyometric calf prompts preserve equipment and control details', () => {
  const expected = {
    '1371': [/seated barbell calf raise/i, /barbell resting securely across the thighs/i, /raised block/i, /lower the heels below/i],
    '1372': [/standing barbell calf raise/i, /squat rack/i, /barbell across the upper back/i, /knees straight/i],
    '1374': [/low-box jump/i, /single-leg stabilization/i, /land softly/i, /switch legs/i],
    '1375': [/standing cable calf raise/i, /cable machine/i, /stable platform/i, /heels free/i],
    '1376': [/single-leg cable calf raise/i, /low cable ankle cuff/i, /lift the other foot/i, /switch legs/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('seated, standing, cable, and plyometric calf prompts match the catalogue hierarchy', () => {
  const expected = {
    '1371': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings/i],
    '1372': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Glutes/i],
    '1374': [/Primary muscles: Calves/i, /Secondary muscles: Quads, Hamstrings, Glutes/i],
    '1375': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Glutes/i],
    '1376': [/Primary muscles: Calves/i, /Secondary muscles: none/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('rope, hack, leg-press, and single-leg calf prompts preserve equipment and support details', () => {
  const expected = {
    '1378': [/calf stretch with a rope/i, /loop the middle of the rope/i, /rear heel grounded/i, /switch sides/i],
    '1383': [/hack-machine calf raise/i, /sled machine/i, /shoulder pads/i, /heels hanging/i],
    '1384': [/single-leg hack-machine calf raise/i, /one foot/i, /shoulder pads/i, /switch legs/i],
    '1385': [/seated calf raise on a leg press machine/i, /backrest/i, /footplate/i, /safety handles/i],
    '1386': [/single-leg donkey calf raise/i, /wall or bar/i, /other leg lifted/i, /switch legs/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('rope, hack, leg-press, and single-leg calf prompts match the catalogue hierarchy', () => {
  const expected = {
    '1378': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings/i],
    '1383': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Glutes/i],
    '1384': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Glutes/i],
    '1385': [/Primary muscles: Calves/i, /Secondary muscles: Quads, Hamstrings, Glutes/i],
    '1386': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Glutes/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('seated dumbbell and rope calf prompts preserve grip, support, and stretch details', () => {
  const expected = {
    '1379': [/seated dumbbell calf raise/i, /raised step/i, /dumbbell securely across the thighs/i, /heels hanging/i],
    '1380': [/seated single-leg dumbbell calf raise/i, /hammer grip/i, /one ball of the foot/i, /switch legs/i],
    '1381': [/seated single-leg dumbbell calf raise/i, /palm-up grip/i, /dumbbell palm up/i, /switch legs/i],
    '1382': [/wall-supported exercise-ball calf raise/i, /exercise ball/i, /one dumbbell in each hand/i, /do not squat/i],
    '1388': [/seated peroneals stretch with a rope/i, /legs extended/i, /loop the rope around the ball of one foot/i, /switch legs/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('seated dumbbell and rope calf prompts match the catalogue hierarchy', () => {
  const expected = {
    '1379': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings/i],
    '1380': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Glutes/i],
    '1381': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Glutes/i],
    '1382': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Quads/i],
    '1388': [/Primary muscles: Calves/i, /Secondary muscles: Ankles, Feet/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('barbell and bodyweight calf prompts preserve stance and movement details', () => {
  const expected = {
    '0088': [/seated barbell calf raise/i, /barbell.*across the thighs/i, /raised block/i, /heels free/i],
    '0108': [/standing barbell calf raise/i, /upper back/i, /feet shoulder-width/i, /knees straight/i],
    '0111': [/standing barbell rocking leg calf raise/i, /rock through the forefoot/i, /barbell.*upper back/i, /no jumping/i],
    '0257': [/standing circles-knee calf stretch/i, /hands on the hips/i, /heels onto the balls of the feet/i, /circles with the knees/i],
    '0284': [/bodyweight donkey calf raise/i, /raised step/i, /wall or rail/i, /heels hanging/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('barbell and bodyweight calf prompts match the catalogue hierarchy', () => {
  const expected = {
    '0088': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Quads/i],
    '0108': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Glutes/i],
    '0111': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Quads/i],
    '0257': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Quads/i],
    '0284': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Glutes/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('dumbbell, sled, and Smith calf prompts preserve equipment and support details', () => {
  const expected = {
    '0400': [/seated single-leg dumbbell calf raise/i, /dumbbell securely on the right thigh/i, /left leg clear/i, /switch legs/i],
    '0727': [/standing single-leg calf raise/i, /one dumbbell in one hand/i, /non-working foot/i, /switch legs/i],
    '0738': [/45-degree sled calf press/i, /sled machine set at 45 degrees/i, /toes on the platform/i, /ankle extension/i],
    '0742': [/forward-angled sled calf raise/i, /heels hanging off/i, /hold the handles/i, /sled resistance/i],
    '0763': [/Smith-machine reverse calf raise/i, /bar just below shoulder height/i, /step with heels hanging off/i, /straight back/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('dumbbell, sled, and Smith calf prompts match the catalogue hierarchy', () => {
  const expected = {
    '0400': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Glutes/i],
    '0727': [/Primary muscles: Calves/i, /Secondary muscles: Ankles, Feet/i],
    '0738': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings/i],
    '0742': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Glutes/i],
    '0763': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('Smith, weighted, band, and seated calf prompts preserve equipment and stretch details', () => {
  const expected = {
    '0773': [/standing calf raise inside a Smith machine/i, /bar across the upper back/i, /feet flat/i, /raise both heels/i],
    '0833': [/weighted donkey calf raise/i, /raised platform/i, /heels hanging off/i, /upper back/i],
    '0999': [/single-leg calf raise/i, /resistance band/i, /non-working foot clear/i, /switch legs/i],
    '1389': [/posterior tibialis stretch/i, /rope/i, /legs extended/i, /switch legs/i],
    '1390': [/seated calf stretch/i, /chair or bench/i, /heel grounded/i, /switch legs/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('Smith, weighted, band, and seated calf prompts match the catalogue hierarchy', () => {
  const expected = {
    '0773': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Glutes/i],
    '0833': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Glutes/i],
    '0999': [/Primary muscles: Calves/i, /Secondary muscles: Ankles, Feet/i],
    '1389': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Quads/i],
    '1390': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('leg-press and leverage calf prompts preserve support and range details', () => {
  const expected = {
    '1391': [/seated calf press/i, /sled leg-press machine/i, /knees slightly bent/i, /safety handles/i],
    '1392': [/single-leg calf press/i, /sled leg-press machine/i, /other leg clear/i, /switch sides/i],
    '1393': [/Smith-machine one-leg floor calf raise/i, /bar resting across the lower leg/i, /raised block/i, /other foot clear/i],
    '1395': [/seated single-leg calf raise/i, /Smith machine/i, /back against the pad/i, /other leg off/i],
    '2289': [/seated lever calf press/i, /lever pad/i, /side supports/i, /heels hanging off/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('leg-press and leverage calf prompts match the catalogue hierarchy', () => {
  const expected = {
    '1391': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Quads/i],
    '1392': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Glutes/i],
    '1393': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Glutes/i],
    '1395': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings/i],
    '2289': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('standing, assisted, rotary, and sled calf prompts preserve setup details', () => {
  const expected = {
    '1398': [/standing calf stretch/i, /facing a wall/i, /rear heel flat/i, /switch sides/i],
    '1407': [/calf push stretch/i, /hands against a wall/i, /rear heel grounded/i, /switch legs/i],
    '1708': [/assisted lying calf stretch/i, /lie on your back/i, /hands or a towel/i, /switch legs/i],
    '2315': [/seated rotary lever calf raise/i, /leverage machine/i, /footplate/i, /heels hanging off/i],
    '2334': [/seated sled-machine calf press/i, /platform edge/i, /knees slightly bent/i, /ankles/i],
    '1394': [/Smith-machine reverse calf raise/i, /stable step/i, /heels hanging off/i, /hold the bar/i],
    '1396': [/Smith-machine toe raise/i, /raised platform/i, /grip the bar/i, /back straight/i],
    '2335': [/seated lever calf press/i, /lever pad/i, /side handles/i, /extending the ankles/i],
    '3240': [/exercise-ball calf raise/i, /between the knees/i, /dumbbell/i, /knees collapse inward/i],
    '3241': [/exercise-ball calf raise/i, /between the ankles/i, /dumbbell/i, /ankles aligned/i],
    '1582': [/reclining big-toe pose/i, /rope/i, /knee straight/i, /switch legs/i],
    '1585': [/runner stretch/i, /front thigh/i, /rear leg straight/i, /switch sides/i],
    '1599': [/hamstring and calf stretch/i, /strap/i, /straight back/i, /switch legs/i],
    '1548': [/chair leg-extended stretch/i, /edge of a chair/i, /heel on the floor/i, /switch legs/i],
    '3212': [/basic standing toe touch/i, /hinge forward/i, /slightly bent knees/i, /return slowly/i],
    '1410': [/barbell lateral lunge/i, /step wide/i, /opposite foot stays planted/i, /switch sides/i],
    '1417': [/one-legged diagonal kick/i, /stability ball/i, /lift the hips/i, /alternate sides/i],
    '1420': [/kneeling barbell jump squat/i, /bar across the upper back/i, /jump/i, /land softly/i],
    '1425': [/45-degree sled one-leg press/i, /one foot/i, /footplate/i, /switch legs/i],
    '1433': [/Smith-machine front squat/i, /front shoulders/i, /collarbone/i, /core braced/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('standing, assisted, rotary, and sled calf prompts match the catalogue hierarchy', () => {
  const expected = {
    '1398': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Glutes/i],
    '1407': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings/i],
    '1708': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings/i],
    '2315': [/Primary muscles: Calves/i, /Secondary muscles: Soleus, Ankle stabilizers/i],
    '2334': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Glutes/i],
    '1394': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings/i],
    '1396': [/Primary muscles: Calves/i, /Secondary muscles: Ankles, Shins/i],
    '2335': [/Primary muscles: Calves/i, /Secondary muscles: Soleus, Hamstrings/i],
    '3240': [/Primary muscles: Calves/i, /Secondary muscles: Quadriceps, Hamstrings/i],
    '3241': [/Primary muscles: Calves/i, /Secondary muscles: Hamstrings, Quadriceps/i],
    '1582': [/Primary muscles: Hamstrings/i, /Secondary muscles: Calves, Glutes/i],
    '1585': [/Primary muscles: Hamstrings/i, /Secondary muscles: Calves, Quadriceps/i],
    '1599': [/Primary muscles: Hamstrings/i, /Secondary muscles: Calves/i],
    '1548': [/Primary muscles: Quadriceps/i, /Secondary muscles: Hamstrings, Calves/i],
    '3212': [/Primary muscles: Glutes/i, /Secondary muscles: Hamstrings, Calves/i],
    '1410': [/Primary muscles: Glutes/i, /Secondary muscles: Quadriceps, Hamstrings, Calves/i],
    '1417': [/Primary muscles: Glutes/i, /Secondary muscles: Hamstrings, Calves/i],
    '1420': [/Primary muscles: Glutes/i, /Secondary muscles: Quadriceps, Hamstrings, Calves/i],
    '1425': [/Primary muscles: Glutes/i, /Secondary muscles: Quadriceps, Hamstrings, Calves/i],
    '1433': [/Primary muscles: Glutes/i, /Secondary muscles: Quadriceps, Hamstrings, Calves, Core/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('squat and shoulder-machine batch prompts lock the movement details', () => {
  const expected = {
    '1434': [/Smith-machine low-bar squat/i, /bar low across the upper back/i, /fixed rails/i],
    '1435': [/barbell low-bar squat/i, /bar low across the upper back/i, /bar balanced over the mid-foot/i],
    '1436': [/barbell high-bar squat/i, /bar high on the upper trapezius/i, /knees tracking over toes/i],
    '1438': [/seated two-arm kettlebell military press/i, /one kettlebell at each shoulder/i, /without leaning or using the legs/i],
    '1439': [/gripless shrug/i, /shoulder pads/i, /without bending the elbows/i, /do not roll the shoulders/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('squat and shoulder-machine batch muscle prompts match the catalogue hierarchy', () => {
  const expected = {
    '1434': [/Primary muscles: Glutes/i, /Secondary muscles: Quadriceps, Hamstrings, Calves/i],
    '1435': [/Primary muscles: Glutes/i, /Secondary muscles: Quadriceps, Hamstrings, Calves/i],
    '1436': [/Primary muscles: Glutes/i, /Secondary muscles: Quadriceps, Hamstrings, Calves, Core/i],
    '1438': [/Primary muscles: Shoulders/i, /Secondary muscles: Triceps, Upper back/i],
    '1439': [/Primary muscles: Traps/i, /Secondary muscles: Shoulders, Forearms/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('wrist, dip, crunch, and military-press prompts lock the movement details', () => {
  const expected = {
    '1441': [/one-arm reverse wrist curl/i, /support the pronated forearm on the bench/i, /wrist just beyond the edge/i, /keep the forearm still/i],
    '1451': [/seated dip.*leverage machine/i, /back against the pad/i, /parallel handles/i, /extending the elbows/i],
    '1452': [/seated crunch.*leverage machine/i, /hips secured/i, /curl the ribcage toward the pelvis/i, /without pulling with the arms/i],
    '1456': [/standing close-grip barbell military press/i, /inside shoulder width/i, /without leg drive/i, /upper chest/i],
    '1457': [/standing wide-grip barbell military press/i, /wider than shoulder width/i, /without leg drive/i, /upper chest/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('wrist, dip, crunch, and military-press prompts match the catalogue hierarchy', () => {
  const expected = {
    '1441': [/Primary muscles: Forearms/i, /Secondary muscles: Biceps/i],
    '1451': [/Primary muscles: Triceps/i, /Secondary muscles: Chest, Shoulders/i],
    '1452': [/Primary muscles: Abs/i, /Secondary muscles: Obliques/i],
    '1456': [/Primary muscles: Shoulders/i, /Secondary muscles: Triceps, Upper back/i],
    '1457': [/Primary muscles: Shoulders/i, /Secondary muscles: Triceps, Upper back/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('core and cable batch prompts lock the movement details', () => {
  const expected = {
    '0001': [/3\/4 sit-up/i, /knees bent/i, /feet flat/i, /without pulling the neck/i],
    '0002': [/standing 45-degree side bend/i, /spine long/i, /without rotating/i],
    '1512': [/all-fours quad stretch/i, /hands and knees/i, /heel toward the glutes/i],
    '0006': [/alternating heel touchers/i, /same-side heel/i, /without pulling the neck/i],
    '0007': [/alternate lateral pulldown/i, /single handle/i, /same-side upper chest/i, /without torso swing/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('core and cable batch prompts match the catalogue hierarchy', () => {
  const expected = {
    '0001': [/Primary muscles: Abs/i, /Secondary muscles: Obliques, Hip flexors/i],
    '0002': [/Primary muscles: Obliques/i, /Secondary muscles: none/i],
    '1512': [/Primary muscles: Hamstrings/i, /Secondary muscles: Glutes, Calves/i],
    '0006': [/Primary muscles: Obliques/i, /Secondary muscles: none/i],
    '0007': [/Primary muscles: Lats/i, /Secondary muscles: Biceps/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('bodyweight pull, push, hanging, and balance prompts lock movement details', () => {
  const expected = {
    '3293': [/archer pull-up/i, /wide overhand grip/i, /opposite arm stays straight/i, /without swinging/i],
    '3294': [/archer push-up/i, /hands wider than the shoulders/i, /opposite arm stays straight/i, /alternate/i],
    '2355': [/hanging bent-knee leg raise/i, /knees bent at 90 degrees/i, /without swinging/i],
    '2333': [/hanging straight-leg raise/i, /legs together/i, /parallel with the floor/i, /without swinging/i],
    '3214': [/arms-apart circular toe touch/i, /reach one hand toward the toes/i, /straight leg lifts behind/i, /switch sides/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('bodyweight pull, push, hanging, and balance prompts match the catalogue hierarchy', () => {
  const expected = {
    '3293': [/Primary muscles: Lats/i, /Secondary muscles: Biceps, Forearms/i],
    '3294': [/Primary muscles: Chest/i, /Secondary muscles: Triceps, Shoulders/i],
    '2355': [/Primary muscles: Abs/i, /Secondary muscles: Hip flexors, Shoulders/i],
    '2333': [/Primary muscles: Abs/i, /Secondary muscles: Hip flexors, Shoulders/i],
    '3214': [/Primary muscles: Glutes/i, /Secondary muscles: Hamstrings, Quadriceps, Calves/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('sit-up, assisted hanging, and glute stretch prompts lock movement details', () => {
  const expected = {
    '3204': [/arms-overhead full sit-up/i, /knees bent/i, /feet flat/i, /all the way upright/i],
    '0011': [/assisted hanging knee raise/i, /light band/i, /palms facing away/i, /without swinging/i],
    '0010': [/hanging knee raise with throw-down/i, /knees to the chest/i, /legs down straight/i],
    '1709': [/lying glute stretch/i, /cross one ankle over the opposite thigh/i, /supporting thigh toward the chest/i, /switch sides/i],
    '1710': [/lying gluteus and piriformis stretch/i, /cross one ankle over the opposite thigh/i, /supporting thigh toward the chest/i, /switch sides/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('sit-up, assisted hanging, and glute stretch prompts match the catalogue hierarchy', () => {
  const expected = {
    '3204': [/Primary muscles: Abs/i, /Secondary muscles: Hip flexors, Obliques/i],
    '0011': [/Primary muscles: Abs/i, /Secondary muscles: Hip flexors, Shoulders/i],
    '0010': [/Primary muscles: Abs/i, /Secondary muscles: Hip flexors, Shoulders/i],
    '1709': [/Primary muscles: Glutes/i, /Secondary muscles: Hamstrings/i],
    '1710': [/Primary muscles: Glutes/i, /Secondary muscles: Hamstrings/i],
  }
  for (const [id, patterns] of Object.entries(expected)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('assisted floor, twist, pull-up, and hamstring prompts lock movement details', () => {
  const technique = {
    '0012': [/lateral throw-down/i, /hands under the glutes/i, /alternate sides/i],
    '0013': [/throw-down/i, /near perpendicular/i, /without touching/i],
    '0014': [/medicine-ball Russian twist/i, /knees bent/i, /feet flat/i, /rotate the torso/i],
    '0015': [/parallel close-grip pull-up/i, /narrow neutral-grip parallel handles/i, /assistance pad/i, /chin over the bars/i],
    '0016': [/assisted prone hamstring lift/i, /ankles secured/i, /knees straight/i, /lower them under control/i],
  }
  for (const [id, patterns] of Object.entries(technique)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
  const muscles = {
    '0012': [/Primary muscles: Abs, Hip flexors/i, /Secondary muscles: Obliques/i],
    '0013': [/Primary muscles: Abs, Hip flexors/i, /Secondary muscles: Obliques/i],
    '0014': [/Primary muscles: Obliques/i, /Secondary muscles: Abs/i],
    '0015': [/Primary muscles: Lats/i, /Secondary muscles: Biceps, Forearms/i],
    '0016': [/Primary muscles: Hamstrings/i, /Secondary muscles: Glutes/i],
  }
  for (const [id, patterns] of Object.entries(muscles)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('assisted stretch and sit-up prompts lock movement details', () => {
  const technique = {
    '1713': [/prone lying quadriceps stretch/i, /bend one knee/i, /heel toward the glutes/i, /repeat on the other side/i],
    '1714': [/prone rectus femoris stretch/i, /pelvis grounded/i, /foot toward the glutes/i],
    '1716': [/seated pectoralis major stretch/i, /large stability ball/i, /second stability ball/i, /lower it toward the chest/i],
    '1712': [/side-lying adductor stretch/i, /top leg straight/i, /low bench/i, /inner-thigh stretch/i],
    '1758': [/assisted sit-up/i, /partner secures the feet/i, /about 45 degrees/i, /without pulling the neck/i],
  }
  for (const [id, patterns] of Object.entries(technique)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
  const muscles = {
    '1713': [/Primary muscles: Quads/i, /Secondary muscles: Hamstrings, Glutes/i],
    '1714': [/Primary muscles: Quads/i, /Secondary muscles: Hip flexors/i],
    '1716': [/Primary muscles: Chest/i, /Secondary muscles: Shoulders, Triceps/i],
    '1712': [/Primary muscles: Adductors/i, /Secondary muscles: Hamstrings, Glutes/i],
    '1758': [/Primary muscles: Abs/i, /Secondary muscles: Hip flexors/i],
  }
  for (const [id, patterns] of Object.entries(muscles)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('assisted pull-up, towel extension, and dip prompts lock movement details', () => {
  const technique = {
    '1431': [/assisted standing chin-up/i, /overhand grip/i, /foot platform/i, /chin clears the bar/i],
    '1432': [/assisted standing pull-up/i, /overhand grip/i, /engage the lats and biceps/i, /lower slowly/i],
    '0018': [/standing triceps extension with a towel/i, /behind the head/i, /elbows close to the ears/i, /forearms overhead/i],
    '0019': [/kneeling triceps dip/i, /assistance pad/i, /parallel handles/i, /bend the elbows to lower/i],
    '2364': [/wide-grip chest dip/i, /knees on the assistance pad/i, /clearly wide grip/i, /upper arms are parallel/i],
  }
  for (const [id, patterns] of Object.entries(technique)) {
    const prompt = promptFor(id, 'technique')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
  const muscles = {
    '1431': [/Primary muscles: Lats/i, /Secondary muscles: Biceps, Forearms/i],
    '1432': [/Primary muscles: Lats/i, /Secondary muscles: Biceps, Forearms/i],
    '0018': [/Primary muscles: Triceps/i, /Secondary muscles: Shoulders/i],
    '0019': [/Primary muscles: Triceps/i, /Secondary muscles: Chest, Shoulders/i],
    '2364': [/Primary muscles: Chest/i, /Secondary muscles: Triceps, Shoulders/i],
  }
  for (const [id, patterns] of Object.entries(muscles)) {
    const prompt = promptFor(id, 'muscles')
    for (const pattern of patterns) assert.match(prompt, pattern)
  }
})

test('cardio, stability, bodyweight, and stretch batch prompts stay distinct', () => {
  assert.match(promptFor('3220', 'technique'), /jumping-jack style cardio/i)
  assert.match(promptFor('3672', 'technique'), /alternating forward lunges/i)
  assert.match(promptFor('1314', 'technique'), /stability ball/i)
  assert.match(promptFor('3297', 'technique'), /back lever on a fixed pull-up bar/i)
  assert.match(promptFor('1405', 'technique'), /back-pec stretch/i)
  assert.match(promptFor('3220', 'muscles'), /Primary muscles: Quads/i)
  assert.match(promptFor('1314', 'muscles'), /Secondary muscles: Hamstrings, Lower back/i)
  assert.match(promptFor('3297', 'muscles'), /Primary muscles: Upper back/i)
})

test('backward jump, balance, band, and assisted-pull prompts stay distinct', () => {
  assert.match(promptFor('1473', 'technique'), /controlled backward jump/i)
  assert.match(promptFor('0020', 'technique'), /wobble balance board/i)
  assert.match(promptFor('0968', 'technique'), /alternating biceps curls/i)
  assert.match(promptFor('0969', 'technique'), /band alternating V-up/i)
  assert.match(promptFor('0970', 'technique'), /band looped over a pull-up bar/i)
  assert.match(promptFor('0968', 'muscles'), /Primary muscles: Biceps/i)
  assert.match(promptFor('0969', 'muscles'), /Primary muscles: Abs/i)
  assert.match(promptFor('0970', 'muscles'), /Primary muscles: Upper back/i)
})

test('band rollout, press, hip extension, crunch, and pulldown prompts stay distinct', () => {
  assert.match(promptFor('0971', 'technique'), /band-assisted wheel rollout/i)
  assert.match(promptFor('1254', 'technique'), /band bench press/i)
  assert.match(promptFor('0980', 'technique'), /alternating band bent-over hip extensions/i)
  assert.match(promptFor('0972', 'technique'), /band bicycle crunch/i)
  assert.match(promptFor('0974', 'technique'), /standing band close-grip pulldown/i)
  assert.match(promptFor('0971', 'muscles'), /Primary muscles: Abs/i)
  assert.match(promptFor('1254', 'muscles'), /Primary muscles: Chest/i)
  assert.match(promptFor('0980', 'muscles'), /Primary muscles: Glutes/i)
})

test('band push-up, concentration curl, fixed-back pulldown, and front raise prompts stay distinct', () => {
  assert.match(promptFor('0975', 'technique'), /band around the upper arms/i)
  assert.match(promptFor('0976', 'technique'), /inner thigh/i)
  assert.match(promptFor('3117', 'technique'), /seated close-grip variant/i)
  assert.match(promptFor('3116', 'technique'), /standing wider-grip variant/i)
  assert.match(promptFor('0977', 'technique'), /only to shoulder height/i)
  assert.match(promptFor('0975', 'muscles'), /Primary muscles: Triceps/i)
  assert.match(promptFor('0976', 'muscles'), /Primary muscles: Biceps/i)
  assert.match(promptFor('0977', 'muscles'), /Primary muscles: Shoulders/i)
})

test('band front raise, jack-knife, kneeling pulldown, twisting crunch, and hip rotation prompts stay distinct', () => {
  assert.match(promptFor('0978', 'technique'), /palms facing down/i)
  assert.match(promptFor('0981', 'technique'), /lift the straight legs and upper body simultaneously/i)
  assert.match(promptFor('0983', 'technique'), /one-arm.*pulldown/i)
  assert.match(promptFor('0985', 'technique'), /waist height/i)
  assert.match(promptFor('0984', 'technique'), /rotate the knees outward/i)
  assert.match(promptFor('0981', 'muscles'), /Primary muscles: Abs/i)
  assert.match(promptFor('0983', 'muscles'), /Primary muscles: Upper back/i)
  assert.match(promptFor('0985', 'muscles'), /Primary muscles: Abs/i)
})

test('band split squat, leg raise, squat row, squat, and standing crunch prompts stay distinct', () => {
  assert.match(promptFor('1001', 'technique'), /single-leg split squat/i)
  assert.match(promptFor('1002', 'technique'), /band around the arches of both feet/i)
  assert.match(promptFor('1003', 'technique'), /squat row/i)
  assert.match(promptFor('1004', 'technique'), /band just above the knees/i)
  assert.match(promptFor('1005', 'technique'), /standing crunch/i)
  assert.match(promptFor('1001', 'muscles'), /Primary muscles: Quads/i)
  assert.match(promptFor('1002', 'muscles'), /Primary muscles: Abs/i)
  assert.match(promptFor('1003', 'muscles'), /Primary muscles: Quads, Upper back/i)
  assert.match(promptFor('1005', 'muscles'), /Primary muscles: Abs/i)
})

test('band twisting crunch, step-up, stiff deadlift, straight deadlift, and seated twist prompts stay distinct', () => {
  assert.match(promptFor('1007', 'technique'), /band looped around the upper back/i)
  assert.match(promptFor('1008', 'technique'), /step-up/i)
  assert.match(promptFor('1009', 'technique'), /band looped around both ankles/i)
  assert.match(promptFor('1010', 'technique'), /band under both feet/i)
  assert.match(promptFor('1011', 'technique'), /band is wrapped around the waist/i)
  assert.match(promptFor('1007', 'muscles'), /Primary muscles: Abs/i)
  assert.match(promptFor('1008', 'muscles'), /Primary muscles: Quads/i)
  assert.match(promptFor('1009', 'muscles'), /Primary muscles: Glutes/i)
  assert.match(promptFor('1011', 'muscles'), /Primary muscles: Abs/i)
})

test('band twisting press, underhand pulldown, V-up, Pallof press, wrist curl, Y-raise, and shrug prompts stay distinct', () => {
  assert.match(promptFor('1012', 'technique'), /twist the torso/i)
  assert.match(promptFor('1013', 'technique'), /underhand grip slightly wider than shoulder width/i)
  assert.match(promptFor('1014', 'technique'), /lift the legs and upper body simultaneously/i)
  assert.match(promptFor('1015', 'technique'), /perpendicular to the anchor/i)
  assert.match(promptFor('1016', 'technique'), /forearms on the thighs/i)
  assert.match(promptFor('1017', 'technique'), /forming a Y/i)
  assert.match(promptFor('1018', 'technique'), /band under both feet/i)
  assert.match(promptFor('1012', 'muscles'), /Primary muscles: Shoulders/i)
  assert.match(promptFor('1013', 'muscles'), /Primary muscles: Upper back/i)
  assert.match(promptFor('1014', 'muscles'), /Primary muscles: Abs/i)
  assert.match(promptFor('1015', 'muscles'), /Primary muscles: Abs/i)
  assert.match(promptFor('1016', 'muscles'), /Primary muscles: Forearms/i)
  assert.match(promptFor('1017', 'muscles'), /Primary muscles: Shoulders/i)
  assert.match(promptFor('1018', 'muscles'), /Primary muscles: Traps/i)
})

test('rear-delt row, stiff deadlift, burpee, chest stretch, and dumbbell burpee prompts stay distinct', () => {
  assert.match(promptFor('1022', 'technique'), /rear-delt row/i)
  assert.match(promptFor('1023', 'technique'), /band around your upper legs/i)
  assert.match(promptFor('1160', 'technique'), /straight push-up plank/i)
  assert.match(promptFor('1167', 'technique'), /crossing them in front/i)
  assert.match(promptFor('1201', 'technique'), /dumbbells overhead/i)
  assert.match(promptFor('1022', 'muscles'), /Primary muscles: Shoulders/i)
  assert.match(promptFor('1023', 'muscles'), /Primary muscles: Glutes/i)
  assert.match(promptFor('1160', 'muscles'), /Primary muscles: Quads/i)
  assert.match(promptFor('1167', 'muscles'), /Primary muscles: Chest/i)
  assert.match(promptFor('1201', 'muscles'), /Primary muscles: Quads/i)
})

test('decline pullover, reverse-grip bench, incline press, wide bench, and chest stretch prompts stay distinct', () => {
  assert.match(promptFor('1255', 'technique'), /decline bench/i)
  assert.match(promptFor('1255', 'technique'), /arc behind the head/i)
  assert.match(promptFor('1256', 'technique'), /reverse grip.*decline bench/i)
  assert.match(promptFor('1257', 'technique'), /45-degree angle|incline bench to 45 degrees/i)
  assert.match(promptFor('1258', 'technique'), /wide reverse grip/i)
  assert.match(promptFor('1259', 'technique'), /fingers behind the head/i)
  for (const id of ['1255', '1256', '1257', '1258', '1259']) assert.match(promptFor(id, 'muscles'), /Primary muscles: Chest/i)
})

test('cable decline press, fly, and exercise-ball fly prompts stay distinct', () => {
  assert.match(promptFor('1260', 'technique'), /decline bench.*one handle/i)
  assert.match(promptFor('1261', 'technique'), /decline bench facing the cable machine/i)
  assert.match(promptFor('1262', 'technique'), /low pulley.*decline angle/i)
  assert.match(promptFor('1263', 'technique'), /exercise ball/i)
  assert.match(promptFor('1263', 'technique'), /handle out to the side/i)
  assert.match(promptFor('1264', 'technique'), /exercise ball/i)
  assert.match(promptFor('1264', 'technique'), /incline bench/i)
  for (const id of ['1260', '1261', '1262', '1263', '1264']) assert.match(promptFor(id, 'muscles'), /Primary muscles: Chest/i)
})

test('cable incline presses, exercise-ball press, and standing crossover prompts stay distinct', () => {
  assert.match(promptFor('1265', 'technique'), /low cable pulley/i)
  assert.match(promptFor('1265', 'technique'), /incline bench/i)
  assert.match(promptFor('1266', 'technique'), /exercise ball.*incline bench/i)
  assert.match(promptFor('1267', 'technique'), /other hand on (your|the) hip/i)
  assert.match(promptFor('1268', 'technique'), /both cable handles/i)
  assert.match(promptFor('1269', 'technique'), /standing up straight crossovers/i)
  assert.match(promptFor('1270', 'technique'), /upper chest crossover/i)
  for (const id of ['1265', '1266', '1267', '1268', '1269', '1270']) assert.match(promptFor(id, 'muscles'), /Primary muscles: Chest/i)
})

test('chest stretches and push-up variants preserve their distinct movement cues', () => {
  assert.match(promptFor('1271', 'technique'), /interlace the fingers/i)
  assert.match(promptFor('1272', 'technique'), /stability ball/i)
  assert.match(promptFor('1273', 'technique'), /clap once/i)
  assert.match(promptFor('1274', 'technique'), /very close to the floor/i)
  assert.match(promptFor('1275', 'technique'), /drop both knees/i)
  for (const id of ['1271', '1272', '1273', '1274', '1275']) assert.match(promptFor(id, 'muscles'), /Primary muscles: Chest/i)
})

test('dumbbell fly variants preserve bench, ball, and unilateral movement cues', () => {
  assert.match(promptFor('1276', 'technique'), /decline bench/i)
  assert.match(promptFor('1276', 'technique'), /one dumbbell/i)
  assert.match(promptFor('1277', 'technique'), /stability ball/i)
  assert.match(promptFor('1277', 'technique'), /both arms/i)
  assert.match(promptFor('1278', 'technique'), /inclined posture/i)
  assert.match(promptFor('1279', 'technique'), /incline bench/i)
  assert.match(promptFor('1279', 'technique'), /other hand rests on the torso/i)
  assert.match(promptFor('1280', 'technique'), /stability ball/i)
  for (const id of ['1276', '1277', '1278', '1279', '1280']) assert.match(promptFor(id, 'muscles'), /Primary muscles: Chest/i)
})

test('dumbbell press and pullover variants preserve equipment and movement cues', () => {
  assert.match(promptFor('1281', 'technique'), /incline bench/i)
  assert.match(promptFor('1281', 'technique'), /press the working dumbbell/i)
  assert.match(promptFor('1282', 'technique'), /stability ball/i)
  assert.match(promptFor('1283', 'technique'), /both dumbbells/i)
  assert.match(promptFor('1284', 'technique'), /arc behind the head/i)
  assert.match(promptFor('1284', 'technique'), /both hands/i)
  assert.match(promptFor('1285', 'technique'), /flat bench/i)
  for (const id of ['1281', '1282', '1283', '1284', '1285']) assert.match(promptFor(id, 'muscles'), /Primary muscles: Chest/i)
})

test('one-arm dumbbell chest variants preserve ball, bench, and unilateral movement cues', () => {
  assert.match(promptFor('1286', 'technique'), /stability ball/i)
  assert.match(promptFor('1286', 'technique'), /one dumbbell/i)
  assert.match(promptFor('1287', 'technique'), /decline bench/i)
  assert.match(promptFor('1288', 'technique'), /stability ball/i)
  assert.match(promptFor('1289', 'technique'), /45 degrees/i)
  assert.match(promptFor('1290', 'technique'), /overhead/i)
  for (const id of ['1286', '1287', '1288', '1289', '1290']) assert.match(promptFor(id, 'muscles'), /Primary muscles: Chest/i)
})

test('stability-ball dumbbell variants preserve balance, pullover, and hip-extension cues', () => {
  assert.match(promptFor('1291', 'technique'), /one dumbbell/i)
  assert.match(promptFor('1291', 'technique'), /behind the head/i)
  assert.match(promptFor('1292', 'technique'), /one foot planted/i)
  assert.match(promptFor('1292', 'technique'), /both arms/i)
  assert.match(promptFor('1293', 'technique'), /both dumbbells overhead/i)
  assert.match(promptFor('1294', 'technique'), /lift the hips/i)
  assert.match(promptFor('1295', 'technique'), /both hands/i)
  for (const id of ['1291', '1292', '1293', '1294', '1295']) assert.match(promptFor(id, 'muscles'), /Primary muscles: Chest/i)
})

test('pike, isometric, kettlebell, and leverage press prompts preserve equipment and motion cues', () => {
  assert.match(promptFor('1296', 'technique'), /inverted-V pike/i)
  assert.match(promptFor('1297', 'technique'), /isometric chest squeeze/i)
  assert.match(promptFor('1298', 'technique'), /kettlebell/i)
  assert.match(promptFor('1299', 'technique'), /incline leverage chest-press machine/i)
  assert.match(promptFor('1300', 'technique'), /decline leverage chest-press machine/i)
  for (const id of ['1296', '1297', '1298', '1299', '1300']) assert.match(promptFor(id, 'muscles'), /Primary muscles: Chest/i)
})

test('machine and medicine-ball chest prompts preserve equipment and response patterns', () => {
  assert.match(promptFor('1301', 'technique'), /inner-chest press machine/i)
  assert.match(promptFor('1302', 'technique'), /medicine ball/i)
  assert.match(promptFor('1302', 'technique'), /explosively/i)
  assert.match(promptFor('1303', 'technique'), /three-point stance/i)
  assert.match(promptFor('1304', 'technique'), /repeat smoothly/i)
  assert.match(promptFor('1305', 'technique'), /one decisive/i)
  for (const id of ['1301', '1302', '1303', '1304', '1305']) assert.match(promptFor(id, 'muscles'), /Primary muscles: Chest/i)
})

test('plyometric, BOSU, Smith, and weighted push-up prompts preserve equipment and transitions', () => {
  assert.match(promptFor('1306', 'technique'), /hands leave the floor/i)
  assert.match(promptFor('1307', 'technique'), /BOSU ball/i)
  assert.match(promptFor('1308', 'technique'), /Smith machine/i)
  assert.match(promptFor('1309', 'technique'), /decline bench/i)
  assert.match(promptFor('1310', 'technique'), /weighted vest/i)
  assert.match(promptFor('1310', 'technique'), /move them outward/i)
  for (const id of ['1306', '1307', '1308', '1309', '1310']) assert.match(promptFor(id, 'muscles'), /Primary muscles: Chest/i)
})

test('wide push-up, medicine-ball run, unilateral row, ball extension, and pullover prompts stay specific', () => {
  assert.match(promptFor('1311', 'technique'), /wider than shoulder width/i)
  assert.match(promptFor('1312', 'technique'), /run after it/i)
  assert.match(promptFor('1313', 'technique'), /one handle at a time/i)
  assert.match(promptFor('1314', 'technique'), /stability ball/i)
  assert.match(promptFor('1316', 'technique'), /barbell/i)
  for (const id of ['1311', '1312']) assert.match(promptFor(id, 'muscles'), /Primary muscles: Chest/i)
  assert.match(promptFor('1313', 'muscles'), /Primary muscles: Upper back/i)
  assert.match(promptFor('1314', 'muscles'), /Primary muscles: Glutes/i)
  assert.match(promptFor('1316', 'muscles'), /Primary muscles: Lats/i)
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
