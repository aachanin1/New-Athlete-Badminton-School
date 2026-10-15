import { NextRequest, NextResponse } from 'next/server'
import { isDeepStrictEqual } from 'node:util'
import { readAssignmentContext, verifyAssignmentContext, type SignedAssignmentContext } from '@/lib/assignment-save-context'

import { getServiceRoleClient } from '@/lib/auth/admin'
import { notifyAssignedCoachesForSlot } from '@/lib/coach-notifications'
import {
  checkCoachAssignmentConflicts,
  formatCoachAssignmentDatabaseError,
  formatExactCoachConflict,
  formatLegacyCoachWarnings,
  type LegacyCoachAssignmentWarningRow,
} from '@/lib/coach-assignment-conflicts'
import {
  formatAutoGroupNameError,
  resolveCoachAssignmentGroupName,
} from '@/lib/coach-assignment-group-naming'
import { loadAssignmentGroupNamingStudents } from '@/lib/coach-assignment-group-naming-server'
import { getCoachAssignmentRetry } from '@/lib/coach-assignment-write-errors'
import { createClient } from '@/lib/supabase/server'

type AssignmentManagerRole = 'head_coach' | 'admin' | 'super_admin'

interface GroupPayload {
  name?: string
  coachId?: string | null
  levelMin?: number | null
  levelMax?: number | null
  sortOrder?: number
  studentSessionIds?: string[]
}

interface BookingSessionForGroup {
  id: string
  schedule_slot_id: string
  child_id: string | null
  bookings?: {
    user_id: string
    learner_type: 'self' | 'child'
    status: string
  } | null
}

interface ScheduleSlotForNotification {
  id: string
  branch_id: string
  date: string
  start_time: string
  end_time: string
  branches?: { name: string | null } | null
  course_types?: { name: string | null } | null
}

async function requireAssignmentManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as unknown as { data: { role: string } | null }

  if (!profile || !['head_coach', 'admin', 'super_admin'].includes(profile.role)) {
    return null
  }

  return { user, role: profile.role as AssignmentManagerRole }
}

