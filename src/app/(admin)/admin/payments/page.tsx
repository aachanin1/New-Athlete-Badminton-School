import { createClient } from '@/lib/supabase/server'
import { PaymentsClient } from '@/components/admin/payments-client'

export default async function PaymentsPage() {
  const supabase = createClient()

  // Fetch payments with booking + user + branch data
  const { data: payments } = await (supabase
    .from('payments')
    .select(`
      id, booking_id, user_id, amount, method, slip_image_url,
      status, verified_by, verified_at, notes, created_at,
      bookings(month, year, status, total_sessions, branch_id, course_type_id,
        branches(name),
        course_types(name)
      ),
      profiles!payments_user_id_fkey(full_name, email)
    `)
    .order('created_at', { ascending: false }) as any)

  // Fetch verifier names
  const verifierIds = Array.from(new Set((payments || []).map((p: any) => p.verified_by).filter(Boolean))) as string[]
  let verifierMap: Record<string, string> = {}
  if (verifierIds.length > 0) {
    const { data: verifiers } = await (supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', verifierIds) as any)
    verifierMap = (verifiers || []).reduce((m: Record<string, string>, v: any) => {
      m[v.id] = v.full_name
      return m
    }, {})
  }

  // Transform data
  const paymentList = (payments || []).map((p: any) => ({
    id: p.id,
    booking_id: p.booking_id,
    user_id: p.user_id,
    amount: p.amount,
    method: p.method,
    slip_image_url: p.slip_image_url,
    status: p.status,
    verified_by: p.verified_by,
    verified_at: p.verified_at,
    notes: p.notes,
    created_at: p.created_at,
    user_name: p.profiles?.full_name || 'ไม่ทราบ',
    user_email: p.profiles?.email || '',
    booking_month: p.bookings?.month || 0,
    booking_year: p.bookings?.year || 0,
    booking_status: p.bookings?.status || '',
    branch_name: p.bookings?.branches?.name || 'ไม่ทราบ',
    course_type: p.bookings?.course_types?.name || '',
    total_sessions: p.bookings?.total_sessions || 0,
    verified_by_name: p.verified_by ? (verifierMap[p.verified_by] || null) : null,
  }))

  return <PaymentsClient payments={paymentList} />
}
