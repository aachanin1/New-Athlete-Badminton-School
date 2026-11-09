import assert from 'node:assert/strict'
import path from 'node:path'
import { verifyLessonSourceTarget } from '../../scripts/verify-lesson-source-test-target.mjs'
process.env.LESSON_SOURCE_RUN_MANIFEST ||= path.resolve('.playwright/booking-bill-policy-1/run.json')
process.env.TASK10_DISPOSABLE_TARGET ||= path.resolve('.playwright/booking-bill-policy-1/target.json')
const declared = verifyLessonSourceTarget()
assert.match(declared.runId, /^booking-bill-policy-1-20261109-[a-f0-9-]{36}$/)
assert.equal(declared.target.project, 'BookingBillPolicy20261109')
assert.equal(declared.target.api, 'http://127.0.0.1:63301')
const runtime = await import('../branch-closure/isolated-runtime.mjs')
assert.equal(runtime.run.runId, declared.runId)
export const { run, env, db, sql, q, concurrentSql, holdTransaction, observeLockWait } = runtime

