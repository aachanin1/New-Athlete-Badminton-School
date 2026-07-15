import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import {
  buildBookingSlotAvailability,
  type BookingAvailabilityScheduleSlotRow,
  type BookingAvailabilitySessionRow,
  type BookingAvailabilitySlotInput,
  type BookingAvailabilityTemplateRow,
} from '@/lib/booking-slot-availability'
import {
  decideProgressiveBookingEntry,
  getProgressiveBookingEntryDependencyState,
} from '@/lib/progressive-pricing-feature'
import { createClient } from '@/lib/supabase/server'
import type { CourseTypeName } from '@/types/database'

interface AvailabilityPayload {
  bookingId?: string | null
  courseTypeId?: string
  slots?: BookingAvailabilitySlotInput[]
}

interface DbError {
  message: string
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^\d{2}:\d{2}(:\d{2})?$/
const MAX_AVAILABILITY_SLOTS = 500

function isAvailabilitySlot(value: unknown): value is BookingAvailabilitySlotInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const slot = value as Partial<BookingAvailabilitySlotInput>
  return Boolean(
    typeof slot.date === 'string' && DATE_PATTERN.test(slot.date)
    && typeof slot.startTime === 'string' && TIME_PATTERN.test(slot.startTime)
    && typeof slot.endTime === 'string' && TIME_PATTERN.test(slot.endTime)
    && typeof slot.branchId === 'string' && UUID_PATTERN.test(slot.branchId)
    && (slot.scheduleTemplateId === undefined
      || slot.scheduleTemplateId === null
      || (typeof slot.scheduleTemplateId === 'string' && UUID_PATTERN.test(slot.scheduleTemplateId))),
  )
}

function isSlotArray(value: unknown): value is BookingAvailabilitySlotInput[] {
  return Array.isArray(value)
    && value.length <= MAX_AVAILABILITY_SLOTS
    && value.every(isAvailabilitySlot)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json() as AvailabilityPayload
    if (!body.courseTypeId || !UUID_PATTERN.test(body.courseTypeId)
      || !isSlotArray(body.slots) || body.slots.length === 0) {
      return NextResponse.json({ error: 'ข้อมูลรอบเรียนไม่ครบ' }, { status: 400 })
    }

    const client = getServiceRoleClient()
    const { data: courseType, error: courseTypeError } = await client
      .from('course_types')
      .select('id, name')
      .eq('id', body.courseTypeId)
      .single() as unknown as {
        data: { id: string; name: CourseTypeName } | null
        error: DbError | null
      }
    if (courseTypeError || !courseType) {
      return NextResponse.json({ error: 'ไม่พบประเภทคอร์สในระบบ' }, { status: 400 })
    }

    let progressiveMode = decideProgressiveBookingEntry(courseType.name).mode === 'progressive'
    if (body.bookingId) {
      if (!UUID_PATTERN.test(body.bookingId)) {
        return NextResponse.json({ error: 'ข้อมูลการจองไม่ถูกต้อง' }, { status: 400 })
      }
      const { data: booking } = await client
        .from('bookings')
        .select('id, pricing_scope_id, course_type_id')
        .eq('id', body.bookingId)
        .eq('user_id', user.id)
        .maybeSingle() as unknown as {
          data: { id: string; pricing_scope_id: string | null; course_type_id: string } | null
        }
      if (!booking) return NextResponse.json({ error: 'ไม่พบการจองที่ต้องการแก้ไข' }, { status: 404 })
      if (booking.course_type_id !== courseType.id) {
        return NextResponse.json({ error: 'ประเภทคอร์สไม่ตรงกับรายการจอง' }, { status: 400 })
      }
      progressiveMode = Boolean(booking.pricing_scope_id)
    }

    if (!progressiveMode) {
      return NextResponse.json({ mode: 'legacy', checkedAt: new Date().toISOString(), slots: [] })
    }

    const dependency = getProgressiveBookingEntryDependencyState()
    if (!dependency.ready) {
      return NextResponse.json({
        error: 'ระบบตรวจสอบการจองยังไม่พร้อม กรุณาลองใหม่ภายหลัง',
        code: 'PROGRESSIVE_BOOKING_DEPENDENCY_UNAVAILABLE',
      }, { status: 503 })
    }

    const allCandidates = body.slots
    const branchIds = Array.from(new Set(allCandidates.map((slot) => slot.branchId)))
    const dates = allCandidates.map((slot) => slot.date).sort()
    const firstDate = dates[0]
    const lastDate = dates[dates.length - 1]

    const [templateResult, scheduleSlotResult] = await Promise.all([
      client
        .from('schedule_templates')
        .select('id, branch_id, course_type_id, day_of_week, start_time, end_time, is_active')
        .eq('course_type_id', courseType.id)
        .eq('is_active', true)
        .in('branch_id', branchIds),
      client
        .from('schedule_slots')
        .select('id, template_id, branch_id, course_type_id, date, start_time, end_time, status')
        .eq('course_type_id', courseType.id)
        .gte('date', firstDate)
        .lte('date', lastDate)
        .in('branch_id', branchIds),
    ])
    if (templateResult.error) throw new Error(`โหลดรอบเรียนประจำไม่สำเร็จ: ${templateResult.error.message}`)
    if (scheduleSlotResult.error) throw new Error(`โหลดรอบเรียนจริงไม่สำเร็จ: ${scheduleSlotResult.error.message}`)

    const scheduleSlots = (scheduleSlotResult.data || []) as BookingAvailabilityScheduleSlotRow[]
    const scheduleSlotIds = scheduleSlots.map((slot) => slot.id)
    let bookingSessions: BookingAvailabilitySessionRow[] = []
    if (scheduleSlotIds.length > 0) {
      const { data, error } = await client
        .from('booking_sessions')
        .select('schedule_slot_id, booking_id, cancelled_at, status, bookings!inner(status, expires_at)')
        .in('schedule_slot_id', scheduleSlotIds)
        .is('cancelled_at', null)
        .in('status', ['scheduled', 'completed', 'absent'])
      if (error) throw new Error(`โหลดจำนวนผู้เรียนไม่สำเร็จ: ${error.message}`)
      bookingSessions = (data || []) as unknown as BookingAvailabilitySessionRow[]
    }

    const now = new Date()
    const slots = buildBookingSlotAvailability({
      courseTypeId: courseType.id,
      candidates: body.slots,
      templates: (templateResult.data || []) as BookingAvailabilityTemplateRow[],
      scheduleSlots,
      bookingSessions,
      nowMs: now.getTime(),
      excludeBookingId: body.bookingId || null,
    })

    return NextResponse.json({ mode: 'progressive', checkedAt: now.toISOString(), slots })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown availability error'
    return NextResponse.json({ error: `ตรวจสอบที่ว่างไม่สำเร็จ: ${message}` }, { status: 500 })
  }
}
