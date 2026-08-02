import {
  addDaysToInputDate,
  calculateTeachingPayEntries,
  COACH_TEACHING_RULES_SETTING_KEY,
  getCoachTeachingRule,
  getTeachingWeekInfoBangkok,
  normalizeCoachEmploymentType,
  normalizeCoachTeachingRulesSettings,
  type CoachEmploymentType,
  type CoachTeachingRules,
} from '@/lib/coach-teaching-rules'
import {
  getCoachTeachingHourSourceRead,
  type CoachTeachingHourReason,
  type CoachTeachingHourSourceRow,
} from '@/lib/coach-teaching-hours'
import { getBangkokDateString } from '@/lib/utils'

const PAGE_SIZE = 1000

type PayrollQuery = PromiseLike<unknown> & {
  eq: (column: string, value: unknown) => PayrollQuery
  gte: (column: string, value: unknown) => PayrollQuery
  lt: (column: string, value: unknown) => PayrollQuery
  order: (column: string, options?: { ascending?: boolean }) => PayrollQuery
  range: (from: number, to: number) => PayrollQuery
  maybeSingle: () => PromiseLike<unknown>
}

type PayrollSupabase = {
  from: (table: string) => {
    select: (columns: string, options?: { count?: 'exact' }) => PayrollQuery
  }
}

interface QueryResult<T> {
  data: T | null
  error: { message: string } | null
  count?: number | null
}

interface TeachingRulesSettingRow {
  value: unknown
}

export interface AdminPayrollClosedSummary {
  id: string
  coach_id: string
  week_start: string
  week_end: string
  coach_employment_type: string
  threshold_hours: number
  group_hours: number
  private_hours: number
  total_hours: number
  regular_hours: number
  payable_group_hours: number
  payable_private_hours: number
  payable_hours: number
  private_rate: number
  group_rate: number
  payable_amount: number
  payable_session_count: number
  missing_checkin_count: number
  missing_photo_count: number
  status: string
  notes: string | null
  closed_at: string
  closed_by: string | null
  closed_by_name: string | null
}

interface ClosedSummaryDbRow extends Omit<AdminPayrollClosedSummary,
  | 'threshold_hours'
  | 'group_hours'
  | 'private_hours'
  | 'total_hours'
  | 'regular_hours'
  | 'payable_group_hours'
  | 'payable_private_hours'
  | 'payable_hours'
  | 'private_rate'
  | 'group_rate'
  | 'payable_amount'
  | 'closed_by_name'
> {
  threshold_hours: number | string
  group_hours: number | string
  private_hours: number | string
  total_hours: number | string
  regular_hours: number | string
  payable_group_hours: number | string
  payable_private_hours: number | string
  payable_hours: number | string
  private_rate: number | string
  group_rate: number | string
  payable_amount: number | string
  profiles?: { full_name: string | null } | null
}

export interface AdminPayrollIssueCounts {
  missing_checkin: number
  missing_photo: number
  missing_location: number
  missing_attendance: number
  no_eligible_learner: number
  duplicate_assignment_data: number
}

export interface AdminPayrollWeekSummary {
  week_start: string
  week_end: string
  assigned_round_count: number
  countable_round_count: number
  review_round_count: number
  excluded_round_count: number
  group_hours: number
  private_hours: number
  total_hours: number
  regular_hours: number
  payable_group_hours: number
  payable_private_hours: number
  payable_hours: number
  payable_amount: number
  issue_counts: AdminPayrollIssueCounts
  closed_summary: AdminPayrollClosedSummary | null
}

export interface AdminPayrollCoachSummary {
  coach_id: string
  coach_name: string
  employment_type: CoachEmploymentType | null
  assigned_round_count: number
  countable_round_count: number
  review_round_count: number
  excluded_round_count: number
  group_hours: number
  private_hours: number
  total_hours: number
  regular_hours: number
  payable_group_hours: number
  payable_private_hours: number
  payable_hours: number
  payable_amount: number
  issue_counts: AdminPayrollIssueCounts
  weeks: AdminPayrollWeekSummary[]
}

