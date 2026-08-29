import { existsSync, readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const failures = []

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

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('exercise visual policy: ok')
