import fs from 'node:fs'
// Same physically verified isolation procedure; a new task/project/port/network.
let source=fs.readFileSync('scripts/prepare-booking-makeup-scope-local.mjs','utf8')
source=source.replaceAll('booking-makeup-scope-1','coach-makeup-review-1').replaceAll('BookingMakeupScope20261107','CoachMakeupReview20261107').replaceAll("'630'","'631'").replaceAll('10.222.27.0/24','10.222.28.0/24').replaceAll('20261104044000','20261107060410').replaceAll('97','98')
const file='.playwright/prepare-coach-makeup-review-generated.mjs'
fs.writeFileSync(file,source.replace("'./verify-lesson-source-test-target.mjs'","'../scripts/verify-lesson-source-test-target.mjs'"))
await import('../'+file)
