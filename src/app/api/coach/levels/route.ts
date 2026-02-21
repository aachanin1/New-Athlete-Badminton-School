import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireCoach(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as any
  if (!profile || !['coach', 'head_coach', 'admin', 'super_admin'].includes(profile.role)) return null
  return user
}

// POST: Add/update student level
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const coach = await requireCoach(supabase)
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { studentId, studentType, level, notes } = await request.json()

    if (!studentId || !studentType || !level) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (level < 1 || level > 60) {
      return NextResponse.json({ error: 'Level ต้องอยู่ระหว่าง 1-60' }, { status: 400 })
    }

    const { error: insertErr } = await (supabase.from('student_levels') as any).insert({
      student_id: studentId,
      student_type: studentType,
      level,
      updated_by: coach.id,
      notes: notes || null,
    })

    if (insertErr) {
      return NextResponse.json({ error: `บันทึกไม่สำเร็จ: ${insertErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Level update error:', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${err.message}` }, { status: 500 })
  }
}
