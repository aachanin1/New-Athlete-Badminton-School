import { createClient } from '@/lib/supabase/server'
import { FinanceClient } from '@/components/admin/finance-client'

interface PaymentRow {
  id: string
  amount: number | string
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

interface ExpenseRow {
  id: string
  expense_date: string
  category: string
  description: string | null
  amount: number | string
  branch_id: string | null
  created_at: string
  branches?: { name: string | null } | null
  profiles?: { full_name: string | null; email: string | null } | null
}

interface BranchOptionRow {
  id: string
  name: string | null
}

interface WeeklyTeachingSummaryRow {
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
  payable_amount: number | string
  payable_session_count: number
  missing_checkin_count: number
  missing_photo_count: number
  status: string
  notes: string | null
  closed_at: string
  profiles?: { full_name: string | null; email: string | null } | null
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

  const [
    { data: payments },
    { data: coachSummaries },
    { data: expenses },
    { data: branches },
  ] = await Promise.all([
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
      .from('coach_weekly_teaching_summaries')
      .select(`
        id, coach_id, week_start, week_end, coach_employment_type, threshold_hours,
        group_hours, private_hours, total_hours, regular_hours, payable_group_hours,
        payable_private_hours, payable_hours, payable_amount, payable_session_count,
        missing_checkin_count, missing_photo_count, status, notes, closed_at,
        profiles!coach_weekly_teaching_summaries_coach_id_fkey(full_name, email)
      `)
      .gte('week_start', range.start)
      .lt('week_start', range.end)
      .order('week_start', { ascending: false })
      .limit(2000) as unknown as PromiseLike<{ data: WeeklyTeachingSummaryRow[] | null }>,
    supabase
      .from('finance_expenses')
      .select(`
        id, expense_date, category, description, amount, branch_id, created_at,
        branches(name),
        profiles!finance_expenses_created_by_fkey(full_name, email)
      `)
      .gte('expense_date', range.start)
      .lt('expense_date', range.end)
      .order('expense_date', { ascending: false })
      .limit(2000) as unknown as PromiseLike<{ data: ExpenseRow[] | null }>,
    supabase
      .from('branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name') as unknown as PromiseLike<{ data: BranchOptionRow[] | null }>,
  ])

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

  const coachSummaryList = (coachSummaries || []).map((summary) => ({
    id: summary.id,
    coach_id: summary.coach_id,
    coach_name: summary.profiles?.full_name || summary.profiles?.email || 'ไม่ทราบชื่อ',
    week_start: summary.week_start,
    week_end: summary.week_end,
    employment_type: summary.coach_employment_type,
    threshold_hours: Number(summary.threshold_hours || 0),
    group_hours: Number(summary.group_hours || 0),
    private_hours: Number(summary.private_hours || 0),
    total_hours: Number(summary.total_hours || 0),
    regular_hours: Number(summary.regular_hours || 0),
    payable_group_hours: Number(summary.payable_group_hours || 0),
    payable_private_hours: Number(summary.payable_private_hours || 0),
    payable_hours: Number(summary.payable_hours || 0),
    payable_amount: Number(summary.payable_amount || 0),
    payable_session_count: summary.payable_session_count || 0,
    missing_checkin_count: summary.missing_checkin_count || 0,
    missing_photo_count: summary.missing_photo_count || 0,
    status: summary.status,
    notes: summary.notes,
    closed_at: summary.closed_at,
  }))

  const expenseList = (expenses || []).map((expense) => ({
    id: expense.id,
    expense_date: expense.expense_date,
    category: expense.category,
    description: expense.description || '',
    amount: Number(expense.amount || 0),
    branch_id: expense.branch_id,
    branch_name: expense.branches?.name || '',
    created_at: expense.created_at,
    created_by_name: expense.profiles?.full_name || expense.profiles?.email || '',
  }))

  const branchOptions = (branches || []).map((branch) => ({
    id: branch.id,
    name: branch.name || 'ไม่ทราบสาขา',
  }))

  const now = new Date()
  return (
    <FinanceClient
      payments={paymentList}
      coachSummaries={coachSummaryList}
      expenses={expenseList}
      branches={branchOptions}
      currentMonth={now.getMonth() + 1}
      currentYear={now.getFullYear()}
    />
  )
}
