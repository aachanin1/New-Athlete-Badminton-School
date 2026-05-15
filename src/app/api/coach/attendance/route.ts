import { NextRequest, NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity-log'
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

interface BookingSessionAuthRow {
  id: string
  schedule_slot_id: string
  child_id: string | null
  bookings?: {
    user_id: string
  } | null
}

interface GroupAuthRow {
  id: string
  coach_id: string | null
  schedule_slot_id: string
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
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

function isAdminRole(role: UserRole | null | undefined) {
  return role === 'admin' || role === 'super_admin'
}

async function requireCoach(supabase: ReturnType<typeof createClient>) {
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
  supabase: ReturnType<typeof createClient>,
  actor: { id: string; role: UserRole },
  bookingSessionId: string,
  studentId: string,
  studentType: StudentType,
): Promise<AttendanceAuthContext> {
  const { data: session } = await supabase
    .from('booking_sessions')
    .select('id, schedule_slot_id, child_id, bookings!inner(user_id)')
    .eq('id', bookingSessionId)
    .single() as unknown as { data: BookingSessionAuthRow | null }

  if (!session?.schedule_slot_id) return { allowed: false, scheduleSlotId: null }

  const expectedStudentId = studentType === 'child' ? session.child_id : session.bookings?.user_id
  if (expectedStudentId !== studentId) return { allowed: false, scheduleSlotId: session.schedule_slot_id }

  if (isAdminRole(actor.role)) {
    return { allowed: true, scheduleSlotId: session.schedule_slot_id }
  }

  const { data: groupRows } = await supabase
    .from('coach_assignment_group_students')
    .select(`
      group_id,
      coach_assignment_groups!inner(id, coach_id, schedule_slot_id)
    `)
    .eq('booking_session_id', bookingSessionId) as unknown as {
      data: { coach_assignment_groups?: GroupAuthRow | null }[] | null
    }

  const groups = (groupRows || [])
    .map((row) => row.coach_assignment_groups)
    .filter((group): group is GroupAuthRow => Boolean(group))

  if (groups.length > 0) {
    return {
      allowed: groups.some((group) => group.coach_id === actor.id && group.schedule_slot_id === session.schedule_slot_id),
      scheduleSlotId: session.schedule_slot_id,
    }
  }

  const { data: legacyAssignment } = await supabase
    .from('coach_assignments')
    .select('coach_id')
    .eq('coach_id', actor.id)
    .eq('schedule_slot_id', session.schedule_slot_id)
    .maybeSingle() as unknown as { data: LegacyAssignmentRow | null }

  return { allowed: Boolean(legacyAssignment), scheduleSlotId: session.schedule_slot_id }
}

async function hasCheckedInForSlot(
  supabase: ReturnType<typeof createClient>,
  coachId: string,
  scheduleSlotId: string,
) {
  const { data: checkin } = await supabase
    .from('coach_checkins')
    .select('id')
    .eq('coach_id', coachId)
    .eq('schedule_slot_id', scheduleSlotId)
    .maybeSingle<ExistingCheckinRow>()

  return Boolean(checkin)
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
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
      upsert: (values: AttendanceRecord, options: { onConflict: string }) => Promise<{ error: DbError | null }>
      insert: (values: AttendanceRecord) => Promise<{ error: DbError | null }>
    }
    const sessionTable = supabase.from('booking_sessions') as unknown as {
      update: (values: { status: 'absent' | 'completed' }) => {
        eq: (column: string, value: string) => Promise<{ error: DbError | null }>
      }
    }
    const attendanceRecord: AttendanceRecord = {
      booking_session_id: bookingSessionId,
      student_id: studentId,
      student_type: studentType,
      coach_id: actor.user.id,
      status,
      checked_at: new Date().toISOString(),
    }

    const { error } = await attendanceTable.upsert(attendanceRecord, { onConflict: 'booking_session_id,student_id' })

    if (error) {
      const { error: insertError } = await attendanceTable.insert(attendanceRecord)

      if (insertError) {
        return NextResponse.json({ error: `บันทึกไม่สำเร็จ: ${insertError.message}` }, { status: 500 })
      }
    }

    const sessionStatus = status === 'absent' ? 'absent' : 'completed'
    const { error: sessionError } = await sessionTable.update({ status: sessionStatus }).eq('id', bookingSessionId)

    if (sessionError) {
      return NextResponse.json({ error: `อัปเดตสถานะรอบเรียนไม่สำเร็จ: ${sessionError.message}` }, { status: 500 })
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Attendance error:', error)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${getErrorMessage(error)}` }, { status: 500 })
  }
}
