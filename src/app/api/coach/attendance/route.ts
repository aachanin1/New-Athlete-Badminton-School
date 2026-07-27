import { NextRequest, NextResponse } from 'next/server'

import { getServiceRoleClient } from '@/lib/auth/admin'
import { logActivity } from '@/lib/activity-log'
import { syncBookingSessionStatusFromAttendance } from '@/lib/attendance-write-through'
import {
  classifyCoachAssignmentSessionProvenance,
  loadWalletRedeemedSessionIds,
  requireCoachAssignmentQueryData,
  resolveCoachLearnerAccess,
} from '@/lib/coach-assignment-resolution'
import { formatNotificationSlotDateTime } from '@/lib/date-format'
import { notifyUserOnce } from '@/lib/notifications'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'

type AttendanceStatus = 'present' | 'absent' | 'late'
type StudentType = 'adult' | 'child'

interface ProfileRole {
  role: UserRole
}

interface DbError {
  message: string
}

interface AttendanceRecord {
  booking_session_id: string
  student_id: string
  student_type: StudentType
  coach_id: string
  status: AttendanceStatus
  checked_at: string
}

interface ExistingAttendanceRow {
  id: string
}

interface BookingSessionAuthRow {
  id: string
  schedule_slot_id: string
  child_id: string | null
  rescheduled_from_id: string | null
  is_makeup: boolean | null
  bookings?: {
    user_id: string
  } | null
  schedule_slots?: {
    date: string
    start_time: string
    end_time: string
    branches?: { name: string | null } | null
  } | null
}

interface GroupAuthRow {
  id: string
  coach_id: string | null
  schedule_slot_id: string
  coach_assignment_group_students?: { booking_session_id: string | null }[] | null
}

interface LegacyAssignmentRow {
  coach_id: string
}

interface ExistingCheckinRow {
  id: string
}

interface AttendanceAuthContext {
  allowed: boolean
  scheduleSlotId: string | null
  recipientUserId: string | null
  slotLabel: string | null
}

type NotificationSupabase = Parameters<typeof notifyUserOnce>[0]

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

function isAdminRole(role: UserRole | null | undefined) {
  return role === 'admin' || role === 'super_admin'
}

function getSlotLabel(session: BookingSessionAuthRow | null) {
  const slot = session?.schedule_slots
  if (!slot) return null

  const branchName = slot.branches?.name ? ` ที่${slot.branches.name}` : ''
  return `${formatNotificationSlotDateTime(slot.date, slot.start_time, slot.end_time)}${branchName}`
}

async function requireCoach(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as unknown as { data: ProfileRole | null }

  if (!profile || !['coach', 'head_coach', 'admin', 'super_admin'].includes(profile.role)) return null
  return { user, role: profile.role }
}

