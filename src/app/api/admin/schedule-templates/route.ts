import { NextRequest, NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity-log'
import { getServiceRoleClient, requireSuperAdminUser } from '@/lib/auth/admin'

interface TemplatePayload {
  id?: string
  branchId?: string
  courseTypeId?: string
  dayOfWeek?: number
  dayOfWeeks?: number[]
  startTime?: string
  endTime?: string
  isActive?: boolean
  notes?: string | null
}

interface ExistingTemplateRow {
  id: string
  day_of_week: number
}

interface InsertedTemplateRow {
  id: string
  day_of_week: number
}

interface DbError {
  message: string
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

function isTime(value?: string) {
  return Boolean(value && /^\d{2}:\d{2}$/.test(value))
}

function normalizeDayOfWeeks(payload: TemplatePayload) {
  const source = Array.isArray(payload.dayOfWeeks)
    ? payload.dayOfWeeks
    : payload.dayOfWeek !== undefined
      ? [payload.dayOfWeek]
      : []

  return Array.from(new Set(source.map(Number))).sort((a, b) => a - b)
}

function validateDays(days: number[]) {
  if (days.length === 0) return 'กรุณาเลือกอย่างน้อย 1 วัน'
  if (days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) return 'วันที่เลือกไม่ถูกต้อง'
  return null
}

function validatePayload(payload: TemplatePayload, mode: 'create' | 'update') {
  if (mode === 'create') {
    if (!payload.branchId) return 'กรุณาเลือกสาขา'
    if (!payload.courseTypeId) return 'กรุณาเลือกคอร์ส'
    const dayError = validateDays(normalizeDayOfWeeks(payload))
    if (dayError) return dayError
    if (!isTime(payload.startTime) || !isTime(payload.endTime)) return 'กรุณากรอกเวลาให้ถูกต้อง'
  }

  if (payload.dayOfWeek !== undefined) {
    const dayError = validateDays([payload.dayOfWeek])
    if (dayError) return dayError
  }

  if (payload.startTime && !isTime(payload.startTime)) return 'เวลาเริ่มไม่ถูกต้อง'
  if (payload.endTime && !isTime(payload.endTime)) return 'เวลาจบไม่ถูกต้อง'
  if (payload.startTime && payload.endTime && payload.endTime <= payload.startTime) {
    return 'เวลาจบต้องมากกว่าเวลาเริ่ม'
  }

  return null
}

export async function POST(request: NextRequest) {
  const admin = await requireSuperAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const payload = await request.json() as TemplatePayload
    const errorMessage = validatePayload(payload, 'create')
    if (errorMessage) return NextResponse.json({ error: errorMessage }, { status: 400 })

    const supabaseAdmin = getServiceRoleClient()
    const branchId = payload.branchId as string
    const courseTypeId = payload.courseTypeId as string
    const startTime = payload.startTime as string
    const endTime = payload.endTime as string
    const dayOfWeeks = normalizeDayOfWeeks(payload)

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('schedule_templates')
      .select('id, day_of_week')
      .eq('branch_id', branchId)
      .eq('course_type_id', courseTypeId)
      .eq('start_time', startTime)
      .eq('end_time', endTime)
      .in('day_of_week', dayOfWeeks) as unknown as { data: ExistingTemplateRow[] | null; error: DbError | null }

    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })

    const duplicateDays = new Set((existing || []).map((template) => template.day_of_week))
    const daysToCreate = dayOfWeeks.filter((day) => !duplicateDays.has(day))

    if (daysToCreate.length === 0) {
      return NextResponse.json({
        error: 'รอบเรียนที่เลือกมีอยู่แล้วทั้งหมด',
        createdCount: 0,
        skippedDays: dayOfWeeks,
      }, { status: 409 })
    }

    const rows = daysToCreate.map((dayOfWeek) => ({
      branch_id: branchId,
      course_type_id: courseTypeId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      is_active: payload.isActive ?? true,
      notes: payload.notes?.trim() || null,
    }))

    const scheduleTemplates = supabaseAdmin.from('schedule_templates') as unknown as {
      insert: (values: typeof rows) => {
        select: (columns: string) => PromiseLike<{ data: InsertedTemplateRow[] | null; error: DbError | null }>
      }
    }

    const { data, error } = await scheduleTemplates
      .insert(rows)
      .select('id, day_of_week')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logActivity({
      userId: admin.user.id,
      action: 'create_schedule_templates',
      entityType: 'schedule_template',
      entityId: data?.[0]?.id || null,
      details: {
        branchId,
        courseTypeId,
        startTime,
        endTime,
        notes: payload.notes?.trim() || null,
        dayOfWeeks,
        createdDays: daysToCreate,
        skippedDays: Array.from(duplicateDays).sort((a, b) => a - b),
      },
      ipAddress: request.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({
      success: true,
      templateIds: (data || []).map((template) => template.id),
      createdCount: data?.length || 0,
      createdDays: daysToCreate,
      skippedDays: Array.from(duplicateDays).sort((a, b) => a - b),
    })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await requireSuperAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const payload = await request.json() as TemplatePayload
    if (!payload.id) return NextResponse.json({ error: 'template id is required' }, { status: 400 })

    const errorMessage = validatePayload(payload, 'update')
    if (errorMessage) return NextResponse.json({ error: errorMessage }, { status: 400 })

    const updates: Record<string, string | number | boolean | null> = {}
    if (payload.branchId !== undefined) updates.branch_id = payload.branchId
    if (payload.courseTypeId !== undefined) updates.course_type_id = payload.courseTypeId
    if (payload.dayOfWeek !== undefined) updates.day_of_week = payload.dayOfWeek
    if (payload.startTime !== undefined) updates.start_time = payload.startTime
    if (payload.endTime !== undefined) updates.end_time = payload.endTime
    if (payload.isActive !== undefined) updates.is_active = payload.isActive
    if (payload.notes !== undefined) updates.notes = payload.notes?.trim() || null

    const supabaseAdmin = getServiceRoleClient()
    const { error } = await supabaseAdmin
      .from('schedule_templates')
      .update(updates)
      .eq('id', payload.id) as unknown as { error: DbError | null }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logActivity({
      userId: admin.user.id,
      action: 'update_schedule_template',
      entityType: 'schedule_template',
      entityId: payload.id,
      details: updates,
      ipAddress: request.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await requireSuperAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const templateId = request.nextUrl.searchParams.get('id')
    if (!templateId) return NextResponse.json({ error: 'template id is required' }, { status: 400 })

    const supabaseAdmin = getServiceRoleClient()
    const { error } = await supabaseAdmin
      .from('schedule_templates')
      .delete()
      .eq('id', templateId) as unknown as { error: DbError | null }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logActivity({
      userId: admin.user.id,
      action: 'delete_schedule_template',
      entityType: 'schedule_template',
      entityId: templateId,
      details: {},
      ipAddress: request.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
