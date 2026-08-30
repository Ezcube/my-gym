import { pathToFileURL } from 'node:url'
import { EXERCISE_VISUAL_IDS } from '../frontend/src/lib/exercise-visuals.js'
import { EXIDX } from '../frontend/src/lib/exercises.js'
import { MUSCLE_NAME, musclesOf } from '../frontend/src/lib/muscles.js'
import { correctExerciseInstructions } from '../frontend/src/lib/exercise-instructions.js'

const approved = new Set(EXERCISE_VISUAL_IDS)
const list = values => values.length ? values.join(', ') : 'none'

const TECHNIQUE_ACCURACY = Object.freeze({
  '0025': 'The bar path reaches the middle of the chest before a controlled press.',
  '3666': 'Use an inclined motorized treadmill. Show walking, not running: natural heel contact, mid-stance, then controlled toe-off while the torso stays upright.',
  '2138': 'Use a stationary exercise bike with a correctly adjusted saddle. Keep the athlete seated and show one controlled pedal cycle with the knee never locked out.',
  '2141': 'Use an elliptical cross trainer with both feet planted on its pedals and hands on the moving handles. Show alternating elliptical stride phases without impact or free-standing walking.',
  '2311': 'Use a rotating stepmill with visible moving stairs. Keep the torso upright and show each foot landing fully on a step without hanging from the rails.',
  '0979': 'Use a resistance band anchored at chest height. Stand perpendicular to the anchor, press both hands straight away from the sternum, and resist torso rotation throughout.',
  '0289': 'Use a flat horizontal bench and two separate dumbbells. Keep both feet planted and the shoulder blades stable; each dumbbell descends beside the chest before a controlled press, with no barbell or joined weight.',
  '0293': 'Show a bilateral row with one dumbbell in each hand from a stable hip hinge and neutral spine. Pull both weights toward the lower ribs together; no one-arm stance or torso swing.',
  '1760': 'Use one dumbbell held vertically at the chest. The heels stay planted and the torso remains braced while the hips travel down between the legs; this is not a barbell squat.',
  '0432': 'Use a hip hinge rather than a squat. Two dumbbells travel close to the legs while the spine stays neutral with only a slight knee bend; stop at a controlled hamstring stretch.',
  '0410': 'Show a rear-foot-elevated split squat with the rear foot elevated on a bench. The front foot stays fully planted, the dumbbells hang at the sides, and the torso remains controlled; this is not a standard forward lunge.',
  '0314': 'Use an incline bench set to 45 degrees and two separate dumbbells. Lower both weights beside the upper chest before a controlled press; this is not a flat bench or barbell press.',
  '0308': 'Show a flat bench fly with two separate dumbbells and a fixed slight elbow bend. Lower both arms in a wide arc and return along the same path; this is not a dumbbell press.',
  '0405': 'Keep the athlete seated against an upright back support. Press both dumbbells vertically from shoulder height without leg drive; this is not a standing or Arnold press.',
  '0310': 'Raise both dumbbells forward together with a stable torso and nearly straight elbows. Stop at shoulder height, not overhead or out to the sides, then lower under control.',
  '0406': 'Keep both dumbbells hanging at the sides while the arms remain straight. Elevate both shoulders straight upward, pause, and lower under control; no elbow curl or shoulder rolling.',
  '0333': 'Use a stable hip hinge and neutral spine while both upper arms stay beside the torso. Keep the elbows fixed and extend only the forearms backward until the arms are straight; this is not a row or shoulder swing.',
  '0383': 'From a stable hip hinge and neutral spine, raise both dumbbells out to the sides with a fixed slight elbow bend. Stop with the upper arms near shoulder height; this is not a row or shrug.',
  '0297': 'Sit with one dumbbell and brace the working elbow against the inner thigh. The upper arm remains stationary while the forearm curls through a controlled full range without torso movement.',
  '2188': 'Sit upright and use one dumbbell held with both hands overhead. Keep the upper arms close to the ears while only the elbows move to lower the weight behind the head and extend it again.',
  '0375': 'Lie lengthwise on a flat bench and use one dumbbell held with both hands above the chest. With a slight fixed elbow bend, lower the weight in an arc behind the head and return along the same path; this is not a press.',
  '0413': 'Two dumbbells hang at the sides. The heels stay planted and the torso remains braced while the hips move down and back until the thighs approach parallel, then stand under control; this is not a goblet or barbell squat.',
  '1459': 'Use a hip hinge. Two dumbbells travel close to the legs while a soft fixed knee bend and neutral spine are maintained. The hips move backward until a controlled hamstring stretch, then extend; this is not a squat.',
  '0336': 'Keep two dumbbells hanging at the sides and step forward into an alternating lunge. The front foot stays fully planted while the rear knee lowers under control, then push through the front heel to return; this is not a reverse or static split squat.',
  '0431': 'Use a stable knee-height platform and two dumbbells hanging at the sides. The entire lead foot stays on the platform; drive through the lead leg to stand tall, then descend under control with no jump or push-off from the trailing foot.',
  '0417': 'Two dumbbells hang at the sides while the torso stays upright. Raise both heels together to the highest controlled position while the knees remain straight but not locked, pause, and lower slowly; no bouncing or knee bend.',
  '0003': 'Show a supine bicycle crunch on the floor. Bring the opposite elbow toward the bent knee while the other leg extends and hovers; alternate smoothly without pulling the neck. This is not a stationary exercise bike.',
  '0687': 'Sit with the torso leaned back, knees bent, and feet lifted off the floor. Rotate the ribcage and shoulders together from side to side while the hands stay centered in front of the chest; the movement comes from the torso, not just the hands.',
  '0630': 'Start in a rigid high plank with hands under the shoulders. Alternate one knee toward the chest while the other leg stays extended; the hips stay low and the shoulders remain stacked. This is not a standing run or squat thrust.',
  '0276': 'Use a supine tabletop position with hips and knees at 90 degrees and the lower back pressed into the floor. Lower one opposite arm and leg toward the floor, return to center, then switch sides without arching the lumbar spine.',
  '0464': 'Begin in a stable high plank. Rotate the whole torso into a controlled side-plank position with the top arm toward the ceiling, then return to both hands and alternate sides. Keep the legs and hips controlled; this is not a forearm plank.',
  '2137': 'Stay seated against an upright back support. Begin with elbows forward; the palms face the athlete. Press upward while the forearms rotate until the palms face forward overhead. Reverse the same path under control; this is not a standard shoulder press.',
  '0296': 'Lie on a flat bench with one dumbbell in each hand. The dumbbells stay close together above the chest while the elbows remain tucked beside the torso; lower under control and press with the triceps. This is not a wide chest press or fly.',
  '0351': 'Lie on a flat bench with one dumbbell in each hand. The upper arms remain vertical and stationary while only the elbows move to lower both dumbbells toward the forehead and extend them again; this is not a pullover or press.',
  '0315': 'Sit against an incline bench set to 45 degrees. Both arms hang slightly behind the torso with palms facing forward. The upper arms remain stationary while both forearms curl the dumbbells toward the shoulders; this is not a shoulder press.',
  '0437': 'Stand upright; the two dumbbells begin in front of the thighs. Lead upward with the elbows; the elbows stay above the hands as the weights rise close to the body toward the upper chest, then lower slowly. This is not a shrug or biceps curl.',
  '0372': 'Sit at a preacher bench with the backs of both upper arms fully supported on the pad. Begin with the palms face up and elbows nearly extended; curl only at the elbows while the upper arms stay planted. This is not a standing curl.',
  '0439': 'Stand tall and curl both dumbbells with the palms rotating to face forward. At the top, rotate the forearms until the palms face away from the athlete, then lower under control with a pronated grip before returning to neutral. This is not an ordinary curl.',
  '0381': 'Hold one dumbbell at each side and step backward into an alternating reverse lunge. The front foot stays fully planted while the rear knee lowers under control; push through the front heel to return. This is not a forward lunge.',
  '0407': 'Stand upright holding one dumbbell at one side. Bend only toward the weighted side so the dumbbell slides down the outside of the thigh, then use the trunk to return to neutral. Keep the shoulders square with no torso rotation or hip shift.',
  '0409': 'Place the forefoot of one working leg on the edge of a stable step while the other leg remains off the platform. Hold one dumbbell while the other hand holds a fixed support. Lower the working heel below the step, rise fully onto the toes with a straight knee, and lower slowly; this is not a bilateral calf raise.',
  '0577': 'Use a seated lever chest-press machine. The handles travel forward from chest height and return under control while the back and shoulder blades stay against the pad. Keep the feet planted and wrists neutral; this is not a free-weight press.',
  '0603': 'Use a seated lever shoulder-press machine with the back fully supported. The handles begin at shoulder level; press overhead without locking the elbows, then lower evenly. Keep the feet planted with no leg drive or lower-back arch.',
  '0599': 'Use a seated leg-curl machine adjusted so the knee joints align with the machine pivot. The thigh pad pins the thighs down and the roller sits behind the lower legs just above the heels. Curl the heel roller down and back by bending only the knees; this is not a lying leg curl.',
  '0178': 'Stand centered between two low cable pulleys with one handle in each hand and the cables under continuous tension. With a slight fixed elbow bend, raise both arms out to the sides only to shoulder height, then lower slowly. Keep the torso still and do not shrug or press overhead.',
  '0203': 'Use a rope attached to a low pulley and a stable hip hinge with a neutral spine. Pull the rope toward the upper chest as the elbows travel wide and the shoulder blades draw together, then return slowly. This is a rear-delt row, not a face pull or biceps curl.',
})

