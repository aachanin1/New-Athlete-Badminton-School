import assert from 'node:assert/strict'
import path from 'node:path'
import { verifyLessonSourceTarget } from '../../scripts/verify-lesson-source-test-target.mjs'
process.env.LESSON_SOURCE_RUN_MANIFEST ||= path.resolve('.playwright/no-class-return-1/run.json')
process.env.TASK10_DISPOSABLE_TARGET ||= path.resolve('.playwright/no-class-return-1/target.json')
const declared = verifyLessonSourceTarget()
assert.match(declared.runId, /^no-class-return-1-20261104-[a-f0-9-]{36}$/, 'Wrong task run')
assert.ok(['NoClassReturn20261104', 'NoClassReturnFresh20261104'].includes(declared.target.project), 'Wrong task project')
const runtime = await import('../branch-closure/isolated-runtime.mjs')
assert.equal(runtime.run.runId, declared.runId, 'A runtime imported earlier belongs to another task')
assert.equal(runtime.run.target.project, declared.target.project, 'Imported database differs from the task target')
export const { run, env, db, sql, q, concurrentSql, holdTransaction, observeLockWait } = runtime
export const fixtures = await import('../branch-closure/fixtures.mjs')
