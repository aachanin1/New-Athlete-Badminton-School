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
import {
  LessonWalletEntitlementError,
  resolveLessonWalletEntitlement,
} from '../src/lib/lesson-wallet-entitlement.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const route = read('src/app/api/lesson-wallet/route.ts')
const slotResolver = read('src/lib/schedule-slot-utils.ts')
const migration = read('supabase/migrations/20260823090000_adult_private_ten_month_lesson_wallet.sql')
const correctiveMigration = read('supabase/migrations/20260824002134_correct_adult_private_wallet_tier_range.sql')
const walletPage = read('src/app/(dashboard)/dashboard/lesson-wallet/page.tsx')
const walletClient = read('src/components/dashboard/lesson-wallet-client.tsx')

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

const approvedPayment = (verifiedAt) => ({
  id: 'payment-approved',
  status: 'approved',
  verified_at: verifiedAt,
})

const tier = (courseType, quantity, overrides = {}) => ({
  id: `${courseType}-${quantity}`,
  course_type_name: courseType,
  min_sessions: quantity,
  max_sessions: quantity,
  price_per_session: 500,
  package_price: quantity * 500,
  valid_from: '2020-01-01',
  valid_to: null,
  ...overrides,
})

const entitlement = ({
  courseType = 'adult_group',
  quantity = 10,
  verifiedAt = '2026-01-15T05:00:00.000Z',
  originalSessionDate = '2026-01-20',
  payments = [approvedPayment(verifiedAt)],
  tiers = [tier(courseType, quantity)],
  inheritedEntitlement = null,
} = {}) => resolveLessonWalletEntitlement({
  courseType,
  purchasedQuantity: quantity,
  originalSessionDate,
  payments,
  pricingTiers: tiers,
  inheritedEntitlement,
})

check('January package approval expires at the inclusive end of October in Bangkok', () => {
  const result = entitlement()
  assert.equal(result.policyType, 'ten_month_package')
  assert.equal(result.expiresAt, '2026-10-31T16:59:59.999Z')
})

check('mid-month and month-end approvals share the same tenth inclusive calendar-month end', () => {
  assert.equal(entitlement({ verifiedAt: '2026-01-01T00:00:00.000Z' }).expiresAt, '2026-10-31T16:59:59.999Z')
  assert.equal(entitlement({ verifiedAt: '2026-01-31T16:59:59.000Z' }).expiresAt, '2026-10-31T16:59:59.999Z')
})

check('ten-month expiry crosses year boundaries and handles leap-year February', () => {
  assert.equal(entitlement({ verifiedAt: '2026-12-15T05:00:00.000Z' }).expiresAt, '2027-09-30T16:59:59.999Z')
  assert.equal(entitlement({ verifiedAt: '2023-05-15T05:00:00.000Z' }).expiresAt, '2024-02-29T16:59:59.999Z')
})

check('Adult and Private single-unit tiers and every Kids tier remain same-month', () => {
  assert.equal(entitlement({ quantity: 1, tiers: [tier('adult_group', 1)] }).policyType, 'same_month')
  assert.equal(entitlement({ courseType: 'private', quantity: 1, tiers: [tier('private', 1)] }).policyType, 'same_month')
  assert.equal(entitlement({ courseType: 'kids_group', quantity: 10, tiers: [tier('kids_group', 10)] }).policyType, 'same_month')
})

check('inclusive Adult range tiers resolve at lower, interior, and upper quantities', () => {
  const adultTiers = [
    tier('adult_group', 2, { id: 'adult-2-6', max_sessions: 6 }),
    tier('adult_group', 7, { id: 'adult-7-12', max_sessions: 12 }),
  ]

  for (const quantity of [2, 4, 6]) {
    assert.equal(entitlement({ quantity, tiers: adultTiers }).pricingTier.id, 'adult-2-6')
  }
  for (const quantity of [7, 9, 12]) {
    assert.equal(entitlement({ quantity, tiers: adultTiers }).pricingTier.id, 'adult-7-12')
  }
})

