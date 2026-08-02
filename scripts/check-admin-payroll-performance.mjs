import assert from 'node:assert/strict'
import fs from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith('@/')) return nextResolve(specifier, context)
    return {
      url: pathToFileURL(path.join(root, 'src', `${specifier.slice(2)}.ts`)).href,
      shortCircuit: true,
    }
  },
})

const {
  buildAdminPayrollSummaries,
  getAdminPayrollMonthRange,
  parseAdminPayrollMonth,
} = await import('../src/lib/admin-payroll-read.ts')
const { COACH_TEACHING_RULES } = await import('../src/lib/coach-teaching-rules.ts')

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const source = read('src/lib/coach-teaching-hours.ts')
const payrollRead = read('src/lib/admin-payroll-read.ts')
const page = read('src/app/(admin)/admin/payroll/page.tsx')
const client = read('src/components/admin/payroll-client.tsx')
const detailRoute = read('src/app/api/admin/coach-teaching-hours/route.ts')
let passed = 0
function check(name, action) {
  action()
  passed += 1
  console.log(`PASS ${passed}: ${name}`)
}

check('every selected month expands only to complete intersecting Monday-Sunday weeks', () => {
  for (const year of [2026, 2027]) {
    for (let month = 1; month <= 12; month += 1) {
      const range = getAdminPayrollMonthRange(year, month)
      const days = (Date.parse(range.expandedEndExclusive) - Date.parse(range.expandedStart)) / 86_400_000
      assert.ok(days >= 28 && days <= 42 && days % 7 === 0, `${year}-${month} expanded to ${days} days`)
      assert.equal(new Date(`${range.expandedStart}T00:00:00Z`).getUTCDay(), 1)
      assert.equal(new Date(`${range.expandedEndExclusive}T00:00:00Z`).getUTCDay(), 1)
    }
  }
})

check('invalid or missing URL state falls back atomically instead of mixing year and month', () => {
  const fallback = parseAdminPayrollMonth(null, null)
  assert.ok(fallback.year >= 2026)
  assert.ok(fallback.month >= 1 && fallback.month <= 12)
  assert.deepEqual(parseAdminPayrollMonth('2026', '13'), fallback)
  assert.deepEqual(parseAdminPayrollMonth('invalid', '7'), fallback)
})

check('initial payroll read is selected-month bounded and never requests an annual range', () => {
  assert.match(page, /parseAdminPayrollMonth/)
  assert.match(page, /loadAdminPayrollMonthSummary/)
  assert.doesNotMatch(page, /getYearRange|getFullYear\(\).*0, 1|getCoachTeachingHourSourceRows/)
  assert.match(payrollRead, /expandedStart/)
  assert.match(payrollRead, /expandedEndExclusive/)
  assert.match(source, /MAX_SOURCE_RANGE_DAYS = 62/)
})

check('assignment reads page with exact counts and stable date, time, slot, and id ordering', () => {
  assert.match(source, /count: 'exact'/)
  assert.match(source, /pagination incomplete/)
  assert.match(source, /\.order\('schedule_slots\(date\)'\)/)
  assert.match(source, /\.order\('schedule_slots\(start_time\)'\)/)
  assert.match(source, /\.order\('schedule_slot_id'\)/)
  assert.match(source, /\.order\('sort_order'\)/)
  assert.match(source, /\.order\('id'\)/)
  assert.doesNotMatch(source, /limit\(5000\)/)
})

check('initial RSC serializes summaries and metrics but no full teaching-slot detail collection', () => {
  assert.match(page, /coaches=\{read\.coaches\}/)
  assert.match(page, /totals=\{read\.totals\}/)
  assert.doesNotMatch(page, /rows=|photo_url|location_lat|checkin_time/)
  const summary = buildAdminPayrollSummaries([{
    assignment_id: 'assignment-a',
    assignment_source: 'group',
    coach_id: 'coach-a',
    coach_name: 'Coach A',
    employment_type: 'part_time',
    schedule_slot_id: 'slot-a',
    branch_name: 'Branch A',
    course_type: 'Private',
    date: '2026-07-20',
    start_time: '17:00:00',
    end_time: '18:00:00',
    checkin_id: 'checkin-a',
    checkin_time: 'secret-time',
    photo_url: 'secret-photo-url',
    location_lat: 13.7,
    location_lng: 100.5,
    student_count: 1,
    attendance_count: 1,
    present_count: 1,
    late_count: 0,
    absent_count: 0,
    has_checkin: true,
    has_photo: true,
    has_location: true,
    has_attendance: true,
    is_verified: true,
    classification: 'counted',
    classification_reason: 'evidence_complete',
    evidence_reasons: ['evidence_complete'],
  }], COACH_TEACHING_RULES, [])
  const serialized = JSON.stringify(summary)
  assert.doesNotMatch(serialized, /secret-photo-url|secret-time|location_lat|schedule_slot_id/)
})