function normalizeLevel(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function getBangkokSlotStart(date: string, startTime: string) {
  return new Date(`${date}T${startTime.slice(0, 8)}+07:00`)
}

function isAssignmentLocked(date: string, startTime: string, now = new Date()) {
  return now >= getBangkokSlotStart(date, startTime)
}

function getLifecycleConflict(errorMessage: string) {
  if (errorMessage.includes('COACH_ASSIGNMENT_BASELINE_CONFLICT')) return {
    code: 'COACH_ASSIGNMENT_BASELINE_CONFLICT',
    error: 'การมอบหมายบน Server เปลี่ยนแล้ว กรุณารีเฟรชและตรวจกลุ่มก่อนบันทึกอีกครั้ง',
  }
  if (errorMessage.includes('COACH_ASSIGNMENT_DUPLICATE_MEMBERSHIP')) {
    return {
      code: 'COACH_ASSIGNMENT_DUPLICATE_MEMBERSHIP',
      error: 'พบผู้เรียนซ้ำข้ามกลุ่ม กรุณารีเฟรชและตรวจการแบ่งกลุ่มอีกครั้ง',
    }
  }
  if (errorMessage.includes('COACH_ASSIGNMENT_ROSTER_CONFLICT')) {
    return {
      code: 'COACH_ASSIGNMENT_ROSTER_CONFLICT',
      error: 'รายชื่อผู้เรียนในรอบเปลี่ยนแล้ว กรุณารีเฟรชและตรวจกลุ่มก่อนบันทึกอีกครั้ง',
    }
  }
  return null
}

function getCanonicalGroups(saveResult: unknown) {
  if (!saveResult || typeof saveResult !== 'object' || Array.isArray(saveResult)) return []
  const snapshot = (saveResult as { snapshot?: unknown }).snapshot
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return []
  const groups = (snapshot as { groups?: unknown }).groups
  return Array.isArray(groups) ? groups : []
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const manager = await requireAssignmentManager(supabase)
  if (!manager) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json() as {
      scheduleSlotId?: string
      branchId?: string
      groups?: GroupPayload[]
      expectedGroups?: unknown[]
      requestId?: string
      deadline?: string
      saveContext?: SignedAssignmentContext
      prepare?: boolean
    }

    const { scheduleSlotId, branchId } = body
    const groups = Array.isArray(body.groups) ? body.groups : []

    if (!scheduleSlotId || !branchId) {
      return NextResponse.json({ error: 'ข้อมูลรอบสอนไม่ครบ' }, { status: 400 })
    }

    if (groups.length === 0) {
      return NextResponse.json({ error: 'กรุณาสร้างอย่างน้อย 1 กลุ่ม' }, { status: 400 })
    }

    const adminSupabase = getServiceRoleClient()

    if (manager.role === 'head_coach') {
      const { data: ownBranch } = await adminSupabase
        .from('coach_branches')
        .select('branch_id')
        .eq('coach_id', manager.user.id)
        .eq('branch_id', branchId)
        .maybeSingle() as unknown as { data: { branch_id: string } | null }

      if (!ownBranch) {
        return NextResponse.json({ error: 'คุณไม่มีสิทธิ์จัดกลุ่มรอบสอนของสาขานี้' }, { status: 403 })
      }
    }

    const { data: slot } = await adminSupabase
      .from('schedule_slots')
      .select(`
        id,
        branch_id,
        date,
        start_time,
        end_time,
        branches(name),
        course_types(name)
      `)
      .eq('id', scheduleSlotId)
      .single() as unknown as { data: ScheduleSlotForNotification | null }

    if (!slot || slot.branch_id !== branchId) {
      return NextResponse.json({ error: 'ไม่พบรอบสอนที่ต้องการจัดกลุ่ม' }, { status: 404 })
    }

    const intent = { groups: body.groups, expectedGroups: body.expectedGroups, saveContext: body.saveContext, deadline: body.deadline }
    let context
    if (body.requestId || body.saveContext) {
      if (!/^[0-9a-f-]{36}$/i.test(body.requestId || '') || !body.saveContext) return NextResponse.json({ error: 'ข้อมูลคำขอไม่ครบ' }, { status: 400 })
      try { context = verifyAssignmentContext(body.saveContext, manager.user.id, scheduleSlotId) }
      catch { return NextResponse.json({ error: 'กรุณาโหลดข้อมูลรอบเรียนล่าสุด' }, { status: 409 }) }
      const receipt = await adminSupabase.from('assignment5_receipts').select('intent,result,slot_id').eq('actor_id', manager.user.id).eq('request_id', body.requestId!).maybeSingle()
      if (receipt.error) return NextResponse.json({ error: 'ยังตรวจผลคำขอไม่ได้' }, { status: 503 })
      if (receipt.data) {
        if (receipt.data.slot_id !== scheduleSlotId || !isDeepStrictEqual(receipt.data.intent, intent)) return NextResponse.json({ code: 'COACH_ASSIGNMENT_REQUEST_MISMATCH', error: 'รหัสคำขอนี้ใช้กับรายการอื่นแล้ว' }, { status: 409 })
        return assignmentResponse(manager.user.id, scheduleSlotId, { ...receipt.data.result, replayed: true })
      }
      const admitted = await adminSupabase.rpc('assignment5_admit_v1', { p_actor: manager.user.id, p_slot: scheduleSlotId,
        p_request: body.requestId, p_intent: intent, p_attempt: body.prepare !== true })
      if (admitted.error) {
        const retry = getCoachAssignmentRetry(admitted.error)
        return NextResponse.json(retry || { code: 'COACH_ASSIGNMENT_STOPPED', error: 'รายการนี้หมดเวลารอแล้ว งานของคุณยังอยู่ กรุณาลองอีกครั้ง' }, { status: 409 })
      }
      if (body.prepare) return NextResponse.json(admitted.data)
    }

    if (isAssignmentLocked(slot.date, slot.start_time)) {
      return NextResponse.json({ error: 'รอบเรียนนี้เริ่มหรือเลยเวลาเรียนแล้ว ไม่สามารถมอบหมาย/แก้ไขกลุ่มได้ กรุณาใช้ flow ตรวจสอบ attendance gap หรือข้อมูลย้อนหลังแทน' }, { status: 409 })
    }

    const submittedSessionIds = Array.from(new Set(groups.flatMap((group) => group.studentSessionIds || [])))

    const { data: sessions } = submittedSessionIds.length > 0
      ? await adminSupabase
        .from('booking_sessions')
        .select('id, schedule_slot_id, child_id, bookings!inner(user_id, learner_type, status)')
        .in('id', submittedSessionIds) as unknown as { data: BookingSessionForGroup[] | null }
      : { data: [] as BookingSessionForGroup[] }

    const sessionMap = new Map((sessions || []).map((session) => [session.id, session]))
    const invalidSession = submittedSessionIds.find((id) => sessionMap.get(id)?.schedule_slot_id !== scheduleSlotId)
    if (invalidSession) {
      return NextResponse.json({ error: 'มีผู้เรียนที่ไม่ได้อยู่ในรอบสอนนี้' }, { status: 400 })
    }

    const nonVerifiedSession = submittedSessionIds.find((id) => sessionMap.get(id)?.bookings?.status !== 'verified')
    if (nonVerifiedSession) {
      return NextResponse.json({ error: 'จองยังไม่สมบูรณ์ ต้องยืนยันการชำระเงินก่อนมอบหมายโค้ช' }, { status: 400 })
    }

    const submittedCoachIds = groups.map((group) => group.coachId).filter(Boolean) as string[]
    const coachIds = Array.from(new Set(submittedCoachIds))
    if (coachIds.length !== submittedCoachIds.length) {
      return NextResponse.json({ error: 'โค้ช 1 คนไม่สามารถรับผิดชอบหลายกลุ่มในรอบเวลาเดียวกันได้' }, { status: 400 })
    }

    if (coachIds.length > 0) {
      const { data: coachBranches } = await adminSupabase
        .from('coach_branches')
        .select('coach_id')
        .eq('branch_id', branchId)
        .in('coach_id', coachIds) as unknown as { data: { coach_id: string }[] | null }

      const allowedCoachIds = new Set((coachBranches || []).map((row) => row.coach_id))
      const invalidCoachId = coachIds.find((coachId) => !allowedCoachIds.has(coachId))
      if (invalidCoachId) {
        return NextResponse.json({ error: 'มีโค้ชที่ไม่ได้อยู่ในสาขานี้' }, { status: 400 })
      }
    }

    const legacyWarnings: LegacyCoachAssignmentWarningRow[] = []
    for (const coachId of coachIds) {
      const conflictResult = await checkCoachAssignmentConflicts({
        supabase: adminSupabase,
        coachId,
        scheduleSlotId,
        replaceCurrentSlot: true,
      })
      if (conflictResult.exactConflicts[0]) {
        return NextResponse.json({
          error: formatExactCoachConflict(conflictResult.exactConflicts[0]),
        }, { status: 409 })
      }
      legacyWarnings.push(...conflictResult.legacyWarnings)
    }

    const namingStudentsBySessionId = await loadAssignmentGroupNamingStudents(adminSupabase, submittedSessionIds)
    const normalizedGroups = [] as Array<{
      name: string
      coachId: string | null
      levelMin: number | null
      levelMax: number | null
      sortOrder: number
      studentSessionIds: string[]
    }>

    for (const [index, group] of groups.entries()) {
      const studentSessionIds = group.studentSessionIds || []
      const namingStudents = studentSessionIds
        .map((sessionId) => namingStudentsBySessionId.get(sessionId))
        .filter((student): student is NonNullable<typeof student> => Boolean(student))
      const resolvedName = resolveCoachAssignmentGroupName({ currentName: group.name, students: namingStudents })

      if (!resolvedName.name && resolvedName.error) {
        return NextResponse.json({ error: formatAutoGroupNameError(resolvedName.error) }, { status: 400 })
      }

      normalizedGroups.push({
        name: resolvedName.name || (group.name || '').trim(),
        coachId: group.coachId || null,
        levelMin: resolvedName.levelMin ?? normalizeLevel(group.levelMin),
        levelMax: resolvedName.levelMax ?? normalizeLevel(group.levelMax),
        sortOrder: Number.isFinite(Number(group.sortOrder)) ? Number(group.sortOrder) : index,
        studentSessionIds,
      })
    }

    if (!Array.isArray(body.expectedGroups)) return NextResponse.json({ code: 'COACH_ASSIGNMENT_BASELINE_REQUIRED', error: 'กรุณาโหลดข้อมูลการมอบหมายล่าสุดก่อนบันทึก' }, { status: 409 })
    const { data: saveResult, error: saveError } = context ? await adminSupabase.rpc('assignment5_save_v1', {
      p_actor: manager.user.id, p_slot: scheduleSlotId, p_request: body.requestId,
      p_intent: intent, p_groups: normalizedGroups, p_context: context,
    }) : await adminSupabase.rpc('save_coach_assignment_groups_v3', {
      p_schedule_slot_id: scheduleSlotId,
      p_actor_id: manager.user.id,
      p_groups: normalizedGroups,
      p_expected_groups: body.expectedGroups,
    })

    if (saveError) {
      const retry = getCoachAssignmentRetry(saveError)
      if (retry) return NextResponse.json(retry, { status: 409 })
      if (/COACH_ASSIGNMENT_(INTENT_EXPIRED|STARTED|FORBIDDEN|REQUEST_MISMATCH)/.test(saveError.message)) return NextResponse.json({ code: 'COACH_ASSIGNMENT_STOPPED', error: 'รายการนี้ไม่สามารถบันทึกต่อได้ กรุณาตรวจข้อมูลรอบเรียน' }, { status: 409 })
      const lifecycleConflict = getLifecycleConflict(saveError.message)
      if (lifecycleConflict) {
        return NextResponse.json(lifecycleConflict, { status: 409 })
      }
      const conflictMessage = formatCoachAssignmentDatabaseError(saveError.message)
      return NextResponse.json({
        error: conflictMessage || `บันทึกกลุ่มไม่สำเร็จ: ${saveError.message}`,
      }, { status: conflictMessage ? 409 : 500 })
    }

    if (context) return assignmentResponse(manager.user.id, scheduleSlotId, saveResult)

    const assignedCoachIds = (saveResult as { no_change?: boolean } | null)?.no_change ? [] : coachIds
    const delivery = await Promise.allSettled(assignedCoachIds.map((coachId) => {
      const coachGroups = groups.filter((group) => group.coachId === coachId)
      const coachStudentCount = coachGroups.reduce((sum, group) => sum + (group.studentSessionIds?.length || 0), 0)

      return notifyAssignedCoachesForSlot(adminSupabase, {
        coachIds: [coachId],
        slot,
        groupCount: coachGroups.length,
        studentCount: coachStudentCount,
      })
    }))
    const deliveryIncomplete = delivery.some(result => result.status === 'rejected' || result.value.some(recipient => !recipient.success))

    return NextResponse.json({
      success: true,
      scheduleSlotId,
      warnings: [formatLegacyCoachWarnings(legacyWarnings), deliveryIncomplete ? 'บันทึกกลุ่มสำเร็จ แต่การแจ้งโค้ชยังยืนยันไม่ครบ กรุณาตรวจแจ้งเตือน' : null].filter(Boolean).join(' · ') || null,
      canonicalGroups: getCanonicalGroups(saveResult),
      result: saveResult,
    })
  } catch (error: unknown) {
    console.error('Coach assignment groups error:', error)
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function assignmentResponse(actor: string, slot: string, result: Record<string, unknown>) {
  const latest = await readAssignmentContext(actor, slot)
  return NextResponse.json({ success: true, confirmed: true, scheduleSlotId: slot,
    canonicalGroups: latest.context.groups, rosterSessionIds: latest.context.rosterSessionIds,
    saveContext: latest.signed, noAssignmentNeeded: latest.context.rosterSessionIds.length === 0,
    result }, { headers: { 'Cache-Control': 'private, no-store' } })
}

// Readback after an uncertain Save is read-only and uses the same manager/branch gate.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const manager = await requireAssignmentManager(supabase)
  if (!manager) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = request.nextUrl.searchParams.get('scheduleSlotId') || ''
  const branchId = request.nextUrl.searchParams.get('branchId') || ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'ข้อมูลรอบสอนไม่ถูกต้อง' }, { status: 400 })
  const { data: slot, error } = await supabase.from('schedule_slots').select('id, branch_id').eq('id', id).maybeSingle() as unknown as { data: { id: string; branch_id: string } | null; error: { message: string } | null }
  if (error) return NextResponse.json({ error: 'อ่านข้อมูลรอบสอนไม่สำเร็จ' }, { status: 503 })
  if (!slot || slot.branch_id !== branchId) return NextResponse.json({ error: 'ไม่พบรอบสอน' }, { status: 404 })
  if (manager.role === 'head_coach') {
    const own = await supabase.from('coach_branches').select('branch_id').eq('coach_id', manager.user.id).eq('branch_id', branchId).maybeSingle()
    if (own.error) return NextResponse.json({ error: 'ตรวจสิทธิ์สาขาไม่สำเร็จ' }, { status: 503 })
    if (!own.data) return NextResponse.json({ error: 'ไม่มีสิทธิ์ในสาขานี้' }, { status: 403 })
  }
  const requestId = request.nextUrl.searchParams.get('requestId')
  if (requestId) {
    if (!/^[0-9a-f-]{36}$/i.test(requestId)) return NextResponse.json({ error: 'ข้อมูลคำขอไม่ถูกต้อง' }, { status: 400 })
    const receipt = await getServiceRoleClient().rpc('assignment5_status_v1', { p_actor: manager.user.id, p_slot: id, p_request: requestId })
    if (receipt.error) return NextResponse.json({ error: 'ยังยืนยันผลบันทึกไม่ได้' }, { status: 503 })
    if (receipt.data?.confirmed) return assignmentResponse(manager.user.id, id, receipt.data.result)
    return NextResponse.json(receipt.data, { headers: { 'Cache-Control': 'private, no-store' } })
  }
  try {
    const latest = await readAssignmentContext(manager.user.id, id)
    return NextResponse.json({ canonicalGroups: latest.context.groups, rosterSessionIds: latest.context.rosterSessionIds,
      saveContext: latest.signed }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch { return NextResponse.json({ error: 'อ่านรายชื่อปัจจุบันไม่ครบ กรุณาลองอีกครั้ง' }, { status: 503 }) }
}
