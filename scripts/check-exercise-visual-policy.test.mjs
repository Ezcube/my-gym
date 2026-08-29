import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listGeneratedVisualFiles } from './check-exercise-visual-policy.mjs'

test('enumerates every generated WebP so unlisted assets cannot ship silently', () => {
  const root = mkdtempSync(join(tmpdir(), 'my-gym-visual-policy-'))
  try {
    mkdirSync(join(root, '0001'), { recursive: true })
    mkdirSync(join(root, 'orphan'), { recursive: true })
    writeFileSync(join(root, '0001', 'technique.webp'), 'expected')
    writeFileSync(join(root, '0001', 'notes.txt'), 'ignored')
    writeFileSync(join(root, 'orphan', 'extra.webp'), 'unexpected')

    assert.deepEqual(listGeneratedVisualFiles(root), [
      '0001/technique.webp',
      'orphan/extra.webp',
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
