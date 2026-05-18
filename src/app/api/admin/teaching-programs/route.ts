import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { logActivity } from '@/lib/activity-log'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { notifyUser } from '@/lib/notifications'
import type { Database, ProgramStatus } from '@/types/database'

interface ReviewPayload {
  programId?: string
  status?: ProgramStatus
  notes?: string
}

interface TeachingProgramRow {
  id: string
  coach_id: string
  schedule_slot_id: string
  status: ProgramStatus
}

interface UpdatedProgramRow {
  id: string
  status: ProgramStatus
  reviewed_at: string | null
  notes: string | null
  updated_at: string
}

interface SlotRow {
  date: string | null
  start_time: string | null
  end_time: string | null
  branches?: { name: string | null } | { name: string | null }[] | null
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

function firstRelationName(value: SlotRow['branches']) {
  if (!value) return null
  if (Array.isArray(value)) return value[0]?.name || null
  return value.name || null
}

function isReviewStatus(value: unknown): value is Extract<ProgramStatus, 'approved' | 'rejected'> {
  return value === 'approved' || value === 'rejected'
}

export async function PATCH(request: NextRequest) {
  const access = await requireAdminMenuAccess('teaching_programs')

  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status })
  }

  try {
    const payload = await request.json() as ReviewPayload
    const programId = payload.programId?.trim()
    const nextStatus = payload.status
    const notes = payload.notes?.trim() || null

    if (!programId) {
      return NextResponse.json({ error: 'ไม่พบโปรแกรมสอนที่ต้องการตรวจ' }, { status: 400 })
    }

    if (!isReviewStatus(nextStatus)) {
      return NextResponse.json({ error: 'สถานะตรวจไม่ถูกต้อง' }, { status: 400 })
    }

    if (nextStatus === 'rejected' && !notes) {
      return NextResponse.json({ error: 'กรุณาระบุหมายเหตุเมื่อต้องส่งกลับให้โค้ชแก้ไข' }, { status: 400 })
    }

    const supabase = getServiceRoleClient()
    const { data: program, error: programError } = await supabase
      .from('teaching_programs')
      .select('id, coach_id, schedule_slot_id, status')
      .eq('id', programId)
      .single() as unknown as { data: TeachingProgramRow | null; error: { message: string } | null }

    if (programError || !program) {
      return NextResponse.json({ error: 'ไม่พบโปรแกรมสอนนี้ในระบบ' }, { status: 404 })
    }

    if (program.status !== 'submitted') {
      return NextResponse.json({ error: 'ตรวจได้เฉพาะรายการที่โค้ชส่งมาแล้วเท่านั้น' }, { status: 409 })
    }

    const now = new Date().toISOString()
    const reviewerName = access.ctx.profile?.full_name || access.ctx.user.email || 'Admin'
    const { data: updatedProgram, error: updateError } = await supabase
      .from('teaching_programs')
      .update({
        status: nextStatus,
        reviewed_by: access.ctx.user.id,
        reviewed_at: now,
        notes,
        updated_at: now,
      })
      .eq('id', programId)
      .select('id, status, reviewed_at, notes, updated_at')
      .single() as unknown as { data: UpdatedProgramRow | null; error: { message: string } | null }

    if (updateError || !updatedProgram) {
      return NextResponse.json({ error: `บันทึกผลตรวจไม่สำเร็จ: ${updateError?.message || 'unknown error'}` }, { status: 500 })
    }

    const { data: slot } = await supabase
      .from('schedule_slots')
      .select('date, start_time, end_time, branches(name)')
      .eq('id', program.schedule_slot_id)
      .maybeSingle() as unknown as { data: SlotRow | null }

    const slotLabel = slot
      ? `${firstRelationName(slot.branches) || 'รอบสอน'} ${slot.date || ''} ${slot.start_time || ''}-${slot.end_time || ''}`.trim()
      : 'รอบสอนของคุณ'

    await notifyUser(supabase as SupabaseClient<Database>, {
      user_id: program.coach_id,
      title: nextStatus === 'approved' ? 'โปรแกรมสอนได้รับการอนุมัติ' : 'โปรแกรมสอนถูกส่งกลับให้แก้ไข',
      message: nextStatus === 'approved'
        ? `โปรแกรมสอน ${slotLabel} ผ่านการตรวจแล้ว`
        : `โปรแกรมสอน ${slotLabel} ต้องแก้ไขเพิ่มเติม${notes ? `: ${notes}` : ''}`,
      type: 'system',
      link_url: '/coach/programs',
    })

    await logActivity({
      userId: access.ctx.user.id,
      action: nextStatus === 'approved' ? 'approve_teaching_program' : 'return_teaching_program_revision',
      entityType: 'teaching_program',
      entityId: programId,
      details: {
        coachId: program.coach_id,
        scheduleSlotId: program.schedule_slot_id,
        status: nextStatus,
        notes,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({
      success: true,
      program: {
        ...updatedProgram,
        reviewed_by_name: reviewerName,
      },
    })
  } catch (error) {
    console.error('Admin teaching program review error:', error)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${getErrorMessage(error)}` }, { status: 500 })
  }
}
