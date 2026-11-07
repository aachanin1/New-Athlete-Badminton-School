import fs from 'node:fs'
const source=fs.readFileSync('scripts/build-booking-makeup-scope-local.mjs','utf8').replaceAll('booking-makeup-scope','coach-makeup-review').replaceAll('63010','63110').replaceAll('63011','63111')
const file='.playwright/build-coach-makeup-review-generated.mjs'
fs.writeFileSync(file,source.replace("'../tests/coach-makeup-review/runtime.mjs'","'../tests/coach-makeup-review/runtime.mjs'"))
await import('../'+file)
