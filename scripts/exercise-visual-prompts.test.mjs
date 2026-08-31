import test from 'node:test'
import assert from 'node:assert/strict'
import { EXERCISE_VISUAL_IDS } from '../frontend/src/lib/exercise-visuals.js'
import { promptFor } from './exercise-visual-prompts.mjs'

test('every approved id produces both complete prompts', () => {
  assert.equal(EXERCISE_VISUAL_IDS.length, 105)
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
