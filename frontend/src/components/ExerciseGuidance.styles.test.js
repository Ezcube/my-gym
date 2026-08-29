import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

describe('exercise guidance readability', () => {
  it('uses readable text tokens and sizes for labels, phases, and safety copy', () => {
    expect(css).toMatch(/\.exercise-guidance-label\{[^}]*color:var\(--label-2\)[^}]*font-size:12px/s)
    expect(css).toMatch(/\.exercise-guidance-phases span\{[^}]*color:var\(--label-2\)[^}]*font-size:12px[^}]*font-weight:500/s)
    expect(css).toMatch(/\.exercise-guidance-safety\{[^}]*color:var\(--label-2\)[^}]*font-size:13px/s)
    expect(css).toMatch(/\.exercise-guidance-phases span\{font-size:11px\}/)
  })

  it('keeps the fixed navigation opaque enough that underlying workout copy does not ghost through', () => {
    expect(css).toMatch(/#tabbar\{[^}]*background:color-mix\(in srgb,var\(--bg-el\) 94%,transparent\)/s)
    expect(css).toMatch(/:root\[data-theme="light"\] #tabbar\{background:rgba\(249,249,251,\.96\)\}/)
  })
})
