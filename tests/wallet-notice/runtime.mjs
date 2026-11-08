import path from 'node:path'
process.env.LESSON_SOURCE_RUN_MANIFEST ||= path.resolve('.playwright/wallet-store-notice-actor-1/run.json')
process.env.TASK10_DISPOSABLE_TARGET ||= path.resolve('.playwright/wallet-store-notice-actor-1/target.json')
export const {run,env,db,sql,q} = await import('../branch-closure/isolated-runtime.mjs')
export const fixtures = await import('../branch-closure/fixtures.mjs')
