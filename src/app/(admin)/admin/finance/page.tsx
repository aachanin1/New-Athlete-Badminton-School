import { createClient } from '@/lib/supabase/server'
import { FinanceClient } from '@/components/admin/finance-client'

export default async function FinancePage() {
  const supabase = createClient()

  const { data: payments } = await (supabase
    .from('payments')
    .select(`
      id, amount, status, created_at,
      bookings(month, year, branch_id, course_type_id,
        branches(name),
        course_types(name)
      )
    `)
    .eq('status', 'approved')
    .order('created_at', { ascending: false }) as any)

  const paymentList = (payments || []).map((p: any) => ({
    id: p.id,
    amount: p.amount,
    status: p.status,
    created_at: p.created_at,
    branch_name: p.bookings?.branches?.name || 'ไม่ทราบ',
    course_type: p.bookings?.course_types?.name || '',
    booking_month: p.bookings?.month || 0,
    booking_year: p.bookings?.year || 0,
  }))

  const now = new Date()
  return <FinanceClient payments={paymentList} currentMonth={now.getMonth() + 1} currentYear={now.getFullYear()} />
}
