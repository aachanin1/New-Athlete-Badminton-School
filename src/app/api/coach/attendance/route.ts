import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-log'

type AttendanceStatus = 'present' | 'absent' | 'late'

interface ProfileRole {
  role: string
}

interface DbError {
  message: string
}

interface AttendanceRecord {
  booking_session_id: string
  student_id: string
  student_type: 'adult' | 'child'
  coach_id: string
  status: AttendanceStatus
  checked_at: string
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
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
  return user
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const coach = await requireCoach(supabase)
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { bookingSessionId, studentId, studentType, status } = await request.json() as {
      bookingSessionId?: string
      studentId?: string
      studentType?: 'adult' | 'child'
      status?: AttendanceStatus
    }

    if (!bookingSessionId || !studentId || !studentType || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['present', 'absent', 'late'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
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
      coach_id: coach.id,
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
      userId: coach.id,
      action: 'mark_attendance',
      entityType: 'attendance',
      details: {
        bookingSessionId,
        studentId,
        studentType,
        status,
        sessionStatus,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Attendance error:', error)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${getErrorMessage(error)}` }, { status: 500 })
  }
}
