import { createClient } from '@/lib/supabase/server'
import { NotificationsAdminClient } from '@/components/admin/notifications-admin-client'

export default async function AdminNotificationsPage() {
  const supabase = createClient()
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nextMonth = nextDate.getMonth() + 1
  const nextYear = nextDate.getFullYear()
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonth = prevDate.getMonth() + 1
  const prevYear = prevDate.getFullYear()

  const [{ data: notifications }, { data: users }, { data: bookings }, { data: sessions }] = await Promise.all([
    supabase
      .from('notifications')
      .select('id, user_id, title, message, type, is_read, link_url, created_at, profiles!notifications_user_id_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(200) as any,
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name') as any,
    supabase
      .from('bookings')
      .select('id, user_id, total_sessions, month, year, status, profiles!bookings_user_id_fkey(full_name), course_types(name), branches(name)') as any,
    supabase
      .from('booking_sessions')
      .select('id, booking_id, date, start_time, status, branch_id, branches(name), bookings!inner(id, course_types(name), month, year)') as any,
  ])

  const notifList = (notifications || []).map((n: any) => ({
    id: n.id,
    user_id: n.user_id,
    title: n.title,
    message: n.message,
    type: n.type,
    is_read: n.is_read,
    link_url: n.link_url,
    created_at: n.created_at,
    user_name: n.profiles?.full_name || 'ไม่ทราบ',
  }))

  const currentMonthBookings = (bookings || []).filter((booking: any) => booking.month === currentMonth && booking.year === currentYear && ['paid', 'verified'].includes(booking.status))
  const nextMonthUserIds = new Set(
    (bookings || [])
      .filter((booking: any) => booking.month === nextMonth && booking.year === nextYear && ['pending_payment', 'paid', 'verified'].includes(booking.status))
      .map((booking: any) => booking.user_id)
  )

  const currentBookingIds = new Set(currentMonthBookings.map((booking: any) => booking.id))
  const usedSessionCountByBookingId: Record<string, number> = {}
  const futureSessions = (sessions || []).filter((session: any) => session.date >= today && session.status === 'scheduled')

  ;(sessions || []).forEach((session: any) => {
    if (!currentBookingIds.has(session.booking_id)) return
    const sessionDate = session.date
    const isUsed = sessionDate <= today || ['completed', 'rescheduled', 'absent'].includes(session.status)
    if (isUsed) {
      usedSessionCountByBookingId[session.booking_id] = (usedSessionCountByBookingId[session.booking_id] || 0) + 1
    }
  })

  const nonRenewalAlerts = currentMonthBookings
    .filter((booking: any) => !nextMonthUserIds.has(booking.user_id))
    .map((booking: any) => {
      const progress = booking.total_sessions > 0
        ? Math.min(100, Math.round(((usedSessionCountByBookingId[booking.id] || 0) / booking.total_sessions) * 100))
        : 0

      if (progress < 70) return null

      const level = progress >= 85 ? 'red' : progress >= 80 ? 'yellow' : 'green'
      return {
        id: booking.id,
        title: `${booking.profiles?.full_name || 'ผู้ใช้'} ใช้คอร์สไป ${progress}%`,
        description: `ยังไม่พบการจองเดือนถัดไป • ${booking.course_types?.name || '-'} • ${booking.branches?.name || '-'}`,
        level,
        userId: booking.user_id,
        notificationTitle: 'ถึงเวลาวางแผนคอร์สเดือนถัดไปแล้ว',
        notificationMessage: `คุณใช้คอร์สเดือนนี้ไปแล้ว ${progress}% แล้ว หากต้องการเรียนต่อสามารถเข้ามาจองเดือนถัดไปได้เลย`,
        notificationType: 'reminder',
      }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.title.localeCompare(b.title, 'th'))

  const groupedSessionMap = new Map<string, { count: number; branchName: string; courseName: string; date: string; startTime: string }>()
  ;futureSessions.forEach((session: any) => {
    const key = `${session.date}-${session.start_time}-${session.branch_id}-${session.bookings?.course_types?.name || ''}`
    const existing = groupedSessionMap.get(key)
    if (existing) {
      existing.count += 1
    } else {
      groupedSessionMap.set(key, {
        count: 1,
        branchName: session.branches?.name || '-',
        courseName: session.bookings?.course_types?.name || '-',
        date: session.date,
        startTime: session.start_time,
      })
    }
  })

  const lowEnrollmentAlerts = Array.from(groupedSessionMap.entries()).map(([key, item]) => ({
    id: key,
    title: `${item.branchName} • ${item.courseName}`,
    description: `${item.date} ${item.startTime.slice(0, 5)} • มีผู้เรียน ${item.count} คน`,
    level: item.count === 1 ? 'red' : item.count === 2 ? 'yellow' : 'green',
  }))

  const prevMonthUserMap = new Map<string, string>()
  ;(bookings || [])
    .filter((booking: any) => booking.month === prevMonth && booking.year === prevYear && ['paid', 'verified'].includes(booking.status))
    .forEach((booking: any) => {
      if (!prevMonthUserMap.has(booking.user_id)) {
        prevMonthUserMap.set(booking.user_id, booking.profiles?.full_name || 'ผู้ใช้')
      }
    })

  const currentUserIds = new Set(currentMonthBookings.map((booking: any) => booking.user_id))
  const oldBookingUserIds = new Set(
    (bookings || [])
      .filter((booking: any) => {
        const monthKey = booking.year * 12 + booking.month
        const currentKey = currentYear * 12 + currentMonth
        return monthKey <= currentKey - 2 && ['paid', 'verified'].includes(booking.status)
      })
      .map((booking: any) => booking.user_id)
  )

  const customerFollowUpAlerts = [
    ...Array.from(prevMonthUserMap.entries())
      .filter(([userId]) => !currentUserIds.has(userId))
      .map(([userId, fullName]) => ({
        id: `prev-${userId}`,
        title: `${fullName} ไม่ได้ลงเรียนเดือนนี้`,
        description: 'ลูกค้าเดือนก่อนยังไม่กลับมาจอง ควรติดตามกลับมาเรียน',
        level: 'yellow' as const,
        userId,
        notificationTitle: 'คิดถึงนะ กลับมาลงเรียนกันต่อได้เลย',
        notificationMessage: 'เดือนนี้ยังไม่พบการจองของคุณ หากต้องการกลับมาเรียนสามารถเข้าแอปเพื่อเลือกวันเรียนได้ทันที',
        notificationType: 'reminder',
      })),
    ...Array.from(oldBookingUserIds)
      .filter((userId) => !currentUserIds.has(userId as string) && !prevMonthUserMap.has(userId as string))
      .map((userId) => {
        const user = (users || []).find((item: any) => item.id === (userId as string))
        return {
          id: `old-${userId as string}`,
          title: `${user?.full_name || 'ลูกค้าเก่า'} หายไปเกิน 1 เดือน`,
          description: 'เหมาะสำหรับส่งแจ้งเตือนชวนกลับมาเรียนอีกครั้ง',
          level: 'green' as const,
          userId: userId as string,
          notificationTitle: 'กลับมาฝึกแบดด้วยกันอีกครั้งไหม',
          notificationMessage: 'เรามีรอบเรียนพร้อมให้คุณกลับมาฝึกต่อแล้ว สามารถเข้าไปดูตารางและจองได้ทันที',
          notificationType: 'reminder',
        }
      }),
  ]

  return (
    <NotificationsAdminClient
      notifications={notifList}
      users={users || []}
      nonRenewalAlerts={nonRenewalAlerts as any}
      lowEnrollmentAlerts={lowEnrollmentAlerts as any}
      customerFollowUpAlerts={customerFollowUpAlerts as any}
    />
  )
}
