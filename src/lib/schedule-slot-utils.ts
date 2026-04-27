import { getServiceRoleClient } from '@/lib/auth/admin'

interface EnsureScheduleSlotInput {
  branchId: string
  courseTypeId: string
  date: string
  startTime: string
  endTime: string
}

export async function ensureScheduleSlot({
  branchId,
  courseTypeId,
  date,
  startTime,
  endTime,
}: EnsureScheduleSlotInput) {
  const supabase = getServiceRoleClient()

  const { data: existingSlot, error: existingError } = await (supabase
    .from('schedule_slots') as any)
    .select('id')
    .eq('branch_id', branchId)
    .eq('course_type_id', courseTypeId)
    .eq('date', date)
    .eq('start_time', startTime)
    .single()

  if (existingError && existingError.code !== 'PGRST116') {
    throw existingError
  }

  if (existingSlot?.id) {
    return existingSlot.id as string
  }

  const { data: createdSlot, error: createError } = await (supabase
    .from('schedule_slots') as any)
    .insert({
      branch_id: branchId,
      course_type_id: courseTypeId,
      date,
      start_time: startTime,
      end_time: endTime,
      status: 'open',
    })
    .select('id')
    .single()

  if (createError) {
    throw createError
  }

  return createdSlot.id as string
}
