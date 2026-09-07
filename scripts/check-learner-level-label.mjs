import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import Module, { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cache = new Map()
function load(relative) {
  const filename = path.resolve(root, relative)
  if (cache.has(filename)) return cache.get(filename).exports
  const mod = new Module(filename)
  cache.set(filename, mod)
  mod.require = (id) => {
    if (!id.startsWith('@/') && !id.startsWith('.')) return require(id)
    const base = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(filename), id)
    const target = [base, `${base}.ts`, `${base}.tsx`].find((p) => fs.existsSync(p) && fs.statSync(p).isFile())
    return load(target)
  }
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename,
  }).outputText, filename)
  return mod.exports
}

const expected = 'LV 0 · นักเรียนใหม่/รอประเมิน'
const { getLevelDisplay, LEVEL_RANGES } = load('src/constants/levels.ts')
for (const level of [0, null, undefined, -1]) assert.equal(getLevelDisplay(level).label, expected)
for (const level of [1, 34, 35, 58, 59, 70]) {
  const range = LEVEL_RANGES.find((r) => level >= r.minLevel && level <= r.maxLevel)
  assert.deepEqual(getLevelDisplay(level), { level, label: range.label, color: range.color, range })
}
const { formatScheduleLevel, getScheduleLevelDetails, buildLatestScheduleStudentLevelMap } = load('src/lib/schedule-learning-details.ts')
assert.equal(formatScheduleLevel(0, 'old stored name'), expected)
assert.equal(formatScheduleLevel(9, 'Backhand'), 'LV 9 · Backhand')
assert.equal(formatScheduleLevel(9, null), 'LV 9')
const latest = buildLatestScheduleStudentLevelMap([
  { student_type: 'adult', student_id: 'same', level: 0, created_at: '2026-09-01' },
  { student_type: 'child', student_id: 'same', level: 9, created_at: '2026-09-01' },
])
assert.equal(getScheduleLevelDetails('adult', 'same', latest, new Map()).label, expected)
assert.equal(getScheduleLevelDetails('child', 'same', latest, new Map()).label, 'LV 9')
for (const type of ['child', 'adult']) assert.equal(getScheduleLevelDetails(type, 'missing', latest, new Map()).label, expected)
const { LearnerLevelBadge } = load('src/components/shared/learner-level-badge.tsx')
for (const level of [0, null, undefined]) {
  const markup = renderToStaticMarkup(React.createElement(LearnerLevelBadge, { level, className: 'text-[10px] text-blue-700', children: 'ยังไม่ประเมิน' }))
  assert.ok(markup.includes(expected))
  for (const value of ['text-red-700', 'font-bold', 'text-sm', 'whitespace-normal', 'break-words', 'max-w-full']) assert.ok(markup.includes(value), value)
  assert.ok(!markup.includes('text-[10px]'))
  assert.ok(!markup.includes('text-blue-700'))
}
for (const children of ['Basic', 'LV 9', 'LV 9 · Backhand', 'Backhand (LV 9)']) {
  const markup = renderToStaticMarkup(React.createElement(LearnerLevelBadge, { level: 9, className: 'text-[10px] text-blue-700', children }))
  assert.ok(markup.includes(children))
  assert.ok(markup.includes('text-[10px] text-blue-700'))
  assert.ok(!markup.includes('text-red-700'))
}
console.log('Learner level regression passed: null/undefined/zero, child/adult/fallback, stale names, evaluated boundaries, identity and badge rendering')