const MUSCLE_GROUP_OVERRIDES = Object.freeze({
  '3666': { primary: ['Quads', 'Calves'], secondary: ['Hamstrings'] },
  '2138': { primary: ['Quads'], secondary: ['Hamstrings', 'Calves'] },
  '2141': { primary: ['Quads', 'Glutes'], secondary: ['Hamstrings', 'Calves'] },
  '2311': { primary: ['Quads', 'Glutes', 'Calves'], secondary: ['Hamstrings'] },
  '0630': { primary: ['Abs', 'Hip flexors'], secondary: ['Shoulders', 'Triceps', 'Quads'] },
})

function exerciseFor(id) {
  if (!approved.has(id) || !EXIDX[id]) throw new Error(`Unknown exercise id: ${id}`)
  return EXIDX[id]
}

function movementInstructions(ex) {
  return correctExerciseInstructions(ex.id, ex.st || [])
    .map((step, index) => `${index + 1}. ${step}`).join('\n')
}

function muscleGroups(ex) {
  if (MUSCLE_GROUP_OVERRIDES[ex.id]) return MUSCLE_GROUP_OVERRIDES[ex.id]
  const entries = Object.entries(musclesOf(ex))
  const names = rows => rows.map(([slug]) => MUSCLE_NAME[slug] || slug)
  return {
    primary: names(entries.filter(([, weight]) => weight >= 0.75)),
    secondary: names(entries.filter(([, weight]) => weight > 0 && weight < 0.75)),
  }
}

