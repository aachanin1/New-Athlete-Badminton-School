import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatLearnerDisplayName, joinLearnerDisplayNames } from '../src/lib/learner-display-name.ts'
import { calculateProgressiveBookingPrice } from '../src/lib/progressive-booking-pricing.ts'
import { formatPricingTierRange } from '../src/lib/pricing.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const migrationFiles = fs.readdirSync(path.join(root, 'supabase/migrations'))
  .filter((name) => name.endsWith('_unlimited_normal_slot_entry.sql'))
assert.equal(migrationFiles.length, 1, 'exactly one unlimited-slot migration source is required')

const migration = read(`supabase/migrations/${migrationFiles[0]}`)
const availability = read('src/lib/booking-slot-availability.ts')
const availabilityRoute = read('src/app/api/bookings/availability/route.ts')
const bookingClient = read('src/components/dashboard/booking-client.tsx')
const bookingRoute = read('src/app/api/bookings/route.ts')
const bookingWrite = read('src/lib/progressive-booking-write.ts')
const previewRoute = read('src/app/api/bookings/preview/route.ts')
const previewHelper = read('src/lib/progressive-booking-preview.ts')
const walletRoute = read('src/app/api/lesson-wallet/route.ts')
const rescheduleRoute = read('src/app/api/reschedule/route.ts')
const makeupRoute = read('src/app/api/admin/makeup/route.ts')

let passed = 0
function check(name, action) {
  action()
  passed += 1
  console.log(`PASS ${passed}: ${name}`)
}

check('nickname and full name are combined', () => assert.equal(formatLearnerDisplayName({ nickname: 'น้องเอ', fullName: 'เด็กหญิง เอ ใจดี' }), 'น้องเอ - เด็กหญิง เอ ใจดี'))
check('missing nickname uses full name', () => assert.equal(formatLearnerDisplayName({ nickname: null, fullName: 'สมชาย ใจดี' }), 'สมชาย ใจดี'))
check('whitespace nickname uses full name', () => assert.equal(formatLearnerDisplayName({ nickname: '  ', fullName: 'สมชาย ใจดี' }), 'สมชาย ใจดี'))
check('equal nickname is not duplicated', () => assert.equal(formatLearnerDisplayName({ nickname: 'สมชาย ใจดี', fullName: 'สมชาย ใจดี' }), 'สมชาย ใจดี'))
check('nickname-only learner is supported', () => assert.equal(formatLearnerDisplayName({ nickname: 'น้องบี', fullName: ' ' }), 'น้องบี'))
check('blank learner has a safe fallback', () => assert.equal(formatLearnerDisplayName({ nickname: ' ', fullName: null }), 'ไม่ระบุชื่อผู้เรียน'))
check('multiple learners have no blank separator', () => assert.equal(joinLearnerDisplayNames([{ nickname: 'เอ', fullName: 'เด็กหญิง เอ' }, { fullName: 'เด็กชาย บี' }]), 'เอ - เด็กหญิง เอ, เด็กชาย บี'))

const tiers = [
  { id: 'one', minSessions: 1, maxSessions: 1, ratePerSession: 700, packagePrice: 700 },
  { id: 'two-six', minSessions: 2, maxSessions: 6, ratePerSession: 625, packagePrice: 2500 },
  { id: 'seven-ten', minSessions: 7, maxSessions: 10, ratePerSession: 500, packagePrice: 4000 },
  { id: 'open', minSessions: 19, maxSessions: null, ratePerSession: 350, packagePrice: 7000 },
]
check('Progressive 4+1 selects exact 2–6 tier at 625', () => {
  const result = calculateProgressiveBookingPrice({ previousActiveSessions: 4, newBookingEntitlementSessions: 1, pricingTiers: tiers })
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual([result.value.selectedTier.id, result.value.ratePerSession, result.value.grossBookingPrice], ['two-six', 625, 625])
})
check('Progressive 4+4 selects exact 7–10 tier at 500 and gross 2,000', () => {
  const result = calculateProgressiveBookingPrice({ previousActiveSessions: 4, newBookingEntitlementSessions: 4, pricingTiers: tiers })
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual([result.value.selectedTier.id, result.value.ratePerSession, result.value.grossBookingPrice], ['seven-ten', 500, 2000])
})
check('one-session range is customer-readable', () => assert.equal(formatPricingTierRange({ minSessions: 1, maxSessions: 1, unit: 'session' }), '1 ครั้ง'))
check('bounded range is customer-readable', () => assert.equal(formatPricingTierRange({ minSessions: 2, maxSessions: 6, unit: 'session' }), '2–6 ครั้ง'))
check('open range is customer-readable', () => assert.equal(formatPricingTierRange({ minSessions: 19, maxSessions: null, unit: 'session' }), '19 ครั้งขึ้นไป'))