export interface AdminPayrollMonthTotals {
  coach_count: number
  assigned_round_count: number
  countable_round_count: number
  review_round_count: number
  excluded_round_count: number
  total_hours: number
  payable_hours: number
  payable_amount: number
}

export interface AdminPayrollReadMetrics {
  operation: 'admin_payroll_month_summary' | 'admin_payroll_coach_week_detail'
  durationMs: number
  externalCalls: number
  rowsBySource: Record<string, number>
  callsBySource: Record<string, number>
  phasesMs: Record<string, number>
  responseBytes: number
}

export interface AdminPayrollMonthRead {
  year: number
  month: number
  range: AdminPayrollMonthRange
  coaches: AdminPayrollCoachSummary[]
  totals: AdminPayrollMonthTotals
  teachingRules: CoachTeachingRules
  metrics: AdminPayrollReadMetrics
}

export interface AdminPayrollDetailRow {
  assignment_id: string
  assignment_source: 'group' | 'legacy'
  schedule_slot_id: string
  branch_name: string
  course_type: string
  date: string
  start_time: string
  end_time: string
  checkin_time: string | null
  photo_url: string | null
  location_lat: number | null
  location_lng: number | null
  student_count: number
  attendance_count: number
  present_count: number
  late_count: number
  absent_count: number
  has_checkin: boolean
  has_photo: boolean
  has_location: boolean
  has_attendance: boolean
  classification: CoachTeachingHourSourceRow['classification']
  classification_reason: CoachTeachingHourReason
  evidence_reasons: CoachTeachingHourReason[]
  hours: number
  regular_hours: number
  payable_hours: number
  payable_amount: number
}

export interface AdminPayrollCoachWeekDetail {
  coach_id: string
  coach_name: string
  employment_type: CoachEmploymentType | null
  week: AdminPayrollWeekSummary
  rows: AdminPayrollDetailRow[]
  metrics: AdminPayrollReadMetrics
}

export interface AdminPayrollMonthRange {
  monthStart: string
  monthEnd: string
  expandedStart: string
  expandedEndExclusive: string
}

function createIssueCounts(): AdminPayrollIssueCounts {
  return {
    missing_checkin: 0,
    missing_photo: 0,
    missing_location: 0,
    missing_attendance: 0,
    no_eligible_learner: 0,
    duplicate_assignment_data: 0,
  }
}

function addIssueCounts(target: AdminPayrollIssueCounts, source: AdminPayrollIssueCounts) {
  target.missing_checkin += source.missing_checkin
  target.missing_photo += source.missing_photo
  target.missing_location += source.missing_location
  target.missing_attendance += source.missing_attendance
  target.no_eligible_learner += source.no_eligible_learner
  target.duplicate_assignment_data += source.duplicate_assignment_data
}

function getRowIssueCounts(row: CoachTeachingHourSourceRow): AdminPayrollIssueCounts {
  const counts = createIssueCounts()
  row.evidence_reasons.forEach((reason) => {
    if (reason !== 'evidence_complete') counts[reason] += 1
  })
  return counts
}

function formatInputDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function parseAdminPayrollMonth(yearValue?: string | null, monthValue?: string | null) {
  const current = getBangkokDateString()
  const fallbackYear = Number(current.slice(0, 4))
  const fallbackMonth = Number(current.slice(5, 7))
  const year = Number(yearValue)
  const month = Number(monthValue)
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    return { year: fallbackYear, month: fallbackMonth }
  }
  return { year, month }
}

export function getAdminPayrollMonthRange(year: number, month: number): AdminPayrollMonthRange {
  const monthStartDate = new Date(Date.UTC(year, month - 1, 1))
  const monthEndDate = new Date(Date.UTC(year, month, 0))
  const monthStart = formatInputDate(monthStartDate)
  const monthEnd = formatInputDate(monthEndDate)
  const firstWeek = getTeachingWeekInfoBangkok(monthStart)
  const lastWeek = getTeachingWeekInfoBangkok(monthEnd)
  return {
    monthStart,
    monthEnd,
    expandedStart: firstWeek.weekStart,
    expandedEndExclusive: addDaysToInputDate(lastWeek.weekEnd, 1),
  }
}

