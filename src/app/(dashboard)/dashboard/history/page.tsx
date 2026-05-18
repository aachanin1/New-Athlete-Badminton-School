import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HistoryClient } from '@/components/dashboard/history-client'
import {
  PAYMENT_TRANSFER_SETTING_KEY,
  normalizePaymentTransferSettings,
} from '@/lib/payment-settings'

interface HistoryBookingRow {
  id: string
  user_id: string
  learner_type: string
  child_id: string | null
  branch_id: string
  course_type_id: string
  month: number
  year: number
  total_sessions: number
  total_price: number
  status: string
  created_at: string
  branches?: { name: string } | null
  children?: { full_name: string; nickname: string | null } | null
  course_types?: { name: string } | null
  profiles?: { full_name: string; email: string } | null
}

interface ProfileRow {
  role: string
}

interface PaymentRow {
  id: string
  booking_id: string
  user_id: string
  amount: number
  method: string
  slip_image_url: string | null
  status: string
  verified_by: string | null
  verified_at: string | null
  notes: string | null
  created_at: string
}

interface SessionRow {
  id: string
  booking_id: string
  date: string
  start_time: string
  end_time: string
  branch_id: string
  child_id: string | null
  status: string
  is_makeup: boolean
  children?: { full_name: string; nickname: string | null } | null
  branches?: { name: string } | null
}

interface CouponUsageRow {
  id: string
  coupon_id: string
  booking_id: string
  discount_amount: number
  used_at: string
  coupons?: {
    code: string
    discount_type: string
    discount_value: number
  } | null
}

export default async function HistoryPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Check if user is admin/super_admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as unknown as { data: ProfileRow | null }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

  // Admin sees all bookings, user sees only own
  const bookingsResult = isAdmin
    ? await supabase
      .from('bookings')
      .select('*, branches(name), children(full_name, nickname), course_types(name), profiles!bookings_user_id_fkey(full_name, email)')
      .order('created_at', { ascending: false }) as unknown as { data: HistoryBookingRow[] | null }
    : await supabase
      .from('bookings')
      .select('*, branches(name), children(full_name, nickname), course_types(name), profiles!bookings_user_id_fkey(full_name, email)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }) as unknown as { data: HistoryBookingRow[] | null }

  const bookings = bookingsResult.data || []

  // Same for payments
  const paymentsResult = isAdmin
    ? await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false }) as unknown as { data: PaymentRow[] | null }
    : await supabase
      .from('payments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }) as unknown as { data: PaymentRow[] | null }

  const payments = paymentsResult.data || []

  const { data: paymentSetting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', PAYMENT_TRANSFER_SETTING_KEY)
    .maybeSingle() as unknown as { data: { value: unknown } | null }

  const bookingIds = bookings.map((booking) => booking.id)
  let couponUsageMap: Record<string, CouponUsageRow[]> = {}

  if (bookingIds.length > 0) {
    const { data: couponUsages } = await supabase
      .from('coupon_usages')
      .select('id, coupon_id, booking_id, discount_amount, used_at, coupons(code, discount_type, discount_value)')
      .in('booking_id', bookingIds)
      .order('used_at', { ascending: false }) as unknown as { data: CouponUsageRow[] | null }

    couponUsageMap = (couponUsages || []).reduce<Record<string, CouponUsageRow[]>>((map, usage) => {
      if (!map[usage.booking_id]) map[usage.booking_id] = []
      map[usage.booking_id].push(usage)
      return map
    }, {})
  }

  // Fetch all sessions per booking (with child names, branch names)
  const { data: sessionRows } = await supabase
    .from('booking_sessions')
    .select('id, booking_id, date, start_time, end_time, branch_id, child_id, status, is_makeup, children(full_name, nickname), branches(name)')
    .order('date', { ascending: true }) as unknown as { data: SessionRow[] | null }

  const sessionCountMap: Record<string, number> = {}
  const bookingChildNamesMap: Record<string, string[]> = {}
  const bookingSessionsMap: Record<string, SessionRow[]> = {}
  ;(sessionRows || []).forEach((s) => {
    sessionCountMap[s.booking_id] = (sessionCountMap[s.booking_id] || 0) + 1
    if (s.children?.full_name && !bookingChildNamesMap[s.booking_id]?.includes(s.children.full_name)) {
      if (!bookingChildNamesMap[s.booking_id]) bookingChildNamesMap[s.booking_id] = []
      bookingChildNamesMap[s.booking_id].push(s.children.full_name)
    }
    if (!bookingSessionsMap[s.booking_id]) bookingSessionsMap[s.booking_id] = []
    bookingSessionsMap[s.booking_id].push(s)
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">
          {isAdmin ? 'จัดการการจอง (Admin)' : 'ประวัติการจอง'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {isAdmin ? 'ดูและอนุมัติการจองทั้งหมด' : 'ดูประวัติการจองและการชำระเงินทั้งหมด'}
        </p>
      </div>
      <HistoryClient
        bookings={bookings}
        payments={payments}
        userId={user.id}
        isAdmin={isAdmin}
        sessionCountMap={sessionCountMap}
        bookingChildNamesMap={bookingChildNamesMap}
        bookingSessionsMap={bookingSessionsMap}
        couponUsageMap={couponUsageMap}
        paymentTransferSettings={normalizePaymentTransferSettings(paymentSetting?.value)}
      />
    </div>
  )
}
