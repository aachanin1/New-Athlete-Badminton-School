import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  getBangkokDayOfWeek,
  getTemplateSlots,
  normalizeCourseTypeName,
  normalizeScheduleTime,
} from '../src/lib/schedule-template-utils.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const route = read('src/app/api/lesson-wallet/route.ts')
const slotResolver = read('src/lib/schedule-slot-utils.ts')

let passed = 0
function check(name, action) {
  action()
  passed += 1
  console.log(`PASS ${passed}: ${name}`)
}

const ramintraPrivateSunday = {
  id: '508d96b1-canonical-private-sunday',
  branch_id: 'ram-intra-id',
  branch_slug: 'ram-intra',
  course_type_id: 'private-id',
  course_type_name: 'private',
  day_of_week: 0,
  start_time: '17:00:00',
  end_time: '18:00:00',
  is_active: true,
  notes: null,
}

check('Bangkok Sunday is stable even when the Node host timezone is UTC', () => {
  assert.equal(getBangkokDayOfWeek('2026-07-19'), 0)
})
check('invalid calendar dates fail closed', () => {
  assert.equal(getBangkokDayOfWeek('2026-02-30'), null)
})
check('the exact Ramintra Private Sunday 17:00-18:00 target is displayed', () => {
  assert.deepEqual(getTemplateSlots([ramintraPrivateSunday], 'ram-intra', 'private', 0), [{
    start: '17:00',
    end: '18:00',
    templateId: ramintraPrivateSunday.id,
  }])
})
check('17:00 and 17:00:00 normalize identically', () => {
  assert.equal(normalizeScheduleTime('17:00'), '17:00:00')
  assert.equal(normalizeScheduleTime('17:00:00'), '17:00:00')
})
check('timezone-bearing input normalizes to Bangkok time', () => {
  assert.equal(normalizeScheduleTime('2026-07-19T10:00:00Z', '2026-07-19'), '17:00:00')
  assert.equal(normalizeScheduleTime('17:00:00+07:00', '2026-07-19'), '17:00:00')
})
check('invalid times fail closed', () => {
  assert.equal(normalizeScheduleTime('25:00'), null)
  assert.equal(normalizeScheduleTime('17:60'), null)
})
check('course type validation never defaults missing data to Kids Group', () => {
  assert.equal(normalizeCourseTypeName(undefined), null)
  assert.equal(normalizeCourseTypeName(''), null)
  assert.equal(normalizeCourseTypeName('kids_group'), 'kids_group')
  assert.equal(route.includes("|| 'kids_group'"), false)
})
check('supplied template id is a hint and canonical fallback still executes', () => {
  assert.match(route, /if \(payload\.scheduleTemplateId\)[\s\S]*loadTemplates\(payload\.scheduleTemplateId\)[\s\S]*return loadTemplates\(\)/)
})
check('template lookup requires canonical branch, authoritative course, Bangkok weekday and active state', () => {
  for (const predicate of [".eq('branch_id', payload.branchId)", ".eq('course_type_id', courseTypeId)", ".eq('day_of_week', bangkokDayOfWeek)", ".eq('is_active', true)"]) {
    assert.equal(route.includes(predicate), true, predicate)
  }
  assert.equal(route.includes('credit.course_type_id'), true)
})
check('template time matching uses normalized exact start and end', () => {
  assert.match(route, /normalizeScheduleTime\(template\.start_time[\s\S]*=== normalizeScheduleTime\(startTime/)
  assert.match(route, /normalizeScheduleTime\(template\.end_time[\s\S]*=== normalizeScheduleTime\(endTime/)
})
check('real slot resolution persists canonical template and exact normalized interval', () => {
  assert.equal(slotResolver.includes('template_id: templateId || null'), true)
  for (const required of ['slot.template_id === expected.templateId', 'slot.course_type_id === expected.courseTypeId', 'slot.date === expected.date', "normalizeScheduleTime(slot.start_time || ''", "normalizeScheduleTime(slot.end_time || ''"]) {
    assert.equal(route.includes(required), true, required)
  }
})
check('missing canonical template and invalid course data return distinct typed Thai errors', () => {
  for (const code of ['LESSON_WALLET_TEMPLATE_NOT_FOUND', 'LESSON_WALLET_COURSE_INVALID']) assert.equal(route.includes(code), true)
  assert.equal(route.includes('ไม่พบรอบเรียนประจำที่เปิดใช้งานตรงกับสาขา คอร์ส วัน และเวลาที่เลือก'), true)
  assert.equal(route.includes('ข้อมูลคอร์สของสิทธิ์กระเป๋าไม่ถูกต้อง กรุณาติดต่อผู้ดูแล'), true)
})
check('duplicate or overlap and stale credit return distinct typed conflicts', () => {
  for (const code of ['LESSON_WALLET_TARGET_CONFLICT', 'LESSON_WALLET_CREDIT_STALE']) assert.equal(route.includes(code), true)
  assert.equal(route.includes(".lt('start_time'"), true)
  assert.equal(route.includes(".gt('end_time'"), true)
})
check('future and same-month guards remain before redemption', () => {
  assert.equal(route.includes('!isSameMonth(credit.original_date, targetDate)'), true)
  assert.equal(route.includes('!isFutureSlot(targetDate, startTime)'), true)
})
check('full remains non-blocking while cancelled remains blocked', () => {
  assert.equal(route.includes("!['open', 'full'].includes(slot.status)"), true)
  assert.equal(route.includes("slot.status === 'cancelled'"), true)
  assert.equal(route.includes('current_students || 0) >= Number(slot.max_students'), false)
})
check('credit compare-and-set and loser compensation remain present', () => {
  assert.match(route, /\.eq\('id', credit\.id\)[\s\S]*\.eq\('status', 'active'\)/)
  assert.equal(route.includes('await adjustSlotCount(adminSupabase, scheduleSlotId, -1)'), true)
  assert.equal(route.includes("from('booking_sessions').delete().eq('id', newSession.id)"), true)
})
check('redeem path creates no payment, coupon, Ledger or Finance record', () => {
  const redeemPath = route.slice(route.indexOf('async function redeemWalletCredit'))
  for (const forbidden of ["from('payments')", "from('coupon_usages')", "from('payment_ledger')", "from('finance_expenses')"]) {
    assert.equal(redeemPath.includes(forbidden), false, forbidden)
  }
})
check('Wallet store retires only the source membership through the atomic lifecycle RPC', () => {
  const storePath = route.slice(route.indexOf('async function storeInWallet'), route.indexOf('async function redeemWalletCredit'))
  assert.equal(storePath.includes("rpc('retire_coach_assignment_membership_v1'"), true)
  assert.equal(storePath.includes("p_reason: 'wallet_store'"), true)
  assert.equal(storePath.includes("from('coach_assignment_groups').delete"), false)
})
check('Wallet redemption destination remains unassigned until Head Coach Save', () => {
  const redeemPath = route.slice(route.indexOf('async function redeemWalletCredit'))
  assert.equal(redeemPath.includes("from('coach_assignment_group_students').insert"), false)
  assert.equal(redeemPath.includes("rpc('create_exact_coach_assignment_group_v1'"), false)
  assert.match(redeemPath, /status: 'scheduled',[\s\S]*rescheduled_from_id: credit\.original_session_id/)
})

console.log(`\nLesson Wallet regression checks passed: ${passed}`)