function mapClosedSummary(row: ClosedSummaryDbRow): AdminPayrollClosedSummary {
  return {
    ...row,
    threshold_hours: Number(row.threshold_hours),
    group_hours: Number(row.group_hours),
    private_hours: Number(row.private_hours),
    total_hours: Number(row.total_hours),
    regular_hours: Number(row.regular_hours),
    payable_group_hours: Number(row.payable_group_hours),
    payable_private_hours: Number(row.payable_private_hours),
    payable_hours: Number(row.payable_hours),
    private_rate: Number(row.private_rate),
    group_rate: Number(row.group_rate),
    payable_amount: Number(row.payable_amount),
    closed_by_name: row.profiles?.full_name || null,
  }
}

async function loadTeachingRules(supabase: PayrollSupabase) {
  const result = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', COACH_TEACHING_RULES_SETTING_KEY)
    .maybeSingle() as unknown as QueryResult<TeachingRulesSettingRow>
  if (result.error) throw new Error(`Admin payroll teaching rules query failed: ${result.error.message}`)
  return {
    rules: normalizeCoachTeachingRulesSettings(result.data?.value),
    rowCount: result.data ? 1 : 0,
  }
}

async function loadClosedSummaries(
  supabase: PayrollSupabase,
  startDate: string,
  endDateExclusive: string,
  coachId?: string,
) {
  const rows: ClosedSummaryDbRow[] = []
  let expectedCount: number | null = null
  let calls = 0
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from('coach_weekly_teaching_summaries')
      .select(`
        id, coach_id, week_start, week_end, coach_employment_type, threshold_hours,
        group_hours, private_hours, total_hours, regular_hours, payable_group_hours,
        payable_private_hours, payable_hours, private_rate, group_rate, payable_amount,
        payable_session_count, missing_checkin_count, missing_photo_count, status, notes,
        closed_at, closed_by,
        profiles!coach_weekly_teaching_summaries_closed_by_fkey(full_name)
      `, { count: 'exact' })
      .gte('week_start', startDate)
      .lt('week_start', endDateExclusive)
      .order('week_start')
      .order('coach_id')
      .order('id')
    if (coachId) query = query.eq('coach_id', coachId)
    const result = await query.range(from, from + PAGE_SIZE - 1) as unknown as QueryResult<ClosedSummaryDbRow[]>
    calls += 1
    if (result.error) throw new Error(`Admin payroll summaries query failed: ${result.error.message}`)
    if (result.count === null || result.count === undefined) {
      throw new Error('Admin payroll summaries pagination incomplete: exact count unavailable')
    }
    if (expectedCount === null) expectedCount = result.count
    if (result.count !== expectedCount) throw new Error('Admin payroll summaries changed while reading')
    const page = result.data || []
    rows.push(...page)
    if (rows.length === expectedCount) break
    if (page.length === 0 || rows.length > expectedCount) {
      throw new Error(`Admin payroll summaries pagination incomplete: fetched ${rows.length} of ${expectedCount}`)
    }
  }
  if (new Set(rows.map((row) => row.id)).size !== rows.length) {
    throw new Error('Admin payroll summaries pagination returned duplicate rows')
  }
  return { summaries: rows.map(mapClosedSummary), calls }
}

