import { getServiceRoleClient } from '@/lib/auth/admin'
import { getBangkokDayOfWeek, normalizeScheduleTime } from '@/lib/schedule-template-utils'

type AdminSupabase = ReturnType<typeof getServiceRoleClient>

export type ScheduleSlotIntegrityErrorCode =
  | 'SCHEDULE_SLOT_TEMPLATE_NOT_FOUND'
  | 'SCHEDULE_SLOT_TEMPLATE_AMBIGUOUS'
  | 'SCHEDULE_SLOT_TEMPLATE_MISMATCH'
  | 'SCHEDULE_SLOT_UNAVAILABLE'

export class ScheduleSlotIntegrityError extends Error {
  constructor(
    public readonly code: ScheduleSlotIntegrityErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ScheduleSlotIntegrityError'
  }
}

interface CanonicalTemplateInput {
  supabase?: AdminSupabase
  branchId: string
  courseTypeId: string
  date: string
  startTime: string
  endTime: string
}

interface EnsureScheduleSlotInput extends CanonicalTemplateInput {
  templateId: string
  scheduleSlotId?: string | null
}

interface ScheduleTemplateRow {
  id: string
  branch_id: string
  course_type_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
}

interface ScheduleSlotRow {
  id: string
  template_id: string | null
  branch_id: string
  course_type_id: string
  date: string
  start_time: string
  end_time: string
  status: string
}

interface DbError {
  message: string
  code?: string
}

const SLOT_COLUMNS = 'id, template_id, branch_id, course_type_id, date, start_time, end_time, status'

function normalizedInterval(date: string, startTime: string, endTime: string) {
  const normalizedStartTime = normalizeScheduleTime(startTime, date)
  const normalizedEndTime = normalizeScheduleTime(endTime, date)
  if (!normalizedStartTime || !normalizedEndTime || normalizedStartTime >= normalizedEndTime) {
    throw new ScheduleSlotIntegrityError('SCHEDULE_SLOT_UNAVAILABLE', 'ข้อมูลเวลารอบสอนไม่ถูกต้อง')
  }
  return { normalizedStartTime, normalizedEndTime }
}

export async function resolveCanonicalScheduleTemplate({
  supabase: providedSupabase,
  branchId,
  courseTypeId,
  date,
  startTime,
  endTime,
}: CanonicalTemplateInput) {
  const supabase = providedSupabase || getServiceRoleClient()
  const dayOfWeek = getBangkokDayOfWeek(date)
  const { normalizedStartTime, normalizedEndTime } = normalizedInterval(date, startTime, endTime)
  if (dayOfWeek === null) {
    throw new ScheduleSlotIntegrityError('SCHEDULE_SLOT_TEMPLATE_NOT_FOUND', 'วันที่รอบสอนไม่ถูกต้อง')
  }

  const { data, error } = await supabase
    .from('schedule_templates')
    .select('id, branch_id, course_type_id, day_of_week, start_time, end_time, is_active')
    .eq('branch_id', branchId)
    .eq('course_type_id', courseTypeId)
    .eq('day_of_week', dayOfWeek)
    .eq('start_time', normalizedStartTime)
    .eq('end_time', normalizedEndTime)
    .eq('is_active', true) as unknown as {
      data: ScheduleTemplateRow[] | null
      error: DbError | null
    }

  if (error) throw error
  if (!data || data.length === 0) {
    throw new ScheduleSlotIntegrityError(
      'SCHEDULE_SLOT_TEMPLATE_NOT_FOUND',
      'ไม่พบรอบเรียนประจำที่เปิดใช้งานตรงกับสาขา คอร์ส วัน และเวลา',
    )
  }
  if (data.length !== 1) {
    throw new ScheduleSlotIntegrityError(
      'SCHEDULE_SLOT_TEMPLATE_AMBIGUOUS',
      'พบรอบเรียนประจำที่เปิดใช้งานซ้ำกัน กรุณาให้ผู้ดูแลตรวจสอบ',
    )
  }
  return data[0]
}

function validateSlot(
  slot: ScheduleSlotRow | null,
  expected: {
    scheduleSlotId?: string | null
    templateId: string
    branchId: string
    courseTypeId: string
    date: string
    startTime: string
    endTime: string
  },
) {
  if (!slot) {
    throw new ScheduleSlotIntegrityError('SCHEDULE_SLOT_UNAVAILABLE', 'ไม่พบรอบสอนที่ต้องการ')
  }
  if (
    (expected.scheduleSlotId && slot.id !== expected.scheduleSlotId)
    || slot.branch_id !== expected.branchId
    || slot.course_type_id !== expected.courseTypeId
    || slot.date !== expected.date
    || normalizeScheduleTime(slot.start_time, expected.date) !== expected.startTime
    || normalizeScheduleTime(slot.end_time, expected.date) !== expected.endTime
  ) {
    throw new ScheduleSlotIntegrityError('SCHEDULE_SLOT_UNAVAILABLE', 'ข้อมูลรอบสอนไม่ตรงกับรอบที่เลือก')
  }
  if (!['open', 'full'].includes(slot.status)) {
    throw new ScheduleSlotIntegrityError('SCHEDULE_SLOT_UNAVAILABLE', 'รอบสอนนี้ถูกยกเลิกหรือไม่พร้อมใช้งาน')
  }
  if (slot.template_id !== expected.templateId) {
    throw new ScheduleSlotIntegrityError(
      'SCHEDULE_SLOT_TEMPLATE_MISMATCH',
      'รอบสอนนี้ไม่ได้เชื่อมกับรอบเรียนประจำที่ถูกต้อง',
    )
  }
  return slot
}

