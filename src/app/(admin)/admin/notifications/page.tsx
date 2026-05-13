import { NotificationsAdminClient } from '@/components/admin/notifications-admin-client'
import { requireAdminPageAccess } from '@/lib/auth/admin'
import type { UserRole } from '@/types/database'

type AlertLevel = 'red' | 'yellow' | 'green'

interface NotificationRow {
  id: string
  user_id: string
  title: string
  message: string
  type: string
  is_read: boolean
  link_url: string | null
  created_at: string
  profiles?: { full_name: string | null; email: string | null; role: UserRole | null } | null
}

interface UserRow {
  id: string
  full_name: string | null
  email: string | null
  role: UserRole
}

interface BookingRow {
  id: string
  user_id: string
  total_sessions: number
  month: number
  year: number
  status: string
  profiles?: { full_name: string | null } | null
  course_types?: { name: string | null } | null
  branches?: { name: string | null } | null
}

interface SessionRow {
  id: string
  booking_id: string
  date: string
  start_time: string
  status: string
  branch_id: string
  branches?: { name: string | null } | null
  bookings?: { id: string; course_types?: { name: string | null } | null; month: number; year: number } | null
}

interface PaymentRow {
  id: string
  amount: number
  status: string
  created_at: string
  profiles?: { full_name: string | null } | null
}

interface ComplaintRow {
  id: string
  subject: string
  status: string
  created_at: string
  profiles?: { full_name: string | null } | null
}

interface AssignmentRow {
  id: string
  coach_id: string
  schedule_slot_id: string
  profiles?: { full_name: string | null } | null
  schedule_slots?: {
    id: string
    date: string
    start_time: string
    end_time: string
    branches?: { name: string | null } | null
  } | null
}

interface CheckinRow {
  coach_id: string
  schedule_slot_id: string
}

interface AlertInsight {
  id: string
  title: string
  description: string
  level: AlertLevel
  userId?: string
  notificationTitle?: string
  notificationMessage?: string
  notificationType?: string
  linkUrl?: string
}

interface AdminActionAlert {
  id: string
  title: string
  description: string
  tone: 'red' | 'amber' | 'blue' | 'green'
  href: string
  actionLabel: string
}

