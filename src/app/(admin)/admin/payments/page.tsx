import { createClient } from '@/lib/supabase/server'
import { PaymentsClient } from '@/components/admin/payments-client'
import {
  PAYMENT_TRANSFER_SETTING_KEY,
  normalizePaymentTransferSettings,
} from '@/lib/payment-settings'

type PaymentStatus = 'pending' | 'approved' | 'rejected'

interface PaymentRow {
  id: string
  booking_id: string
  user_id: string
  amount: number
  method: string
  slip_image_url: string | null
  status: PaymentStatus
  verified_by: string | null
  verified_at: string | null
  notes: string | null
  created_at: string
  bookings?: {
    month: number | null
    year: number | null
    status: string | null
    total_sessions: number | null
    branch_id: string | null
    course_type_id: string | null
    branches?: { name: string | null } | null
    course_types?: { name: string | null } | null
  } | null
  profiles?: { full_name: string | null; email: string | null } | null
}

interface VerifierRow {
  id: string
  full_name: string | null
}

export default async function PaymentsPage() {
  const supabase = createClient()

  // Fetch payments with booking + user + branch data
  const { data: payments } = await supabase
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
    .order('created_at', { ascending: false }) as unknown as { data: PaymentRow[] | null }

  // Fetch verifier names
  const verifierIds = Array.from(new Set((payments || []).map((p) => p.verified_by).filter(Boolean))) as string[]
  let verifierMap: Record<string, string> = {}
  if (verifierIds.length > 0) {
    const { data: verifiers } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', verifierIds) as unknown as { data: VerifierRow[] | null }
    verifierMap = (verifiers || []).reduce((m: Record<string, string>, v) => {
      m[v.id] = v.full_name || ''
      return m
    }, {})
  }

  const { data: paymentSetting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', PAYMENT_TRANSFER_SETTING_KEY)
    .maybeSingle() as unknown as { data: { value: unknown } | null }

  // Transform data
  const paymentList = (payments || []).map((p) => ({
    id: p.id,
    booking_id: p.booking_id,
    user_id: p.user_id,
    amount: p.amount,
    method: p.method,
    slip_image_url: p.slip_image_url,
    status: ['pending', 'approved', 'rejected'].includes(p.status) ? p.status : 'pending',
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

  return (
    <PaymentsClient
      payments={paymentList}
      paymentTransferSettings={normalizePaymentTransferSettings(paymentSetting?.value)}
    />
  )
}
