import { NextRequest, NextResponse } from 'next/server'

import { MIN_LEVEL } from '@/constants/levels'
import { canManageStudentForCoach, getCoachRole } from '@/lib/coach-student-access'
import { createClient } from '@/lib/supabase/server'
import type { StudentType } from '@/types/database'
import { CoachAssignmentDataUnavailableError } from '@/lib/coach-assignment-resolution'
import { decodeAssessmentCursor, encodeAssessmentCursor, isAssessmentUuid, toLevelAssessment, type AssessmentRow } from '@/lib/student-level-history'

async function requireCoach(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const role = await getCoachRole(supabase, user.id)
  if (!role || !['coach', 'head_coach', 'admin', 'super_admin'].includes(role)) return null

  return user
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const headers = { 'Cache-Control': 'private, no-store' }
  try {
    const coach = await requireCoach(supabase)
    if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
    const studentId = request.nextUrl.searchParams.get('studentId') || ''
    const studentType = request.nextUrl.searchParams.get('studentType')
    const before = request.nextUrl.searchParams.get('before')
    if (!isAssessmentUuid(studentId) || (studentType !== 'child' && studentType !== 'adult')) {
      return NextResponse.json({ error: 'ข้อมูลผู้เรียนไม่ถูกต้อง' }, { status: 400, headers })
    }
    const cursor = before ? decodeAssessmentCursor(before, studentId, studentType) : null
    if (before && !cursor) return NextResponse.json({ error: 'หน้าประวัติไม่ถูกต้อง กรุณาเปิดประวัติใหม่' }, { status: 400, headers })
    if (!await canManageStudentForCoach(supabase, coach.id, studentId, studentType)) {
      return NextResponse.json({ error: 'คุณยังไม่ได้รับผิดชอบผู้เรียนคนนี้ จึงไม่สามารถอ่านประวัติการประเมินได้' }, { status: 403, headers })
    }
    let query = supabase.from('student_levels')
      .select('id, level, notes, created_at, profiles!student_levels_updated_by_fkey(full_name)')
      .eq('student_id', studentId).eq('student_type', studentType)
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .limit(11)
    if (cursor) query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`)
    const { data, error } = await query as unknown as { data: AssessmentRow[] | null; error: unknown }
    if (error) throw error
    const rows = (data || []).slice(0, 10)
    const last = rows.at(-1)
    return NextResponse.json({
      items: rows.map(toLevelAssessment),
      nextCursor: data && data.length > 10 && last ? encodeAssessmentCursor({ studentId, studentType, createdAt: last.created_at, id: last.id }) : null,
    }, { headers })
  } catch (error) {
    console.error('Level history read error:', error)
    return NextResponse.json({ error: 'ยังอ่านประวัติการประเมินไม่ได้ กรุณาลองใหม่อีกครั้ง' }, { status: 503, headers })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  try {
    const coach = await requireCoach(supabase)
    if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json() as {
      studentId?: string
      studentType?: StudentType
      level?: string | number | null
      notes?: string | null
    }
    const { studentId, studentType, level, notes } = body
    if (notes !== undefined && notes !== null && typeof notes !== 'string') {
      return NextResponse.json({ error: 'หมายเหตุต้องเป็นข้อความ' }, { status: 400 })
    }
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
      notes: notes?.trim() || null,
    })

    if (insertErr) {
      return NextResponse.json({ error: `บันทึกไม่สำเร็จ: ${insertErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('Level update error:', err)
    if (err instanceof CoachAssignmentDataUnavailableError) {
      return NextResponse.json({ error: 'ยังตรวจสอบสิทธิ์ผู้เรียนไม่ได้ กรุณาลองใหม่อีกครั้ง' }, { status: 503 })
    }
    const message = err instanceof Error ? err.message : 'ไม่ทราบสาเหตุ'
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${message}` }, { status: 500 })
  }
}
