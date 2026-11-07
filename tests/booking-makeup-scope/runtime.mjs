import assert from 'node:assert/strict'
import path from 'node:path'
import { verifyLessonSourceTarget } from '../../scripts/verify-lesson-source-test-target.mjs'
process.env.LESSON_SOURCE_RUN_MANIFEST ||= path.resolve('.playwright/booking-makeup-scope-1/run.json')
process.env.TASK10_DISPOSABLE_TARGET ||= path.resolve('.playwright/booking-makeup-scope-1/target.json')
const declared = verifyLessonSourceTarget()
assert.match(declared.runId, /^booking-makeup-scope-1-20261107-[a-f0-9-]{36}$/)
assert.equal(declared.target.project, 'BookingMakeupScope20261107')
const runtime = await import('../branch-closure/isolated-runtime.mjs')
assert.equal(runtime.run.runId, declared.runId)
export const { run, env, db, sql, q, concurrentSql, holdTransaction, observeLockWait } = runtime
export const fixtures = await import('../branch-closure/fixtures.mjs')
