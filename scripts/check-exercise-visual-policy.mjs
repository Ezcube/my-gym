import { existsSync, readFileSync, statSync } from 'node:fs'
import { EXERCISE_VISUAL_IDS, EXERCISE_VISUALS } from '../frontend/src/lib/exercise-visuals.js'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const failures = []

const read24LE = (buffer, offset) => buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16)

function webpDimensions(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('not a WebP RIFF file')
  }
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const tag = buffer.toString('ascii', offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)
    const data = offset + 8
    if (tag === 'VP8X' && data + 10 <= buffer.length) {
      return { width: read24LE(buffer, data + 4) + 1, height: read24LE(buffer, data + 7) + 1 }
    }
    if (tag === 'VP8L' && data + 5 <= buffer.length && buffer[data] === 0x2f) {
      const bits = buffer.readUInt32LE(data + 1)
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
    }
    if (tag === 'VP8 ' && data + 10 <= buffer.length && buffer[data + 3] === 0x9d && buffer[data + 4] === 0x01 && buffer[data + 5] === 0x2a) {
      return { width: buffer.readUInt16LE(data + 6) & 0x3fff, height: buffer.readUInt16LE(data + 8) & 0x3fff }
    }
    offset = data + size + (size % 2)
  }
  throw new Error('unsupported WebP payload')
}

function validateGeneratedAssets() {
  if (EXERCISE_VISUAL_IDS.length !== 30 || new Set(EXERCISE_VISUAL_IDS).size !== 30) {
    failures.push('exercise visual manifest must contain exactly 30 unique ids')
  }
  let files = 0
  for (const id of EXERCISE_VISUAL_IDS) {
    const pair = EXERCISE_VISUALS[id]
    for (const kind of ['technique', 'muscles']) {
      const visual = pair?.[kind]
      if (!visual || !visual.src.startsWith(`./exercise-visuals/${id}/`) || !visual.src.endsWith(`/${kind}.webp`)) {
        failures.push(`${id}/${kind}: invalid local manifest path`)
        continue
      }
      const relative = visual.src.replace(/^\.\//, '')
      const url = new URL(`frontend/public/${relative}`, root)
      if (!existsSync(url)) {
        failures.push(`${id}/${kind}: asset missing`)
        continue
      }
      files++
      const bytes = readFileSync(url)
      const size = statSync(url).size
      if (size <= 0 || size > 307200) failures.push(`${id}/${kind}: ${size} bytes exceeds policy`)
      try {
        const actual = webpDimensions(bytes)
        if (actual.width !== visual.width || actual.height !== visual.height) {
          failures.push(`${id}/${kind}: ${actual.width}x${actual.height} != ${visual.width}x${visual.height}`)
        }
        if (actual.width > 1200) failures.push(`${id}/${kind}: width exceeds 1200`)
      } catch (error) {
        failures.push(`${id}/${kind}: ${error.message}`)
      }
    }
  }
  if (files !== 60) failures.push(`expected 60 generated WebP files, found ${files}`)
}

function reject(path, pattern, message) {
  if (pattern.test(read(path))) failures.push(`${path}: ${message}`)
}

reject('frontend/src/components/Media.jsx', /<img|imgSrc|gifSrc/, 'component requests external exercise media')
reject('frontend/src/lib/exercises.js', /VITE_IMG_BASE|VITE_GIF_BASE|export const (imgSrc|gifSrc)/, 'legacy media URL API remains')
reject('frontend/package.json', /VITE_IMG_BASE|VITE_GIF_BASE/, 'mobile build injects external media bases')
reject('docker-compose.yml', /(^|\n)\s{2}media:\s*\n|\.\/media\/(img|gif)/, 'Compose still downloads or mounts exercise media')
reject('.github/workflows/pages.yml', /VITE_IMG_BASE|VITE_GIF_BASE/, 'GitHub Pages still injects external media')
reject('.gitlab-ci.yml', /VITE_IMG_BASE|VITE_GIF_BASE/, 'GitLab Pages still injects external media')
reject('.github/workflows/pages.yml', /^\s*DATASET:/m, 'unused external media dataset remains configured')
reject('.gitlab-ci.yml', /^\s*DATASET:/m, 'unused external media dataset remains configured')

if (existsSync(new URL('scripts/fetch-media.sh', root))) {
  failures.push('scripts/fetch-media.sh: unlicensed media downloader still exists')
}

validateGeneratedAssets()

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('exercise visual policy: ok (30 ids, 60 local WebP files)')
