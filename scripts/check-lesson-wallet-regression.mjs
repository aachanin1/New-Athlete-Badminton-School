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
  resolveLessonWalletErrorCode,
  resolveLessonWalletEntitlement,
} from '../src/lib/lesson-wallet-entitlement.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const route = read('src/app/api/lesson-wallet/route.ts')
const slotResolver = read('src/lib/schedule-slot-utils.ts')
const migration = read('supabase/migrations/20260823090000_adult_private_ten_month_lesson_wallet.sql')
const correctiveMigration = read('supabase/migrations/20260824002134_correct_adult_private_wallet_tier_range.sql')
const privateThresholdMigration = read('supabase/migrations/20260824154718_correct_private_wallet_package_tier_matching.sql')
const progressiveKidsMigration = read('supabase/migrations/20260826021944_separate_progressive_kids_wallet_entitlement.sql')
const integrityMigration = read('supabase/migrations/20260828020022_permanent_schedule_slot_template_integrity.sql')
const adminTemplateRoute = read('src/app/api/admin/schedule-templates/route.ts')
const coachAssignmentsRoute = read('src/app/api/coach/assignments/route.ts')
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
  assert.equal(entitlement({ courseType: 'kids_group', quantity: 10, payments: [], tiers: [] }).policyType, 'same_month')
})

check('Progressive Kids uses verified-booking same-month evidence without Legacy Payment or tier evidence', () => {
  const result = entitlement({
    courseType: 'kids_group',
    quantity: 8,
    originalSessionDate: '2026-02-12',
    payments: [],
    tiers: [],
  })
  assert.equal(result.policyType, 'same_month')
  assert.equal(result.entitlementStartedAt, '2026-02-11T17:00:00.000Z')
  assert.equal(result.expiresAt, '2026-02-28T16:59:59.999Z')
  assert.equal(result.paymentId, null)
  assert.equal(result.pricingTier, null)
})

check('Private historical packages select the greatest effective threshold without using max as containment', () => {
  const privateTiers = [
    tier('private', 1, { id: 'private-1', max_sessions: 1, price_per_session: 900, package_price: 900 }),
    tier('private', 10, { id: 'private-10', max_sessions: 10, price_per_session: 800, package_price: 8000 }),
  ]

  for (const quantity of [2, 4, 9]) {
    const result = entitlement({ courseType: 'private', quantity, tiers: privateTiers })
    assert.equal(result.pricingTier.id, 'private-1')
    assert.equal(result.pricingTier.pricePerUnit, 900)
    assert.equal(result.policyType, 'ten_month_package')
  }
  const tenHours = entitlement({ courseType: 'private', quantity: 10, tiers: privateTiers })
  assert.equal(tenHours.pricingTier.id, 'private-10')
  assert.equal(tenHours.pricingTier.pricePerUnit, 800)
  assert.equal(tenHours.policyType, 'ten_month_package')
})

check('Private threshold evidence fails closed only at the selected greatest threshold', () => {
  const lower = tier('private', 1, { id: 'private-1', max_sessions: 1 })
  const selected = tier('private', 10, { id: 'private-10', max_sessions: 10 })
  assert.equal(entitlement({ courseType: 'private', quantity: 10, tiers: [lower, selected] }).pricingTier.id, 'private-10')
  assert.throws(
    () => entitlement({ courseType: 'private', quantity: 10, tiers: [lower, selected, { ...selected, id: 'private-10-duplicate' }] }),
    (error) => error instanceof LessonWalletEntitlementError && error.code === 'LESSON_WALLET_TIER_EVIDENCE_AMBIGUOUS',
  )
  assert.throws(
    () => entitlement({ courseType: 'private', quantity: 4, tiers: [selected] }),
    (error) => error instanceof LessonWalletEntitlementError && error.code === 'LESSON_WALLET_TIER_EVIDENCE_MISSING',
  )
})

