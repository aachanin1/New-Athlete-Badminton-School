import { createClient } from '@/lib/supabase/server'
import { FinanceClient } from '@/components/admin/finance-client'

interface PaymentRow {
  id: string
  amount: number
  status: string
  created_at: string
  bookings?: {
    id: string
    month: number
    year: number
    branch_id: string
    course_type_id: string
    total_sessions: number
    branches?: { name: string | null } | null
    course_types?: { name: string | null } | null
  } | null
  profiles?: { full_name: string | null; email: string | null } | null
}

interface AssignmentRow {
  id: string
  coach_id: string
  schedule_slot_id: string
  profiles?: { full_name: string | null } | null
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

function getYearRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const end = new Date(now.getFullYear() + 1, 0, 1)
  const toInput = (value: Date) => {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return { start: toInput(start), end: toInput(end) }
}

export default async function FinancePage() {
  const supabase = createClient()
  const range = getYearRange()

  const [{ data: payments }, { data: assignments }, { data: checkins }] = await Promise.all([
    supabase
      .from('payments')
      .select(`
        id, amount, status, created_at,
        bookings(id, month, year, branch_id, course_type_id, total_sessions,
          branches(name),
          course_types(name)
        ),
        profiles!payments_user_id_fkey(full_name, email)
      `)
      .in('status', ['pending', 'approved', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(2000) as unknown as PromiseLike<{ data: PaymentRow[] | null }>,
    supabase
      .from('coach_assignments')
      .select(`
        id, coach_id, schedule_slot_id,
        profiles!coach_assignments_coach_id_fkey(full_name),
        schedule_slots!inner(id, branch_id, date, start_time, end_time,
          branches(name),
          course_types(name)
        )
      `)
      .gte('schedule_slots.date', range.start)
      .lt('schedule_slots.date', range.end)
      .limit(2000) as unknown as PromiseLike<{ data: AssignmentRow[] | null }>,
    supabase
      .from('coach_checkins')
      .select('id, coach_id, schedule_slot_id, checkin_time, photo_url')
      .gte('checkin_time', `${range.start}T00:00:00`)
      .lt('checkin_time', `${range.end}T00:00:00`)
      .order('checkin_time', { ascending: false })
      .limit(2000) as unknown as PromiseLike<{ data: CheckinRow[] | null }>,
  ])

  const checkinMap = new Map<string, CheckinRow>()
  ;(checkins || []).forEach((checkin) => {
    const key = `${checkin.coach_id}:${checkin.schedule_slot_id}`
    if (!checkinMap.has(key)) checkinMap.set(key, checkin)
  })

  const paymentList = (payments || []).map((payment) => ({
    id: payment.id,
    amount: Number(payment.amount || 0),
    status: payment.status,
    created_at: payment.created_at,
    payer_name: payment.profiles?.full_name || payment.profiles?.email || 'ไม่ทราบชื่อ',
    branch_name: payment.bookings?.branches?.name || 'ไม่ทราบสาขา',
    course_type: payment.bookings?.course_types?.name || '',
    booking_month: payment.bookings?.month || 0,
    booking_year: payment.bookings?.year || 0,
    total_sessions: payment.bookings?.total_sessions || 0,
  }))

  const payrollRows = (assignments || [])
    .filter((assignment) => assignment.schedule_slots)
    .map((assignment) => {
      const slot = assignment.schedule_slots
      const checkin = checkinMap.get(`${assignment.coach_id}:${assignment.schedule_slot_id}`)

      return {
        assignment_id: assignment.id,
        coach_id: assignment.coach_id,
        coach_name: assignment.profiles?.full_name || 'ไม่ทราบชื่อ',
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
    <FinanceClient
      payments={paymentList}
      payrollRows={payrollRows}
      currentMonth={now.getMonth() + 1}
      currentYear={now.getFullYear()}
    />
  )
}