export function buildAdminPayrollSummaries(
  rows: CoachTeachingHourSourceRow[],
  rules: CoachTeachingRules,
  closedSummaries: AdminPayrollClosedSummary[],
) {
  const closedMap = new Map(closedSummaries.map((summary) => [`${summary.coach_id}:${summary.week_start}`, summary]))
  const coachRows = new Map<string, CoachTeachingHourSourceRow[]>()
  rows.forEach((row) => {
    const aggregate = coachRows.get(row.coach_id) || []
    aggregate.push(row)
    coachRows.set(row.coach_id, aggregate)
  })

  const coaches = Array.from(coachRows.entries()).map<AdminPayrollCoachSummary>(([coachId, assignedRows]) => {
    const orderedRows = [...assignedRows].sort((a, b) => (
      `${a.date} ${a.start_time} ${a.schedule_slot_id}`.localeCompare(`${b.date} ${b.start_time} ${b.schedule_slot_id}`)
    ))
    const employmentType = normalizeCoachEmploymentType(orderedRows.find((row) => row.employment_type)?.employment_type)
    const countedRows = orderedRows.filter((row) => row.classification === 'counted')
    const entries = employmentType
      ? calculateTeachingPayEntries(countedRows, getCoachTeachingRule(employmentType, rules))
      : []
    const entryMap = new Map(entries.map((entry) => [entry.row.schedule_slot_id, entry]))
    const weekRows = new Map<string, CoachTeachingHourSourceRow[]>()
    orderedRows.forEach((row) => {
      const week = getTeachingWeekInfoBangkok(row.date)
      const aggregate = weekRows.get(week.weekStart) || []
      aggregate.push(row)
      weekRows.set(week.weekStart, aggregate)
    })

    const weeks = Array.from(weekRows.entries()).map<AdminPayrollWeekSummary>(([weekStart, rowsInWeek]) => {
      const week = getTeachingWeekInfoBangkok(weekStart)
      const weekEntries = rowsInWeek.flatMap((row) => {
        const entry = entryMap.get(row.schedule_slot_id)
        return entry ? [entry] : []
      })
      const issueCounts = createIssueCounts()
      rowsInWeek.forEach((row) => addIssueCounts(issueCounts, getRowIssueCounts(row)))
      const totals = weekEntries.reduce((summary, entry) => {
        summary.total_hours += entry.hours
        summary.regular_hours += entry.regularHours
        summary.payable_hours += entry.payableHours
        summary.payable_amount += entry.payableAmount
        if (entry.isPrivate) {
          summary.private_hours += entry.hours
          summary.payable_private_hours += entry.payableHours
        } else {
          summary.group_hours += entry.hours
          summary.payable_group_hours += entry.payableHours
        }
        return summary
      }, {
        group_hours: 0,
        private_hours: 0,
        total_hours: 0,
        regular_hours: 0,
        payable_group_hours: 0,
        payable_private_hours: 0,
        payable_hours: 0,
        payable_amount: 0,
      })
      return {
        week_start: week.weekStart,
        week_end: week.weekEnd,
        assigned_round_count: rowsInWeek.length,
        countable_round_count: rowsInWeek.filter((row) => row.classification === 'counted').length,
        review_round_count: rowsInWeek.filter((row) => row.classification === 'review').length,
        excluded_round_count: rowsInWeek.filter((row) => row.classification === 'excluded').length,
        ...totals,
        issue_counts: issueCounts,
        closed_summary: closedMap.get(`${coachId}:${week.weekStart}`) || null,
      }
    }).sort((a, b) => a.week_start.localeCompare(b.week_start))

    const issueCounts = createIssueCounts()
    weeks.forEach((week) => addIssueCounts(issueCounts, week.issue_counts))
    return weeks.reduce<AdminPayrollCoachSummary>((summary, week) => {
      summary.assigned_round_count += week.assigned_round_count
      summary.countable_round_count += week.countable_round_count
      summary.review_round_count += week.review_round_count
      summary.excluded_round_count += week.excluded_round_count
      summary.group_hours += week.group_hours
      summary.private_hours += week.private_hours
      summary.total_hours += week.total_hours
      summary.regular_hours += week.regular_hours
      summary.payable_group_hours += week.payable_group_hours
      summary.payable_private_hours += week.payable_private_hours
      summary.payable_hours += week.payable_hours
      summary.payable_amount += week.payable_amount
      return summary
    }, {
      coach_id: coachId,
      coach_name: orderedRows[0]?.coach_name || 'ไม่ทราบชื่อ',
      employment_type: employmentType,
      assigned_round_count: 0,
      countable_round_count: 0,
      review_round_count: 0,
      excluded_round_count: 0,
      group_hours: 0,
      private_hours: 0,
      total_hours: 0,
      regular_hours: 0,
      payable_group_hours: 0,
      payable_private_hours: 0,
      payable_hours: 0,
      payable_amount: 0,
      issue_counts: issueCounts,
      weeks,
    })
  }).sort((a, b) => a.coach_name.localeCompare(b.coach_name, 'th'))

  const totals = coaches.reduce<AdminPayrollMonthTotals>((summary, coach) => {
    summary.assigned_round_count += coach.assigned_round_count
    summary.countable_round_count += coach.countable_round_count
    summary.review_round_count += coach.review_round_count
    summary.excluded_round_count += coach.excluded_round_count
    summary.total_hours += coach.total_hours
    summary.payable_hours += coach.payable_hours
    summary.payable_amount += coach.payable_amount
    return summary
  }, {
    coach_count: coaches.length,
    assigned_round_count: 0,
    countable_round_count: 0,
    review_round_count: 0,
    excluded_round_count: 0,
    total_hours: 0,
    payable_hours: 0,
    payable_amount: 0,
  })
  return { coaches, totals }
}