check('representative Kids range boundaries and interiors resolve but remain same-month', () => {
  const kidsTiers = [
    tier('kids_group', 2, { id: 'kids-2-6', max_sessions: 6 }),
    tier('kids_group', 7, { id: 'kids-7-10', max_sessions: 10 }),
    tier('kids_group', 11, { id: 'kids-11-14', max_sessions: 14 }),
    tier('kids_group', 15, { id: 'kids-15-18', max_sessions: 18 }),
    tier('kids_group', 19, { id: 'kids-19-plus', max_sessions: null }),
  ]

  for (const quantity of [2, 4, 6, 7, 8, 10, 11, 13, 14, 15, 16, 18, 19, 24]) {
    assert.equal(entitlement({ courseType: 'kids_group', quantity, tiers: kidsTiers }).policyType, 'same_month')
  }
})

check('missing or ambiguous approved Payment evidence fails closed', () => {
  for (const payments of [[], [approvedPayment('2026-01-01T00:00:00.000Z'), approvedPayment('2026-01-02T00:00:00.000Z')]]) {
    assert.throws(() => entitlement({ payments }), LessonWalletEntitlementError)
  }
  assert.throws(() => entitlement({ payments: [{ id: 'missing-date', status: 'approved', verified_at: null }] }), LessonWalletEntitlementError)
})

check('missing, overlapping, or non-exact historical tier evidence fails closed', () => {
  assert.throws(() => entitlement({ tiers: [] }), LessonWalletEntitlementError)
  assert.throws(() => entitlement({ tiers: [tier('adult_group', 10), tier('adult_group', 10, { id: 'overlap' })] }), LessonWalletEntitlementError)
  assert.throws(() => entitlement({ quantity: 12, tiers: [tier('adult_group', 10)] }), LessonWalletEntitlementError)
})

