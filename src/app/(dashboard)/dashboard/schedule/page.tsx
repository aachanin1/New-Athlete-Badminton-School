import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, Clock, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { createClient } from '@/lib/supabase/server'
import { ScheduleCalendarClient } from '@/components/dashboard/schedule-calendar-client'
import {
  buildAttendanceCountBySessionId,
  buildLatestAttendanceRowBySessionId,
  type AttendanceSessionRow,
} from '@/lib/session-attendance-status'
import {
  buildActiveScheduleLevelNameMap,
  buildLatestScheduleStudentLevelMap,
  getScheduleLevelDetails,
  type ScheduleLevelDefinition,
  type ScheduleStudentLevelRow,
  type ScheduleStudentType,
} from '@/lib/schedule-learning-details'

interface ScheduleSessionRow {
  id: string
  booking_id: string
  schedule_slot_id: string | null
  date: string
  start_time: string
  end_time: string
  status: string
  is_makeup: boolean
  child_id: string | null
  rescheduled_from_id: string | null
  children: { full_name: string; nickname: string | null } | null
  bookings: { user_id: string; course_types: { name: string | null } | null } | null
  branches: { name: string | null } | null
}

interface OriginalSessionRow {
  id: string
  date: string
  start_time: string
  end_time: string
}

interface WalletCreditRow {
  original_session_id: string
  redeemed_session_id: string | null
  status: 'active' | 'redeemed' | 'expired'
  redeemed_at: string | null
  expired_at: string | null
}

interface RedeemedSessionRow {
  id: string
  date: string
  start_time: string
  end_time: string
}

interface ChildRow {
  id: string
  full_name: string
  nickname: string | null
}

interface ProfileRow {
  full_name: string | null
}

interface AssignmentGroupRow {
  id: string
  name: string
  schedule_slot_id: string
  coach_id: string | null
  profiles: {
    full_name: string | null
    role: string | null
    avatar_url: string | null
  } | null
  coach_assignment_group_students: { booking_session_id: string }[] | null
}

interface ExactAssignmentMembershipRow {
  booking_session_id: string
  coach_assignment_groups: AssignmentGroupRow | AssignmentGroupRow[] | null
}

interface LegacyAssignmentRow {
  schedule_slot_id: string
  coach_id: string
  profiles: {
    full_name: string | null
    role: string | null
    avatar_url: string | null
  } | null
}

interface OwnershipScopedSlotAssignmentRow {
  schedule_slot_id: string | null
  schedule_slots: {
    coach_assignment_groups: { id: string }[] | null
    coach_assignments: LegacyAssignmentRow[] | null
  } | {
    coach_assignment_groups: { id: string }[] | null
    coach_assignments: LegacyAssignmentRow[] | null
  }[] | null
}

interface AttendanceRow extends AttendanceSessionRow {
  booking_session_id: string
  student_id: string
  status: 'present' | 'absent' | 'late'
  checked_at: string
}

interface SlotSessionRow {
  id: string
  schedule_slot_id: string | null
}

interface IncompleteBookingRow {
  id: string
  status: string
  total_price: number | null
  total_sessions: number | null
  created_at: string
}

interface ActiveLevelRow extends ScheduleLevelDefinition {
  is_active: boolean
}

function formatMoney(amount: number) {
  return `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 0 })}`
}

