import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'

import { logActivity } from '@/lib/activity-log'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { notifyRoles } from '@/lib/notifications'
import { createClient } from '@/lib/supabase/server'
import type { ProgramStatus, UserRole } from '@/types/database'

interface ProfileRoleRow {
  role: UserRole
}

interface ProfileNameRow {
  full_name: string | null
}

interface ProgramPayload {
  programId?: string
  scheduleSlotId?: string
  programContent?: string
  status?: ProgramStatus
}

interface DbError {
  message: string
}

interface InsertedProgramRow {
  id: string
}

interface ExistingProgramRow {
  id: string
  status: ProgramStatus
  schedule_slot_id: string | null
}

type ProgramMutationChain = PromiseLike<{ data?: InsertedProgramRow | null; error: DbError | null }> & {
  eq: (column: string, value: string) => ProgramMutationChain
  select: (columns: string) => ProgramMutationChain
  single: () => PromiseLike<{ data: InsertedProgramRow | null; error: DbError | null }>
}

type ProgramMutationTable = {
  update: (values: Record<string, unknown>) => ProgramMutationChain
  insert: (values: Record<string, unknown>) => ProgramMutationChain
  delete: () => ProgramMutationChain
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

function normalizeStatus(value: unknown): Extract<ProgramStatus, 'draft' | 'submitted'> {
  return value === 'submitted' ? 'submitted' : 'draft'
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

async function isAssignedToSlot(supabase: ReturnType<typeof createClient>, coach: User, scheduleSlotId: string) {
  const { data: group } = await supabase
    .from('coach_assignment_groups')
    .select('id')
    .eq('coach_id', coach.id)
    .eq('schedule_slot_id', scheduleSlotId)
    .limit(1)
    .maybeSingle()

  if (group) return true

  const { data: legacyAssignment } = await supabase
    .from('coach_assignments')
    .select('id')
    .eq('coach_id', coach.id)
    .eq('schedule_slot_id', scheduleSlotId)
    .limit(1)
    .maybeSingle()

  return Boolean(legacyAssignment)
}

async function getOwnedProgram(supabase: ReturnType<typeof createClient>, coach: User, programId: string) {
  const { data, error } = await supabase
    .from('teaching_programs')
    .select('id, status, schedule_slot_id')
    .eq('id', programId)
    .eq('coach_id', coach.id)
    .single() as unknown as { data: ExistingProgramRow | null; error: DbError | null }

  return { data, error }
}

async function getExistingProgramForSlot(
  supabase: ReturnType<typeof createClient>,
  coach: User,
  scheduleSlotId: string,
  exceptProgramId?: string,
) {
  let query = supabase
    .from('teaching_programs')
    .select('id, status, schedule_slot_id')
    .eq('coach_id', coach.id)
    .eq('schedule_slot_id', scheduleSlotId)

  if (exceptProgramId) {
    query = query.neq('id', exceptProgramId)
  }

  const { data } = await query
    .limit(1)
    .maybeSingle() as unknown as { data: ExistingProgramRow | null; error: DbError | null }

  return data
}

async function updateProgram(supabase: ReturnType<typeof createClient>, coach: User, payload: Required<Pick<ProgramPayload, 'programId' | 'programContent' | 'scheduleSlotId'>> & { status: ProgramStatus }) {
  const table = supabase.from('teaching_programs') as unknown as ProgramMutationTable
  return table
    .update({
      schedule_slot_id: payload.scheduleSlotId,
      program_content: payload.programContent,
      status: payload.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payload.programId)
    .eq('coach_id', coach.id) as unknown as PromiseLike<{ error: DbError | null }>
}

async function insertProgram(supabase: ReturnType<typeof createClient>, coach: User, payload: { scheduleSlotId: string; programContent: string; status: ProgramStatus }) {
  const table = supabase.from('teaching_programs') as unknown as ProgramMutationTable
  return table
    .insert({
      coach_id: coach.id,
      schedule_slot_id: payload.scheduleSlotId,
      program_content: payload.programContent,
      status: payload.status,
    })
    .select('id')
    .single() as unknown as PromiseLike<{ data: InsertedProgramRow | null; error: DbError | null }>
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const coach = await requireCoach(supabase)
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const payload = await request.json() as ProgramPayload
    const programContent = payload.programContent?.trim()
    const scheduleSlotId = payload.scheduleSlotId?.trim()
    const status = normalizeStatus(payload.status)

    if (!scheduleSlotId) {
      return NextResponse.json({ error: 'กรุณาเลือกรอบสอนก่อนบันทึกโปรแกรม' }, { status: 400 })
    }

    if (!programContent) {
      return NextResponse.json({ error: 'กรุณากรอกเนื้อหาโปรแกรม' }, { status: 400 })
    }

    const assigned = await isAssignedToSlot(supabase, coach, scheduleSlotId)
    if (!assigned) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์ส่งโปรแกรมให้รอบสอนนี้' }, { status: 403 })
    }

    if (payload.programId) {
      const { data: currentProgram, error: fetchError } = await getOwnedProgram(supabase, coach, payload.programId)

      if (fetchError || !currentProgram) {
        return NextResponse.json({ error: 'ไม่พบโปรแกรมสอนของคุณ' }, { status: 404 })
      }

      if (!['draft', 'rejected'].includes(currentProgram.status)) {
        return NextResponse.json({ error: 'รอบนี้ส่งโปรแกรมแล้ว ไม่สามารถแก้หรือส่งซ้ำได้' }, { status: 409 })
      }

      const duplicateProgram = await getExistingProgramForSlot(supabase, coach, scheduleSlotId, currentProgram.id)
      if (duplicateProgram) {
        return NextResponse.json({ error: 'รอบนี้มีโปรแกรมสอนแล้ว กรุณาแก้ไขรายการเดิมแทน' }, { status: 409 })
      }

      const { error } = await updateProgram(supabase, coach, {
        programId: payload.programId,
        scheduleSlotId,
        programContent,
        status,
      })

      if (error) {
        return NextResponse.json({ error: `อัปเดตไม่สำเร็จ: ${error.message}` }, { status: 500 })
      }

      await logActivity({
        userId: coach.id,
        action: 'update_teaching_program',
        entityType: 'program',
        entityId: payload.programId,
        details: { status },
        ipAddress: request.headers.get('x-forwarded-for'),
      })
    } else {
      const duplicateProgram = await getExistingProgramForSlot(supabase, coach, scheduleSlotId)
      if (duplicateProgram) {
        return NextResponse.json({ error: 'รอบนี้มีโปรแกรมสอนแล้ว กรุณาเลือกแก้ไขรายการเดิม หรือเลือกรอบอื่น' }, { status: 409 })
      }

      const { data: insertedProgram, error } = await insertProgram(supabase, coach, { scheduleSlotId, programContent, status })

      if (error) {
        return NextResponse.json({ error: `สร้างไม่สำเร็จ: ${error.message}` }, { status: 500 })
      }

      await logActivity({
        userId: coach.id,
        action: 'create_teaching_program',
        entityType: 'program',
        entityId: insertedProgram?.id || null,
        details: { status },
        ipAddress: request.headers.get('x-forwarded-for'),
      })
    }

    if (status === 'submitted') {
      const adminSupabase = getServiceRoleClient()
      const { data: profile } = await adminSupabase
        .from('profiles')
        .select('full_name')
        .eq('id', coach.id)
        .single() as unknown as { data: ProfileNameRow | null }

      await notifyRoles(adminSupabase as SupabaseClient, {
        roles: ['super_admin', 'admin'],
        title: 'โปรแกรมสอนรอตรวจ',
        message: `${profile?.full_name || 'โค้ช'} ส่งโปรแกรมสอนเข้าตรวจแล้ว`,
        type: 'system',
        link_url: '/admin/teaching-programs',
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Program error:', error)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${getErrorMessage(error)}` }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient()
  const coach = await requireCoach(supabase)
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const programId = searchParams.get('id')?.trim()
    if (!programId) {
      return NextResponse.json({ error: 'ไม่พบโปรแกรมที่ต้องการลบ' }, { status: 400 })
    }

    const { data: program, error: fetchError } = await supabase
      .from('teaching_programs')
      .select('id, status')
      .eq('id', programId)
      .eq('coach_id', coach.id)
      .single() as unknown as { data: ExistingProgramRow | null; error: DbError | null }

    if (fetchError || !program) {
      return NextResponse.json({ error: 'ไม่พบฉบับร่างของคุณ' }, { status: 404 })
    }

    if (program.status !== 'draft') {
      return NextResponse.json({ error: 'ลบได้เฉพาะฉบับร่างเท่านั้น' }, { status: 400 })
    }

    const table = supabase.from('teaching_programs') as unknown as ProgramMutationTable
    const { error } = await table
      .delete()
      .eq('id', programId)
      .eq('coach_id', coach.id) as unknown as { error: DbError | null }

    if (error) {
      return NextResponse.json({ error: `ลบฉบับร่างไม่สำเร็จ: ${error.message}` }, { status: 500 })
    }

    await logActivity({
      userId: coach.id,
      action: 'delete_teaching_program_draft',
      entityType: 'program',
      entityId: programId,
      details: { status: 'draft' },
      ipAddress: request.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Program delete error:', error)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${getErrorMessage(error)}` }, { status: 500 })
  }
}