check('re-wallet preserves the original policy start, expiry and evidence', () => {
  const inherited = entitlement()
  const result = entitlement({
    verifiedAt: '2026-04-15T05:00:00.000Z',
    originalSessionDate: '2026-04-20',
    inheritedEntitlement: inherited,
  })
  assert.deepEqual(result, inherited)
})

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
  assert.match(route, /normalizeScheduleTime\(template\.start_time[\s\S]*=== normalizeScheduleTime\(payload\.startTime/)
  assert.match(route, /normalizeScheduleTime\(template\.end_time[\s\S]*=== normalizeScheduleTime\(payload\.endTime/)
})
check('real slot resolution persists and revalidates canonical template and exact interval atomically', () => {
  assert.equal(slotResolver.includes('template_id: templateId || null'), true)
  for (const required of ['v_schedule_slot.template_id IS DISTINCT FROM p_schedule_template_id', 'v_schedule_slot.end_time IS DISTINCT FROM p_end_time', 'ON CONFLICT (branch_id, course_type_id, date, start_time) DO NOTHING']) {
    assert.equal(migration.includes(required), true, required)
  }
})
check('missing canonical template and invalid course data return distinct typed Thai errors', () => {
  for (const code of ['LESSON_WALLET_TEMPLATE_NOT_FOUND', 'LESSON_WALLET_COURSE_INVALID']) assert.equal(route.includes(code), true)
  assert.equal(route.includes('ไม่พบรอบเรียนประจำที่เปิดใช้งานตรงกับสาขา คอร์ส วัน และเวลาที่เลือก'), true)
  assert.equal(route.includes('ข้อมูลคอร์สของสิทธิ์ไม่ถูกต้อง'), true)
})
check('duplicate or overlap and stale credit return distinct typed conflicts', () => {
  for (const code of ['LESSON_WALLET_TARGET_CONFLICT', 'LESSON_WALLET_CREDIT_STALE']) assert.equal(route.includes(code), true)
  assert.equal(migration.includes('existing_session.start_time < p_end_time'), true)
  assert.equal(migration.includes('existing_session.end_time > p_start_time'), true)
})
check('future and same-month guards remain before redemption', () => {
  assert.equal(route.includes('!isFutureSlot(targetDate, startTime)'), true)
  assert.equal(migration.includes("coalesce(v_credit.entitlement_policy, 'same_month') = 'same_month'"), true)
  assert.equal(migration.includes('LESSON_WALLET_TARGET_AFTER_EXPIRY'), true)
})
check('full remains non-blocking while cancelled remains blocked', () => {
  assert.equal(migration.includes("v_schedule_slot.status::text NOT IN ('open', 'full')"), true)
  assert.equal(migration.includes("slot_row.status::text = 'cancelled'"), true)
  assert.equal(migration.includes('current_students >= max_students'), false)
})
check('store and redeem use service-role-only atomic RPCs with pinned search_path', () => {
  assert.equal(route.includes("rpc('lesson_wallet_store_v2'"), true)
  assert.equal(route.includes("rpc('lesson_wallet_redeem_v2'"), true)
  assert.equal((migration.match(/SECURITY DEFINER/g) || []).length, 2)
  assert.equal((migration.match(/SET search_path = public, pg_temp/g) || []).length, 2)
  assert.equal((migration.match(/FROM PUBLIC, anon, authenticated/g) || []).length >= 3, true)
})
check('redeem path creates no payment, coupon, Ledger or Finance record', () => {
  const redeemPath = route.slice(route.indexOf('async function redeemWalletCredit'))
  for (const forbidden of ["from('payments')", "from('coupon_usages')", "from('payment_ledger')", "from('finance_expenses')"]) {
    assert.equal(redeemPath.includes(forbidden), false, forbidden)
  }
})
check('Wallet store retires only the source membership through the atomic lifecycle RPC', () => {
  assert.equal(migration.includes('public.retire_coach_assignment_membership_v1('), true)
  assert.equal(migration.includes("'wallet_store'"), true)
  assert.equal(migration.includes('DELETE FROM public.coach_assignment_groups'), false)
})
check('Wallet redemption destination remains unassigned until Head Coach Save', () => {
  const redeemPath = route.slice(route.indexOf('async function redeemWalletCredit'))
  assert.equal(redeemPath.includes("from('coach_assignment_group_students').insert"), false)
  assert.equal(redeemPath.includes("rpc('create_exact_coach_assignment_group_v1'"), false)
  assert.match(migration, /'scheduled',\s+member\.original_session_id/)
})
check('Wallet page read is side-effect-free and members are loaded in one nested query', () => {
  assert.equal(walletPage.includes(".update({ status: 'expired'"), false)
  assert.equal(walletPage.includes('lesson_wallet_credit_members(child_id, children(full_name, nickname))'), true)
  assert.equal(walletClient.includes('lesson_wallet_credit_members'), true)
})
check('notifications and activity are emitted once per entitlement unit, not once per participant', () => {
  const storePath = route.slice(route.indexOf('async function storeInWallet'), route.indexOf('async function redeemWalletCredit'))
  assert.equal((storePath.match(/notifyRoles\(/g) || []).length, 1)
  assert.equal((storePath.match(/logActivity\(/g) || []).length, 1)
  assert.equal(storePath.includes('entityId: data.credit_id'), true)
  assert.equal(storePath.includes('participantCount: data.participant_count'), true)
  assert.equal(storePath.includes('participantSessionIds: data.participant_session_ids'), true)
})
check('the corrective RPC uses inclusive tier containment without replacing Redeem', () => {
  assert.equal((correctiveMigration.match(/tier\.min_sessions <= v_selected\.total_sessions/g) || []).length, 2)
  assert.equal((correctiveMigration.match(/v_selected\.total_sessions <= tier\.max_sessions/g) || []).length, 2)
  assert.doesNotMatch(correctiveMigration, /tier\.min_sessions = v_selected\.total_sessions/)
  assert.doesNotMatch(correctiveMigration, /CREATE OR REPLACE FUNCTION public\.lesson_wallet_redeem_v2/)
  assert.equal((correctiveMigration.match(/CREATE OR REPLACE FUNCTION/g) || []).length, 1)
  assert.equal((correctiveMigration.match(/SECURITY DEFINER/g) || []).length, 1)
  assert.equal((correctiveMigration.match(/SET search_path = public, pg_temp/g) || []).length, 1)
  assert.match(correctiveMigration, /REVOKE ALL ON FUNCTION public\.lesson_wallet_store_v2\(uuid, uuid, uuid\)\s+FROM PUBLIC, anon, authenticated;/)
  assert.match(correctiveMigration, /GRANT EXECUTE ON FUNCTION public\.lesson_wallet_store_v2\(uuid, uuid, uuid\) TO service_role;/)
})
check('the additive migration has no apply-time wallet-row backfill', () => {
  const beforeFunctions = migration.slice(0, migration.indexOf('CREATE OR REPLACE FUNCTION'))
  assert.doesNotMatch(beforeFunctions, /\b(?:UPDATE|DELETE FROM)\s+public\.lesson_wallet_credits\b/i)
})

console.log(`\nLesson Wallet regression checks passed: ${passed}`)
