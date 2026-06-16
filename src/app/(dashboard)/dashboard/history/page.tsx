import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HistoryClient } from '@/components/dashboard/history-client'
import { getServiceRoleClient } from '@/lib/auth/admin'
import {
  PAYMENT_TRANSFER_SETTING_KEY,
  normalizePaymentTransferSettings,
} from '@/lib/payment-settings'
import {
  buildLatestAttendanceRowBySessionStudentKey,
  deriveSessionDisplayStatus,
  getAttendanceSessionStudentKey,
  type AttendanceSessionRow,
  type DisplaySessionStatus,
} from '@/lib/session-attendance-status'

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
  rescheduled_from_id: string | null
  wallet_credit_status: string | null
  wallet_redeemed_session_id: string | null
  wallet_redeemed_at: string | null
  wallet_expired_at: string | null
  wallet_expires_at: string | null
  date: string
  start_time: string
  end_time: string
  branch_id: string
  child_id: string | null
  status: string
  display_status: DisplaySessionStatus | 'rescheduled'
  is_makeup: boolean
  children?: { full_name: string; nickname: string | null } | null
  branches?: { name: string } | null
}

type RawSessionRow = Omit<
  SessionRow,
  | 'display_status'
  | 'wallet_credit_status'
  | 'wallet_redeemed_session_id'
  | 'wallet_redeemed_at'
  | 'wallet_expired_at'
  | 'wallet_expires_at'
>

interface WalletCreditRow {
  original_session_id: string
  redeemed_session_id: string | null
  status: string
  redeemed_at: string | null
  expired_at: string | null
  expires_at: string | null
}

interface AttendanceRow extends AttendanceSessionRow {
  student_id: string
  checked_at: string | null
}

interface WalletCreditQueryResult {
  data: WalletCreditRow[] | null
  error: { message: string } | null
}

interface AttendanceQueryResult {
  data: AttendanceRow[] | null
  error: { message: string } | null
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

const ATTENDANCE_QUERY_CHUNK_SIZE = 100

async function fetchWalletCreditsBySessionIds(
  adminSupabase: ReturnType<typeof getServiceRoleClient>,
  sessionIds: string[],
) {
  const walletCredits: WalletCreditRow[] = []

  for (let index = 0; index < sessionIds.length; index += ATTENDANCE_QUERY_CHUNK_SIZE) {
    const chunk = sessionIds.slice(index, index + ATTENDANCE_QUERY_CHUNK_SIZE)
    const { data, error } = await (adminSupabase
      .from('lesson_wallet_credits')
      .select('original_session_id, redeemed_session_id, status, redeemed_at, expired_at, expires_at')
      .in('original_session_id', chunk) as unknown as Promise<WalletCreditQueryResult>)

    if (error) {
      throw new Error(`Dashboard history wallet credit query failed: ${error.message}`)
    }

    walletCredits.push(...(data || []))
  }

  return walletCredits
}

async function fetchAttendanceRowsBySessionIds(
  adminSupabase: ReturnType<typeof getServiceRoleClient>,
  sessionIds: string[],
) {
  const attendanceRows: AttendanceRow[] = []

  for (let index = 0; index < sessionIds.length; index += ATTENDANCE_QUERY_CHUNK_SIZE) {
    const chunk = sessionIds.slice(index, index + ATTENDANCE_QUERY_CHUNK_SIZE)
    const { data, error } = await (adminSupabase
      .from('attendance')
      .select('booking_session_id, student_id, status, checked_at')
      .in('booking_session_id', chunk)
      .order('checked_at', { ascending: true }) as unknown as Promise<AttendanceQueryResult>)

    if (error) {
      throw new Error(`Dashboard history attendance query failed: ${error.message}`)
    }

    attendanceRows.push(...(data || []))
  }

  return attendanceRows
}

export default async function HistoryPage() {
  const supabase = await createClient()
  const adminSupabase = getServiceRoleClient()
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

  // Fetch only sessions for the bookings visible on this page.
  let rawSessionRows: RawSessionRow[] = []
  if (bookingIds.length > 0) {
    const { data } = await supabase
      .from('booking_sessions')
      .select('id, booking_id, rescheduled_from_id, date, start_time, end_time, branch_id, child_id, status, is_makeup, children(full_name, nickname), branches(name)')
      .in('booking_id', bookingIds)
      .order('date', { ascending: true }) as unknown as { data: RawSessionRow[] | null }
    rawSessionRows = data || []
  }

  const sessionIds = rawSessionRows.map((session) => session.id)
  const walletCreditRows = sessionIds.length > 0
    ? await fetchWalletCreditsBySessionIds(adminSupabase, sessionIds)
    : []
  const walletCreditByOriginalSessionId = new Map(
    walletCreditRows.map((credit) => [credit.original_session_id, credit])
  )
  const attendanceRows = sessionIds.length > 0
    ? await fetchAttendanceRowsBySessionIds(adminSupabase, sessionIds)
    : []
  const latestAttendanceBySessionStudent = buildLatestAttendanceRowBySessionStudentKey(attendanceRows)
  const bookingById = new Map(bookings.map((booking) => [booking.id, booking]))
  const now = new Date()
  const sessionRows: SessionRow[] = rawSessionRows.map((session) => {
    const booking = bookingById.get(session.booking_id)
    const expectedStudentId = session.child_id || booking?.user_id || null
    const attendance = expectedStudentId
      ? latestAttendanceBySessionStudent.get(getAttendanceSessionStudentKey(session.id, expectedStudentId))
      : null
    const walletCredit = walletCreditByOriginalSessionId.get(session.id) || null

    return {
      ...session,
      wallet_credit_status: walletCredit?.status || null,
      wallet_redeemed_session_id: walletCredit?.redeemed_session_id || null,
      wallet_redeemed_at: walletCredit?.redeemed_at || null,
      wallet_expired_at: walletCredit?.expired_at || null,
      wallet_expires_at: walletCredit?.expires_at || null,
      display_status: session.status === 'rescheduled'
        ? 'rescheduled'
        : deriveSessionDisplayStatus({
          status: session.status,
          date: session.date,
          startTime: session.start_time,
          endTime: session.end_time,
          isMakeup: session.is_makeup,
          attendanceStatus: attendance?.status || null,
          now,
        }),
    }
  })

  const activeSessionStatuses = new Set(['scheduled', 'completed', 'absent'])
  const sessionCountMap: Record<string, number> = {}
  const bookingChildNamesMap: Record<string, string[]> = {}
  const bookingSessionsMap: Record<string, SessionRow[]> = {}
  sessionRows.forEach((s) => {
    if (activeSessionStatuses.has(s.status)) {
      sessionCountMap[s.booking_id] = (sessionCountMap[s.booking_id] || 0) + 1
    }
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
