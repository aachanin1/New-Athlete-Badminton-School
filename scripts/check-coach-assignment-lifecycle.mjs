import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { register } from 'node:module'

register(new URL('./ts-alias-loader.mjs', import.meta.url).href, import.meta.url)

import {
  getAssignmentGroupsSignature,
  parseCanonicalAssignmentGroups,
  reconcileAssignmentDraft,
} from '../src/lib/coach-assignment-lifecycle.ts'
import {
  getGenuineLegacyOnlySlotIds,
  resolveCoachSlotAccess,
} from '../src/lib/coach-assignment-resolution.ts'

const {
  finalizeMeaningfulHistoryEvents,
  getActivityPresentation,
  getHistoryBusinessKey,
  getSnapshotBusinessSignature,
  isMeaningfulHistoryReason,
} = await import('../src/lib/coach-assignment-history.ts')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const sourceOnly = process.argv.includes('--source-only')
let passed = 0

async function check(name, action) {
  await action()
  passed += 1
  console.log(`PASS ${passed}: ${name}`)
}

const assignmentPage = read('src/app/(coach)/coach/assign-groups/page.tsx')
const assignmentClient = read('src/components/coach/assign-groups-client.tsx')
const assignmentMemoryLib = read('src/lib/coach-student-memory.ts')
const assignmentMemoryRoutePath = 'src/app/api/coach/assignment-memory/route.ts'
const assignmentMemoryRoute = fs.existsSync(path.join(root, assignmentMemoryRoutePath))
  ? read(assignmentMemoryRoutePath)
  : ''
const assignmentHistoryLibPath = 'src/lib/coach-assignment-history.ts'
const assignmentHistoryLib = fs.existsSync(path.join(root, assignmentHistoryLibPath))
  ? read(assignmentHistoryLibPath)
  : ''
const assignmentHistoryRoutePath = 'src/app/api/coach/assignment-history/route.ts'
const assignmentHistoryRoute = fs.existsSync(path.join(root, assignmentHistoryRoutePath))
  ? read(assignmentHistoryRoutePath)
  : ''
const assignmentRoute = read('src/app/api/coach/assignment-groups/route.ts')
const legacyAssignmentRoute = read('src/app/api/coach/assignments/route.ts')
const scheduleSlotResolver = read('src/lib/schedule-slot-utils.ts')
const rescheduleRoute = read('src/app/api/reschedule/route.ts')
const walletRoute = read('src/app/api/lesson-wallet/route.ts')
const teachingHours = read('src/lib/coach-teaching-hours.ts')
const migration = read('supabase/migrations/20260804000000_assignment_group_lifecycle_integrity.sql')
const v1Migration = read('supabase/migrations/20260717070225_coach_assignment_conflict_guards.sql')
const scheduleSlotIntegrityMigration = read('supabase/migrations/20260828020022_permanent_schedule_slot_template_integrity.sql')

