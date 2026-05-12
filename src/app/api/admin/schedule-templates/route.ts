import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireSuperAdminUser } from '@/lib/auth/admin'
import { logActivity } from '@/lib/activity-log'

interface TemplatePayload {
  id?: string
  branchId?: string
  courseTypeId?: string
  dayOfWeek?: number
  startTime?: string
  endTime?: string
  isActive?: boolean
  notes?: string | null
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

function validatePayload(payload: TemplatePayload, mode: 'create' | 'update') {
  if (mode === 'create') {
    if (!payload.branchId) return 'กรุณาเลือกสาขา'
    if (!payload.courseTypeId) return 'กรุณาเลือกคอร์ส'
    if (payload.dayOfWeek === undefined) return 'กรุณาเลือกวัน'
    if (!isTime(payload.startTime) || !isTime(payload.endTime)) return 'กรุณากรอกเวลาให้ถูกต้อง'
  }

  if (payload.dayOfWeek !== undefined && (payload.dayOfWeek < 0 || payload.dayOfWeek > 6)) {
    return 'วันไม่ถูกต้อง'
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
    const { data: duplicate } = await supabaseAdmin
      .from('schedule_templates')
      .select('id')
      .eq('branch_id', payload.branchId)
      .eq('course_type_id', payload.courseTypeId)
      .eq('day_of_week', payload.dayOfWeek)
      .eq('start_time', payload.startTime)
      .eq('end_time', payload.endTime)
      .limit(1)
      .maybeSingle() as unknown as { data: { id: string } | null }

    if (duplicate) {
      return NextResponse.json({ error: 'มีรอบเรียนนี้อยู่แล้ว' }, { status: 409 })
    }

    const { data, error } = await supabaseAdmin
      .from('schedule_templates')
      .insert({
        branch_id: payload.branchId,
        course_type_id: payload.courseTypeId,
        day_of_week: payload.dayOfWeek,
        start_time: payload.startTime,
        end_time: payload.endTime,
        is_active: payload.isActive ?? true,
        notes: payload.notes?.trim() || null,
      })
      .select('id')
      .single() as unknown as { data: { id: string } | null; error: DbError | null }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logActivity({
      userId: admin.user.id,
      action: 'create_schedule_template',
      entityType: 'schedule_template',
      entityId: data?.id || null,
      details: { ...payload },
      ipAddress: request.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ success: true, templateId: data?.id })
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