export default async function SchedulePage() {
  const supabase = await createClient()
  const adminSupabase = getServiceRoleClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const [
    { data: incompleteBookingsData },
    { data: allSessions },
    { data: activeLevelsData },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, status, total_price, total_sessions, created_at')
      .eq('user_id', user.id)
      .in('status', ['pending_payment', 'paid'])
      .order('created_at', { ascending: false }) as unknown as PromiseLike<{ data: IncompleteBookingRow[] | null }>,
    supabase
      .from('booking_sessions')
      .select('id, booking_id, schedule_slot_id, date, start_time, end_time, status, is_makeup, child_id, rescheduled_from_id, bookings!inner(user_id, course_type_id, status, course_types(name)), branches(name), children(full_name, nickname)')
      .eq('bookings.user_id', user.id)
      .eq('bookings.status', 'verified')
      .neq('status', 'rescheduled')
      .order('date', { ascending: true }) as unknown as PromiseLike<{ data: ScheduleSessionRow[] | null }>,
    supabase
      .from('levels')
      .select('id, name, is_active')
      .eq('is_active', true)
      .order('id') as unknown as PromiseLike<{ data: ActiveLevelRow[] | null }>,
  ])

  const incompleteBookings = incompleteBookingsData || []
  const waitingSlipCount = incompleteBookings.filter((booking) => booking.status === 'pending_payment').length
  const waitingVerifyCount = incompleteBookings.filter((booking) => booking.status === 'paid').length
  const incompleteSessions = incompleteBookings.reduce((sum, booking) => sum + Number(booking.total_sessions || 0), 0)
  const incompleteAmount = incompleteBookings.reduce((sum, booking) => sum + Number(booking.total_price || 0), 0)

  const sessionsArr = allSessions || []
  const sessionIds = sessionsArr.map((session) => session.id)
  const studentRefs = Array.from(new Map(sessionsArr.flatMap((session) => {
    const studentId = session.child_id || session.bookings?.user_id
    if (!studentId) return []
    const studentType: ScheduleStudentType = session.child_id ? 'child' : 'adult'
    return [[`${studentType}:${studentId}`, { studentId, studentType }] as const]
  })).values())
  const studentIds = studentRefs.map((student) => student.studentId)
  const studentTypes = Array.from(new Set(studentRefs.map((student) => student.studentType)))
  const studentLevelsPromise: Promise<{ data: ScheduleStudentLevelRow[] | null }> = studentIds.length > 0
    ? Promise.resolve(supabase
        .from('student_levels')
        .select('id, student_id, student_type, level, created_at')
        .in('student_id', studentIds)
        .in('student_type', studentTypes)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }) as unknown as PromiseLike<{ data: ScheduleStudentLevelRow[] | null }>)
    : Promise.resolve({ data: [] })
  const slotIds = Array.from(new Set(sessionsArr.map((session) => session.schedule_slot_id).filter(Boolean))) as string[]
  const fromIds = Array.from(new Set(sessionsArr.map((session) => session.rescheduled_from_id).filter(Boolean))) as string[]
  const fromMap: Record<string, OriginalSessionRow> = {}
  const walletCreditByOriginalSessionId: Record<string, WalletCreditRow> = {}
  const redeemedSessionById: Record<string, RedeemedSessionRow> = {}
  const assignmentBySessionId: Record<string, AssignmentGroupRow> = {}
  const groupSessionIdsBySessionId: Record<string, string[]> = {}
  const slotSessionIdsBySlotId: Record<string, string[]> = {}
  let attendanceBySessionId = new Map<string, AttendanceRow>()
  let attendanceCountBySessionId = new Map<string, number>()
  const groupCountBySlotId: Record<string, number> = {}
  const legacyAssignmentBySlotId: Record<string, LegacyAssignmentRow> = {}

  if (fromIds.length > 0) {
    const { data: fromSessions } = await supabase
      .from('booking_sessions')
      .select('id, date, start_time, end_time')
      .in('id', fromIds) as unknown as { data: OriginalSessionRow[] | null }

    ;(fromSessions || []).forEach((session) => {
      fromMap[session.id] = session
    })
  }

  const walletOriginalIds = Array.from(new Set([...sessionIds, ...fromIds]))
  if (walletOriginalIds.length > 0) {
    const { data: walletCredits } = await adminSupabase
      .from('lesson_wallet_credits')
      .select('original_session_id, redeemed_session_id, status, redeemed_at, expired_at')
      .in('original_session_id', walletOriginalIds) as unknown as { data: WalletCreditRow[] | null }

    ;(walletCredits || []).forEach((credit) => {
      walletCreditByOriginalSessionId[credit.original_session_id] = credit
    })

    const redeemedSessionIds = Array.from(new Set((walletCredits || [])
      .map((credit) => credit.redeemed_session_id)
      .filter(Boolean))) as string[]

    if (redeemedSessionIds.length > 0) {
      const { data: redeemedSessions } = await adminSupabase
        .from('booking_sessions')
        .select('id, date, start_time, end_time')
        .in('id', redeemedSessionIds) as unknown as { data: RedeemedSessionRow[] | null }

      ;(redeemedSessions || []).forEach((session) => {
        redeemedSessionById[session.id] = session
      })
    }
  }

  if (slotIds.length > 0) {
    const useOwnershipScopedMembershipRead = slotIds.length > 100
    const [
      { data: groupRows },
      { data: legacyAssignments },
      { data: exactMembershipRows },
      { data: ownershipScopedSlotAssignments },
    ] = await Promise.all([
      useOwnershipScopedMembershipRead
        ? Promise.resolve({ data: [] as AssignmentGroupRow[] })
        : adminSupabase
            .from('coach_assignment_groups')
            .select(`
              id,
              name,
              schedule_slot_id,
              coach_id,
              profiles!coach_assignment_groups_coach_id_fkey(full_name, role, avatar_url),
              coach_assignment_group_students(booking_session_id)
            `)
            .in('schedule_slot_id', slotIds) as unknown as PromiseLike<{ data: AssignmentGroupRow[] | null }>,
      useOwnershipScopedMembershipRead
        ? Promise.resolve({ data: [] as LegacyAssignmentRow[] })
        : adminSupabase
            .from('coach_assignments')
            .select(`
              schedule_slot_id,
              coach_id,
              profiles!coach_assignments_coach_id_fkey(full_name, role, avatar_url)
            `)
            .in('schedule_slot_id', slotIds) as unknown as PromiseLike<{ data: LegacyAssignmentRow[] | null }>,
      useOwnershipScopedMembershipRead
        ? adminSupabase
            .from('coach_assignment_group_students')
            .select(`
              booking_session_id,
              coach_assignment_groups!inner(
                id,
                name,
                schedule_slot_id,
                coach_id,
                profiles!coach_assignment_groups_coach_id_fkey(full_name, role, avatar_url),
                coach_assignment_group_students(booking_session_id)
              ),
              booking_sessions!inner(bookings!inner(user_id, status))
            `)
            .eq('booking_sessions.bookings.user_id', user.id)
            .eq('booking_sessions.bookings.status', 'verified') as unknown as PromiseLike<{ data: ExactAssignmentMembershipRow[] | null }>
        : Promise.resolve({ data: [] as ExactAssignmentMembershipRow[] }),
      useOwnershipScopedMembershipRead
        ? adminSupabase
            .from('booking_sessions')
            .select(`
              schedule_slot_id,
              bookings!inner(user_id, status),
              schedule_slots!inner(
                coach_assignment_groups(id),
                coach_assignments(
                  schedule_slot_id,
                  coach_id,
                  profiles!coach_assignments_coach_id_fkey(full_name, role, avatar_url)
                )
              )
            `)
            .eq('bookings.user_id', user.id)
            .eq('bookings.status', 'verified')
            .neq('status', 'rescheduled') as unknown as PromiseLike<{ data: OwnershipScopedSlotAssignmentRow[] | null }>
        : Promise.resolve({ data: [] as OwnershipScopedSlotAssignmentRow[] }),
    ])

    ;(groupRows || []).forEach((group) => {
      groupCountBySlotId[group.schedule_slot_id] = (groupCountBySlotId[group.schedule_slot_id] || 0) + 1
      const groupSessionIds = (group.coach_assignment_group_students || []).map((student) => student.booking_session_id)
      ;(group.coach_assignment_group_students || []).forEach((student) => {
        if (sessionIds.includes(student.booking_session_id)) {
          assignmentBySessionId[student.booking_session_id] = group
          groupSessionIdsBySessionId[student.booking_session_id] = groupSessionIds
        }
      })
    })

    const countedMembershipGroupIds = new Set<string>()
    ;(exactMembershipRows || []).forEach((membership) => {
      const relation = membership.coach_assignment_groups
      const group = Array.isArray(relation) ? relation[0] || null : relation
      if (!group || !sessionIds.includes(membership.booking_session_id)) return
      assignmentBySessionId[membership.booking_session_id] = group
      groupSessionIdsBySessionId[membership.booking_session_id] = (group.coach_assignment_group_students || [])
        .map((student) => student.booking_session_id)
      if (!countedMembershipGroupIds.has(group.id)) {
        countedMembershipGroupIds.add(group.id)
        groupCountBySlotId[group.schedule_slot_id] = (groupCountBySlotId[group.schedule_slot_id] || 0) + 1
      }
    })

    ;(ownershipScopedSlotAssignments || []).forEach((row) => {
      if (!row.schedule_slot_id) return
      const relation = row.schedule_slots
      const slot = Array.isArray(relation) ? relation[0] || null : relation
      if (!slot) return

      groupCountBySlotId[row.schedule_slot_id] = (slot.coach_assignment_groups || []).length
      ;(slot.coach_assignments || []).forEach((assignment) => {
        if (!legacyAssignmentBySlotId[assignment.schedule_slot_id]) {
          legacyAssignmentBySlotId[assignment.schedule_slot_id] = assignment
        }
      })
    })

    ;(legacyAssignments || []).forEach((assignment) => {
      if (!legacyAssignmentBySlotId[assignment.schedule_slot_id]) {
        legacyAssignmentBySlotId[assignment.schedule_slot_id] = assignment
      }
    })
  }

  if (slotIds.length > 0) {
    const { data: slotSessions } = await adminSupabase
      .from('booking_sessions')
      .select('id, schedule_slot_id')
      .in('schedule_slot_id', slotIds)
      .neq('status', 'rescheduled')
      .neq('status', 'walleted')
      .limit(1000) as unknown as { data: SlotSessionRow[] | null }

    ;(slotSessions || []).forEach((session) => {
      if (!session.schedule_slot_id) return
      const rows = slotSessionIdsBySlotId[session.schedule_slot_id] || []
      rows.push(session.id)
      slotSessionIdsBySlotId[session.schedule_slot_id] = rows
    })
  }

  const attendanceScopeSessionIds = Array.from(new Set([
    ...sessionIds,
    ...Object.values(groupSessionIdsBySessionId).flat(),
    ...Object.values(slotSessionIdsBySlotId).flat(),
  ]))

  if (attendanceScopeSessionIds.length > 0) {
    const { data: attendanceRows } = await adminSupabase
      .from('attendance')
      .select('booking_session_id, student_id, status, checked_at')
      .in('booking_session_id', attendanceScopeSessionIds)
      .order('checked_at', { ascending: true }) as unknown as { data: AttendanceRow[] | null }

    const sessionById = new Map(sessionsArr.map((item) => [item.id, item]))
    const ownAttendanceRows = (attendanceRows || []).filter((attendance) => {
      const session = sessionById.get(attendance.booking_session_id)
      const expectedStudentId = session?.child_id || session?.bookings?.user_id
      return !expectedStudentId || attendance.student_id === expectedStudentId
    })

    attendanceBySessionId = buildLatestAttendanceRowBySessionId(ownAttendanceRows)
    attendanceCountBySessionId = buildAttendanceCountBySessionId(attendanceRows || [])
  }

  const { data: studentLevelsData } = await studentLevelsPromise
  const latestStudentLevels = buildLatestScheduleStudentLevelMap(studentLevelsData || [])
  const activeLevelNames = buildActiveScheduleLevelNameMap(activeLevelsData || [])

  const sessions = sessionsArr.map((session) => {
    const assignment = assignmentBySessionId[session.id]
    const legacyAssignment = !assignment && session.schedule_slot_id && !groupCountBySlotId[session.schedule_slot_id]
      ? legacyAssignmentBySlotId[session.schedule_slot_id] || null
      : null
    const attendance = attendanceBySessionId.get(session.id)
    const walletCredit = walletCreditByOriginalSessionId[session.id]
    const sourceWalletCredit = session.rescheduled_from_id ? walletCreditByOriginalSessionId[session.rescheduled_from_id] : null
    const studentId = session.child_id || session.bookings?.user_id || ''
    const studentType: ScheduleStudentType = session.child_id ? 'child' : 'adult'
    const levelDetails = studentId
      ? getScheduleLevelDetails(studentType, studentId, latestStudentLevels, activeLevelNames)
      : { level: 0, levelName: null, label: 'LV 0 / ยังไม่ประเมิน' }

    return {
      ...session,
      rescheduled_from: session.rescheduled_from_id ? fromMap[session.rescheduled_from_id] || null : null,
      wallet_credit_status: walletCredit?.status || null,
      wallet_redeemed_at: walletCredit?.redeemed_at || null,
      wallet_expired_at: walletCredit?.expired_at || null,
      wallet_redeemed_to: walletCredit?.redeemed_session_id ? redeemedSessionById[walletCredit.redeemed_session_id] || null : null,
      wallet_source_status: sourceWalletCredit?.status || null,
      assignment_group_id: assignment?.id || null,
      assignment_group_name: assignment?.name || null,
      can_view_program: Boolean(
        assignment?.id
        && assignment.coach_id
        && assignment.schedule_slot_id === session.schedule_slot_id
      ),
      coach_id: assignment?.coach_id || legacyAssignment?.coach_id || null,
      coach_name: assignment?.profiles?.full_name || legacyAssignment?.profiles?.full_name || null,
      coach_role: assignment?.profiles?.role || legacyAssignment?.profiles?.role || null,
      coach_avatar_url: assignment?.profiles?.avatar_url || legacyAssignment?.profiles?.avatar_url || null,
      assignment_status: assignment?.coach_id || legacyAssignment?.coach_id ? 'assigned' as const : 'pending_assignment' as const,
      attendance_status: attendance?.status || null,
      attendance_checked_at: attendance?.checked_at || null,
      level: levelDetails.level,
      level_name: levelDetails.levelName,
      level_label: levelDetails.label,
      attendance_scope_count: (groupSessionIdsBySessionId[session.id] || slotSessionIdsBySlotId[session.schedule_slot_id || ''] || [session.id])
        .reduce((sum, sessionId) => sum + (attendanceCountBySessionId.get(sessionId) || 0), 0),
    }
  }).filter((session) => {
    if (session.status !== 'walleted') return true

    // Keep only active wallet credits on the schedule. Redeemed/expired credits
    // are shown in the wallet page or as source context on the target session.
    return !session.wallet_credit_status || session.wallet_credit_status === 'active'
  })

  const [{ data: children }, { data: profile }] = await Promise.all([
    supabase
      .from('children')
      .select('id, full_name, nickname')
      .eq('parent_id', user.id) as unknown as PromiseLike<{ data: ChildRow[] | null }>,
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single() as unknown as PromiseLike<{ data: ProfileRow | null }>,
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">ตารางเรียน</h1>
        <p className="mt-1 text-sm text-gray-500">ดูตารางเรียนรายเดือน พร้อมรอบปกติ รอบชดเชย และประวัติการเปลี่ยนวัน</p>
      </div>

      {incompleteBookings.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/70">
          <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-amber-900">มีรายการจองที่ยังไม่สมบูรณ์</p>
                <p className="mt-1 text-sm text-amber-800">
                  รายการเหล่านี้ยังไม่เข้า flow สอน และจะไม่แสดงในตารางเรียนจริงจนกว่าระบบจะยืนยันการชำระเงิน
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-amber-800">
                  {waitingSlipCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-1">
                      <Upload className="h-3.5 w-3.5" />
                      รอแนบสลิป {waitingSlipCount} รายการ
                    </span>
                  )}
                  {waitingVerifyCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-1">
                      <Clock className="h-3.5 w-3.5" />
                      รอตรวจสอบ {waitingVerifyCount} รายการ
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-md border border-amber-200 bg-white px-2 py-1">
                    รวม {incompleteSessions} ครั้ง · {formatMoney(incompleteAmount)}
                  </span>
                </div>
              </div>
            </div>
            <Button asChild className="bg-[#2748bf] hover:bg-[#153c85]">
              <Link href="/dashboard/history">
                <Upload className="mr-2 h-4 w-4" />
                ไปแนบสลิป/ดูประวัติ
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <ScheduleCalendarClient
        sessions={sessions}
        learnerChildren={children || []}
        userName={profile?.full_name || ''}
      />
    </div>
  )
}
