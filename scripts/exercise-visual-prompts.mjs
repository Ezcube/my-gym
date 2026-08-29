import { pathToFileURL } from 'node:url'
import { EXERCISE_VISUAL_IDS } from '../frontend/src/lib/exercise-visuals.js'
import { EXIDX } from '../frontend/src/lib/exercises.js'
import { MUSCLE_NAME, musclesOf } from '../frontend/src/lib/muscles.js'

const approved = new Set(EXERCISE_VISUAL_IDS)
const list = values => values.length ? values.join(', ') : 'none'

function exerciseFor(id) {
  if (!approved.has(id) || !EXIDX[id]) throw new Error(`Unknown exercise id: ${id}`)
  return EXIDX[id]
}

function movementInstructions(ex) {
  return (ex.st || []).map((step, index) => `${index + 1}. ${step}`).join('\n')
}

function muscleGroups(ex) {
  const entries = Object.entries(musclesOf(ex))
  const names = rows => rows.map(([slug]) => MUSCLE_NAME[slug] || slug)
  return {
    primary: names(entries.filter(([, weight]) => weight >= 0.75)),
    secondary: names(entries.filter(([, weight]) => weight > 0 && weight < 0.75)),
  }
}

function techniquePrompt(ex) {
  const accuracy = ex.id === '0025'
    ? 'The bar path reaches the middle of the chest before a controlled press.'
    : 'Follow the supplied exercise instructions exactly.'
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
Subject: the same real adult male athlete twice in a relaxed neutral anatomical pose, front view on the left and back view on the right, framed from head to feet so lower-leg targets remain visible, charcoal compression shorts, torso, arms, and legs unobstructed.
Scene/backdrop: clean matte near-black background (#0b0e0c), no floor or equipment.
Style/medium: photorealistic sports photography with a clean scientific fitness overlay; clearly a real human, not a mannequin.
Composition/framing: two equal figures with generous separation and consistent scale.
Color palette: subdued natural body tones. Highlight primary muscles in vivid emerald green with a precise semi-transparent anatomical overlay. Highlight secondary muscles in a clearly softer, darker green. Leave every other muscle neutral.
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