check('typed Lesson Wallet error codes prefer explicit application codes and never let P0001 mask message evidence', () => {
  assert.equal(resolveLessonWalletErrorCode({ code: 'LESSON_WALLET_TIER_EVIDENCE_MISSING', message: 'untyped' }), 'LESSON_WALLET_TIER_EVIDENCE_MISSING')
  assert.equal(resolveLessonWalletErrorCode({ code: 'P0001', message: 'LESSON_WALLET_TIER_EVIDENCE_AMBIGUOUS' }), 'LESSON_WALLET_TIER_EVIDENCE_AMBIGUOUS')
  assert.equal(resolveLessonWalletErrorCode({ code: 'P0001', message: 'database failure' }), 'LESSON_WALLET_MUTATION_FAILED')
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
  for (const quantity of [2, 4, 6, 7, 8, 10, 11, 13, 14, 15, 16, 18, 19, 24]) {
    const result = entitlement({ courseType: 'kids_group', quantity, payments: [], tiers: [] })
    assert.equal(result.policyType, 'same_month')
    assert.equal(result.paymentId, null)
    assert.equal(result.pricingTier, null)
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

check('Kids re-wallet preserves truthful null Payment and tier evidence', () => {
  const inherited = entitlement({ courseType: 'kids_group', quantity: 8, payments: [], tiers: [] })
  const result = entitlement({
    courseType: 'kids_group',
    quantity: 8,
    originalSessionDate: '2026-04-20',
    payments: [],
    tiers: [],
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
check('supplied template id remains a hint while exact active canonical matching must be unique', () => {
  assert.match(route, /const exactMatches = await loadTemplates\(\)/)
  assert.match(route, /exactMatches\.length !== 1[\s\S]*LESSON_WALLET_TEMPLATE_AMBIGUOUS/)
  assert.match(route, /payload\.scheduleTemplateId === canonicalTemplate\.id[\s\S]*return canonicalTemplate/)
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
  assert.equal(slotResolver.includes('template_id: effectiveTemplateId,'), true)
  assert.equal(slotResolver.includes('template_id: templateId || null'), false)
  assert.match(slotResolver, /resolveCanonicalScheduleTemplate\([\s\S]*const effectiveTemplateId = canonicalTemplate\.id/)
  assert.match(slotResolver, /existing\.data\.template_id === null[\s\S]*bindLegacySlot/)
  assert.match(slotResolver, /\.is\('template_id', null\)[\s\S]*select\(SLOT_COLUMNS\)[\s\S]*loadScheduleSlot/)
  assert.match(slotResolver, /createError\.code === '23505'[\s\S]*loadScheduleSlot[\s\S]*validateSlot/)
  for (const required of ['v_schedule_slot.template_id IS DISTINCT FROM p_schedule_template_id', 'v_schedule_slot.end_time IS DISTINCT FROM p_end_time', 'ON CONFLICT (branch_id, course_type_id, date, start_time) DO NOTHING']) {
    assert.equal(migration.includes(required), true, required)
  }
})
check('permanent migration binds only a unique active canonical legacy NULL slot and revalidates under lock', () => {
  for (const required of [
    'v_active_template_match_count <> 1',
    'LESSON_WALLET_TEMPLATE_AMBIGUOUS',
    'v_schedule_slot.template_id IS NULL',
    'SET template_id = p_schedule_template_id',
    'slot_row.template_id IS NULL',
    'WHERE slot_row.id = v_schedule_slot.id',
    'FOR UPDATE',
    'v_schedule_slot.template_id IS DISTINCT FROM p_schedule_template_id',
    'v_schedule_slot.end_time IS DISTINCT FROM p_end_time',
    "v_schedule_slot.status::text NOT IN ('open', 'full')",
  ]) assert.equal(integrityMigration.includes(required), true, required)
})
check('permanent migration discovers the live FK, changes SET NULL to RESTRICT, and preserves nullable legacy rows', () => {
  assert.match(integrityMigration, /FROM pg_catalog\.pg_constraint/)
  assert.match(integrityMigration, /constraint_row\.conkey[\s\S]*attribute\.attname = 'template_id'/)
  assert.match(integrityMigration, /DROP CONSTRAINT %I/)
  assert.match(integrityMigration, /ON DELETE RESTRICT/)
  assert.doesNotMatch(integrityMigration, /template_id\s+uuid\s+NOT NULL/i)
  assert.doesNotMatch(integrityMigration, /80117017|de0d599b|bfacfafd|4896fce1|eabcf632|d6a54b6f|9c12e869/i)
})
check('permanent Redeem remains service-role-only and has no financial or attendance mutation', () => {
  assert.match(integrityMigration, /CREATE OR REPLACE FUNCTION public\.lesson_wallet_redeem_v2\(/)
  assert.match(integrityMigration, /SECURITY DEFINER[\s\S]*SET search_path = public, pg_temp/)
  assert.match(integrityMigration, /REVOKE ALL ON FUNCTION public\.lesson_wallet_redeem_v2[\s\S]*FROM PUBLIC, anon, authenticated/)
  assert.match(integrityMigration, /GRANT EXECUTE ON FUNCTION public\.lesson_wallet_redeem_v2[\s\S]*TO service_role/)
  for (const table of ['payments', 'coupon_usages', 'payment_ledger', 'finance_expenses', 'attendance']) {
    assert.doesNotMatch(integrityMigration, new RegExp(`(?:INSERT\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+public\\.${table}`, 'i'), table)
  }
})
check('referenced templates deactivate, unreferenced templates may delete, and the FK race fails safely', () => {
  assert.match(adminTemplateRoute, /referencedSlotCount[\s\S]*deactivateReferencedTemplate\('referenced'\)/)
  assert.match(adminTemplateRoute, /update\(\{ is_active: false \}\)/)
  assert.match(adminTemplateRoute, /deleteError\?\.code === '23503'[\s\S]*deactivateReferencedTemplate\('delete_race'\)/)
  assert.match(adminTemplateRoute, /action: 'delete_unreferenced_schedule_template'/)
})
check('coach assignment fallback resolves one canonical template and never creates a NULL-provenance slot', () => {
  assert.match(coachAssignmentsRoute, /resolveCanonicalScheduleTemplate\(/)
  assert.match(coachAssignmentsRoute, /templateId: canonicalTemplate\.id/)
  assert.match(coachAssignmentsRoute, /existingSessionSlotIds\.length > 1[\s\S]*SCHEDULE_SLOT_SESSION_SLOT_CONFLICT/)
  assert.doesNotMatch(coachAssignmentsRoute, /ensureScheduleSlot\(\{[\s\S]{0,240}templateId:\s*null/)
})
check('missing canonical template and invalid course data return distinct typed Thai errors', () => {
  for (const code of ['LESSON_WALLET_TEMPLATE_NOT_FOUND', 'LESSON_WALLET_TEMPLATE_AMBIGUOUS', 'LESSON_WALLET_COURSE_INVALID']) assert.equal(route.includes(code), true)
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
check('the prior corrective RPC remains the frozen inclusive-containment baseline', () => {
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
check('the new Store RPC selects a Private threshold while retaining Adult and Kids containment and security', () => {
  assert.equal((privateThresholdMigration.match(/SELECT max\(tier\.min_sessions\) INTO v_private_tier_min/g) || []).length, 1)
  assert.equal((privateThresholdMigration.match(/tier\.min_sessions = v_private_tier_min/g) || []).length, 2)
  assert.equal((privateThresholdMigration.match(/tier\.min_sessions <= v_selected\.total_sessions/g) || []).length, 3)
  assert.equal((privateThresholdMigration.match(/v_selected\.total_sessions <= tier\.max_sessions/g) || []).length, 2)
  assert.match(privateThresholdMigration, /IF v_selected\.course_name = 'private' THEN[\s\S]*SELECT max\(tier\.min_sessions\)/)
  assert.doesNotMatch(privateThresholdMigration, /CREATE OR REPLACE FUNCTION public\.lesson_wallet_redeem_v2/)
  assert.equal((privateThresholdMigration.match(/CREATE OR REPLACE FUNCTION/g) || []).length, 1)
  assert.equal((privateThresholdMigration.match(/SECURITY DEFINER/g) || []).length, 1)
  assert.equal((privateThresholdMigration.match(/SET search_path = public, pg_temp/g) || []).length, 1)
  assert.match(privateThresholdMigration, /REVOKE ALL ON FUNCTION public\.lesson_wallet_store_v2\(uuid, uuid, uuid\)\s+FROM PUBLIC, anon, authenticated;/)
  assert.match(privateThresholdMigration, /GRANT EXECUTE ON FUNCTION public\.lesson_wallet_store_v2\(uuid, uuid, uuid\) TO service_role;/)
})
check('Progressive Kids branches before Legacy Payment evidence while preserving the Adult/Private Store contract', () => {
  const kidsBranch = progressiveKidsMigration.indexOf("IF v_selected.course_name = 'kids_group' THEN")
  const paymentLookup = progressiveKidsMigration.indexOf('FROM public.payments payment')
  assert.ok(kidsBranch > 0 && paymentLookup > kidsBranch)
  assert.match(progressiveKidsMigration, /v_payment_id := NULL;[\s\S]*v_tier_id := NULL;[\s\S]*v_policy := 'same_month'/)
  assert.match(progressiveKidsMigration, /'evidence_source', 'verified_booking'/)
  assert.match(progressiveKidsMigration, /v_started_at := v_selected\.date::timestamp AT TIME ZONE 'Asia\/Bangkok'/)
  assert.match(progressiveKidsMigration, /date_trunc\('month', v_selected\.date::timestamp\) \+ interval '1 month'/)
  assert.equal((progressiveKidsMigration.match(/SELECT max\(tier\.min_sessions\) INTO v_private_tier_min/g) || []).length, 1)
  assert.equal((progressiveKidsMigration.match(/v_selected\.total_sessions <= tier\.max_sessions/g) || []).length, 2)
  assert.equal((progressiveKidsMigration.match(/CREATE OR REPLACE FUNCTION/g) || []).length, 1)
  assert.equal((progressiveKidsMigration.match(/SECURITY DEFINER/g) || []).length, 1)
  assert.equal((progressiveKidsMigration.match(/SET search_path = public, pg_temp/g) || []).length, 1)
  assert.match(progressiveKidsMigration, /REVOKE ALL ON FUNCTION public\.lesson_wallet_store_v2\(uuid, uuid, uuid\)\s+FROM PUBLIC, anon, authenticated;/)
  assert.match(progressiveKidsMigration, /GRANT EXECUTE ON FUNCTION public\.lesson_wallet_store_v2\(uuid, uuid, uuid\) TO service_role;/)
  assert.doesNotMatch(progressiveKidsMigration, /CREATE OR REPLACE FUNCTION public\.lesson_wallet_redeem_v2/)
  const beforeStoreFunction = progressiveKidsMigration.slice(0, progressiveKidsMigration.indexOf('CREATE OR REPLACE FUNCTION'))
  assert.doesNotMatch(beforeStoreFunction, /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\./i)

  const inheritedLookup = route.indexOf('const priorCredit = priorById.values().next().value')
  const routeKidsBranch = route.indexOf("if (courseType === 'kids_group')")
  const routePaymentLookup = route.indexOf(".from('payments')", routeKidsBranch)
  assert.ok(inheritedLookup > 0 && routeKidsBranch > inheritedLookup && routePaymentLookup > routeKidsBranch)
})
check('the API uses typed code forwarding and retains the exact Thai evidence messages', () => {
  assert.equal(route.includes('resolveLessonWalletErrorCode(error)'), true)
  assert.equal(route.includes("LESSON_WALLET_TIER_EVIDENCE_MISSING: 'ไม่พบ pricing tier ที่ตรงกับแพ็กเกจ ณ วันที่อนุมัติ Payment'"), true)
  assert.equal(route.includes("LESSON_WALLET_TIER_EVIDENCE_AMBIGUOUS: 'พบ pricing tier ที่มีผลทับซ้อนกัน จึงยังเก็บสิทธิ์ไม่ได้'"), true)
})
check('the additive migration has no apply-time wallet-row backfill', () => {
  const beforeFunctions = migration.slice(0, migration.indexOf('CREATE OR REPLACE FUNCTION'))
  assert.doesNotMatch(beforeFunctions, /\b(?:UPDATE|DELETE FROM)\s+public\.lesson_wallet_credits\b/i)
})

console.log(`\nLesson Wallet regression checks passed: ${passed}`)
