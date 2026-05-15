import { NextRequest, NextResponse } from 'next/server'

import { MIN_LEVEL } from '@/constants/levels'
import { canManageStudentForCoach, getCoachRole } from '@/lib/coach-student-access'
import { createClient } from '@/lib/supabase/server'
import type { StudentType } from '@/types/database'

async function requireCoach(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const role = await getCoachRole(supabase, user.id)
  if (!role || !['coach', 'head_coach', 'admin', 'super_admin'].includes(role)) return null

  return user
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const coach = await requireCoach(supabase)
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json() as {
      studentId?: string
      studentType?: StudentType
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

    const canManage = await canManageStudentForCoach(supabase, coach.id, studentId, studentType)
    if (!canManage) {
      return NextResponse.json({ error: 'คุณยังไม่ได้รับผิดชอบผู้เรียนคนนี้ จึงไม่สามารถประเมิน Level ได้' }, { status: 403 })
    }

    if (!Number.isInteger(numericLevel) || numericLevel <= MIN_LEVEL) {
      return NextResponse.json({ error: 'กรุณาเลือก Level ที่เปิดใช้งานอยู่ในระบบ' }, { status: 400 })
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
        student_type: StudentType
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