function techniquePrompt(ex) {
  const accuracy = TECHNIQUE_ACCURACY[ex.id] || 'Follow the supplied exercise instructions exactly.'
  return `Use case: scientific-educational
Asset type: landscape technique image for a dark fitness workout app
Primary request: Create a clear three-panel photorealistic demonstration of ${ex.n}.
Equipment: ${ex.eq || 'body weight'}.
Existing exercise instructions:
${movementInstructions(ex)}
Exercise-specific accuracy: ${accuracy}
Subject: the same real adult male athlete in every panel, realistic non-exaggerated physique, neutral charcoal training clothes that do not hide joint position.
Scene/backdrop: the correct gym setup and equipment on a clean matte near-black background (#0b0e0c).
Composition/framing: one 3:2 landscape image divided into three equal panels. Panel 1 shows the stable starting position. Panel 2 shows the most informative loaded, lowered, or peak-contraction position described by the instructions. Panel 3 shows the controlled completed repetition. Keep camera angle, person, equipment, scale, and direction identical across panels.
Style/medium: polished photorealistic sports photography with high anatomical and equipment clarity.
Lighting/mood: soft neutral studio lighting, crisp silhouette, no dramatic shadows.
Constraints: scientifically plausible joint alignment, grip, stance, range of motion, and equipment path; full relevant body and equipment remain visible; no unsafe invented motion.
Avoid: extra limbs or fingers, merged or bent equipment, inconsistent bar plates, different person between panels, extreme bodybuilding proportions, gore, or exposed anatomy; no text, labels, logos, or watermark.`
}

function musclesPrompt(ex) {
  const groups = muscleGroups(ex)
  return `Use case: scientific-educational
Asset type: landscape target-muscle image for a dark fitness workout app
Primary request: Show the muscles trained by ${ex.n} on a realistic adult male athlete.
Primary muscles: ${list(groups.primary)}.
Secondary muscles: ${list(groups.secondary)}.
Subject: the same real adult male athlete twice in a relaxed neutral anatomical pose, front view on the left and back view on the right, framed from head to feet so lower-leg targets remain visible. He is fully clothed in an opaque fitted charcoal short-sleeve athletic top and full-length training tights; no bare torso or underwear-like clothing.
Scene/backdrop: clean matte near-black background (#0b0e0c), no floor or equipment.
Style/medium: photorealistic sports photography with a clean scientific fitness overlay; clearly a real human, not a mannequin.
Composition/framing: two equal figures with generous separation and consistent scale.
Color palette: subdued natural body tones and charcoal clothing. Apply the muscle overlay visibly over the clothing: highlight primary muscles in vivid emerald green with a precise semi-transparent anatomical shape, and secondary muscles in a clearly softer, darker green. Leave every other region neutral.
Constraints: anatomically plausible, symmetric highlights, muscle placement consistent with the named groups, clean edges, no exposed tissue or internal anatomy.
Avoid: highlighted unrelated muscles, extra limbs, different people between views, bodybuilding exaggeration, text, labels, arrows, numbers, logos, borders, checkerboard, or watermark.`
}

export function promptFor(id, kind) {
  const ex = exerciseFor(id)
  if (kind === 'technique') return techniquePrompt(ex)
  if (kind === 'muscles') return musclesPrompt(ex)
  throw new Error(`Unknown visual kind: ${kind}`)
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (invoked) {
  const [id, kind] = process.argv.slice(2)
  try {
    process.stdout.write(promptFor(id, kind) + '\n')
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
