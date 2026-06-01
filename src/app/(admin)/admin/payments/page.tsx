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

interface IncompleteBookingRow {
  id: string
  user_id: string
  child_id: string | null
  learner_type: string | null
  month: number | null
  year: number | null
  total_sessions: number | null
  total_price: number | null
  status: string | null
  created_at: string
  branches?: { name: string | null } | null
  course_types?: { name: string | null } | null
  children?: { full_name: string | null; nickname: string | null } | null
  profiles?: { full_name: string | null; email: string | null; phone: string | null } | null
  payments?: {
    id: string
    status: PaymentStatus | string | null
    slip_image_url: string | null
    created_at: string | null
  }[] | null
}

export default async function PaymentsPage() {
  const supabase = await createClient()

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

  const { data: incompleteBookings } = await supabase
    .from('bookings')
    .select(`
      id,
      user_id,
      child_id,
      learner_type,
      month,
      year,
      total_sessions,
      total_price,
      status,
      created_at,
      branches(name),
      course_types(name),
      children(full_name, nickname),
      profiles!bookings_user_id_fkey(full_name, email, phone),
      payments(id, status, slip_image_url, created_at)
    `)
    .in('status', ['pending_payment', 'paid'])
    .order('created_at', { ascending: false }) as unknown as { data: IncompleteBookingRow[] | null }

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

  const incompleteBookingList = (incompleteBookings || []).map((booking) => {
    const latestPayment = [...(booking.payments || [])].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
      return bTime - aTime
    })[0] || null

    return {
      id: booking.id,
      user_id: booking.user_id,
      user_name: booking.profiles?.full_name || 'ไม่ทราบ',
      user_email: booking.profiles?.email || '',
      user_phone: booking.profiles?.phone || '',
      learner_name: booking.children?.nickname || booking.children?.full_name || (booking.learner_type === 'self' ? 'ผู้เรียนเอง' : 'ไม่ทราบผู้เรียน'),
      branch_name: booking.branches?.name || 'ไม่ทราบ',
      course_type: booking.course_types?.name || '',
      month: booking.month || 0,
      year: booking.year || 0,
      total_sessions: booking.total_sessions || 0,
      total_price: booking.total_price || 0,
      status: booking.status || '',
      created_at: booking.created_at,
      latest_payment_id: latestPayment?.id || null,
      latest_payment_status: latestPayment?.status || null,
      has_slip: Boolean(latestPayment?.slip_image_url),
    }
  })

  return (
    <PaymentsClient
      payments={paymentList}
      incompleteBookings={incompleteBookingList}
      paymentTransferSettings={normalizePaymentTransferSettings(paymentSetting?.value)}
      slipOkMode={process.env.SLIPOK_TEST_MODE === 'true' ? 'test' : 'live'}
    />
  )
}
