import { NotificationsAdminClient } from '@/components/admin/notifications-admin-client'
import { requireAdminPageAccess } from '@/lib/auth/admin'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { isProgressivePaymentReviewEnabled } from '@/lib/progressive-pricing-feature'
import { formatLearnerDisplayName } from '@/lib/learner-display-name'
import {
  buildLowEnrollmentRecommendations,
  buildNearCourseRecommendations,
  createEmptyFollowUpWorkspace,
  normalizeFollowUpWorkspaceSnapshot,
  type RecommendationAttendanceInput,
  type RecommendationBookingInput,
  type RecommendationCourseName,
  type RecommendationSessionInput,
  type RecommendationWorkspaceData,
} from '@/lib/admin-notification-recommendations'
import type { UserRole } from '@/types/database'

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

interface RecommendationBookingRow {
  id: string
  user_id: string
  learner_type: 'self' | 'child'
  child_id: string | null
  branch_id: string
  course_type_id: string
  total_sessions: number
  entitlement_sessions: number | null
  month: number
  year: number
  status: string
  expires_at: string | null
  expired_at: string | null
  created_at: string
  profiles?: { full_name: string | null } | null
  course_types?: { name: string | null } | null
  branches?: { name: string | null } | null
}

interface RecommendationSessionRow {
  id: string
  booking_id: string
  schedule_slot_id: string | null
  date: string
  start_time: string
  end_time: string
  branch_id: string
  child_id: string | null
  status: string
  rescheduled_from_id: string | null
  is_makeup: boolean
  cancelled_at: string | null
  branches?: { name: string | null } | null
}

interface RecommendationAttendanceRow {
  id: string
  booking_session_id: string
  student_id: string
  status: string
}

interface RecommendationChildRow {
  id: string
  full_name: string | null
  nickname: string | null
}

interface PaymentRow {
  id: string
  amount?: number
  status: string
  created_at: string
  profiles?: { full_name: string | null } | null
}

interface ProgressivePendingPaymentRow {
  source_id: string
  status: string
  total_amount?: number
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

interface AdminActionAlert {
  id: string
  title: string
  description: string
  tone: 'red' | 'amber' | 'blue' | 'green'
  href: string
  actionLabel: string
}

const RECOMMENDATION_PAGE_SIZE = 500

type AdminServiceClient = ReturnType<typeof getServiceRoleClient>

function getBangkokDateString(value: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)

  const partMap = new Map(parts.map((part) => [part.type, part.value]))
  return `${partMap.get('year')}-${partMap.get('month')}-${partMap.get('day')}`
}