async function getAttendanceAuthContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actor: { id: string; role: UserRole },
  bookingSessionId: string,
  studentId: string,
  studentType: StudentType,
): Promise<AttendanceAuthContext> {
  const sessionResult = await supabase
    .from('booking_sessions')
    .select('id, schedule_slot_id, child_id, rescheduled_from_id, is_makeup, bookings!inner(user_id), schedule_slots(date, start_time, end_time, branches(name))')
    .eq('id', bookingSessionId)
    .single() as unknown as {
      data: BookingSessionAuthRow | null
      error: DbError | null
    }
  const session = requireCoachAssignmentQueryData(
    sessionResult,
    'Coach attendance learner query failed',
  )

  if (!session?.schedule_slot_id) {
    return { allowed: false, scheduleSlotId: null, recipientUserId: null, slotLabel: null }
  }

  const expectedStudentId = studentType === 'child' ? session.child_id : session.bookings?.user_id
  const recipientUserId = session.bookings?.user_id || null
  const slotLabel = getSlotLabel(session)

  if (expectedStudentId !== studentId) {
    return { allowed: false, scheduleSlotId: session.schedule_slot_id, recipientUserId, slotLabel }
  }

  if (isAdminRole(actor.role)) {
    return { allowed: true, scheduleSlotId: session.schedule_slot_id, recipientUserId, slotLabel }
  }

  const adminSupabase = getServiceRoleClient()
  const groupResult = await adminSupabase
    .from('coach_assignment_groups')
    .select(`
      id,
      coach_id,
      schedule_slot_id,
      coach_assignment_group_students(booking_session_id)
    `)
    .eq('schedule_slot_id', session.schedule_slot_id) as unknown as {
      data: GroupAuthRow[] | null
      error: DbError | null
    }

  const groups = requireCoachAssignmentQueryData(
    groupResult,
    'Coach attendance exact assignment query failed',
  ) || []
  if (groups.length > 0) return {
    allowed: resolveCoachLearnerAccess({
      exactGroups: groups,
      coachId: actor.id,
      bookingSessionId,
      hasLegacyAssignment: false,
      sessionProvenance: 'normal',
    }).allowed,
    scheduleSlotId: session.schedule_slot_id,
    recipientUserId,
    slotLabel,
  }

  const legacyResult = await adminSupabase
    .from('coach_assignments')
    .select('coach_id')
    .eq('coach_id', actor.id)
    .eq('schedule_slot_id', session.schedule_slot_id)
    .maybeSingle() as unknown as { data: LegacyAssignmentRow | null; error: DbError | null }
  const legacyAssignment = requireCoachAssignmentQueryData(
    legacyResult,
    'Coach attendance Legacy assignment query failed',
  )
  const walletRedeemedSessionIds = await loadWalletRedeemedSessionIds(
    adminSupabase,
    [session],
    'Coach attendance',
  )

  return {
    allowed: resolveCoachLearnerAccess({
      exactGroups: groups,
      coachId: actor.id,
      bookingSessionId,
      hasLegacyAssignment: Boolean(legacyAssignment),
      sessionProvenance: classifyCoachAssignmentSessionProvenance(
        session,
        walletRedeemedSessionIds,
      ),
    }).allowed,
    scheduleSlotId: session.schedule_slot_id,
    recipientUserId,
    slotLabel,
  }
}

