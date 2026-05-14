import { createClient } from '@/lib/supabase/server'
import { PayrollClient } from '@/components/admin/payroll-client'

interface AssignmentRow {
  id: string
  coach_id: string
  schedule_slot_id: string
  profiles?: {
    full_name: string | null
    coach_employment_type: string | null
  } | null
  schedule_slots?: {
    id: string
    branch_id: string
    date: string
    start_time: string
    end_time: string
    branches?: { name: string | null } | null
    course_types?: { name: string | null } | null
  } | null
}

interface CheckinRow {
  id: string
  coach_id: string
  schedule_slot_id: string
  checkin_time: string
  photo_url: string | null
}

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

  const [{ data: assignments }, { data: checkins }, { data: summaries }] = await Promise.all([
    supabase
      .from('coach_assignments')
      .select(`
        id, coach_id, schedule_slot_id,
        profiles!coach_assignments_coach_id_fkey(full_name, coach_employment_type),
        schedule_slots!inner(id, branch_id, date, start_time, end_time,
          branches(name),
          course_types(name)
        )
      `)
      .gte('schedule_slots.date', range.start)
      .lt('schedule_slots.date', range.end)
      .limit(3000) as unknown as PromiseLike<{ data: AssignmentRow[] | null }>,
    supabase
      .from('coach_checkins')
      .select('id, coach_id, schedule_slot_id, checkin_time, photo_url')
      .gte('checkin_time', `${range.start}T00:00:00`)
      .lt('checkin_time', `${range.end}T00:00:00`)
      .order('checkin_time', { ascending: false })
      .limit(3000) as unknown as PromiseLike<{ data: CheckinRow[] | null }>,
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
  ])

  const checkinMap = new Map<string, CheckinRow>()
  ;(checkins || []).forEach((checkin) => {
    const key = `${checkin.coach_id}:${checkin.schedule_slot_id}`
    if (!checkinMap.has(key)) checkinMap.set(key, checkin)
  })

  const payrollRows = (assignments || [])
    .filter((assignment) => assignment.schedule_slots)
    .map((assignment) => {
      const slot = assignment.schedule_slots
      const checkin = checkinMap.get(`${assignment.coach_id}:${assignment.schedule_slot_id}`)

      return {
        assignment_id: assignment.id,
        coach_id: assignment.coach_id,
        coach_name: assignment.profiles?.full_name || 'ไม่ทราบชื่อ',
        employment_type: assignment.profiles?.coach_employment_type || null,
        schedule_slot_id: assignment.schedule_slot_id,
        branch_name: slot?.branches?.name || 'ไม่ทราบสาขา',
        course_type: slot?.course_types?.name || '',
        date: slot?.date || '',
        start_time: slot?.start_time || '',
        end_time: slot?.end_time || '',
        checkin_id: checkin?.id || null,
        checkin_time: checkin?.checkin_time || null,
        photo_url: checkin?.photo_url || null,
      }
    })

  const now = new Date()
  return (
    <PayrollClient
      rows={payrollRows}
      currentMonth={now.getMonth() + 1}
      currentYear={now.getFullYear()}
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
