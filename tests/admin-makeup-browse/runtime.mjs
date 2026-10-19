import path from 'node:path'
process.env.LESSON_SOURCE_RUN_MANIFEST ||= path.resolve('.playwright/admin-makeup-browse-v7/run.json')
process.env.TASK10_DISPOSABLE_TARGET ||= path.resolve('.playwright/admin-makeup-browse-v7/target.json')
const runtime=await import('../branch-closure/isolated-runtime.mjs')
export const {run,env,db,sql,q,concurrentSql,holdTransaction,observeLockWait}=runtime
export const fixtures=await import('../branch-closure/fixtures.mjs')
