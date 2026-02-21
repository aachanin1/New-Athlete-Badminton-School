import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireCoach(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as any
  if (!profile || !['coach', 'head_coach', 'admin', 'super_admin'].includes(profile.role)) return null
  return user
}

// POST: Mark attendance for a booking_session
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const coach = await requireCoach(supabase)
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { bookingSessionId, studentId, studentType, status } = await request.json()

    if (!bookingSessionId || !studentId || !studentType || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['present', 'absent', 'late'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Upsert attendance
    const { error } = await (supabase.from('attendance') as any).upsert(
      {
        booking_session_id: bookingSessionId,
        student_id: studentId,
        student_type: studentType,
        coach_id: coach.id,
        status,
        checked_at: new Date().toISOString(),
      },
      { onConflict: 'booking_session_id,student_id' }
    )

    if (error) {
      // If upsert fails (no unique constraint), try insert
      const { error: insertErr } = await (supabase.from('attendance') as any).insert({
        booking_session_id: bookingSessionId,
        student_id: studentId,
        student_type: studentType,
        coach_id: coach.id,
        status,
        checked_at: new Date().toISOString(),
      })
      if (insertErr) {
        return NextResponse.json({ error: `บันทึกไม่สำเร็จ: ${insertErr.message}` }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Attendance error:', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${err.message}` }, { status: 500 })
  }
}