function addDaysToDateString(value: string, days: number) {
  const date = new Date(`${value}T00:00:00+07:00`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function getMonthPartsFromDateString(value: string) {
  const [year, month] = value.split('-').map(Number)
  return { year, month }
}

function getMonthOffsetParts(year: number, month: number, offset: number) {
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  }
}

async function fetchRecommendationBookings(service: AdminServiceClient) {
  const rows: RecommendationBookingRow[] = []
  let cursor: string | null = null

  for (;;) {
    let query = service
      .from('bookings')
      .select(`
        id, user_id, learner_type, child_id, branch_id, course_type_id,
        total_sessions, entitlement_sessions, month, year, status,
        expires_at, expired_at, created_at,
        profiles!bookings_user_id_fkey(full_name), course_types(name), branches(name)
      `)
      .order('id', { ascending: true })
      .limit(RECOMMENDATION_PAGE_SIZE)
    if (cursor) query = query.gt('id', cursor)
    const { data, error } = await query as unknown as {
      data: RecommendationBookingRow[] | null
      error: { message: string } | null
    }
    if (error) throw new Error(`Admin recommendation bookings query failed: ${error.message}`)
    const page = data || []
    rows.push(...page)
    if (page.length < RECOMMENDATION_PAGE_SIZE) break
    cursor = page.at(-1)?.id || null
  }

  return rows
}

async function fetchRecommendationSessions(service: AdminServiceClient) {
  const rows: RecommendationSessionRow[] = []
  let cursor: string | null = null

  for (;;) {
    let query = service
      .from('booking_sessions')
      .select(`
        id, booking_id, schedule_slot_id, date, start_time, end_time,
        branch_id, child_id, status, rescheduled_from_id, is_makeup, cancelled_at,
        branches(name)
      `)
      .order('id', { ascending: true })
      .limit(RECOMMENDATION_PAGE_SIZE)
    if (cursor) query = query.gt('id', cursor)
    const { data, error } = await query as unknown as {
      data: RecommendationSessionRow[] | null
      error: { message: string } | null
    }
    if (error) throw new Error(`Admin recommendation sessions query failed: ${error.message}`)
    const page = data || []
    rows.push(...page)
    if (page.length < RECOMMENDATION_PAGE_SIZE) break
    cursor = page.at(-1)?.id || null
  }

  return rows
}

async function fetchRecommendationAttendance(service: AdminServiceClient) {
  const rows: RecommendationAttendanceRow[] = []
  let cursor: string | null = null

  for (;;) {
    let query = service
      .from('attendance')
      .select('id, booking_session_id, student_id, status')
      .order('id', { ascending: true })
      .limit(RECOMMENDATION_PAGE_SIZE)
    if (cursor) query = query.gt('id', cursor)
    const { data, error } = await query as unknown as {
      data: RecommendationAttendanceRow[] | null
      error: { message: string } | null
    }
    if (error) throw new Error(`Admin recommendation attendance query failed: ${error.message}`)
    const page = data || []
    rows.push(...page)
    if (page.length < RECOMMENDATION_PAGE_SIZE) break
    cursor = page.at(-1)?.id || null
  }

  return rows
}

async function fetchRecommendationChildren(service: AdminServiceClient) {
  const rows: RecommendationChildRow[] = []
  let cursor: string | null = null

  for (;;) {
    let query = service
      .from('children')
      .select('id, full_name, nickname')
      .order('id', { ascending: true })
      .limit(RECOMMENDATION_PAGE_SIZE)
    if (cursor) query = query.gt('id', cursor)
    const { data, error } = await query as unknown as {
      data: RecommendationChildRow[] | null
      error: { message: string } | null
    }
    if (error) throw new Error(`Admin recommendation children query failed: ${error.message}`)
    const page = data || []
    rows.push(...page)
    if (page.length < RECOMMENDATION_PAGE_SIZE) break
    cursor = page.at(-1)?.id || null
  }

  return rows
}

async function fetchRecommendationWorkspace({
  service,
  today,
  currentYear,
  currentMonth,
  nextYear,
  nextMonth,
  nowIso,
}: {
  service: AdminServiceClient
  today: string
  currentYear: number
  currentMonth: number
  nextYear: number
  nextMonth: number
  nowIso: string
}): Promise<RecommendationWorkspaceData> {
  const [bookingRows, sessionRows, attendanceRows, children, followUpResult] = await Promise.all([
    fetchRecommendationBookings(service),
    fetchRecommendationSessions(service),
    fetchRecommendationAttendance(service),
    fetchRecommendationChildren(service),
    service.rpc('admin_notification_follow_up_workspace_v2', {
      p_page: 1,
      p_page_size: 10,
      p_status: 'all',
      p_search: '',
    }),
  ])
  const childNameById = new Map(children.map((child) => [child.id, formatLearnerDisplayName({
    fullName: child.full_name,
    nickname: child.nickname,
  })]))
  const bookings = bookingRows.flatMap((row): RecommendationBookingInput[] => {
    if (!['kids_group', 'adult_group', 'private'].includes(row.course_types?.name || '')) return []
    const courseName = row.course_types?.name as RecommendationCourseName
    const ownerName = row.profiles?.full_name || 'ไม่ทราบชื่อ'
    return [{
      id: row.id,
      userId: row.user_id,
      ownerName,
      learnerType: row.learner_type,
      childId: row.child_id,
      learnerName: row.child_id ? childNameById.get(row.child_id) || 'ผู้เรียน' : ownerName,
      branchId: row.branch_id,
      branchName: row.branches?.name || '-',
      courseTypeId: row.course_type_id,
      courseName,
      month: row.month,
      year: row.year,
      totalSessions: row.total_sessions,
      entitlementSessions: row.entitlement_sessions,
      status: row.status,
      expiresAt: row.expires_at,
      expiredAt: row.expired_at,
      createdAt: row.created_at,
    }]
  })
  const sessions: RecommendationSessionInput[] = sessionRows.map((row) => ({
    id: row.id,
    bookingId: row.booking_id,
    scheduleSlotId: row.schedule_slot_id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    branchId: row.branch_id,
    branchName: row.branches?.name || '-',
    childId: row.child_id,
    learnerName: row.child_id ? childNameById.get(row.child_id) || 'ผู้เรียน' : null,
    status: row.status,
    rescheduledFromId: row.rescheduled_from_id,
    isMakeup: row.is_makeup,
    cancelledAt: row.cancelled_at,
  }))
  const attendance: RecommendationAttendanceInput[] = attendanceRows.map((row) => ({
    bookingSessionId: row.booking_session_id,
    studentId: row.student_id,
    status: row.status,
  }))

  return {
    lowEnrollment: buildLowEnrollmentRecommendations({ bookings, sessions, today }),
    nearCourse: buildNearCourseRecommendations({
      bookings,
      sessions,
      attendance,
      currentYear,
      currentMonth,
      nextYear,
      nextMonth,
      nowIso,
    }),
    followUp: followUpResult.error
      ? createEmptyFollowUpWorkspace({ state: 'unavailable', error: followUpResult.error.message })
      : normalizeFollowUpWorkspaceSnapshot(followUpResult.data),
  }
}

export default async function AdminNotificationsPage() {
  const { supabase, user, role } = await requireAdminPageAccess()
  const canViewFinancialAmounts = role === 'super_admin'
  const service = getServiceRoleClient()
  const now = new Date()
  const nowIso = now.toISOString()
  const today = getBangkokDateString(now)
  const tomorrow = addDaysToDateString(today, 1)
  const { month: currentMonth, year: currentYear } = getMonthPartsFromDateString(today)
  const { month: nextMonth, year: nextYear } = getMonthOffsetParts(currentYear, currentMonth, 1)
  const recommendationWorkspacePromise = fetchRecommendationWorkspace({
    service,
    today,
    currentYear,
    currentMonth,
    nextYear,
    nextMonth,
    nowIso,
  })

  const [
    { data: notifications },
    { data: users },
    recommendationWorkspace,
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
    recommendationWorkspacePromise,
    supabase
      .from('payments')
      .select(`id, ${canViewFinancialAmounts ? 'amount,' : ''} status, created_at, profiles!payments_user_id_fkey(full_name)`)
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

  const { data: progressivePendingPayments, error: progressivePendingError } = isProgressivePaymentReviewEnabled()
    ? await service.from('payment_review_queue_v1')
        .select(`source_id, status${canViewFinancialAmounts ? ', total_amount' : ''}`)
        .eq('source_kind', 'progressive')
        .in('status', ['submitted', 'under_review'])
        .limit(50)
    : { data: [] as ProgressivePendingPaymentRow[], error: null }
  if (progressivePendingError) {
    throw new Error(`[admin/notifications] progressive payment queue failed: ${progressivePendingError.message}`)
  }
  const progressivePending = (progressivePendingPayments || []) as unknown as ProgressivePendingPaymentRow[]
  const pendingPaymentCount = (pendingPayments || []).length + progressivePending.length
  const pendingPaymentTotal = canViewFinancialAmounts
    ? (pendingPayments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
      + progressivePending.reduce((sum, payment) => sum + Number(payment.total_amount || 0), 0)
    : null

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
    ...(pendingPaymentCount > 0 ? [{
      id: 'pending-payments',
      title: `มีสลิปรอตรวจ ${pendingPaymentCount} รายการ`,
      description: canViewFinancialAmounts && pendingPaymentTotal !== null
        ? `ยอดรวมประมาณ ${pendingPaymentTotal.toLocaleString('th-TH')} บาท`
        : 'ตรวจสอบหลักฐานและดำเนินการจากหน้าชำระเงิน',
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
    ...(recommendationWorkspace.lowEnrollment.filter((alert) => alert.level === 'red').length > 0 ? [{
      id: 'low-enrollment',
      title: `มีคลาสคนน้อย ${recommendationWorkspace.lowEnrollment.filter((alert) => alert.level === 'red').length} รอบ`,
      description: 'รอบที่มีผู้เรียน 1 คนอาจต้องติดตามหรือปรับกลุ่ม',
      tone: 'green' as const,
      href: '/admin/schedules',
      actionLabel: 'ไปหน้าตารางเรียน',
    }] : []),
  ]

  return (
    <NotificationsAdminClient
      currentAdminId={user.id}
      todayDateKey={today}
      notifications={notificationList}
      users={(users || []).map((profile) => ({
        id: profile.id,
        full_name: profile.full_name || 'ไม่ทราบชื่อ',
        email: profile.email || '',
        role: profile.role,
      }))}
      actionAlerts={actionAlerts}
      recommendationWorkspace={recommendationWorkspace}
    />
  )
}