function mergeMetrics(params: {
  operation: AdminPayrollReadMetrics['operation']
  startedAt: number
  sourceMetrics: Awaited<ReturnType<typeof getCoachTeachingHourSourceRead>>['metrics']
  closedRows: number
  closedCalls: number
  settingsRows: number
  phasesMs: Record<string, number>
  payload: unknown
}) {
  const responseBytes = Buffer.byteLength(JSON.stringify(params.payload), 'utf8')
  return {
    operation: params.operation,
    durationMs: Math.round((performance.now() - params.startedAt) * 10) / 10,
    externalCalls: params.sourceMetrics.externalCalls + params.closedCalls + 1,
    rowsBySource: {
      ...params.sourceMetrics.rowsBySource,
      coach_weekly_teaching_summaries: params.closedRows,
      system_settings: params.settingsRows,
    },
    callsBySource: {
      ...params.sourceMetrics.callsBySource,
      coach_weekly_teaching_summaries: params.closedCalls,
      system_settings: 1,
    },
    phasesMs: {
      ...params.sourceMetrics.phasesMs,
      ...params.phasesMs,
    },
    responseBytes,
  } satisfies AdminPayrollReadMetrics
}

function logReadMetrics(metrics: AdminPayrollReadMetrics) {
  console.info('[admin-payroll-performance]', JSON.stringify(metrics))
}

export async function loadAdminPayrollMonthSummary(
  supabaseClient: unknown,
  year: number,
  month: number,
): Promise<AdminPayrollMonthRead> {
  const startedAt = performance.now()
  const supabase = supabaseClient as PayrollSupabase
  const range = getAdminPayrollMonthRange(year, month)
  const phasesMs: Record<string, number> = {}
  const phase = async <T>(name: string, run: () => Promise<T>) => {
    const phaseStartedAt = performance.now()
    try {
      return await run()
    } finally {
      phasesMs[name] = Math.round((performance.now() - phaseStartedAt) * 10) / 10
    }
  }
  const [sourceRead, teachingRulesRead, closedRead] = await Promise.all([
    phase('source', () => getCoachTeachingHourSourceRead(supabase, {
      startDate: range.expandedStart,
      endDateExclusive: range.expandedEndExclusive,
      includeExcluded: true,
    })),
    phase('rules', () => loadTeachingRules(supabase)),
    phase('closedSummaries', () => loadClosedSummaries(
      supabase,
      range.expandedStart,
      range.expandedEndExclusive,
    )),
  ])
  const summary = buildAdminPayrollSummaries(sourceRead.rows, teachingRulesRead.rules, closedRead.summaries)
  const payload = { year, month, range, coaches: summary.coaches, totals: summary.totals, teachingRules: teachingRulesRead.rules }
  const metrics = mergeMetrics({
    operation: 'admin_payroll_month_summary',
    startedAt,
    sourceMetrics: sourceRead.metrics,
    closedRows: closedRead.summaries.length,
    closedCalls: closedRead.calls,
    settingsRows: teachingRulesRead.rowCount,
    phasesMs,
    payload,
  })
  logReadMetrics(metrics)
  return { ...payload, metrics }
}