check('detail endpoint is invoked only from an explicit Coach/week expansion action', () => {
  const occurrences = client.match(/\/api\/admin\/coach-teaching-hours/g) || []
  assert.equal(occurrences.length, 1)
  assert.match(client, /const loadDetail = async/)
  assert.match(client, /onClick=\{\(\) => loadDetail\(selectedCoach, week\)\}/)
  assert.doesNotMatch(client, /useEffect\([\s\S]{0,500}coach-teaching-hours/)
})

check('month navigation is server-authoritative URL state with a visible pending state', () => {
  assert.match(client, /router\.push\(`\/admin\/payroll\?year=\$\{year\}&month=\$\{month\}`/)
  assert.match(client, /useTransition\(\)/)
  assert.match(client, /disabled=\{isNavigating\}/)
  assert.match(client, /กำลังโหลดสรุปเดือนใหม่/)
})

check('aborted or stale detail responses cannot overwrite a new selection or month', () => {
  assert.match(client, /new AbortController\(\)/)
  assert.match(client, /detailControllerRef\.current\?\.abort\(\)/)
  assert.match(client, /generation !== detailGenerationRef\.current/)
  assert.match(client, /controller\.signal\.aborted/)
  assert.match(client, /signal: controller\.signal/)
})

check('Coach/week detail route is Payroll-authorized, canonical, server-only, and no-store', () => {
  assert.match(detailRoute, /requireAdminMenuAccess\('payroll'\)/)
  assert.match(detailRoute, /isCanonicalTeachingWeekRangeBangkok/)
  assert.match(detailRoute, /getServiceRoleClient\(\)/)
  assert.match(detailRoute, /Cache-Control': 'private, no-store'/)
  assert.match(detailRoute, /Server-Timing/)
  assert.doesNotMatch(detailRoute, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY/)
})

check('related reads use bounded concurrency and avoid coach-chunk by slot-chunk fan-out', () => {
  assert.match(source, /PAYROLL_QUERY_CONCURRENCY = 6/)
  assert.match(source, /mapWithConcurrency\(chunks, PAYROLL_QUERY_CONCURRENCY/)
  assert.doesNotMatch(source, /coachIndex[\s\S]{0,1200}slotIndex/)
  assert.match(source, /getCheckins\([\s\S]*assignmentKeys[\s\S]*slotIds/)
})

check('read metrics expose duration, calls, rows, phases, and response size without sensitive payload values', () => {
  for (const field of ['durationMs', 'externalCalls', 'rowsBySource', 'callsBySource', 'phasesMs', 'responseBytes']) {
    assert.match(payrollRead, new RegExp(field))
  }
  assert.match(payrollRead, /console\.info\('\[admin-payroll-performance\]', JSON\.stringify\(metrics\)\)/)
  const logStatement = payrollRead.match(/function logReadMetrics[\s\S]*?\n\}/)?.[0] || ''
  assert.doesNotMatch(logStatement, /photo_url|location_lat|location_lng|coach_name|learner|payable_amount/)
})

check('summary query cost is independent of records in unrelated months and annual growth', () => {
  assert.match(payrollRead, /startDate: range\.expandedStart/)
  assert.match(payrollRead, /endDateExclusive: range\.expandedEndExclusive/)
  assert.doesNotMatch(payrollRead, /getFullYear\(|365|366|yearStart|yearEnd/)
})

check('loading, error, empty, and success detail states are rendered separately', () => {
  assert.match(client, /state\.status === 'loading'/)
  assert.match(client, /state\.status === 'error'/)
  assert.match(client, /state\.data\.rows\.length === 0/)
  assert.match(client, /state\.status !== 'success'/)
})

console.log(`\nAdmin Payroll performance architecture checks passed: ${passed}`)
