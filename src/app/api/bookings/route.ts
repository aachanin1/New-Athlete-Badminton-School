import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { logActivity } from '@/lib/activity-log'
import { calculateBookingBasePrice } from '@/lib/booking-pricing'
import { notifyRoles, notifyUserOnce } from '@/lib/notifications'
import { ensureScheduleSlot } from '@/lib/schedule-slot-utils'
import type { Coupon, CourseTypeName, LearnerType } from '@/types/database'

interface BookingSessionPayload {
  date: string
  startTime: string
  endTime: string
  branchId: string
  childId: string | null
  scheduleTemplateId?: string | null
}
export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json() as UpdateBookingPayload
    const {
      bookingId,
      branchId,
      courseTypeId,
      month,
      year,
      totalSessions,
      totalAmount,
      expectedTotalPrice,
      sessions,
    } = body

    if (
      !bookingId ||
      !branchId ||
      !courseTypeId ||
      !month ||
      !year ||
      !totalSessions ||
      !isPositiveNumber(totalAmount) ||
      !isPositiveNumber(expectedTotalPrice) ||
      !sessions ||
      sessions.length === 0
    ) {
      return NextResponse.json({ error: 'ข้อมูลการแก้ไขการจองไม่ครบ กรุณาตรวจสอบอีกครั้ง' }, { status: 400 })
    }

    const expiredSession = sessions.find((session) => !isSessionStillBookable(session))
    if (expiredSession) {
      return NextResponse.json({
        error: `รอบ ${expiredSession.startTime}-${expiredSession.endTime} วันที่ ${expiredSession.date} เริ่มไปแล้ว กรุณาเลือกรอบเรียนใหม่`,
      }, { status: 400 })
    }

    const adminSupabase = getServiceRoleClient()
    const { data: booking, error: bookingError } = await (adminSupabase
      .from('bookings') as unknown as DbTable)
      .select('id, user_id, course_type_id, status, learner_type, child_id')
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .single() as { data: { id: string; user_id: string; course_type_id: string; status: string; learner_type: LearnerType | null; child_id: string | null } | null; error: DbError | null }

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'ไม่พบการจองที่ต้องการแก้ไข' }, { status: 404 })
    }

    if (booking.status !== 'pending_payment') {
      return NextResponse.json({ error: 'แก้ไขได้เฉพาะรายการที่ยังรอชำระเงินเท่านั้น' }, { status: 400 })
    }

    if (booking.course_type_id !== courseTypeId) {
      return NextResponse.json({ error: 'ไม่สามารถเปลี่ยนประเภทคอร์สจากหน้าการแก้ไขวันจองได้' }, { status: 400 })
    }

    const childIntegrityError = validateChildSessionIntegrity(booking.learner_type, sessions, booking.child_id)
    if (childIntegrityError) {
      return NextResponse.json({ error: childIntegrityError }, { status: 400 })
    }

    const childIds = getSessionChildIds(sessions)
    const childNameMap = new Map<string, string>()
    if (childIds.length > 0) {
      const { data: ownedChildren, error: childError } = await (adminSupabase
        .from('children') as unknown as DbTable)
        .select('id, full_name, nickname')
        .eq('parent_id', user.id)
        .in('id', childIds) as { data: OwnedChildRow[] | null; error: DbError | null }

      if (childError || !ownedChildren || ownedChildren.length !== childIds.length) {
        return NextResponse.json({ error: 'ไม่สามารถแก้ไขการจองให้ผู้เรียนที่ไม่ได้อยู่ในบัญชีนี้ได้' }, { status: 403 })
      }
      if (ownedChildren) {
        ownedChildren.forEach((child) => {
          childNameMap.set(child.id, child.nickname || child.full_name)
        })
      }
    }

    const { data: courseType } = await (adminSupabase
      .from('course_types') as unknown as DbTable)
      .select('id, name')
      .eq('id', courseTypeId)
      .single() as { data: { id: string; name: CourseTypeName } | null }

    if (!courseType) {
      return NextResponse.json({ error: 'ไม่พบประเภทคอร์สในระบบ' }, { status: 400 })
    }

    try {
      await assertNoDuplicateActiveSessions(adminSupabase, user.id, sessions, childNameMap, bookingId)
    } catch (duplicateError) {
      const message = duplicateError instanceof Error ? duplicateError.message : 'ไม่สามารถจองรอบซ้ำได้'
      return NextResponse.json({ error: message }, { status: 409 })
    }

    const calculatedTotalAmount = await calculateBookingBasePrice({
      supabase: adminSupabase,
      userId: user.id,
      courseTypeId,
      courseTypeName: courseType.name,
      month,
      year,
      newSessions: totalSessions,
      existingStatuses: SETTLED_BOOKING_STATUSES,
      excludeBookingId: bookingId,
    })

    if (Math.abs(calculatedTotalAmount - totalAmount) > 1 || Math.abs(calculatedTotalAmount - expectedTotalPrice) > 1) {
      return NextResponse.json({ error: 'ราคาค่าเรียนมีการเปลี่ยนแปลง กรุณารีเฟรชหน้าแล้วตรวจสอบยอดอีกครั้ง' }, { status: 400 })
    }
    const zeroPriceKidsTrueUp = courseType.name === 'kids_group' && calculatedTotalAmount === 0

    let sessionRows: ResolvedBookingSessionRow[]
    try {
      sessionRows = await resolveSessionRows(adminSupabase, bookingId, courseTypeId, sessions)
    } catch (slotError) {
      const message = slotError instanceof Error ? slotError.message : 'ไม่สามารถสร้างรอบเรียนจริงได้'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { data: oldSessions } = await (adminSupabase
      .from('booking_sessions') as unknown as DbTable)
      .select('booking_id, date, start_time, end_time, branch_id, child_id, schedule_slot_id, status, is_makeup')
      .eq('booking_id', bookingId) as { data: ResolvedBookingSessionRow[] | null }

    const { error: deleteError } = await (adminSupabase
      .from('booking_sessions') as unknown as DbTable)
      .delete()
      .eq('booking_id', bookingId) as { error: DbError | null }

    if (deleteError) {
      return NextResponse.json({ error: `ลบรอบเรียนเดิมไม่สำเร็จ: ${deleteError.message}` }, { status: 500 })
    }

    const { error: updateError } = await (adminSupabase
      .from('bookings') as unknown as DbTable)
      .update({
        total_sessions: totalSessions,
        total_price: calculatedTotalAmount,
        status: zeroPriceKidsTrueUp ? 'verified' : 'pending_payment',
        branch_id: branchId,
        child_id: getResolvedBookingChildId(booking.learner_type, booking.child_id, sessions),
        month,
        year,
      })
      .eq('id', bookingId) as { error: DbError | null }

    if (updateError) {
      if (oldSessions?.length) await (adminSupabase.from('booking_sessions') as unknown as DbTable).insert(oldSessions)
      return NextResponse.json({ error: `อัปเดตการจองไม่สำเร็จ: ${updateError.message}` }, { status: 500 })
    }

    const { error: insertError } = await (adminSupabase
      .from('booking_sessions') as unknown as DbTable)
      .insert(sessionRows) as { error: DbError | null }

    if (insertError) {
      if (oldSessions?.length) await (adminSupabase.from('booking_sessions') as unknown as DbTable).insert(oldSessions)
      return NextResponse.json({ error: `สร้างรอบเรียนใหม่ไม่สำเร็จ: ${insertError.message}` }, { status: 500 })
    }

    await logActivity({
      userId: user.id,
      action: 'update_pending_booking_sessions',
      entityType: 'booking',
      entityId: bookingId,
      details: {
        totalSessions,
        totalPrice: calculatedTotalAmount,
        status: zeroPriceKidsTrueUp ? 'verified' : 'pending_payment',
        settledStatuses: SETTLED_BOOKING_STATUSES,
        zeroPriceTrueUp: zeroPriceKidsTrueUp,
      },
    })

    return NextResponse.json({ success: true, bookingId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Update booking error:', error)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${message}` }, { status: 500 })
  }
}

interface CreateBookingPayload {
  learnerType?: LearnerType
  childId?: string | null
  branchId?: string | null
  courseTypeId?: string
  month?: number
  year?: number
  totalSessions?: number
  totalAmount?: number
  expectedTotalPrice?: number
  sessions?: BookingSessionPayload[]
  coupon?: {
    id?: string
    code?: string
  } | null
}

interface UpdateBookingPayload {
  bookingId?: string
  branchId?: string | null
  courseTypeId?: string
  month?: number
  year?: number
  totalSessions?: number
  totalAmount?: number
  expectedTotalPrice?: number
  sessions?: BookingSessionPayload[]
}

interface DeleteBookingPayload {
  bookingId?: string
  action?: 'cancel_pending_booking'
}

interface DbError {
  message: string
  code?: string
}

type AdminSupabase = ReturnType<typeof getServiceRoleClient>
type NotificationSupabase = Parameters<typeof notifyRoles>[0]

interface DbQuery extends PromiseLike<{ data: unknown[] | null; error: DbError | null; count?: number | null }> {
  eq(column: string, value: unknown): DbQuery
  in(column: string, values: unknown[]): DbQuery
  neq(column: string, value: unknown): DbQuery
  is(column: string, value: unknown): DbQuery
  limit(count: number): DbQuery
  select(columns: string): DbQuery
  single(): Promise<{ data: unknown; error: DbError | null }>
  maybeSingle(): Promise<{ data: unknown; error: DbError | null }>
}

interface DbMutation extends PromiseLike<{ data?: unknown; error: DbError | null }> {
  eq(column: string, value: unknown): DbMutation
  in(column: string, values: unknown[]): DbMutation
  select(columns: string): DbQuery
  single(): Promise<{ data: unknown; error: DbError | null }>
  maybeSingle(): Promise<{ data: unknown; error: DbError | null }>
}

interface DbTable {
  select(columns: string): DbQuery
  insert(values: unknown): DbMutation
  update(values: Record<string, unknown>): DbMutation
  delete(): DbMutation
}

interface TemplateRow {
  id: string
  start_time: string
  end_time: string
}

interface OwnedChildRow {
  id: string
  full_name: string
  nickname: string | null
}

interface ExistingSessionConflictRow {
  id: string
  booking_id: string
  date: string
  start_time: string
  end_time: string
  branch_id: string
  child_id: string | null
}

const ACTIVE_BOOKING_STATUSES = ['pending_payment', 'paid', 'verified']
const SETTLED_BOOKING_STATUSES = ['paid', 'verified']
const ACTIVE_SESSION_STATUSES = ['scheduled', 'completed', 'absent']

interface ResolvedBookingSessionRow {
  booking_id: string
  date: string
  start_time: string
  end_time: string
  branch_id: string
  child_id: string | null
  schedule_slot_id: string
  status: 'scheduled'
  is_makeup: false
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function normalizeCode(code: string | undefined) {
  return (code || '').trim().toUpperCase()
}

function getDateOnlyNow() {
  return new Date().toISOString().split('T')[0]
}

function isSessionStillBookable(session: BookingSessionPayload) {
  const [hour, minute] = session.startTime.split(':').map(Number)
  const slotStart = new Date(`${session.date}T00:00:00`)
  slotStart.setHours(hour, minute, 0, 0)
  return slotStart.getTime() > Date.now()
}

function normalizeTime(value: string) {
  return value.slice(0, 5)
}

function getLearnerKey(childId: string | null | undefined) {
  return childId || 'self'
}

function getLearnerName(childId: string | null | undefined, childNames: Map<string, string>) {
  if (!childId) return 'ตัวเอง'
  return childNames.get(childId) || 'ผู้เรียน'
}

function getSessionChildIds(sessions: BookingSessionPayload[]) {
  return Array.from(new Set(sessions.map((session) => session.childId).filter(Boolean))) as string[]
}

function getResolvedBookingChildId(
  learnerType: LearnerType | null | undefined,
  childId: string | null | undefined,
  sessions: BookingSessionPayload[]
) {
  if (learnerType !== 'child') return childId || null
  const sessionChildIds = getSessionChildIds(sessions)
  if (childId) return childId
  return sessionChildIds.length === 1 ? sessionChildIds[0] : null
}

function validateChildSessionIntegrity(
  learnerType: LearnerType | null | undefined,
  sessions: BookingSessionPayload[],
  bookingChildId?: string | null
) {
  if (learnerType !== 'child') return null

  const missingChildSession = sessions.find((session) => !session.childId)
  if (missingChildSession) {
    return 'Please select a child learner for every class session.'
  }

  const sessionChildIds = getSessionChildIds(sessions)
  if (bookingChildId && sessionChildIds.some((sessionChildId) => sessionChildId !== bookingChildId)) {
    return 'Selected learner does not match the child on this booking.'
  }

  return null
}

function getSessionIdentity(session: BookingSessionPayload) {
  return [
    getLearnerKey(session.childId),
    session.date,
    normalizeTime(session.startTime),
    normalizeTime(session.endTime),
  ].join('|')
}

function formatDuplicateSessionMessage(session: BookingSessionPayload, childNames: Map<string, string>) {
  return `${getLearnerName(session.childId, childNames)} มีรอบเรียน ${session.date} ${normalizeTime(session.startTime)}-${normalizeTime(session.endTime)} อยู่แล้ว`
}

async function assertNoDuplicateActiveSessions(
  adminSupabase: AdminSupabase,
  userId: string,
  sessions: BookingSessionPayload[],
  childNames: Map<string, string>,
  excludeBookingId?: string
) {
  const seen = new Set<string>()
  for (const session of sessions) {
    const key = getSessionIdentity(session)
    if (seen.has(key)) {
      throw new Error(`เลือกรอบซ้ำในรายการเดียวกัน: ${formatDuplicateSessionMessage(session, childNames)}`)
    }
    seen.add(key)
  }

  for (const session of sessions) {
    let query = (adminSupabase.from('booking_sessions') as unknown as DbTable)
      .select('id, booking_id, date, start_time, end_time, branch_id, child_id, bookings!inner(id, user_id, status)')
      .eq('date', session.date)
      .eq('start_time', normalizeTime(session.startTime))
      .eq('end_time', normalizeTime(session.endTime))
      .eq('bookings.user_id', userId)
      .in('bookings.status', ACTIVE_BOOKING_STATUSES)
      .in('status', ACTIVE_SESSION_STATUSES)
      .limit(1)

    query = session.childId ? query.eq('child_id', session.childId) : query.is('child_id', null)
    if (excludeBookingId) query = query.neq('booking_id', excludeBookingId)

    const { data, error } = await query as { data: ExistingSessionConflictRow[] | null; error: DbError | null }
    if (error) {
      throw new Error(`ตรวจสอบรอบเรียนซ้ำไม่สำเร็จ: ${error.message}`)
    }
    if (data && data.length > 0) {
      throw new Error(`จองซ้ำไม่ได้: ${formatDuplicateSessionMessage(session, childNames)}`)
    }
  }
}

function timeToMinutes(value: string) {
  const [hour, minute] = normalizeTime(value).split(':').map(Number)
  return (hour || 0) * 60 + (minute || 0)
}

function getDayOfWeek(date: string) {
  return new Date(`${date}T00:00:00`).getDay()
}

function templateCoversSession(template: TemplateRow, session: BookingSessionPayload) {
  const templateStart = timeToMinutes(template.start_time)
  const templateEnd = timeToMinutes(template.end_time)
  const sessionStart = timeToMinutes(session.startTime)
  const sessionEnd = timeToMinutes(session.endTime)

  return templateStart <= sessionStart && templateEnd >= sessionEnd
}

async function resolveTemplateForSession(
  adminSupabase: AdminSupabase,
  courseTypeId: string,
  session: BookingSessionPayload
) {
  let query = (adminSupabase.from('schedule_templates') as unknown as DbTable)
    .select('id, start_time, end_time')
    .eq('branch_id', session.branchId)
    .eq('course_type_id', courseTypeId)
    .eq('day_of_week', getDayOfWeek(session.date))
    .eq('is_active', true)

  if (session.scheduleTemplateId) {
    query = query.eq('id', session.scheduleTemplateId)
  }

  const { data: templates, error } = await query as { data: TemplateRow[] | null; error: DbError | null }

  if (error) {
    throw new Error(`โหลดรอบเรียนประจำไม่สำเร็จ: ${error.message}`)
  }

  const matchedTemplate = (templates || []).find((template) => templateCoversSession(template, session))
  if (!matchedTemplate) {
    throw new Error(`รอบ ${session.startTime}-${session.endTime} วันที่ ${session.date} ไม่ตรงกับรอบเรียนประจำในระบบ`)
  }

  return matchedTemplate
}

async function resolveSessionRows(
  adminSupabase: AdminSupabase,
  bookingId: string,
  courseTypeId: string,
  sessions: BookingSessionPayload[]
): Promise<ResolvedBookingSessionRow[]> {
  const rows: ResolvedBookingSessionRow[] = []

  for (const session of sessions) {
    const template = await resolveTemplateForSession(adminSupabase, courseTypeId, session)
    const scheduleSlotId = await ensureScheduleSlot({
      supabase: adminSupabase,
      templateId: template.id,
      branchId: session.branchId,
      courseTypeId,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
    })

    rows.push({
      booking_id: bookingId,
      date: session.date,
      start_time: normalizeTime(session.startTime),
      end_time: normalizeTime(session.endTime),
      branch_id: session.branchId,
      child_id: session.childId,
      schedule_slot_id: scheduleSlotId,
      status: 'scheduled',
      is_makeup: false,
    })
  }

  return rows
}

function calculateDiscount(coupon: Coupon, totalAmount: number) {
  if (coupon.discount_type === 'fixed') {
    return Math.min(Number(coupon.discount_value), totalAmount)
  }

  if (coupon.discount_type === 'percent') {
    return Math.round((totalAmount * Number(coupon.discount_value)) / 100)
  }

  return 0
}

async function cleanupBooking(adminSupabase: AdminSupabase, bookingId: string) {
  await (adminSupabase.from('coupon_usages') as unknown as DbTable).delete().eq('booking_id', bookingId)
  await (adminSupabase.from('booking_sessions') as unknown as DbTable).delete().eq('booking_id', bookingId)
  await (adminSupabase.from('bookings') as unknown as DbTable).delete().eq('id', bookingId)
}

async function validateCoupon(
  adminSupabase: AdminSupabase,
  userId: string,
  couponInput: CreateBookingPayload['coupon'],
  totalAmount: number
) {
  if (!couponInput?.id && !couponInput?.code) {
    return { coupon: null, discountAmount: 0, error: null as string | null }
  }

  const code = normalizeCode(couponInput.code)
  let query = (adminSupabase.from('coupons') as unknown as DbTable).select('*').eq('is_active', true)

  if (couponInput.id) {
    query = query.eq('id', couponInput.id)
  }

  if (code) {
    query = query.eq('code', code)
  }

  const { data: coupon, error } = await query.single() as { data: Coupon | null; error: DbError | null }

  if (error || !coupon) {
    return { coupon: null, discountAmount: 0, error: 'ไม่พบคูปองนี้ หรือคูปองไม่สามารถใช้งานได้' }
  }

  const today = getDateOnlyNow()
  if (coupon.valid_from && today < coupon.valid_from) {
    return { coupon: null, discountAmount: 0, error: 'คูปองยังไม่เริ่มใช้งาน' }
  }

  if (coupon.valid_to && today > coupon.valid_to) {
    await (adminSupabase.from('coupons') as unknown as DbTable).update({ is_active: false }).eq('id', coupon.id)
    return { coupon: null, discountAmount: 0, error: 'คูปองหมดอายุแล้ว' }
  }

  const currentUses = Number(coupon.current_uses || 0)
  if (coupon.max_uses !== null && currentUses >= Number(coupon.max_uses)) {
    await (adminSupabase.from('coupons') as unknown as DbTable).update({ is_active: false }).eq('id', coupon.id)
    return { coupon: null, discountAmount: 0, error: 'คูปองถูกใช้งานครบจำนวนแล้ว' }
  }

  if (coupon.min_purchase !== null && totalAmount < Number(coupon.min_purchase)) {
    return {
      coupon: null,
      discountAmount: 0,
      error: `ยอดขั้นต่ำสำหรับคูปองนี้คือ ฿${Number(coupon.min_purchase).toLocaleString('th-TH')}`,
    }
  }

  const { data: existingUsage } = await (adminSupabase
    .from('coupon_usages') as unknown as DbTable)
    .select('id')
    .eq('coupon_id', coupon.id)
    .eq('user_id', userId)
    .limit(1)

  if (existingUsage && existingUsage.length > 0) {
    return { coupon: null, discountAmount: 0, error: 'คุณใช้คูปองนี้ไปแล้ว' }
  }

  return { coupon, discountAmount: calculateDiscount(coupon, totalAmount), error: null }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json() as CreateBookingPayload
    const {
      learnerType,
      childId,
      branchId,
      courseTypeId,
      month,
      year,
      totalSessions,
      totalAmount,
      expectedTotalPrice,
      sessions,
      coupon: couponInput,
    } = body

    if (
      !learnerType ||
      !branchId ||
      !courseTypeId ||
      !month ||
      !year ||
      !totalSessions ||
      !isPositiveNumber(totalAmount) ||
      !isPositiveNumber(expectedTotalPrice) ||
      !sessions ||
      sessions.length === 0
    ) {
      return NextResponse.json({ error: 'ข้อมูลการจองไม่ครบ กรุณาตรวจสอบอีกครั้ง' }, { status: 400 })
    }

    const expiredSession = sessions.find((session) => !isSessionStillBookable(session))
    if (expiredSession) {
      return NextResponse.json({
        error: `รอบ ${expiredSession.startTime}-${expiredSession.endTime} วันที่ ${expiredSession.date} เริ่มไปแล้ว กรุณาเลือกรอบเรียนใหม่`,
      }, { status: 400 })
    }

    const childIntegrityError = validateChildSessionIntegrity(learnerType, sessions, childId)
    if (childIntegrityError) {
      return NextResponse.json({ error: childIntegrityError }, { status: 400 })
    }

    const adminSupabase = getServiceRoleClient()

    const childIds = Array.from(new Set([
      childId,
      ...sessions.map((session) => session.childId),
    ].filter(Boolean))) as string[]
    const childNameMap = new Map<string, string>()

    if (childIds.length > 0) {
      const { data: ownedChildren, error: childError } = await (adminSupabase
        .from('children') as unknown as DbTable)
        .select('id, full_name, nickname')
        .eq('parent_id', user.id)
        .in('id', childIds) as { data: OwnedChildRow[] | null; error: DbError | null }

      if (childError || !ownedChildren || ownedChildren.length !== childIds.length) {
        return NextResponse.json({ error: 'ไม่สามารถจองให้ผู้เรียนที่ไม่ได้อยู่ในบัญชีนี้ได้' }, { status: 403 })
      }
      if (ownedChildren) {
        ownedChildren.forEach((child) => {
          childNameMap.set(child.id, child.nickname || child.full_name)
        })
      }
    }

    const { data: courseType } = await (adminSupabase
      .from('course_types') as unknown as DbTable)
      .select('id, name')
      .eq('id', courseTypeId)
      .single() as { data: { id: string; name: CourseTypeName } | null }

    if (!courseType) {
      return NextResponse.json({ error: 'ไม่พบประเภทคอร์สในระบบ' }, { status: 400 })
    }

    const calculatedTotalAmount = await calculateBookingBasePrice({
      supabase: adminSupabase,
      userId: user.id,
      courseTypeId,
      courseTypeName: courseType.name,
      month,
      year,
      newSessions: totalSessions,
      existingStatuses: SETTLED_BOOKING_STATUSES,
    })

    if (Math.abs(calculatedTotalAmount - totalAmount) > 1) {
      return NextResponse.json({ error: 'ราคาค่าเรียนมีการเปลี่ยนแปลง กรุณารีเฟรชหน้าแล้วตรวจสอบยอดอีกครั้ง' }, { status: 400 })
    }

    try {
      await assertNoDuplicateActiveSessions(adminSupabase, user.id, sessions, childNameMap)
    } catch (duplicateError) {
      const message = duplicateError instanceof Error ? duplicateError.message : 'ไม่สามารถจองรอบซ้ำได้'
      return NextResponse.json({ error: message }, { status: 409 })
    }

    const { coupon, discountAmount, error: couponError } = calculatedTotalAmount > 0
      ? await validateCoupon(
        adminSupabase,
        user.id,
        couponInput,
        calculatedTotalAmount
      )
      : { coupon: null, discountAmount: 0, error: null }

    if (couponError) {
      return NextResponse.json({ error: couponError }, { status: 400 })
    }

    const finalPrice = Math.max(0, calculatedTotalAmount - discountAmount)
    const zeroPriceKidsTrueUp = courseType.name === 'kids_group' && calculatedTotalAmount === 0 && finalPrice === 0
    const bookingStatus = zeroPriceKidsTrueUp ? 'verified' : 'pending_payment'
    if (Math.abs(finalPrice - expectedTotalPrice) > 1) {
      return NextResponse.json({ error: 'ยอดชำระไม่ตรงกับข้อมูลล่าสุด กรุณาตรวจสอบคูปองและราคาอีกครั้ง' }, { status: 400 })
    }

    const { data: booking, error: bookingError } = await (adminSupabase
      .from('bookings') as unknown as DbTable)
      .insert({
        user_id: user.id,
        learner_type: learnerType,
        child_id: getResolvedBookingChildId(learnerType, childId, sessions),
        branch_id: branchId,
        course_type_id: courseTypeId,
        month,
        year,
        total_sessions: totalSessions,
        total_price: finalPrice,
        status: bookingStatus,
      })
      .select('id')
      .single() as { data: { id: string } | null; error: DbError | null }

    if (bookingError || !booking) {
      return NextResponse.json({ error: `สร้างการจองไม่สำเร็จ: ${bookingError?.message || 'ไม่พบข้อมูลการจอง'}` }, { status: 500 })
    }

    let sessionRows: ResolvedBookingSessionRow[]
    try {
      sessionRows = await resolveSessionRows(adminSupabase, booking.id, courseTypeId, sessions)
    } catch (slotError) {
      await cleanupBooking(adminSupabase, booking.id)
      const message = slotError instanceof Error ? slotError.message : 'ไม่สามารถสร้างรอบเรียนจริงได้'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { error: sessionError } = await (adminSupabase.from('booking_sessions') as unknown as DbTable).insert(sessionRows)
    if (sessionError) {
      await cleanupBooking(adminSupabase, booking.id)
      return NextResponse.json({ error: `สร้างรอบเรียนไม่สำเร็จ: ${sessionError.message}` }, { status: 500 })
    }

    if (coupon) {
      const { error: usageError } = await (adminSupabase.from('coupon_usages') as unknown as DbTable).insert({
        coupon_id: coupon.id,
        user_id: user.id,
        booking_id: booking.id,
        discount_amount: discountAmount,
      })

      if (usageError) {
        await cleanupBooking(adminSupabase, booking.id)
        return NextResponse.json({ error: `บันทึกการใช้คูปองไม่สำเร็จ: ${usageError.message}` }, { status: 500 })
      }

      const nextUses = Number(coupon.current_uses || 0) + 1
      const couponUpdate: { current_uses: number; is_active?: boolean } = { current_uses: nextUses }
      if (coupon.max_uses !== null && nextUses >= Number(coupon.max_uses)) {
        couponUpdate.is_active = false
      }

      const { error: couponUpdateError } = await (adminSupabase
        .from('coupons') as unknown as DbTable)
        .update(couponUpdate)
        .eq('id', coupon.id)

      if (couponUpdateError) {
        await cleanupBooking(adminSupabase, booking.id)
        return NextResponse.json({ error: `อัปเดตจำนวนคูปองไม่สำเร็จ: ${couponUpdateError.message}` }, { status: 500 })
      }
    }

    await notifyRoles(adminSupabase as unknown as NotificationSupabase, {
      roles: ['admin', 'super_admin'],
      title: 'มีการจองใหม่',
      message: `${user.email || 'User'} สร้างการจองใหม่ ${totalSessions} ครั้ง - ฿${finalPrice.toLocaleString('th-TH')}`,
      type: 'schedule',
      link_url: '/admin/notifications',
    }).catch(() => null)

    const userNotificationTitle = bookingStatus === 'verified'
      ? 'สร้างการจองสำเร็จ'
      : 'สร้างการจองแล้ว รอแนบสลิป'
    const userNotificationMessage = bookingStatus === 'verified'
      ? `ระบบสร้างการจอง ${totalSessions} ครั้ง โดยใช้เครดิตส่วนต่างและยอดชำระเพิ่ม ฿0 คุณสามารถใช้สิทธิ์เรียนรอบนี้ได้ทันที`
      : `ระบบสร้างการจอง ${totalSessions} ครั้ง ยอดชำระ ฿${finalPrice.toLocaleString('th-TH')} เรียบร้อยแล้ว กรุณาแนบสลิปเพื่อยืนยันการจอง`

    await notifyUserOnce(adminSupabase as unknown as NotificationSupabase, {
      user_id: user.id,
      title: userNotificationTitle,
      message: userNotificationMessage,
      type: 'payment',
      link_url: '/dashboard/history',
    }).catch(() => null)

    await logActivity({
      userId: user.id,
      action: 'create_booking',
      entityType: 'booking',
      entityId: booking.id,
      details: {
        totalSessions,
        totalPrice: finalPrice,
        couponId: coupon?.id || null,
        status: bookingStatus,
        settledStatuses: SETTLED_BOOKING_STATUSES,
        zeroPriceTrueUp: zeroPriceKidsTrueUp,
      },
    })

    return NextResponse.json({ success: true, bookingId: booking.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Create booking error:', error)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${message}` }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json() as DeleteBookingPayload
    const { bookingId, action } = body

    if (!bookingId || action !== 'cancel_pending_booking') {
      return NextResponse.json({ error: 'ข้อมูลการยกเลิกการจองไม่ครบ' }, { status: 400 })
    }

    const adminSupabase = getServiceRoleClient()
    const { data: booking, error: bookingError } = await (adminSupabase
      .from('bookings') as unknown as DbTable)
      .select('id, user_id, status')
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .single() as { data: { id: string; user_id: string; status: string } | null; error: DbError | null }

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'ไม่พบการจองที่ต้องการยกเลิก' }, { status: 404 })
    }

    if (booking.status !== 'pending_payment') {
      return NextResponse.json({ error: 'ยกเลิกจากหน้านี้ได้เฉพาะรายการที่ยังรอชำระเงินเท่านั้น' }, { status: 400 })
    }

    const { error: sessionError } = await (adminSupabase
      .from('booking_sessions') as unknown as DbTable)
      .delete()
      .eq('booking_id', bookingId) as { error: DbError | null }

    if (sessionError) {
      return NextResponse.json({ error: `ลบรอบเรียนของการจองไม่สำเร็จ: ${sessionError.message}` }, { status: 500 })
    }

    const { error: updateError } = await (adminSupabase
      .from('bookings') as unknown as DbTable)
      .update({ status: 'cancelled' })
      .eq('id', bookingId) as { error: DbError | null }

    if (updateError) {
      return NextResponse.json({ error: `ยกเลิกการจองไม่สำเร็จ: ${updateError.message}` }, { status: 500 })
    }

    await logActivity({
      userId: user.id,
      action: 'cancel_pending_booking',
      entityType: 'booking',
      entityId: bookingId,
      details: { source: 'user_history' },
    })

    return NextResponse.json({ success: true, bookingId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Cancel booking error:', error)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${message}` }, { status: 500 })
  }
}
