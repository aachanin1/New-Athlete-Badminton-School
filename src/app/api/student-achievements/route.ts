import { NextRequest, NextResponse } from 'next/server'

import { getServiceRoleClient } from '@/lib/auth/admin'
import { createClient } from '@/lib/supabase/server'
import type { StudentType, UserRole } from '@/types/database'

const STAFF_ROLES: UserRole[] = ['coach', 'head_coach', 'admin', 'super_admin']
const STUDENT_TYPES: StudentType[] = ['adult', 'child']

interface AchievementPayload {
  studentId?: string
  studentType?: StudentType
  emoji?: string
  title?: string
  description?: string | null
  awardedAt?: string | null
}

async function requireStaff() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as unknown as { data: { role: UserRole } | null }

  if (!profile || !STAFF_ROLES.includes(profile.role)) return null
  return user
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

function isDateInput(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function validatePayload(payload: AchievementPayload) {
  const studentId = payload.studentId?.trim()
  const studentType = payload.studentType
  const emoji = payload.emoji?.trim()
  const title = payload.title?.trim()
  const description = payload.description?.trim() || null
  const awardedAt = payload.awardedAt || null

  if (!studentId) return { error: 'ไม่พบนักเรียนที่ต้องการเพิ่มรางวัล' }
  if (!studentType || !STUDENT_TYPES.includes(studentType)) return { error: 'ประเภทนักเรียนไม่ถูกต้อง' }
  if (!emoji || emoji.length > 8) return { error: 'กรุณากรอก emoji 1-8 ตัวอักษร' }
  if (!title) return { error: 'กรุณากรอกชื่อรางวัลหรือผลงาน' }
  if (awardedAt && !isDateInput(awardedAt)) return { error: 'วันที่ได้รับรางวัลไม่ถูกต้อง' }

  return {
    value: {
      studentId,
      studentType,
      emoji,
      title,
      description,
      awardedAt,
    },
  }
}

export async function POST(request: NextRequest) {
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const parsed = validatePayload(await request.json() as AchievementPayload)
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const data = parsed.value
    const supabaseAdmin = getServiceRoleClient()
    const { data: achievement, error } = await supabaseAdmin
      .from('student_achievements')
      .insert({
        student_id: data.studentId,
        student_type: data.studentType,
        emoji: data.emoji,
        title: data.title,
        description: data.description,
        awarded_at: data.awardedAt,
        is_active: true,
        created_by: staff.id,
      })
      .select('id, emoji, title, description, awarded_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({
      success: true,
      data: achievement ? {
        id: achievement.id,
        emoji: achievement.emoji,
        title: achievement.title,
        description: achievement.description,
        awardedAt: achievement.awarded_at,
      } : null,
    })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id : ''
    const isActive = typeof body.isActive === 'boolean' ? body.isActive : null

    if (!id || isActive === null) {
      return NextResponse.json({ error: 'ข้อมูลรางวัลไม่ถูกต้อง' }, { status: 400 })
    }

    const supabaseAdmin = getServiceRoleClient()
    const { error } = await supabaseAdmin
      .from('student_achievements')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