async function hasCheckedInForSlot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  coachId: string,
  scheduleSlotId: string,
) {
  const result = await supabase
    .from('coach_checkins')
    .select('id')
    .eq('coach_id', coachId)
    .eq('schedule_slot_id', scheduleSlotId)
    .maybeSingle<ExistingCheckinRow>() as unknown as {
      data: ExistingCheckinRow | null
      error: DbError | null
    }
  const checkin = requireCoachAssignmentQueryData(
    result,
    'Coach attendance check-in query failed',
  )

  return Boolean(checkin)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const actor = await requireCoach(supabase)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { bookingSessionId, studentId, studentType, status } = await request.json() as {
      bookingSessionId?: string
      studentId?: string
      studentType?: StudentType
      status?: AttendanceStatus
    }

    if (!bookingSessionId || !studentId || !studentType || !status) {
      return NextResponse.json({ error: 'ข้อมูลเช็คชื่อไม่ครบ' }, { status: 400 })
    }

    if (!['adult', 'child'].includes(studentType)) {
      return NextResponse.json({ error: 'ประเภทผู้เรียนไม่ถูกต้อง' }, { status: 400 })
    }

    if (!['present', 'absent', 'late'].includes(status)) {
      return NextResponse.json({ error: 'สถานะเช็คชื่อไม่ถูกต้อง' }, { status: 400 })
    }

    const authContext = await getAttendanceAuthContext(
      supabase,
      { id: actor.user.id, role: actor.role },
      bookingSessionId,
      studentId,
      studentType,
    )

    if (!authContext.allowed || !authContext.scheduleSlotId) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์เช็คชื่อผู้เรียนคนนี้' }, { status: 403 })
    }

    if (!isAdminRole(actor.role)) {
      const checkedIn = await hasCheckedInForSlot(supabase, actor.user.id, authContext.scheduleSlotId)
      if (!checkedIn) {
        return NextResponse.json({ error: 'กรุณาเช็คอินรอบสอนนี้ก่อน จึงจะเช็คชื่อผู้เรียนได้' }, { status: 403 })
      }
    }

    const attendanceTable = supabase.from('attendance') as unknown as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => {
            order: (column: string, options: { ascending: boolean }) => {
              limit: (count: number) => {
                maybeSingle: () => Promise<{ data: ExistingAttendanceRow | null; error: DbError | null }>
              }
            }
          }
        }
      }
      update: (values: Pick<AttendanceRecord, 'coach_id' | 'status' | 'checked_at'>) => {
        eq: (column: string, value: string) => Promise<{ error: DbError | null }>
      }
      insert: (values: AttendanceRecord) => Promise<{ error: DbError | null }>
    }
    const attendanceRecord: AttendanceRecord = {
      booking_session_id: bookingSessionId,
      student_id: studentId,
      student_type: studentType,
      coach_id: actor.user.id,
      status,
      checked_at: new Date().toISOString(),
    }

    const { data: existingAttendance, error: existingAttendanceError } = await attendanceTable
      .select('id')
      .eq('booking_session_id', bookingSessionId)
      .eq('student_id', studentId)
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingAttendanceError) {
      return NextResponse.json({ error: `ตรวจสอบรายการเช็คชื่อไม่สำเร็จ: ${existingAttendanceError.message}` }, { status: 500 })
    }

    if (existingAttendance) {
      const { error: updateError } = await attendanceTable
        .update({
          coach_id: actor.user.id,
          status,
          checked_at: attendanceRecord.checked_at,
        })
        .eq('id', existingAttendance.id)

      if (updateError) {
        return NextResponse.json({ error: `อัปเดตรายการเช็คชื่อไม่สำเร็จ: ${updateError.message}` }, { status: 500 })
      }
    } else {
      const { error: insertError } = await attendanceTable.insert(attendanceRecord)

      if (insertError) {
        return NextResponse.json({ error: `บันทึกไม่สำเร็จ: ${insertError.message}` }, { status: 500 })
      }
    }

    let sessionStatus: 'absent' | 'completed'
    try {
      const syncResult = await syncBookingSessionStatusFromAttendance({
        supabase: getServiceRoleClient(),
        bookingSessionId,
        attendanceStatus: status,
      })
      sessionStatus = syncResult.sessionStatus
    } catch (syncError) {
      return NextResponse.json({ error: `อัปเดตสถานะรอบเรียนไม่สำเร็จ: ${getErrorMessage(syncError)}` }, { status: 500 })
    }

    await logActivity({
      userId: actor.user.id,
      action: 'mark_attendance',
      entityType: 'attendance',
      details: {
        bookingSessionId,
        studentId,
        studentType,
        scheduleSlotId: authContext.scheduleSlotId,
        status,
        sessionStatus,
        requiredCheckin: !isAdminRole(actor.role),
      },
      ipAddress: request.headers.get('x-forwarded-for'),
    })

    if ((status === 'absent' || status === 'late') && authContext.recipientUserId) {
      const statusLabel = status === 'absent' ? 'ขาดเรียน' : 'มาสาย'
      const slotLabel = authContext.slotLabel ? ` รอบ ${authContext.slotLabel}` : ''
      const adminSupabase = getServiceRoleClient()

      await notifyUserOnce(adminSupabase as unknown as NotificationSupabase, {
        user_id: authContext.recipientUserId,
        title: `บันทึกสถานะ${statusLabel}`,
        message: `Coach บันทึกสถานะ${statusLabel}${slotLabel} หากมีสิทธิ์ชดเชย Admin จะเป็นผู้จัดรอบชดเชยให้ตามกฎของระบบ`,
        type: 'schedule',
        link_url: '/dashboard/schedule',
      }).catch(() => null)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Attendance error:', error)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${getErrorMessage(error)}` }, { status: 500 })
  }
}