check('availability contract has no capacity authority', () => {
  for (const forbidden of ['capacity:', 'remainingSeats:', 'requestedSeats:', 'full:', 'canFitRequestedSeats:']) assert.equal(availability.includes(forbidden), false)
  assert.equal(availability.includes('activeOccupancy: number'), true)
})
check('availability API does not select max_students', () => assert.equal(availabilityRoute.includes('max_students'), false))
check('Booking UI has no fixed group counts or full-seat display', () => {
  for (const forbidden of ['4-6 คน', '1-6 คน', 'เรท Progressive', 'remainingSeats', 'canFitRequestedSeats', 'slotAvailability.full']) assert.equal(bookingClient.includes(forbidden), false)
})
check('Booking UI contains authoritative range and plain-language explanation', () => {
  for (const required of ['ช่วงราคา {formatPricingTierRange(progressiveKidsPreview.selectedTier)}', 'วิธีคิดราคาการจองครั้งนี้', 'เดือนนี้มีรอบเรียนเดิม', 'ยอดที่ชำระสำหรับรายการก่อนหน้าจะยังอยู่กับรายการเดิม']) assert.equal(bookingClient.includes(required), true)
})
check('Booking UI waits for the server-selected tier in every course mode', () => {
  assert.equal(bookingClient.includes('const pricingPreviewPending = Boolean(courseType && allSelectedSessions.length > 0 && !selectedTier)'), true)
  assert.equal(bookingClient.includes('selectedTierRange ?'), false)
  assert.equal(bookingClient.includes('`${pricing.perSession} บาท/ครั้ง (${pricing.tierLabel})`'), false)
})
check('preview returns exact selected tier evidence in both modes', () => {
  assert.equal(previewHelper.includes('selectedTier: price.value.selectedTier'), true)
  assert.equal(previewRoute.includes('selectedTier: price.selectedTier'), true)
  assert.equal(previewHelper.includes('package_price'), true)
})
check('new Source fails closed against an old capability', () => {
  assert.equal(bookingWrite.includes("capability.slotEntryPolicy !== 'unlimited_learner_v1'"), true)
  assert.equal(migration.includes("'slotEntryPolicy', 'unlimited_learner_v1'"), true)
})
check('obsolete capacity error is absent from effective Source and new migration', () => {
  for (const source of [bookingRoute, bookingWrite, migration]) assert.equal(source.includes('PROGRESSIVE_CAPACITY_EXCEEDED'), false)
})
check('migration keeps locks and rejects cancelled slots', () => {
  assert.equal(migration.includes('FOR UPDATE'), true)
  assert.equal(migration.includes("ss.status = 'cancelled'"), true)
})
check('migration enforces exact and overlapping learner time conflicts', () => {
  assert.equal(migration.includes('earlier.ordinal < later.ordinal'), true)
  assert.equal(migration.includes('earlier.session_start < later.session_end'), true)
  assert.equal(migration.includes('earlier.session_end > later.session_start'), true)
  assert.equal(migration.includes('bs.start_time < r.session_end'), true)
  assert.equal(migration.includes('bs.end_time > r.session_start'), true)
})
check('migration refresh keeps occupancy informational and normalizes historical full', () => {
  assert.equal(migration.includes('current_students = counts.active_count'), true)
  assert.equal(migration.includes("ELSE 'open'::public.slot_status"), true)
  assert.equal(migration.includes('counts.active_count >= ss.max_students'), false)
})
check('Wallet accepts historical full and still rejects cancelled', () => {
  assert.equal(walletRoute.includes("!['open', 'full'].includes(slot.status)"), true)
  assert.equal(walletRoute.includes("slot.status === 'cancelled'"), true)
  assert.equal(walletRoute.includes('current_students || 0) >= Number(slot.max_students'), false)
})
check('Reschedule and Makeup have no capacity ceiling', () => {
  for (const source of [rescheduleRoute, makeupRoute]) {
    assert.equal(source.includes('max_students'), false)
    assert.equal(source.includes('PROGRESSIVE_CAPACITY_EXCEEDED'), false)
  }
})
check('Makeup preserves canonical target and overlap safety without adding capacity authority', () => {
  assert.equal(makeupRoute.includes(".from('schedule_templates')"), true)
  assert.equal(makeupRoute.includes('ensureScheduleSlot({'), true)
  assert.equal(makeupRoute.includes('schedule_slot_id: scheduleSlotId'), true)
  assert.equal(makeupRoute.includes(".lt('start_time'"), true)
  assert.equal(makeupRoute.includes(".gt('end_time'"), true)
})
check('Booking, Wallet and Reschedule use overlap comparisons', () => {
  for (const source of [bookingRoute, walletRoute, rescheduleRoute]) {
    assert.equal(source.includes(".lt('start_time'"), true)
    assert.equal(source.includes(".gt('end_time'"), true)
  }
})

console.log(`\nUnlimited slot entry and customer price UX checks passed: ${passed}`)