function formatInputDate(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const date = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${date}`
}

function getCourseLabel(courseName: string | null | undefined) {
  const labels: Record<string, string> = {
    kids_group: 'เด็กกลุ่ม',
    adult_group: 'ผู้ใหญ่กลุ่ม',
    private: 'ส่วนตัว',
  }
  return courseName ? labels[courseName] || courseName : '-'
}

export default async function AdminNotificationsPage() {
  const { supabase, user } = await requireAdminPageAccess()
  const now = new Date()
  const today = formatInputDate(now)
  const tomorrow = formatInputDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nextMonth = nextDate.getMonth() + 1
  const nextYear = nextDate.getFullYear()
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonth = prevDate.getMonth() + 1
  const prevYear = prevDate.getFullYear()

  const [
    { data: notifications },
    { data: users },
    { data: bookings },
    { data: sessions },
    { data: pendingPayments },
    { data: complaints },
    { data: todayAssignments },
    { data: todayCheckins },
  ] = await Promise.all([
    supabase
      .from('notifications')
      .select('id, user_id, title, message, type, is_read, link_url, created_at, profiles!notifications_user_id_fkey(full_name, email, role)')
      .order('created_at', { ascending: false })
      .limit(300) as unknown as Promise<{ data: NotificationRow[] | null }>,
    supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .order('full_name') as unknown as Promise<{ data: UserRow[] | null }>,
    supabase
      .from('bookings')
      .select('id, user_id, total_sessions, month, year, status, profiles!bookings_user_id_fkey(full_name), course_types(name), branches(name)')
      .limit(1200) as unknown as Promise<{ data: BookingRow[] | null }>,
    supabase
      .from('booking_sessions')
      .select('id, booking_id, date, start_time, status, branch_id, branches(name), bookings!inner(id, course_types(name), month, year)')
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(700) as unknown as Promise<{ data: SessionRow[] | null }>,
    supabase
      .from('payments')
      .select('id, amount, status, created_at, profiles!payments_user_id_fkey(full_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50) as unknown as Promise<{ data: PaymentRow[] | null }>,
    supabase
      .from('complaints')
      .select('id, subject, status, created_at, profiles!complaints_user_id_fkey(full_name)')
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(50) as unknown as Promise<{ data: ComplaintRow[] | null }>,
    supabase
      .from('coach_assignments')
      .select(`
        id, coach_id, schedule_slot_id,
        profiles!coach_assignments_coach_id_fkey(full_name),
        schedule_slots!inner(id, date, start_time, end_time, branches(name))
      `)
      .eq('schedule_slots.date', today)
      .limit(200) as unknown as Promise<{ data: AssignmentRow[] | null }>,
    supabase
      .from('coach_checkins')
      .select('coach_id, schedule_slot_id')
      .gte('checkin_time', `${today}T00:00:00`)
      .lt('checkin_time', `${tomorrow}T00:00:00`)
      .limit(200) as unknown as Promise<{ data: CheckinRow[] | null }>,
  ])

  const notificationList = (notifications || []).map((notification) => ({
    id: notification.id,
    user_id: notification.user_id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    is_read: notification.is_read,
    link_url: notification.link_url,
    created_at: notification.created_at,
    recipient_name: notification.profiles?.full_name || 'ไม่ทราบชื่อ',
    recipient_email: notification.profiles?.email || '',
    recipient_role: notification.profiles?.role || 'user',
    is_admin_inbox: notification.user_id === user.id,
  }))

  const adminInbox = notificationList.filter((notification) => notification.is_admin_inbox)
  const unreadAdminInbox = adminInbox.filter((notification) => !notification.is_read)

  const currentMonthBookings = (bookings || []).filter((booking) => (
    booking.month === currentMonth
    && booking.year === currentYear
    && ['paid', 'verified'].includes(booking.status)
  ))
  const nextMonthUserIds = new Set(
    (bookings || [])
      .filter((booking) => (
        booking.month === nextMonth
        && booking.year === nextYear
        && ['pending_payment', 'paid', 'verified'].includes(booking.status)
      ))
      .map((booking) => booking.user_id)
  )

  const currentBookingIds = new Set(currentMonthBookings.map((booking) => booking.id))
  const usedSessionCountByBookingId: Record<string, number> = {}
  ;(sessions || []).forEach((session) => {
    if (!currentBookingIds.has(session.booking_id)) return
    const isUsed = session.date <= today || ['completed', 'rescheduled', 'absent'].includes(session.status)
    if (isUsed) {
      usedSessionCountByBookingId[session.booking_id] = (usedSessionCountByBookingId[session.booking_id] || 0) + 1
    }
  })

  const nonRenewalAlerts = currentMonthBookings
    .filter((booking) => !nextMonthUserIds.has(booking.user_id))
    .map((booking): AlertInsight | null => {
      const progress = booking.total_sessions > 0
        ? Math.min(100, Math.round(((usedSessionCountByBookingId[booking.id] || 0) / booking.total_sessions) * 100))
        : 0

      if (progress < 70) return null

      const level = progress >= 85 ? 'red' : progress >= 80 ? 'yellow' : 'green'
      return {
        id: booking.id,
        title: `${booking.profiles?.full_name || 'ผู้เรียน'} ใช้คอร์สไป ${progress}%`,
        description: `ยังไม่พบการจองเดือนถัดไป · ${getCourseLabel(booking.course_types?.name)} · ${booking.branches?.name || '-'}`,
        level,
        userId: booking.user_id,
        notificationTitle: 'ถึงเวลาวางแผนคอร์สเดือนถัดไปแล้ว',
        notificationMessage: `คุณใช้คอร์สเดือนนี้ไปแล้ว ${progress}% หากต้องการเรียนต่อสามารถเข้ามาจองเดือนถัดไปได้เลย`,
        notificationType: 'reminder',
        linkUrl: '/dashboard/booking',
      }
    })
    .filter((alert): alert is AlertInsight => Boolean(alert))
    .sort((a, b) => a.title.localeCompare(b.title, 'th'))

  const groupedSessionMap = new Map<string, { count: number; branchName: string; courseName: string; date: string; startTime: string }>()
  ;(sessions || [])
    .filter((session) => session.status === 'scheduled')
    .forEach((session) => {
      const key = `${session.date}-${session.start_time}-${session.branch_id}-${session.bookings?.course_types?.name || ''}`
      const existing = groupedSessionMap.get(key)
      if (existing) {
        existing.count += 1
      } else {
        groupedSessionMap.set(key, {
          count: 1,
          branchName: session.branches?.name || '-',
          courseName: getCourseLabel(session.bookings?.course_types?.name),
          date: session.date,
          startTime: session.start_time,
        })
      }
    })

  const lowEnrollmentAlerts: AlertInsight[] = Array.from(groupedSessionMap.entries())
    .filter(([, item]) => item.count <= 2)
    .map(([key, item]) => ({
      id: key,
      title: `${item.branchName} · ${item.courseName}`,
      description: `${item.date} ${item.startTime.slice(0, 5)} · มีผู้เรียน ${item.count} คน`,
      level: item.count === 1 ? 'red' as const : 'yellow' as const,
    }))
    .slice(0, 20)

  const prevMonthUserMap = new Map<string, string>()
  ;(bookings || [])
    .filter((booking) => booking.month === prevMonth && booking.year === prevYear && ['paid', 'verified'].includes(booking.status))
    .forEach((booking) => {
      if (!prevMonthUserMap.has(booking.user_id)) {
        prevMonthUserMap.set(booking.user_id, booking.profiles?.full_name || 'ผู้เรียน')
      }
    })

  const currentUserIds = new Set(currentMonthBookings.map((booking) => booking.user_id))
  const oldBookingUserIds = new Set(
    (bookings || [])
      .filter((booking) => {
        const monthKey = booking.year * 12 + booking.month
        const currentKey = currentYear * 12 + currentMonth
        return monthKey <= currentKey - 2 && ['paid', 'verified'].includes(booking.status)
      })
      .map((booking) => booking.user_id)
  )

  const customerFollowUpAlerts = [
    ...Array.from(prevMonthUserMap.entries())
      .filter(([userId]) => !currentUserIds.has(userId))
      .map(([userId, fullName]) => ({
        id: `prev-${userId}`,
        title: `${fullName} ยังไม่ได้ลงเรียนเดือนนี้`,
        description: 'ลูกค้าเดือนก่อนยังไม่กลับมาจอง ควรติดตามก่อนหลุดยาว',
        level: 'yellow' as const,
        userId,
        notificationTitle: 'คิดถึงนะ กลับมาลงเรียนกันต่อได้เลย',
        notificationMessage: 'เดือนนี้ยังไม่พบการจองของคุณ หากต้องการกลับมาเรียนสามารถเข้าแอปเพื่อเลือกวันเรียนได้ทันที',
        notificationType: 'reminder',
        linkUrl: '/dashboard/booking',
      })),
    ...Array.from(oldBookingUserIds)
      .filter((oldUserId) => !currentUserIds.has(oldUserId) && !prevMonthUserMap.has(oldUserId))
      .map((oldUserId) => {
        const oldUser = (users || []).find((item) => item.id === oldUserId)
        return {
          id: `old-${oldUserId}`,
          title: `${oldUser?.full_name || 'ลูกค้าเก่า'} หายไปเกิน 1 เดือน`,
          description: 'เหมาะสำหรับส่งแจ้งเตือนชวนกลับมาเรียนอีกครั้ง',
          level: 'green' as const,
          userId: oldUserId,
          notificationTitle: 'กลับมาฝึกแบดด้วยกันอีกครั้งไหม',
          notificationMessage: 'เรามีรอบเรียนพร้อมให้คุณกลับมาฝึกต่อแล้ว สามารถเข้าไปดูตารางและจองได้ทันที',
          notificationType: 'reminder',
          linkUrl: '/dashboard/booking',
        }
      }),
  ].slice(0, 30)

  const checkinKeys = new Set((todayCheckins || []).map((checkin) => `${checkin.coach_id}:${checkin.schedule_slot_id}`))
  const missingCheckins = (todayAssignments || []).filter((assignment) => !checkinKeys.has(`${assignment.coach_id}:${assignment.schedule_slot_id}`))

  const actionAlerts: AdminActionAlert[] = [
    ...(unreadAdminInbox.length > 0 ? [{
      id: 'admin-unread',
      title: `มีแจ้งเตือนใหม่ ${unreadAdminInbox.length} รายการ`,
      description: 'เป็นแจ้งเตือนที่ส่งถึงบัญชี Admin นี้โดยตรง',
      tone: 'blue' as const,
      href: '#admin-inbox',
      actionLabel: 'ดู Inbox',
    }] : []),
    ...((pendingPayments || []).length > 0 ? [{
      id: 'pending-payments',
      title: `มีสลิปรอตรวจ ${pendingPayments?.length || 0} รายการ`,
      description: `ยอดรวมประมาณ ${(pendingPayments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0).toLocaleString('th-TH')} บาท`,
      tone: 'amber' as const,
      href: '/admin/payments',
      actionLabel: 'ไปหน้าชำระเงิน',
    }] : []),
    ...((complaints || []).length > 0 ? [{
      id: 'open-complaints',
      title: `มีเรื่องร้องเรียนที่ยังไม่ปิด ${complaints?.length || 0} เคส`,
      description: complaints?.[0]?.subject || 'ควรตรวจสอบและอัปเดตสถานะให้เรียบร้อย',
      tone: 'red' as const,
      href: '/admin/complaints',
      actionLabel: 'ไปหน้าร้องเรียน',
    }] : []),
    ...(missingCheckins.length > 0 ? [{
      id: 'missing-checkins',
      title: `โค้ชยังไม่เช็คอิน ${missingCheckins.length} รอบวันนี้`,
      description: 'ตรวจตามรอบสอนที่ถูก assign เพื่อใช้ต่อกับชั่วโมงสอนและเงินเดือน',
      tone: 'amber' as const,
      href: '/admin/coach-checkins',
      actionLabel: 'ไปหน้าเช็คอินโค้ช',
    }] : []),
    ...(lowEnrollmentAlerts.filter((alert) => alert.level === 'red').length > 0 ? [{
      id: 'low-enrollment',
      title: `มีคลาสคนน้อย ${lowEnrollmentAlerts.filter((alert) => alert.level === 'red').length} รอบ`,
      description: 'รอบที่มีผู้เรียน 1 คนอาจต้องติดตามหรือปรับกลุ่ม',
      tone: 'green' as const,
      href: '/admin/schedules',
      actionLabel: 'ไปหน้าตารางเรียน',
    }] : []),
  ]

  return (
    <NotificationsAdminClient
      currentAdminId={user.id}
      notifications={notificationList}
      users={(users || []).map((profile) => ({
        id: profile.id,
        full_name: profile.full_name || 'ไม่ทราบชื่อ',
        email: profile.email || '',
        role: profile.role,
      }))}
      actionAlerts={actionAlerts}
      nonRenewalAlerts={nonRenewalAlerts}
      lowEnrollmentAlerts={lowEnrollmentAlerts}
      customerFollowUpAlerts={customerFollowUpAlerts}
    />
  )
}