await check('legacy Coach assignment fallback requires unique canonical template provenance', () => {
  assert.match(legacyAssignmentRoute, /resolveCanonicalScheduleTemplate\(/)
  assert.match(legacyAssignmentRoute, /templateId: canonicalTemplate\.id/)
  assert.match(legacyAssignmentRoute, /scheduleSlotId: scheduleSlotId \|\| existingSessionSlotIds\[0\] \|\| null/)
  assert.match(legacyAssignmentRoute, /SCHEDULE_SLOT_SESSION_SLOT_CONFLICT/)
  assert.match(legacyAssignmentRoute, /error instanceof ScheduleSlotIntegrityError[\s\S]*code: error\.code/)
  assert.doesNotMatch(legacyAssignmentRoute, /ensureScheduleSlot\(\{[\s\S]{0,240}templateId:\s*null/)
})

await check('schedule-slot helper binds only exact unique active legacy NULL rows and fails closed on mismatch/race', () => {
  assert.match(scheduleSlotResolver, /\.eq\('is_active', true\)/)
  assert.match(scheduleSlotResolver, /data\.length !== 1[\s\S]*SCHEDULE_SLOT_TEMPLATE_AMBIGUOUS/)
  assert.match(scheduleSlotResolver, /existing\.data\.template_id === null[\s\S]*bindLegacySlot/)
  assert.match(scheduleSlotResolver, /\.is\('template_id', null\)[\s\S]*loadScheduleSlot/)
  assert.match(scheduleSlotResolver, /slot\.template_id !== expected\.templateId[\s\S]*SCHEDULE_SLOT_TEMPLATE_MISMATCH/)
  assert.match(scheduleSlotResolver, /createError\.code === '23505'[\s\S]*validateSlot/)
  assert.match(scheduleSlotIntegrityMigration, /ON DELETE RESTRICT/)
})

await check('assignment page reads a canonical selected month from Promise searchParams', () => {
  assert.match(assignmentPage, /searchParams\?: Promise<\{[\s\S]*month\?: string \| string\[\]/)
  assert.match(assignmentPage, /const resolvedSearchParams = searchParams \? await searchParams : \{\}/)
  assert.match(assignmentPage, /const bangkokToday = getBangkokDateString\(now\)/)
  assert.match(assignmentPage, /const currentBangkokMonth = bangkokToday\.slice\(0, 7\)/)
  assert.match(assignmentPage, /parseAssignmentMonth\(resolvedSearchParams\.month, currentBangkokMonth\)/)
  assert.equal(assignmentPage.match(/getBangkokDateString\(now\)/g)?.length, 1)
})

await check('Private self and child roster identities use distinct names and level keys', () => {
  assert.match(assignmentPage, /const id = session\.child_id \|\| session\.bookings\?\.user_id/)
  assert.match(assignmentPage, /type: session\.child_id \? 'child' as const : 'adult' as const/)
  assert.match(assignmentPage, /session\.children\?\.nickname \|\| session\.children\?\.full_name \|\| 'เด็ก'/)
  assert.match(assignmentPage, /return session\.bookings\?\.profiles\?\.full_name \|\| 'ผู้เรียน'/)
  assert.match(assignmentPage, /latestLevelMap\.get\(getStudentKey\(studentRef\)\)/)
  assert.match(assignmentPage, /parentName: session\.child_id \? \(session\.bookings\?\.profiles\?\.full_name \|\| null\) : null/)
})

await check('historical month is redirected before data access while current is today-forward and future starts on day one', () => {
  assert.match(assignmentPage, /const \{ monthStart, nextMonthStart \} = getAssignmentMonthRange\(selectedMonth\)/)
  assert.match(assignmentPage, /if \(selectedMonth < currentBangkokMonth\) redirect\('\/coach\/assign-groups'\)/)
  assert.ok(
    assignmentPage.indexOf("if (selectedMonth < currentBangkokMonth) redirect('/coach/assign-groups')")
      < assignmentPage.indexOf('const supabase = await createClient()'),
  )
  assert.match(
    assignmentPage,
    /const queryStart = selectedMonth === currentBangkokMonth[\s\S]*\? bangkokToday[\s\S]*: monthStart/,
  )
  assert.match(assignmentPage, /\.gte\('date', queryStart\)[\s\S]*\.lt\('date', queryEnd\)/)
  assert.match(assignmentPage, /loadAssignmentSessionRows\([\s\S]*queryStart,[\s\S]*nextMonthStart/)
  assert.doesNotMatch(assignmentPage, /\.gte\('date', monthStart\)/)
})

await check('current-month navigation cannot move backward while future navigation keeps the guarded route transition', () => {
  assert.match(assignmentClient, /currentBangkokMonth: string/)
  assert.match(assignmentClient, /const isCurrentMonth = selectedMonth === currentBangkokMonth/)
  assert.match(assignmentClient, /if \(direction === -1 && isCurrentMonth\) return/)
  assert.match(assignmentClient, /disabled=\{Boolean\(savingKey\) \|\| isMonthNavigationActive \|\| isCurrentMonth\}/)
  assert.match(assignmentClient, /router\.push\(`\/coach\/assign-groups\?month=\$\{nextMonth\}`\)/)
})

await check('initial roster delta explains evidence-backed additions and unresolved removals without a history read', () => {
  assert.match(assignmentPage, /interface AssignmentRosterDeltaForClient/)
  assert.match(assignmentPage, /addedStudents:/)
  assert.match(assignmentPage, /removedCount:/)
  assert.match(assignmentPage, /hasPersistedAssignment:/)
  assert.match(assignmentPage, /coach_assignment_group_students\(booking_session_id, student_id, student_type\)/)
  assert.match(assignmentPage, /currentStudentNameByKey/)
  assert.match(assignmentPage, /removedStudentNames/)
  assert.match(assignmentPage, /rosterDelta:/)
  assert.match(assignmentClient, /มีผู้เรียนเพิ่ม/)
  assert.match(assignmentClient, /หลังบันทึกล่าสุด กรุณาตรวจกลุ่มและบันทึกใหม่/)
  assert.match(assignmentClient, /ไม่อยู่ในรายชื่อรอบนี้แล้ว/)
  assert.doesNotMatch(assignmentClient, /ผู้เรียนถูกถอดออก/)
  assert.match(assignmentClient, /ดูประวัติการเปลี่ยนแปลง/)
  assert.doesNotMatch(assignmentPage, /assignment-history/)
})

await check('assignment history GET is authenticated, role- and branch-scoped before service-role SELECT, and typed fail closed', () => {
  assert.match(assignmentHistoryRoute, /export async function GET\(/)
  assert.match(assignmentHistoryRoute, /supabase\.auth\.getUser\(\)/)
  assert.match(assignmentHistoryRoute, /\['head_coach', 'super_admin'\]/)
  assert.match(assignmentHistoryRoute, /HISTORY_UNAUTHORIZED/)
  assert.match(assignmentHistoryRoute, /HISTORY_FORBIDDEN/)
  assert.match(assignmentHistoryRoute, /HISTORY_BRANCH_FORBIDDEN/)
  assert.match(assignmentHistoryRoute, /HISTORY_INVALID_SLOT/)
  assert.match(assignmentHistoryRoute, /HISTORY_SLOT_HISTORICAL/)
  assert.match(assignmentHistoryRoute, /\.from\('schedule_slots'\)/)
  assert.match(assignmentHistoryRoute, /\.from\('coach_branches'\)/)
  assert.ok(
    assignmentHistoryRoute.indexOf(".from('coach_branches')")
      < assignmentHistoryRoute.indexOf('const serviceRoleClient = getServiceRoleClient()'),
  )
  assert.match(assignmentHistoryRoute, /getCoachAssignmentHistory\(serviceRoleClient,/)
  assert.match(assignmentHistoryRoute, /'Cache-Control': 'private, no-store'/)
  assert.doesNotMatch(assignmentHistoryRoute, /\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(|logActivity|notify/i)
})

await check('history reconstruction is bounded, stable, batched, evidence-only, and sanitizes raw audit details', () => {
  assert.match(assignmentHistoryLib, /const ASSIGNMENT_HISTORY_LIMIT = 5/)
  assert.match(assignmentHistoryLib, /const HISTORY_ACTIVITY_SCAN_LIMIT = 50/)
  assert.match(assignmentHistoryLib, /\.contains\('details', \{ scheduleSlotId \}\)/)
  assert.match(assignmentHistoryLib, /\.order\('created_at', \{ ascending: false \}\)[\s\S]*\.order\('id', \{ ascending: false \}\)/)
  assert.match(assignmentHistoryLib, /\.limit\(HISTORY_ACTIVITY_SCAN_LIMIT\)/)
  assert.match(assignmentHistoryLib, /HISTORY_SUPPORTING_BATCH_SIZE/)
  assert.match(assignmentHistoryLib, /ต้องให้ Admin ตรวจสอบ/)
  assert.match(assignmentHistoryLib, /ระบบไม่พบหลักฐานเดิมที่ระบุว่าเกิดจากการย้ายวันหรือเก็บเข้ากระเป๋า/)
  assert.match(assignmentHistoryLib, /save_coach_assignment_groups_v2/)
  assert.match(assignmentHistoryLib, /retire_coach_assignment_membership/)
  assert.match(assignmentHistoryLib, /reschedule_booking_session/)
  assert.match(assignmentHistoryLib, /store_lesson_wallet_credit/)
  assert.match(assignmentHistoryLib, /redeem_lesson_wallet_credit/)
  assert.match(assignmentHistoryLib, /attendance_gap_move_learner_to_existing_group/)
  assert.match(assignmentHistoryLib, /attendance_gap_replace_coach_round/)
  assert.match(assignmentHistoryLib, /attendance_gap_return_entitlement/)
  assert.doesNotMatch(assignmentHistoryLib, /attendance_gap_request_coach_evidence/)
  assert.doesNotMatch(assignmentHistoryLib, /attendance_gap_request_coach_review/)
  assert.doesNotMatch(assignmentHistoryLib, /attendance_gap_closed_no_action/)
  assert.doesNotMatch(assignmentHistoryLib, /attendance_gap_confirm_absent/)
  assert.doesNotMatch(assignmentHistoryLib, /attendance_gap_mark_retrospective/)
  assert.match(assignmentHistoryLib, /เพิ่มผู้เรียนจากการจอง/)
  assert.match(assignmentHistoryLib, /type: 'booking_added'[\s\S]{0,160}actorName: null/)
  assert.match(assignmentHistoryLib, /ย้ายผู้เรียนเข้ารอบ/)
  assert.match(assignmentHistoryLib, /ย้ายผู้เรียนออกจากรอบนี้/)
  assert.match(assignmentHistoryLib, /เก็บรอบเรียนเข้ากระเป๋าวันเรียน/)
  assert.match(assignmentHistoryLib, /ใช้สิทธิ์จากกระเป๋าวันเรียน/)
  assert.match(assignmentHistoryLib, /Admin ย้ายผู้เรียนระหว่างกลุ่ม/)
  assert.match(assignmentHistoryLib, /Admin เปลี่ยนโค้ชประจำรอบ/)
  assert.match(assignmentHistoryLib, /Admin คืนสิทธิ์รอบเรียนเข้ากระเป๋าวันเรียน/)
  assert.match(assignmentHistoryLib, /getSnapshotBusinessSignature/)
  assert.match(assignmentHistoryLib, /deduplicateMeaningfulHistoryEvents/)
  assert.match(assignmentHistoryLib, /getHistoryBusinessKey/)
  assert.match(assignmentHistoryLib, /isMeaningfulHistoryReason/)
  assert.doesNotMatch(assignmentHistoryLib, /const actorName = session\.bookings/)
  assert.doesNotMatch(assignmentHistoryLib, /\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(|logActivity|notify/i)
  assert.doesNotMatch(assignmentHistoryRoute, /details|entity_id|bookingSessionId|scheduleSlotId\s*[:,]\s*event/)
})

await check('history semantics ignore recreated group IDs, remove meaningless reasons, deduplicate business evidence, and cap five events', () => {
  const snapshot = (id, coachId = 'coach-1') => ({
    group_ids: [id],
    coach_ids: [coachId],
    membership_session_ids: ['session-1'],
    groups: [{
      id,
      name: 'กลุ่ม 1',
      coach_id: coachId,
      level_min: 1,
      level_max: 5,
      sort_order: 0,
      student_session_ids: ['session-1'],
    }],
  })
  assert.equal(getSnapshotBusinessSignature(snapshot('old-row')), getSnapshotBusinessSignature(snapshot('new-row')))
  assert.notEqual(getSnapshotBusinessSignature(snapshot('old-row')), getSnapshotBusinessSignature(snapshot('new-row', 'coach-2')))
  assert.equal(isMeaningfulHistoryReason('----'), false)
  assert.equal(isMeaningfulHistoryReason('  '), false)
  assert.equal(isMeaningfulHistoryReason('ย้ายตามคำขอที่ยืนยันแล้ว'), true)

  const activity = (action, details = {}, entityId = 'session-1') => ({
    id: `${action}-audit`,
    user_id: 'actor-1',
    action,
    entity_type: 'booking_sessions',
    entity_id: entityId,
    details,
    created_at: '2026-08-06T10:00:00.000Z',
  })
  assert.equal(getActivityPresentation(activity('attendance_gap_request_coach_review')), null)
  assert.equal(getActivityPresentation(activity('attendance_gap_move_learner_to_existing_group', { reason: 'ย้ายกลุ่ม' })).label, 'Admin ย้ายผู้เรียนระหว่างกลุ่ม')
  assert.equal(getActivityPresentation(activity('attendance_gap_replace_coach_round')).label, 'Admin เปลี่ยนโค้ชประจำรอบ')
  assert.equal(getActivityPresentation(activity('attendance_gap_return_entitlement')).label, 'Admin คืนสิทธิ์รอบเรียนเข้ากระเป๋าวันเรียน')
  assert.match(getActivityPresentation(activity('reschedule_booking_session', { newDate: '2026-08-12', newStartTime: '10:00:00' })).label, /ย้ายผู้เรียนเข้ารอบ วันที่ 2026-08-12 เวลา 10:00 น\./)
  assert.match(getActivityPresentation(activity('store_lesson_wallet_credit')).label, /เก็บรอบเรียนเข้ากระเป๋าวันเรียน/)
  assert.match(getActivityPresentation(activity('redeem_lesson_wallet_credit')).label, /ใช้สิทธิ์จากกระเป๋าวันเรียน/)
  assert.equal(
    getHistoryBusinessKey(activity('retire_coach_assignment_membership', { reason: 'wallet_store', bookingSessionId: 'session-1' }), ['session-1']),
    getHistoryBusinessKey(activity('store_lesson_wallet_credit', { sessionId: 'session-1' }), ['session-1']),
  )
  assert.equal(
    getHistoryBusinessKey(activity('attendance_gap_replace_coach_round', { replacedSessionIds: ['session-1', 'session-2'] }, 'session-1'), ['session-1', 'session-2']),
    getHistoryBusinessKey(activity('attendance_gap_replace_coach_round', { replacedSessionIds: ['session-1', 'session-2'] }, 'session-2'), ['session-1', 'session-2']),
  )

  const event = (sortId, businessKey, occurredAt) => ({
    sortId,
    businessKey,
    occurredAt,
    type: 'admin_adjustment',
    label: sortId,
    actorName: null,
    learnerNames: [],
    reason: null,
  })
  const normalized = finalizeMeaningfulHistoryEvents([
    event('duplicate-old', 'same-admin-action', '2026-08-06T09:00:00.000Z'),
    event('duplicate-new', 'same-admin-action', '2026-08-06T10:00:00.000Z'),
    event('event-2', 'event-2', '2026-08-06T08:00:00.000Z'),
    event('event-3', 'event-3', '2026-08-06T07:00:00.000Z'),
    event('event-4', 'event-4', '2026-08-06T06:00:00.000Z'),
    event('event-5', 'event-5', '2026-08-06T05:00:00.000Z'),
    event('event-6', 'event-6', '2026-08-06T04:00:00.000Z'),
  ])
  assert.equal(normalized.length, 5)
  assert.equal(normalized[0].label, 'duplicate-new')
  assert.equal(normalized.some((item) => item.label === 'duplicate-old'), false)
})

await check('history is loaded only after click with per-slot single-flight, cache, accessible localized states, and retry', () => {
  assert.match(assignmentClient, /const assignmentHistoryRequestsRef = useRef\(new Map/)
  assert.match(assignmentClient, /const assignmentHistoryCacheRef = useRef\(new Map/)
  assert.match(assignmentClient, /assignmentHistoryRequestsRef\.current\.get\(slot\.key\)/)
  assert.match(assignmentClient, /assignmentHistoryCacheRef\.current\.get\(slot\.key\)/)
  assert.match(assignmentClient, /fetch\(`\/api\/coach\/assignment-history\?scheduleSlotId=/)
  assert.match(assignmentClient, /กำลังโหลดประวัติการเปลี่ยนแปลง\.\.\./)
  assert.match(assignmentClient, /aria-busy=\{isAssignmentHistoryLoading\}/)
  assert.match(assignmentClient, /ลองอีกครั้ง/)
  assert.match(assignmentClient, /ยังไม่มีประวัติการเปลี่ยนแปลงที่ตรวจสอบได้/)
  assert.match(assignmentClient, /event\.type === 'unknown'/)
  assert.match(assignmentClient, /border-amber-300 bg-amber-50/)
  assert.match(assignmentClient, /ผู้เรียน \{event\.learnerNames\.length > 0 \? event\.learnerNames\.join\(', '\) : 'ไม่ทราบชื่อจากหลักฐานเดิม'\} ไม่อยู่ในรายชื่อรอบนี้แล้ว/)
  assert.match(assignmentClient, /event\.actorName &&/)
  assert.match(assignmentClient, /โดย \{event\.actorName\}/)
  assert.doesNotMatch(`${assignmentHistoryLib}\n${assignmentClient}`, /ไม่ทราบผู้ดำเนินการ/)
  assert.doesNotMatch(`${assignmentHistoryLib}\n${assignmentClient}`, /การเปลี่ยนแปลงของรายชื่อที่ไม่มีหลักฐานยืนยัน/)
  assert.doesNotMatch(`${assignmentHistoryLib}\n${assignmentClient}`, /ไม่พบสาเหตุที่ยืนยันได้/)
  assert.doesNotMatch(assignmentClient, /ผู้ดำเนินการ:/)
  assert.doesNotMatch(assignmentClient, /ก่อน:/)
  assert.doesNotMatch(assignmentClient, /หลัง:/)
  assert.doesNotMatch(assignmentClient, /useEffect\([\s\S]{0,600}assignment-history/)
})

await check('month validation accepts YYYY-MM only with month 01 through 12', () => {
  assert.equal(assignmentPage.includes("const ASSIGNMENT_MONTH_PATTERN = /^\\d{4}-(?:0[1-9]|1[0-2])$/"), true)
  assert.match(assignmentPage, /typeof value === 'string'[\s\S]*ASSIGNMENT_MONTH_PATTERN\.test\(value\)/)
  assert.match(assignmentPage, /: currentBangkokMonth/)
})

await check('booking-session reads page beyond 1,000 with a stable total order and no fixed short-page follow-up', () => {
  assert.match(assignmentPage, /const ASSIGNMENT_SESSION_PAGE_SIZE = 1000/)
  assert.match(assignmentPage, /const ASSIGNMENT_SESSION_MAX_PAGES = \d+/)
  assert.match(assignmentPage, /pageIndex < ASSIGNMENT_SESSION_MAX_PAGES/)
  assert.match(assignmentPage, /\.select\([\s\S]*\{ count: 'exact' \}/)
  assert.match(
    assignmentPage,
    /\.order\('date',[\s\S]*\.order\('start_time',[\s\S]*\.order\('id',[\s\S]*\.range\(pageStart, pageEnd\)/,
  )
  assert.match(assignmentPage, /if \(pageRows\.length < ASSIGNMENT_SESSION_PAGE_SIZE\)/)
})

await check('booking-session pagination fails closed on duplicate, changing-count, missing, or unbounded results', () => {
  assert.match(assignmentPage, /seenSessionIds\.has\(row\.id\)/)
  assert.match(assignmentPage, /duplicate booking_session id/)
  assert.match(assignmentPage, /expectedTotal !== result\.count/)
  assert.match(assignmentPage, /rows\.length !== expectedTotal/)
  assert.match(assignmentPage, /exceeded bounded pagination/)
})

await check('authoritative groups, Legacy assignments, and learner levels use bounded complete IN batches', () => {
  assert.match(assignmentPage, /function loadCompleteSupportingBatches/)
  assert.match(assignmentPage, /const ASSIGNMENT_SUPPORTING_IN_BATCH_SIZE = 100/)
  assert.match(assignmentPage, /new Set\(options\.values\.filter\(Boolean\)\)/)
  assert.match(assignmentPage, /result\.count !== result\.data\.length/)
  assert.match(assignmentPage, /loadCompleteSupportingBatches<LegacyAssignmentRow>/)
  assert.match(assignmentPage, /loadCompleteSupportingBatches<ExistingGroupRow>/)
  assert.match(assignmentPage, /loadCompleteSupportingBatches<StudentLevelRow>/)
})

await check('initial current and future month renders never wait for Coach Memory', () => {
  assert.doesNotMatch(assignmentPage, /getCoachStudentMemoryMap\(/)
  assert.doesNotMatch(assignmentPage, /createCompleteCoachMemoryReadClient\(supabase\)/)
  assert.match(assignmentPage, /coachMemory: \[\]/)
  assert.match(assignmentPage, /coachMemoryEnabled=\{selectedMonth === currentBangkokMonth\}/)
})

await check('on-demand Coach Memory keeps complete booking-session pagination and bounded supporting batches', () => {
  assert.match(assignmentMemoryLib, /export function createCompleteCoachMemoryReadClient/)
  assert.match(assignmentMemoryLib, /const COACH_MEMORY_SESSION_PAGE_SIZE = 1000/)
  assert.match(assignmentMemoryLib, /table === 'booking_sessions'/)
  assert.match(assignmentMemoryLib, /duplicate booking_session id/)
  assert.match(assignmentMemoryLib, /row count changed during pagination/)
  assert.match(assignmentMemoryLib, /supporting query exceeded bounded IN batches/)
  assert.match(assignmentMemoryRoute, /createCompleteCoachMemoryReadClient\(supabase, metrics\)/)
})

await check('Coach Memory GET is authenticated, role- and branch-scoped, roster-derived, current, and SELECT-only', () => {
  assert.match(assignmentMemoryRoute, /export async function GET\(/)
  assert.match(assignmentMemoryRoute, /supabase\.auth\.getUser\(\)/)
  assert.match(assignmentMemoryRoute, /\['head_coach', 'super_admin'\]/)
  assert.match(assignmentMemoryRoute, /\.from\('schedule_slots'\)/)
  assert.match(assignmentMemoryRoute, /\.from\('coach_branches'\)/)
  assert.match(assignmentMemoryRoute, /\.from\('booking_sessions'\)/)
  assert.match(assignmentMemoryRoute, /getCoachStudentMemoryMap\(/)
  assert.match(assignmentMemoryRoute, /MEMORY_SLOT_HISTORICAL_OR_STARTED/)
  assert.doesNotMatch(assignmentMemoryRoute, /studentIds|branchId\s*=\s*searchParams/)
  assert.doesNotMatch(assignmentMemoryRoute, /getServiceRoleClient|\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(|logActivity|notif/i)
})

await check('current on-demand memory is single-flight with localized accessible loading and a synchronous guard', () => {
  assert.match(assignmentClient, /coachMemoryEnabled: boolean/)
  assert.match(assignmentClient, /const coachMemoryRequestsRef = useRef\(new Map/)
  assert.match(assignmentClient, /if \(!coachMemoryEnabled \|\| slot\.assignmentLocked/)
  assert.match(assignmentClient, /coachMemoryRequestsRef\.current\.get\(slot\.key\)/)
  assert.match(assignmentClient, /coachMemoryRequestsRef\.current\.set\(slot\.key, request\)/)
  assert.match(assignmentClient, /fetch\(`\/api\/coach\/assignment-memory\?scheduleSlotId=/)
  assert.match(assignmentClient, /method: 'GET'/)
  assert.match(assignmentClient, /กำลังโหลดประวัติโค้ช\.\.\./)
  assert.match(assignmentClient, /aria-busy=\{isCoachMemoryLoading\}/)
})

await check('lazy memory updates untouched drafts but never overwrites an edited draft', () => {
  assert.match(assignmentClient, /const draftWasUntouched = getGroupsSignature\(currentDraft\)[\s\S]*getGroupsSignature\(currentBaseline\)/)
  assert.match(assignmentClient, /if \(!draftWasUntouched\) return prev/)
  assert.match(assignmentClient, /const recommendedDraft = createAutoGroups\(slotWithMemory\)/)
  assert.match(assignmentClient, /draftBaselinesBySlotRef\.current[\s\S]*recommendedDraft/)
})

await check('non-current and locked slots never request or render Coach Memory recommendations', () => {
  assert.match(assignmentClient, /const shouldExposeCoachMemory = coachMemoryEnabled && !slot\.assignmentLocked/)
  assert.match(assignmentClient, /shouldExposeCoachMemory && slot\.suggestedCoachName/)
  assert.match(assignmentClient, /showCoachMemory=\{shouldExposeCoachMemory\}/)
  assert.match(assignmentClient, /if \(!coachMemoryEnabled \|\| slot\.assignmentLocked/)
})

await check('client month navigation is canonical, URL-driven, and timezone-stable across years', () => {
  assert.match(assignmentClient, /selectedMonth: string/)
  assert.match(assignmentClient, /router\.push\(`\/coach\/assign-groups\?month=\$\{nextMonth\}`\)/)
  assert.doesNotMatch(assignmentClient, /\[selectedMonth, setSelectedMonth\] = useState/)
  assert.match(assignmentClient, /const absoluteMonth = year \* 12 \+ \(month - 1\) \+ direction/)
  assert.match(assignmentClient, /const nextYear = Math\.floor\(absoluteMonth \/ 12\)/)

  const shift = (monthKey, direction) => {
    const [year, month] = monthKey.split('-').map(Number)
    const absoluteMonth = year * 12 + (month - 1) + direction
    const nextYear = Math.floor(absoluteMonth / 12)
    const nextMonth = absoluteMonth - nextYear * 12 + 1
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}`
  }
  assert.equal(shift('2026-12', 1), '2027-01')
  assert.equal(shift('2026-01', -1), '2025-12')
})

await check('month controls and selected-month empty state render even with zero rows', () => {
  assert.match(assignmentClient, /data-assignment-month-controls/)
  assert.doesNotMatch(assignmentClient, /groupedByDateAll\.length > 0 &&/)
  assert.match(assignmentClient, /ยังไม่มีรอบเรียนสำหรับ \{formatMonth\(selectedMonth\)\}/)
})

await check('month navigation fails closed for edited drafts and active Save without calling a write endpoint', () => {
  const navigationStart = assignmentClient.indexOf('const navigateMonth')
  const navigationEnd = assignmentClient.indexOf('const updateSlotGroups')
  assert.ok(navigationStart >= 0 && navigationEnd > navigationStart)
  const navigationSource = assignmentClient.slice(navigationStart, navigationEnd)
  assert.match(navigationSource, /if \(savingKey\)/)
  assert.match(navigationSource, /if \(hasEditedDraft\)/)
  assert.match(navigationSource, /toast\.warning/)
  assert.doesNotMatch(navigationSource, /fetch\(|method: 'POST'/)
})

await check('month navigation exposes an accessible pending status and disables both controls', () => {
  assert.match(assignmentClient, /useTransition\(\)/)
  assert.match(assignmentClient, /กำลังโหลดข้อมูลเดือน\.\.\./)
  assert.match(assignmentClient, /role="status"/)
  assert.match(assignmentClient, /aria-live="polite"/)
  assert.match(assignmentClient, /aria-busy=\{isMonthNavigationActive\}/)
  assert.match(assignmentClient, /disabled=\{Boolean\(savingKey\) \|\| isMonthNavigationActive \|\| isCurrentMonth\}/)
  assert.match(assignmentClient, /disabled=\{Boolean\(savingKey\) \|\| isMonthNavigationActive\}/)
})

await check('month navigation uses a synchronous re-entry guard and resets after route commit or interruption', () => {
  assert.match(assignmentClient, /const monthNavigationLockRef = useRef\(false\)/)
  assert.match(assignmentClient, /if \(monthNavigationLockRef\.current \|\| isMonthNavigationPending\) return/)
  assert.match(assignmentClient, /monthNavigationLockRef\.current = true[\s\S]*startMonthNavigation\(\(\) =>/)
  assert.match(assignmentClient, /selectedMonth !== monthNavigationSourceMonthRef\.current \|\| !isMonthNavigationPending/)
  assert.match(assignmentClient, /monthNavigationLockRef\.current = false/)
})

await check('client adds no Supabase read or prefetch and only the scoped memory/history GETs plus Save', () => {
  assert.doesNotMatch(assignmentClient, /createClient\(|\.from\('booking_sessions'\)|prefetch\(/)
  assert.equal((assignmentClient.match(/fetch\(/g) || []).length, 3)
  assert.match(assignmentClient, /fetch\(`\/api\/coach\/assignment-memory\?scheduleSlotId=/)
  assert.match(assignmentClient, /fetch\(`\/api\/coach\/assignment-history\?scheduleSlotId=/)
})

await check('started assignment slots retain the existing read-only lock and Admin attendance-gap wording', () => {
  assert.match(assignmentPage, /assignmentLocked: Boolean\(getAssignmentLockReason\(session\.date, session\.start_time, now\)\)/)
  assert.match(assignmentClient, /const isAssignmentLocked = slot\.assignmentLocked/)
  assert.match(assignmentClient, /disabled=\{isAssignmentLocked\}/)
})

await check('Reschedule and Wallet notifications keep canonical assignment-month links', () => {
  assert.match(rescheduleRoute, /\/coach\/assign-groups\?month=\$\{targetDate\.slice\(0, 7\)\}/)
  assert.match(walletRoute, /\/coach\/assign-groups\?month=\$\{monthKey\((?:session\.date|targetDate)\)\}/)
})

await check('assignment roster retains absent learners', () => {
  assert.match(
    assignmentPage,
    /\.in\('status', \['scheduled', 'completed', 'absent'\]\)/,
  )
})

const canonicalGroup = (id, sessionIds, overrides = {}) => ({
  id,
  name: 'กลุ่มเดิม',
  coachId: 'coach-a',
  levelMin: 1,
  levelMax: 5,
  sortOrder: 0,
  studentSessionIds: sessionIds,
  ...overrides,
})

await check('canonical comparison ignores group row identity and member order', () => {
  const before = [canonicalGroup('group-before', ['session-b', 'session-a'])]
  const after = [canonicalGroup('group-after', ['session-a', 'session-b'])]
  assert.equal(getAssignmentGroupsSignature(before), getAssignmentGroupsSignature(after))
})

await check('absent and all-absent rosters remain Saved when exact membership is unchanged', () => {
  const persisted = [canonicalGroup('group-a', ['absent-session'])]
  const draft = [canonicalGroup('local-draft', ['absent-session'])]
  assert.equal(getAssignmentGroupsSignature(persisted), getAssignmentGroupsSignature(draft))
})

await check('untouched draft follows a server lifecycle change', () => {
  const previous = [canonicalGroup('group-a', ['session-a', 'session-b'])]
  const next = [canonicalGroup('group-a', ['session-a'])]
  const result = reconcileAssignmentDraft({
    currentDraft: previous,
    previousServerDerivedDraft: previous,
    nextServerDerivedDraft: next,
    previousPersistedGroups: previous,
    nextPersistedGroups: next,
  })
  assert.deepEqual(result.draft, next)
  assert.equal(result.needsRefreshReview, false)
})

await check('edited draft survives a server lifecycle change and requires review', () => {
  const previous = [canonicalGroup('group-a', ['session-a', 'session-b'])]
  const edited = [canonicalGroup('group-a', ['session-a', 'session-b'], { name: 'ชื่อที่กำลังแก้' })]
  const next = [canonicalGroup('group-a', ['session-a'])]
  const result = reconcileAssignmentDraft({
    currentDraft: edited,
    previousServerDerivedDraft: previous,
    nextServerDerivedDraft: next,
    previousPersistedGroups: previous,
    nextPersistedGroups: next,
  })
  assert.deepEqual(result.draft, edited)
  assert.equal(result.needsRefreshReview, true)
})

await check('client uses canonical persisted response as the post-Save baseline', () => {
  assert.match(assignmentClient, /parseCanonicalAssignmentGroups\(json\?\.canonicalGroups\)/)
  assert.match(assignmentClient, /draftBaselinesBySlotRef\.current[\s\S]*canonicalDrafts/)
  assert.match(assignmentClient, /รายชื่อรอบเรียนบน Server เปลี่ยนระหว่างที่กำลังแก้ฉบับร่าง/)
})

await check('v2 Save and both retirement call sites are wired while v1 remains intact', () => {
  assert.match(assignmentRoute, /rpc\('save_coach_assignment_groups_v2'/)
  assert.match(rescheduleRoute, /rpc\('retire_coach_assignment_membership_v1'[\s\S]*p_reason: 'reschedule_out'/)
  assert.match(walletRoute, /rpc\('retire_coach_assignment_membership_v1'[\s\S]*p_reason: 'wallet_store'/)
  assert.match(v1Migration, /create or replace function public\.save_coach_assignment_groups_v1/)
})

await check('destination Reschedule-in and Wallet redemption remain unassigned', () => {
  const rescheduleDestination = rescheduleRoute.slice(rescheduleRoute.indexOf("status: 'scheduled'"))
  const walletDestination = walletRoute.slice(walletRoute.indexOf('async function redeemWalletCredit'))
  for (const source of [rescheduleDestination, walletDestination]) {
    assert.doesNotMatch(source, /coach_assignment_group_students[\s\S]*\.insert\(/)
    assert.doesNotMatch(source, /create_exact_coach_assignment_group_v1/)
  }
})

await check('empty exact boundary suppresses Legacy while a genuine zero-exact slot retains compatibility', () => {
  const emptyGroup = canonicalGroup('empty-group', [])
  assert.deepEqual(getGenuineLegacyOnlySlotIds(['slot-empty'], [{
    schedule_slot_id: 'slot-empty',
    coach_id: 'coach-a',
    coach_assignment_group_students: [],
  }]), [])
  assert.deepEqual(getGenuineLegacyOnlySlotIds(['slot-legacy'], []), ['slot-legacy'])
  assert.deepEqual(resolveCoachSlotAccess({
    exactGroups: [emptyGroup],
    coachId: 'coach-a',
    hasLegacyAssignment: true,
    legacyEligibleLearnerCount: 1,
  }), { allowed: false, source: 'exact' })
})

await check('Payroll suppresses only truly empty raw exact aggregates', () => {
  assert.match(teachingHours, /const rawSessionIds =[\s\S]*if \(rawSessionIds\.length === 0\) return[\s\S]*if \(sessionIds\.length === 0 && !options\.includeExcluded\) return/)
})

await check('migration is additive, service-role-only, audit-complete, and contains no apply-time mutation block', () => {
  for (const required of [
    'coach_assignment_slot_snapshot_v2',
    'save_coach_assignment_groups_v2',
    'retire_coach_assignment_membership_v1',
    "session_item.status in ('scheduled', 'completed', 'absent')",
    'COACH_ASSIGNMENT_ROSTER_CONFLICT|submitted_session_ineligible',
    'COACH_ASSIGNMENT_ROSTER_CONFLICT|missing_current_eligible_session',
    'COACH_ASSIGNMENT_DUPLICATE_MEMBERSHIP|duplicate_submitted_session',
    'COACH_ASSIGNMENT_RETIREMENT_CONFLICT|session_or_slot_changed',
    "p_reason not in ('reschedule_out', 'wallet_store')",
    "'before', before_snapshot",
    "'after', after_snapshot",
  ]) assert.equal(migration.includes(required), true, `migration missing ${required}`)
  assert.doesNotMatch(migration, /\bdo\s+\$\$/iu)
  assert.doesNotMatch(migration, /errcode\s*=\s*'40001'/iu)
  assert.doesNotMatch(migration, /drop\s+function\s+public\.save_coach_assignment_groups_v1/iu)
  assert.match(migration, /select schedule_slot_id into target_slot_id[\s\S]*from public\.schedule_slots[\s\S]*for update;[\s\S]*select \* into session_row[\s\S]*for update;/u)
  for (const signature of [
    'public.save_coach_assignment_groups_v2(uuid, uuid, jsonb)',
    'public.retire_coach_assignment_membership_v1(uuid, uuid, text)',
  ]) {
    assert.equal(migration.includes(`revoke all on function ${signature} from public, anon, authenticated`), true)
    assert.equal(migration.includes(`grant execute on function ${signature} to service_role`), true)
  }
})

await check('canonical database snapshot parser keeps IDs needed for audit reconstruction', () => {
  assert.deepEqual(parseCanonicalAssignmentGroups([{
    id: 'group-db',
    name: 'กลุ่มฐานข้อมูล',
    coach_id: 'coach-db',
    level_min: 4,
    level_max: 9,
    sort_order: 2,
    student_session_ids: ['session-db'],
  }]), [{
    id: 'group-db',
    name: 'กลุ่มฐานข้อมูล',
    coachId: 'coach-db',
    levelMin: 4,
    levelMax: 9,
    sortOrder: 2,
    studentSessionIds: ['session-db'],
  }])
})

if (sourceOnly) {
  await check('source-only mode stops before Local Supabase identity and fixture setup', () => {
    assert.equal(sourceOnly, true)
  })
  console.log(`\nCoach assignment lifecycle source-only checks passed: ${passed}`)
} else {
function localEnvironment() {
  const output = execSync('npx.cmd --yes supabase@2.111.0 status -o env', {
    cwd: root,
    encoding: 'utf8',
  })
  const values = new Map()
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)="?(.*?)"?$/)
    if (match) values.set(match[1], match[2])
  }
  const apiUrl = values.get('API_URL')
  const dbUrl = values.get('DB_URL')
  const serviceRoleKey = values.get('SERVICE_ROLE_KEY')
  assert.match(apiUrl || '', /^http:\/\/(127\.0\.0\.1|localhost):54321$/)
  assert.match(dbUrl || '', /^postgresql:\/\/postgres:postgres@(127\.0\.0\.1|localhost):54322\/postgres$/)
  assert.ok(serviceRoleKey)
  assert.equal(read('supabase/config.toml').includes('project_id = "New-Athlete-Badminton-School"'), true)
  return { apiUrl, serviceRoleKey }
}

const local = localEnvironment()
await check('isolated Supabase identity is loopback-only and matches the target project ports', () => {})

const admin = createClient(local.apiUrl, local.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const prefix = `assignment-lifecycle-${Date.now()}`
const password = 'LocalOnly!2026'
const ids = {
  branchA: randomUUID(),
  branchB: randomUUID(),
  course: randomUUID(),
  booking: randomUUID(),
}
let coachId = null
let learnerId = null
const slotIds = []
const sessionIds = []
const auditIds = []

function noError(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}

async function createUser(email, role) {
  const result = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: prefix },
  })
  noError(result, `create ${role}`)
  const id = result.data.user.id
  noError(await admin.from('profiles').update({ role, full_name: prefix }).eq('id', id), `update ${role}`)
  return id
}

async function addSlot({
  date = '2099-08-20',
  startTime = '10:00:00',
  endTime = '12:00:00',
  statuses = ['scheduled'],
  branchId = ids.branchA,
} = {}) {
  const slotId = randomUUID()
  slotIds.push(slotId)
  noError(await admin.from('schedule_slots').insert({
    id: slotId,
    template_id: null,
    branch_id: branchId,
    course_type_id: ids.course,
    date,
    start_time: startTime,
    end_time: endTime,
    max_students: 6,
    current_students: statuses.length,
    status: 'open',
  }), 'insert slot')
  const sessions = statuses.map((status) => ({ id: randomUUID(), status }))
  sessionIds.push(...sessions.map((session) => session.id))
  noError(await admin.from('booking_sessions').insert(sessions.map((session) => ({
    id: session.id,
    booking_id: ids.booking,
    schedule_slot_id: slotId,
    date,
    start_time: startTime,
    end_time: endTime,
    branch_id: branchId,
    child_id: null,
    status: session.status,
  }))), 'insert sessions')
  return { slotId, sessions }
}

function groupPayload(sessionIdsForGroup, overrides = {}) {
  return {
    name: 'กลุ่ม Lifecycle',
    coachId,
    levelMin: 1,
    levelMax: 5,
    sortOrder: 0,
    studentSessionIds: sessionIdsForGroup,
    ...overrides,
  }
}

async function saveV2(slotId, groups, actorId = coachId) {
  return admin.rpc('save_coach_assignment_groups_v2', {
    p_schedule_slot_id: slotId,
    p_actor_id: actorId,
    p_groups: groups,
  })
}

async function retire(sessionId, reason, actorId = learnerId) {
  return admin.rpc('retire_coach_assignment_membership_v1', {
    p_booking_session_id: sessionId,
    p_actor_id: actorId,
    p_reason: reason,
  })
}

async function expectConflict(resultPromise, pattern, label) {
  const result = await resultPromise
  assert.ok(result.error, `${label}: expected conflict`)
  assert.match(result.error.message, pattern)
}

async function snapshot(slotId) {
  return noError(await admin.rpc('coach_assignment_slot_snapshot_v2', {
    p_schedule_slot_id: slotId,
  }), 'load lifecycle snapshot')
}

async function cleanup() {
  if (auditIds.length) await admin.from('activity_logs').delete().in('id', auditIds)
  if (coachId || learnerId) {
    await admin.from('activity_logs').delete().in('user_id', [coachId, learnerId].filter(Boolean))
  }
  if (slotIds.length) {
    await admin.from('coach_assignment_groups').delete().in('schedule_slot_id', slotIds)
    await admin.from('coach_assignments').delete().in('schedule_slot_id', slotIds)
  }
  if (sessionIds.length) await admin.from('booking_sessions').delete().in('id', sessionIds)
  if (slotIds.length) await admin.from('schedule_slots').delete().in('id', slotIds)
  await admin.from('bookings').delete().eq('id', ids.booking)
  if (coachId) await admin.from('coach_branches').delete().eq('coach_id', coachId)
  await admin.from('course_types').delete().eq('id', ids.course)
  await admin.from('branches').delete().in('id', [ids.branchA, ids.branchB])
  if (coachId) await admin.auth.admin.deleteUser(coachId)
  if (learnerId) await admin.auth.admin.deleteUser(learnerId)
}

try {
  coachId = await createUser(`${prefix}-coach@example.com`, 'coach')
  learnerId = await createUser(`${prefix}-learner@example.com`, 'user')
  noError(await admin.from('branches').insert([
    { id: ids.branchA, name: `${prefix} A`, slug: `${prefix}-a`, address: 'local', is_active: true },
    { id: ids.branchB, name: `${prefix} B`, slug: `${prefix}-b`, address: 'local', is_active: true },
  ]), 'insert branches')
  noError(await admin.from('course_types').insert({
    id: ids.course,
    name: 'kids_group',
    description: prefix,
    max_students: 6,
    duration_hours: 2,
  }), 'insert course')
  noError(await admin.from('coach_branches').insert([
    { coach_id: coachId, branch_id: ids.branchA },
    { coach_id: coachId, branch_id: ids.branchB },
  ]), 'insert coach branches')
  noError(await admin.from('bookings').insert({
    id: ids.booking,
    user_id: learnerId,
    learner_type: 'self',
    child_id: null,
    branch_id: ids.branchA,
    course_type_id: ids.course,
    month: 8,
    year: 2099,
    total_sessions: 20,
    total_price: 0,
    status: 'verified',
  }), 'insert booking')

  const absent = await addSlot({ statuses: ['absent', 'absent'] })
  const absentSave = noError(await saveV2(
    absent.slotId,
    [groupPayload(absent.sessions.map((session) => session.id))],
  ), 'save all-absent roster')
  auditIds.push(absentSave.audit.id)
  await check('all-absent group saves as exact canonical evidence', () => {
    assert.deepEqual(absentSave.eligible_session_ids, absent.sessions.map((session) => session.id).sort())
    assert.deepEqual(absentSave.snapshot.membership_session_ids, absent.sessions.map((session) => session.id).sort())
  })

  const absentAudit = noError(await admin.from('activity_logs')
    .select('id, user_id, action, entity_id, details, created_at')
    .eq('id', absentSave.audit.id)
    .single(), 'read atomic save audit')
  await check('atomic Save audit reconstructs before/after groups, coaches, memberships, actor, slot and timestamp', () => {
    assert.equal(absentAudit.user_id, coachId)
    assert.equal(absentAudit.entity_id, absent.slotId)
    assert.equal(absentAudit.action, 'save_coach_assignment_groups_v2')
    assert.ok(absentAudit.created_at)
    assert.deepEqual(absentAudit.details.before.group_ids, [])
    assert.equal(absentAudit.details.after.group_ids.length, 1)
    assert.deepEqual(absentAudit.details.after.coach_ids, [coachId])
    assert.deepEqual(absentAudit.details.after.membership_session_ids, absent.sessions.map((session) => session.id).sort())
  })

  const beforeFailedSave = await snapshot(absent.slotId)
  await expectConflict(
    saveV2(absent.slotId, [groupPayload(absent.sessions.map((session) => session.id), { name: 'ต้อง rollback' })], null),
    /null value in column "user_id"|not-null constraint/iu,
    'save audit failure',
  )
  await check('Save mutation rolls back atomically when its audit insert fails', async () => {
    assert.deepEqual(await snapshot(absent.slotId), beforeFailedSave)
  })

  const missing = await addSlot({
    statuses: ['scheduled', 'completed'],
    startTime: '12:00:00',
    endTime: '14:00:00',
  })
  await expectConflict(
    saveV2(missing.slotId, [groupPayload([missing.sessions[0].id])]),
    /COACH_ASSIGNMENT_ROSTER_CONFLICT\|missing_current_eligible_session/,
    'missing eligible learner',
  )
  await check('missing current eligible learner returns a typed roster conflict', () => {})

  await expectConflict(
    saveV2(missing.slotId, [
      groupPayload([missing.sessions[0].id], { name: 'ซ้ำ A', coachId: null, sortOrder: 0 }),
      groupPayload([missing.sessions[0].id, missing.sessions[1].id], { name: 'ซ้ำ B', coachId, sortOrder: 1 }),
    ]),
    /COACH_ASSIGNMENT_DUPLICATE_MEMBERSHIP\|duplicate_submitted_session/,
    'duplicate submitted learner',
  )
  await check('duplicate submitted learner is rejected before mutation', () => {})

  const reschedule = await addSlot({ statuses: ['scheduled'], startTime: '13:00:00', endTime: '15:00:00' })
  const rescheduleSave = noError(await saveV2(reschedule.slotId, [groupPayload([reschedule.sessions[0].id])]), 'seed reschedule ordering')
  auditIds.push(rescheduleSave.audit.id)
  noError(await admin.from('booking_sessions').update({ status: 'rescheduled' }).eq('id', reschedule.sessions[0].id), 'mark rescheduled')
  const rescheduleRetirement = noError(await retire(reschedule.sessions[0].id, 'reschedule_out'), 'retire rescheduled membership')
  auditIds.push(rescheduleRetirement.audit.id)
  await check('Save-wins ordering then Reschedule retirement preserves the empty parent and removes only membership', async () => {
    const current = await snapshot(reschedule.slotId)
    assert.equal(rescheduleRetirement.removed_count, 1)
    assert.equal(current.groups.length, 1)
    assert.deepEqual(current.groups[0].student_session_ids, [])
    assert.deepEqual(current.membership_session_ids, [])
  })
  await expectConflict(
    saveV2(reschedule.slotId, [groupPayload([reschedule.sessions[0].id])]),
    /COACH_ASSIGNMENT_ROSTER_CONFLICT\|submitted_session_ineligible/,
    'stale rescheduled session save',
  )
  await check('Reschedule-wins ordering makes a stale Save fail closed', () => {})

  const retirementAudit = noError(await admin.from('activity_logs')
    .select('id, user_id, entity_id, details, created_at')
    .eq('id', rescheduleRetirement.audit.id)
    .single(), 'read retirement audit')
  await check('retirement audit captures reconstructable reason and before/after exact IDs without PII', () => {
    assert.equal(retirementAudit.user_id, learnerId)
    assert.equal(retirementAudit.entity_id, reschedule.slotId)
    assert.equal(retirementAudit.details.reason, 'reschedule_out')
    assert.equal(retirementAudit.details.before.group_ids.length, 1)
    assert.equal(retirementAudit.details.before.membership_session_ids.length, 1)
    assert.equal(retirementAudit.details.after.group_ids.length, 1)
    assert.deepEqual(retirementAudit.details.after.membership_session_ids, [])
    assert.equal(JSON.stringify(retirementAudit.details).includes(prefix), false)
  })

  const walletRollback = await addSlot({ statuses: ['scheduled'], startTime: '15:00:00', endTime: '17:00:00' })
  const walletRollbackSave = noError(await saveV2(walletRollback.slotId, [groupPayload([walletRollback.sessions[0].id])]), 'seed wallet rollback')
  auditIds.push(walletRollbackSave.audit.id)
  noError(await admin.from('booking_sessions').update({ status: 'walleted' }).eq('id', walletRollback.sessions[0].id), 'mark walleted for rollback')
  await expectConflict(
    retire(walletRollback.sessions[0].id, 'wallet_store', null),
    /null value in column "user_id"|not-null constraint/iu,
    'retirement audit failure',
  )
  await check('membership retirement rolls back atomically when its audit insert fails', async () => {
    const current = await snapshot(walletRollback.slotId)
    assert.deepEqual(current.membership_session_ids, [walletRollback.sessions[0].id])
  })
  const walletRetirement = noError(await retire(walletRollback.sessions[0].id, 'wallet_store'), 'retire wallet membership')
  auditIds.push(walletRetirement.audit.id)
  await check('Wallet-store retirement preserves empty parent and returns exact context', async () => {
    const current = await snapshot(walletRollback.slotId)
    assert.equal(walletRetirement.reason, 'wallet_store')
    assert.equal(walletRetirement.removed_count, 1)
    assert.equal(current.groups.length, 1)
    assert.deepEqual(current.groups[0].student_session_ids, [])
  })
  await expectConflict(
    saveV2(walletRollback.slotId, [groupPayload([walletRollback.sessions[0].id])]),
    /COACH_ASSIGNMENT_ROSTER_CONFLICT\|submitted_session_ineligible/,
    'stale walleted session save',
  )
  await check('Wallet-wins ordering makes a stale Save fail closed', () => {})

  const overlapA = await addSlot({ date: '2099-08-21', startTime: '10:00:00', endTime: '12:00:00', branchId: ids.branchA })
  const overlapB = await addSlot({ date: '2099-08-21', startTime: '11:00:00', endTime: '13:00:00', branchId: ids.branchB })
  const overlapSave = noError(await saveV2(overlapA.slotId, [groupPayload([overlapA.sessions[0].id])]), 'seed exact conflict')
  auditIds.push(overlapSave.audit.id)
  await expectConflict(
    saveV2(overlapB.slotId, [groupPayload([overlapB.sessions[0].id])]),
    /COACH_ASSIGNMENT_CONFLICT/,
    'existing exact reservation conflict',
  )
  await check('existing exact coach conflict reservation behavior remains enforced by v2', () => {})
} finally {
  await cleanup()
}

await check('fixture cleanup leaves no lifecycle residue', async () => {
  const [branches, courses, bookings, sessions, slots, activities] = await Promise.all([
    admin.from('branches').select('id', { count: 'exact', head: true }).ilike('name', `${prefix}%`),
    admin.from('course_types').select('id', { count: 'exact', head: true }).eq('description', prefix),
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('id', ids.booking),
    admin.from('booking_sessions').select('id', { count: 'exact', head: true }).in('id', sessionIds),
    admin.from('schedule_slots').select('id', { count: 'exact', head: true }).in('id', slotIds),
    admin.from('activity_logs').select('id', { count: 'exact', head: true }).in('id', auditIds),
  ])
  for (const result of [branches, courses, bookings, sessions, slots, activities]) {
    noError(result, 'verify fixture cleanup')
    assert.equal(result.count, 0)
  }
})

console.log(`\nCoach assignment lifecycle checks passed: ${passed}`)
}
