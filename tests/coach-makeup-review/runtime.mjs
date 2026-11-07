import path from 'node:path'
process.env.LESSON_SOURCE_RUN_MANIFEST ||= path.resolve('.playwright/coach-makeup-review-1/run.json')
process.env.TASK10_DISPOSABLE_TARGET ||= path.resolve('.playwright/coach-makeup-review-1/target.json')
const runtime=await import('../branch-closure/isolated-runtime.mjs')
export const {run,env,db,sql,q,concurrentSql}=runtime
export const fixtures=await import('../branch-closure/fixtures.mjs')
