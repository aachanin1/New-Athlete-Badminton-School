import { NextRequest, NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity-log'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'

interface ProfileRoleRow {
  role: UserRole
}

interface TemplatePayload {
  templateId?: string
  title?: string
  content?: string
  category?: string | null
  isActive?: boolean
}

interface TemplateRow {
  id: string
  title: string
  content: string
  category: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface DbError {
  message: string
}

type TemplateMutationChain = {
  eq: (column: string, value: string) => TemplateMutationChain
  select: (columns: string) => TemplateMutationChain
  single: () => PromiseLike<{ data: TemplateRow | null; error: DbError | null }>
}

type TemplateMutationTable = {
  insert: (values: Record<string, unknown>) => TemplateMutationChain
  update: (values: Record<string, unknown>) => TemplateMutationChain
}

async function requireCoach(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as unknown as { data: ProfileRoleRow | null }

  if (!profile || !['coach', 'head_coach', 'admin', 'super_admin'].includes(profile.role)) return null
  return user
}

function normalizeTemplatePayload(payload: TemplatePayload) {
  const title = payload.title?.trim()
  const content = payload.content?.trim()
  const category = payload.category?.trim() || null

  return { title, content, category }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

function mapTemplate(row: TemplateRow) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const coach = await requireCoach(supabase)
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const payload = await request.json() as TemplatePayload
    const { title, content, category } = normalizeTemplatePayload(payload)

    if (!title) return NextResponse.json({ error: 'กรุณากรอกชื่อ template' }, { status: 400 })
    if (title.length > 120) return NextResponse.json({ error: 'ชื่อ template ยาวเกินไป' }, { status: 400 })
    if (!content) return NextResponse.json({ error: 'กรุณากรอกเนื้อหาโปรแกรมสอน' }, { status: 400 })

    const table = supabase.from('coach_program_templates') as unknown as TemplateMutationTable
    const { data, error } = await table
      .insert({
        coach_id: coach.id,
        title,
        content,
        category,
        is_active: true,
      })
      .select('id, title, content, category, is_active, created_at, updated_at')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: `สร้าง template ไม่สำเร็จ: ${error?.message || 'unknown error'}` }, { status: 500 })
    }

    await logActivity({
      userId: coach.id,
      action: 'create_coach_program_template',
      entityType: 'coach_program_template',
      entityId: data.id,
      details: { title, category },
      ipAddress: request.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ success: true, template: mapTemplate(data) })
  } catch (error) {
    console.error('Program template create error:', error)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${getErrorMessage(error)}` }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const coach = await requireCoach(supabase)
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const payload = await request.json() as TemplatePayload
    const templateId = payload.templateId?.trim()
    if (!templateId) return NextResponse.json({ error: 'ไม่พบ template ที่ต้องการแก้ไข' }, { status: 400 })

    const { title, content, category } = normalizeTemplatePayload(payload)
    const values: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (payload.title !== undefined) {
      if (!title) return NextResponse.json({ error: 'กรุณากรอกชื่อ template' }, { status: 400 })
      if (title.length > 120) return NextResponse.json({ error: 'ชื่อ template ยาวเกินไป' }, { status: 400 })
      values.title = title
    }

    if (payload.content !== undefined) {
      if (!content) return NextResponse.json({ error: 'กรุณากรอกเนื้อหาโปรแกรมสอน' }, { status: 400 })
      values.content = content
    }

    if (payload.category !== undefined) values.category = category
    if (payload.isActive !== undefined) values.is_active = Boolean(payload.isActive)

    const table = supabase.from('coach_program_templates') as unknown as TemplateMutationTable
    const { data, error } = await table
      .update(values)
      .eq('id', templateId)
      .eq('coach_id', coach.id)
      .select('id, title, content, category, is_active, created_at, updated_at')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: `แก้ไข template ไม่สำเร็จ: ${error?.message || 'not found'}` }, { status: 500 })
    }

    await logActivity({
      userId: coach.id,
      action: 'update_coach_program_template',
      entityType: 'coach_program_template',
      entityId: data.id,
      details: { updatedFields: Object.keys(values) },
      ipAddress: request.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ success: true, template: mapTemplate(data) })
  } catch (error) {
    console.error('Program template update error:', error)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${getErrorMessage(error)}` }, { status: 500 })
  }
}