async function loadScheduleSlot(
  supabase: AdminSupabase,
  input: {
    scheduleSlotId?: string | null
    branchId: string
    courseTypeId: string
    date: string
    startTime: string
  },
) {
  let query = supabase.from('schedule_slots').select(SLOT_COLUMNS)
  if (input.scheduleSlotId) {
    query = query.eq('id', input.scheduleSlotId)
  } else {
    query = query
      .eq('branch_id', input.branchId)
      .eq('course_type_id', input.courseTypeId)
      .eq('date', input.date)
      .eq('start_time', input.startTime)
  }
  return await query.maybeSingle() as unknown as {
    data: ScheduleSlotRow | null
    error: DbError | null
  }
}

async function bindLegacySlot(
  supabase: AdminSupabase,
  slot: ScheduleSlotRow,
  templateId: string,
) {
  const { data, error } = await supabase
    .from('schedule_slots')
    .update({ template_id: templateId })
    .eq('id', slot.id)
    .is('template_id', null)
    .select(SLOT_COLUMNS)
    .maybeSingle() as unknown as {
      data: ScheduleSlotRow | null
      error: DbError | null
    }
  if (error) throw error
  if (data) return data

  const raced = await loadScheduleSlot(supabase, {
    scheduleSlotId: slot.id,
    branchId: slot.branch_id,
    courseTypeId: slot.course_type_id,
    date: slot.date,
    startTime: slot.start_time,
  })
  if (raced.error) throw raced.error
  return raced.data
}

export async function ensureScheduleSlot({
  supabase: providedSupabase,
  templateId,
  scheduleSlotId,
  branchId,
  courseTypeId,
  date,
  startTime,
  endTime,
}: EnsureScheduleSlotInput) {
  const supabase = providedSupabase || getServiceRoleClient()
  const { normalizedStartTime, normalizedEndTime } = normalizedInterval(date, startTime, endTime)
  const canonicalTemplate = await resolveCanonicalScheduleTemplate({
    supabase,
    branchId,
    courseTypeId,
    date,
    startTime: normalizedStartTime,
    endTime: normalizedEndTime,
  })
  // The caller-supplied id is a non-authoritative hint. The exact unique active
  // canonical match for the Bangkok date and full interval owns provenance.
  // Keeping the parameter required prevents NULL creation while avoiding stale
  // host-timezone hints from overriding authoritative template metadata.
  void templateId
  const effectiveTemplateId = canonicalTemplate.id

  const expected = {
    scheduleSlotId,
    templateId: effectiveTemplateId,
    branchId,
    courseTypeId,
    date,
    startTime: normalizedStartTime,
    endTime: normalizedEndTime,
  }
  const existing = await loadScheduleSlot(supabase, {
    scheduleSlotId,
    branchId,
    courseTypeId,
    date,
    startTime: normalizedStartTime,
  })
  if (existing.error && existing.error.code !== 'PGRST116') throw existing.error

  if (existing.data) {
    const boundSlot = existing.data.template_id === null
      ? await bindLegacySlot(supabase, existing.data, effectiveTemplateId)
      : existing.data
    return validateSlot(boundSlot, expected).id
  }
  if (scheduleSlotId) {
    throw new ScheduleSlotIntegrityError('SCHEDULE_SLOT_UNAVAILABLE', 'ไม่พบ schedule slot ที่ระบุ')
  }

  const { data: createdSlot, error: createError } = await supabase
    .from('schedule_slots')
    .insert({
      template_id: effectiveTemplateId,
      branch_id: branchId,
      course_type_id: courseTypeId,
      date,
      start_time: normalizedStartTime,
      end_time: normalizedEndTime,
      status: 'open',
    })
    .select(SLOT_COLUMNS)
    .maybeSingle() as unknown as {
      data: ScheduleSlotRow | null
      error: DbError | null
    }

  if (createError) {
    if (createError.code === '23505') {
      const raced = await loadScheduleSlot(supabase, {
        branchId,
        courseTypeId,
        date,
        startTime: normalizedStartTime,
      })
      if (raced.error) throw raced.error
      const racedSlot = raced.data?.template_id === null
        ? await bindLegacySlot(supabase, raced.data, effectiveTemplateId)
        : raced.data
      return validateSlot(racedSlot, expected).id
    }
    throw createError
  }

  return validateSlot(createdSlot, expected).id
}