export async function loadAdminPayrollCoachWeekDetail(
  supabaseClient: unknown,
  coachId: string,
  weekStart: string,
  weekEnd: string,
): Promise<AdminPayrollCoachWeekDetail> {
  const startedAt = performance.now()
  const supabase = supabaseClient as PayrollSupabase
  const phasesMs: Record<string, number> = {}
  const phase = async <T>(name: string, run: () => Promise<T>) => {
    const phaseStartedAt = performance.now()
    try {
      return await run()
    } finally {
      phasesMs[name] = Math.round((performance.now() - phaseStartedAt) * 10) / 10
    }
  }
  const [sourceRead, teachingRulesRead, closedRead] = await Promise.all([
    phase('source', () => getCoachTeachingHourSourceRead(supabase, {
      startDate: weekStart,
      endDateExclusive: addDaysToInputDate(weekEnd, 1),
      coachId,
      includeExcluded: true,
    })),
    phase('rules', () => loadTeachingRules(supabase)),
    phase('closedSummaries', () => loadClosedSummaries(
      supabase,
      weekStart,
      addDaysToInputDate(weekEnd, 1),
      coachId,
    )),
  ])
  const summary = buildAdminPayrollSummaries(sourceRead.rows, teachingRulesRead.rules, closedRead.summaries)
  const coach = summary.coaches.find((item) => item.coach_id === coachId)
  const week = coach?.weeks.find((item) => item.week_start === weekStart)
  if (!coach || !week) throw new Error('Admin payroll coach/week detail not found')
  const rule = coach.employment_type ? getCoachTeachingRule(coach.employment_type, teachingRulesRead.rules) : null
  const entries = rule
    ? calculateTeachingPayEntries(sourceRead.rows.filter((row) => row.classification === 'counted'), rule)
    : []
  const entryMap = new Map(entries.map((entry) => [entry.row.schedule_slot_id, entry]))
  const rows = sourceRead.rows.map<AdminPayrollDetailRow>((row) => {
    const entry = entryMap.get(row.schedule_slot_id)
    return {
      assignment_id: row.assignment_id,
      assignment_source: row.assignment_source,
      schedule_slot_id: row.schedule_slot_id,
      branch_name: row.branch_name,
      course_type: row.course_type,
      date: row.date,
      start_time: row.start_time,
      end_time: row.end_time,
      checkin_time: row.checkin_time,
      photo_url: row.photo_url,
      location_lat: row.location_lat,
      location_lng: row.location_lng,
      student_count: row.student_count,
      attendance_count: row.attendance_count,
      present_count: row.present_count,
      late_count: row.late_count,
      absent_count: row.absent_count,
      has_checkin: row.has_checkin,
      has_photo: row.has_photo,
      has_location: row.has_location,
      has_attendance: row.has_attendance,
      classification: row.classification,
      classification_reason: row.classification_reason,
      evidence_reasons: row.evidence_reasons,
      hours: entry?.hours || 0,
      regular_hours: entry?.regularHours || 0,
      payable_hours: entry?.payableHours || 0,
      payable_amount: entry?.payableAmount || 0,
    }
  })
  const payload = {
    coach_id: coach.coach_id,
    coach_name: coach.coach_name,
    employment_type: coach.employment_type,
    week,
    rows,
  }
  const metrics = mergeMetrics({
    operation: 'admin_payroll_coach_week_detail',
    startedAt,
    sourceMetrics: sourceRead.metrics,
    closedRows: closedRead.summaries.length,
    closedCalls: closedRead.calls,
    settingsRows: teachingRulesRead.rowCount,
    phasesMs,
    payload,
  })
  logReadMetrics(metrics)
  return { ...payload, metrics }
}
