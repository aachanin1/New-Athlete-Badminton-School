import { PayrollClient } from '@/components/admin/payroll-client'
import { COACH_TEACHING_RULES_SETTING_KEY, normalizeCoachTeachingRulesSettings } from '@/lib/coach-teaching-rules'
import { getCoachTeachingHourSourceRows } from '@/lib/coach-teaching-hours'
import { createClient } from '@/lib/supabase/server'

interface WeeklySummaryRow {
  id: string
  coach_id: string
  week_start: string
  week_end: string
  coach_employment_type: string
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
  payable_session_count: number
  missing_checkin_count: number
  missing_photo_count: number
  status: string
  notes: string | null
  closed_at: string
  closed_by: string | null
  profiles?: { full_name: string | null } | null
}

interface CoachTeachingRulesSettingRow {
  value: unknown
}

function getYearRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const end = new Date(now.getFullYear() + 1, 0, 1)
  const toInput = (value: Date) => {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return { start: toInput(start), end: toInput(end) }
}

export default async function PayrollPage() {
  const supabase = createClient()
  const range = getYearRange()

  const [{ data: summaries }, { data: teachingRulesSetting }, payrollRows] = await Promise.all([
    supabase
      .from('coach_weekly_teaching_summaries')
      .select(`
        id, coach_id, week_start, week_end, coach_employment_type, threshold_hours,
        group_hours, private_hours, total_hours, regular_hours, payable_group_hours,
        payable_private_hours, payable_hours, private_rate, group_rate, payable_amount,
        payable_session_count, missing_checkin_count, missing_photo_count, status, notes,
        closed_at, closed_by,
        profiles!coach_weekly_teaching_summaries_closed_by_fkey(full_name)
      `)
      .gte('week_start', range.start)
      .lt('week_start', range.end)
      .order('week_start', { ascending: false }) as unknown as PromiseLike<{ data: WeeklySummaryRow[] | null }>,
    supabase
      .from('system_settings')
      .select('value')
      .eq('key', COACH_TEACHING_RULES_SETTING_KEY)
      .maybeSingle() as unknown as PromiseLike<{ data: CoachTeachingRulesSettingRow | null }>,
    getCoachTeachingHourSourceRows(supabase, {
      startDate: range.start,
      endDateExclusive: range.end,
    }),
  ])

  const now = new Date()
  return (
    <PayrollClient
      rows={payrollRows}
      currentMonth={now.getMonth() + 1}
      currentYear={now.getFullYear()}
      teachingRules={normalizeCoachTeachingRulesSettings(teachingRulesSetting?.value)}
      summaries={(summaries || []).map((summary) => ({
        id: summary.id,
        coach_id: summary.coach_id,
        week_start: summary.week_start,
        week_end: summary.week_end,
        coach_employment_type: summary.coach_employment_type,
        threshold_hours: Number(summary.threshold_hours),
        group_hours: Number(summary.group_hours),
        private_hours: Number(summary.private_hours),
        total_hours: Number(summary.total_hours),
        regular_hours: Number(summary.regular_hours),
        payable_group_hours: Number(summary.payable_group_hours),
        payable_private_hours: Number(summary.payable_private_hours),
        payable_hours: Number(summary.payable_hours),
        private_rate: Number(summary.private_rate),
        group_rate: Number(summary.group_rate),
        payable_amount: Number(summary.payable_amount),
        payable_session_count: summary.payable_session_count,
        missing_checkin_count: summary.missing_checkin_count,
        missing_photo_count: summary.missing_photo_count,
        status: summary.status,
        notes: summary.notes,
        closed_at: summary.closed_at,
        closed_by: summary.closed_by,
        closed_by_name: summary.profiles?.full_name || null,
      }))}
    />
  )
}
