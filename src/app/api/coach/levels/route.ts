import { NextRequest, NextResponse } from 'next/server'

import { MAX_LEVEL, MIN_LEVEL } from '@/constants/levels'
import { createClient } from '@/lib/supabase/server'

async function requireCoach(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as unknown as { data: { role: string } | null }

  if (!profile || !['coach', 'head_coach', 'admin', 'super_admin'].includes(profile.role)) return null
  return user
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const coach = await requireCoach(supabase)
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json() as {
      studentId?: string
      studentType?: string
      level?: string | number | null
      notes?: string | null
    }
    const { studentId, studentType, level, notes } = body
    const numericLevel = Number(level)

    if (!studentId || !studentType || level === undefined || level === null || level === '') {
      return NextResponse.json({ error: 'กรุณาระบุข้อมูลให้ครบ' }, { status: 400 })
    }

    if (studentType !== 'adult' && studentType !== 'child') {
      return NextResponse.json({ error: 'ประเภทผู้เรียนไม่ถูกต้อง' }, { status: 400 })
    }

    if (!Number.isInteger(numericLevel) || numericLevel < MIN_LEVEL || numericLevel > MAX_LEVEL) {
      return NextResponse.json({ error: `Level ต้องอยู่ระหว่าง ${MIN_LEVEL}-${MAX_LEVEL}` }, { status: 400 })
    }

    const { data: levelDefinition, error: levelError } = await supabase
      .from('levels')
      .select('id, is_active')
      .eq('id', numericLevel)
      .single() as unknown as { data: { id: number; is_active: boolean } | null; error: { message: string } | null }

    if (levelError || !levelDefinition?.is_active) {
      return NextResponse.json({ error: 'Level นี้ยังไม่เปิดใช้งาน กรุณาเลือก Level จากรายการที่ระบบแสดง' }, { status: 400 })
    }

    const studentLevels = supabase.from('student_levels') as unknown as {
      insert: (values: {
        student_id: string
        student_type: 'adult' | 'child'
        level: number
        updated_by: string
        notes: string | null
      }) => PromiseLike<{ error: { message: string } | null }>
    }

    const { error: insertErr } = await studentLevels.insert({
      student_id: studentId,
      student_type: studentType,
      level: numericLevel,
      updated_by: coach.id,
      notes: notes || null,
    })

    if (insertErr) {
      return NextResponse.json({ error: `บันทึกไม่สำเร็จ: ${insertErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('Level update error:', err)
    const message = err instanceof Error ? err.message : 'ไม่ทราบสาเหตุ'
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${message}` }, { status: 500 })
  }
}
