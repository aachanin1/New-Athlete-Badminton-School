import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { run, sql, q } from './runtime.mjs'
import { authCookie, request, fixture, evidence } from './helpers.mjs'

const last = fs.readdirSync(run.outputDir).filter(f => f.startsWith('http-pass-')).sort().at(-1)
assert.ok(last)
const { records } = JSON.parse(fs.readFileSync(path.join(run.outputDir, last), 'utf8'))
const cookie = await authCookie(records.familyActor)
const before = sql(`SELECT coalesce(sum(amount),0) FROM payments WHERE booking_id=${q(records.family)} AND status='approved'`)
const created = await request(cookie, '/api/notifications/events/booking-created', { bookingId: records.family, totalSessions: 999, totalPrice: 999 })
assert.equal(created.status, 200, JSON.stringify(created.result))
const message = sql(`SELECT message FROM notifications WHERE user_id=${q(fixture().actors.sa.id)} AND title='มีการจองใหม่' ORDER BY created_at DESC,id DESC LIMIT 1`)
assert.ok(message.includes('3 ชั่วโมง') && message.includes('2,700') && !message.includes('999'), message)
assert.equal(sql(`SELECT coalesce(sum(amount),0) FROM payments WHERE booking_id=${q(records.family)} AND status='approved'`), before)
const other = await authCookie(fixture().actors.other)
const denied = await request(other, '/api/notifications/events/booking-created', { bookingId: records.family })
assert.equal(denied.status, 404)
const checks = ['Private notification uses stored3hours/2700, ignores client-supplied999 and leaves money unchanged', 'Another authenticated learner cannot emit a notification for this bill']
console.log(JSON.stringify({ passed: checks.length, evidence: evidence('notifications-pass', { checks, source: 'src/app/api/notifications/events/booking-created/route.ts' }) }))
