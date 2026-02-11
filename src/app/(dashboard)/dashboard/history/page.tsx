import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HistoryClient } from '@/components/dashboard/history-client'

export default async function HistoryPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Check if user is admin/super_admin
  const { data: profile } = await (supabase
    .from('profiles') as any)
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

  // Admin sees all bookings, user sees only own
  let bookingsQuery = (supabase.from('bookings') as any)
    .select('*, branches(name), children(full_name, nickname), course_types(name), profiles!bookings_user_id_fkey(full_name, email)')

  if (!isAdmin) {
    bookingsQuery = bookingsQuery.eq('user_id', user.id)
  }

  const { data: bookings } = await bookingsQuery.order('created_at', { ascending: false })

  // Same for payments
  let paymentsQuery = (supabase.from('payments') as any).select('*')
  if (!isAdmin) {
    paymentsQuery = paymentsQuery.eq('user_id', user.id)
  }
  const { data: payments } = await paymentsQuery.order('created_at', { ascending: false })

  // Fetch all sessions per booking (with child names, branch names)
  const { data: sessionRows } = await (supabase
    .from('booking_sessions') as any)
    .select('id, booking_id, date, start_time, end_time, branch_id, child_id, status, is_makeup, children(full_name, nickname), branches(name)')
    .order('date', { ascending: true })

  const sessionCountMap: Record<string, number> = {}
  const bookingChildNamesMap: Record<string, string[]> = {}
  const bookingSessionsMap: Record<string, any[]> = {}
  ;(sessionRows || []).forEach((s: any) => {
    sessionCountMap[s.booking_id] = (sessionCountMap[s.booking_id] || 0) + 1
    if (s.children?.full_name && !bookingChildNamesMap[s.booking_id]?.includes(s.children.full_name)) {
      if (!bookingChildNamesMap[s.booking_id]) bookingChildNamesMap[s.booking_id] = []
      bookingChildNamesMap[s.booking_id].push(s.children.full_name)
    }
    if (!bookingSessionsMap[s.booking_id]) bookingSessionsMap[s.booking_id] = []
    bookingSessionsMap[s.booking_id].push(s)
  })

  // Fetch branches for date picker
  const { data: branches } = await (supabase.from('branches') as any).select('id, name')

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
        bookings={bookings || []}
        payments={payments || []}
        userId={user.id}
        isAdmin={isAdmin}
        sessionCountMap={sessionCountMap}
        bookingChildNamesMap={bookingChildNamesMap}
        bookingSessionsMap={bookingSessionsMap}
        branches={branches || []}
      />
    </div>
  )
}
