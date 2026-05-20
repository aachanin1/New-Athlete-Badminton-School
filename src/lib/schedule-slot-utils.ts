import { getServiceRoleClient } from '@/lib/auth/admin'

interface EnsureScheduleSlotInput {
  supabase?: ReturnType<typeof getServiceRoleClient>
  templateId?: string | null
  branchId: string
  courseTypeId: string
  date: string
  startTime: string
  endTime: string
}

interface ScheduleSlotIdRow {
  id: string
}

interface DbError {
  message: string
  code?: string
}

interface SelectScheduleSlotQuery {
  eq(column: string, value: string): SelectScheduleSlotQuery
  maybeSingle(): Promise<{ data: ScheduleSlotIdRow | null; error: DbError | null }>
}

interface InsertScheduleSlotQuery {
  select(columns: string): {
    maybeSingle(): Promise<{ data: ScheduleSlotIdRow | null; error: DbError | null }>
  }
}

interface ScheduleSlotTable {
  select(columns: string): SelectScheduleSlotQuery
  insert(values: Record<string, unknown>): InsertScheduleSlotQuery
}

function scheduleSlotsTable(supabase: ReturnType<typeof getServiceRoleClient>) {
  return supabase.from('schedule_slots') as unknown as ScheduleSlotTable
}

function normalizeTime(value: string) {
  const short = value.slice(0, 5)
  return `${short}:00`
}

export async function ensureScheduleSlot({
  supabase: providedSupabase,
  templateId,
  branchId,
  courseTypeId,
  date,
  startTime,
  endTime,
}: EnsureScheduleSlotInput) {
  const supabase = providedSupabase || getServiceRoleClient()
  const normalizedStartTime = normalizeTime(startTime)
  const normalizedEndTime = normalizeTime(endTime)
  const table = scheduleSlotsTable(supabase)

  const { data: existingSlot, error: existingError } = await table
    .select('id')
    .eq('branch_id', branchId)
    .eq('course_type_id', courseTypeId)
    .eq('date', date)
    .eq('start_time', normalizedStartTime)
    .maybeSingle()

  if (existingError && existingError.code !== 'PGRST116') {
    throw existingError
  }

  if (existingSlot?.id) {
    return existingSlot.id
  }

  const { data: createdSlot, error: createError } = await table
    .insert({
      template_id: templateId || null,
      branch_id: branchId,
      course_type_id: courseTypeId,
      date,
      start_time: normalizedStartTime,
      end_time: normalizedEndTime,
      status: 'open',
    })
    .select('id')
    .maybeSingle()

  if (createError) {
    if (createError.code === '23505') {
      const { data: racedSlot, error: racedError } = await table
        .select('id')
        .eq('branch_id', branchId)
        .eq('course_type_id', courseTypeId)
        .eq('date', date)
        .eq('start_time', normalizedStartTime)
        .maybeSingle()

      if (racedError) throw racedError
      if (racedSlot?.id) return racedSlot.id
    }

    throw createError
  }

  if (!createdSlot?.id) {
    throw new Error('Unable to create schedule slot')
  }

  return createdSlot.id as string
}
