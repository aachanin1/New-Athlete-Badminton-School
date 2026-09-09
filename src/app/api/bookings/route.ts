import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import {
  cancelProgressivePendingBooking,
  createProgressiveBooking,
  ProgressiveBookingWriteError,
  updateProgressivePendingBooking,
} from '@/lib/progressive-booking-write'
import {
  decideProgressiveBookingEntry,
  getProgressiveBookingEntryDependencyState,
} from '@/lib/progressive-pricing-feature'
import type { CourseTypeName, LearnerType } from '@/types/database'
import { Task10Error } from '@/lib/task10-policy'
import { writeLegacyBooking } from '@/lib/booking-payment-lifecycle'

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
      .select('id, user_id, course_type_id, status, learner_type, child_id, pricing_scope_id')
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .single() as { data: { id: string; user_id: string; course_type_id: string; status: string; learner_type: LearnerType | null; child_id: string | null; pricing_scope_id: string | null } | null; error: DbError | null }

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'ไม่พบการจองที่ต้องการแก้ไข' }, { status: 404 })
    }

    if (booking.pricing_scope_id && booking.status !== 'pending_payment') {
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
      if (booking.pricing_scope_id) await assertNoDuplicateActiveSessions(adminSupabase, user.id, sessions, childNameMap, bookingId)
    } catch (duplicateError) {
      const message = duplicateError instanceof Error ? duplicateError.message : 'ไม่สามารถจองรอบซ้ำได้'
      return NextResponse.json({ error: message }, { status: 409 })
    }

    if (booking.pricing_scope_id) {
      if (!isUuid(body.clientRequestId) || !isNonNegativeInteger(body.expectedScopeRevision)) {
        return NextResponse.json({ error: 'ข้อมูลยืนยันราคาล่าสุดไม่ครบ กรุณาคำนวณราคาใหม่', code: 'PROGRESSIVE_INVALID_REQUEST' }, { status: 409 })
      }
      try {
        const { expectedScopeRevision } = await resolveProgressiveExpectedRevision({
          client: adminSupabase,
          userId: user.id,
          clientRequestId: body.clientRequestId,
          suppliedRevision: body.expectedScopeRevision,
          mutation: 'update',
          bookingId,
        })
        const result = await updateProgressivePendingBooking({
          expectedPolicyFingerprint: body.expectedPolicyFingerprint,
          userId: user.id,
          bookingId,
          branchId,
          sessions,
          clientRequestId: body.clientRequestId,
          expectedScopeRevision,
        })
        return NextResponse.json({ success: true, ...serializeProgressiveResult(result) })
      } catch (error) {
        return progressiveWriteError(error)
      }
    }

    const result = await writeLegacyBooking(adminSupabase, { userId: user.id, action: 'update',
      requestId: isUuid(body.clientRequestId) ? body.clientRequestId : crypto.randomUUID(),
      booking: { bookingId, branchId, courseTypeId, month, year, totalSessions, totalAmount, expectedTotalPrice, sessions },
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Task10Error) return NextResponse.json({ error: error.message, code: error.code, refreshRequired: error.status === 409 }, { status: error.status })
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Update booking error:', error)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${message}` }, { status: 500 })
  }
}

interface CreateBookingPayload {
  expectedPolicyFingerprint?: string | null
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
  clientRequestId?: string
  expectedScopeRevision?: number
  expectedLegacyBaselineSessions?: number
  expectedLegacyBaselineFingerprint?: string
}

interface UpdateBookingPayload {
  expectedPolicyFingerprint?: string | null
  bookingId?: string
  branchId?: string | null
  courseTypeId?: string
  month?: number
  year?: number
  totalSessions?: number
  totalAmount?: number
  expectedTotalPrice?: number
  sessions?: BookingSessionPayload[]
  clientRequestId?: string
  expectedScopeRevision?: number
}

interface DeleteBookingPayload {
  bookingId?: string
  action?: 'cancel_pending_booking'
  clientRequestId?: string
  expectedScopeRevision?: number
}

interface DbError {
  message: string
  code?: string
}

type AdminSupabase = ReturnType<typeof getServiceRoleClient>

interface DbQuery extends PromiseLike<{ data: unknown[] | null; error: DbError | null; count?: number | null }> {
  eq(column: string, value: unknown): DbQuery
  in(column: string, values: unknown[]): DbQuery
  neq(column: string, value: unknown): DbQuery
  is(column: string, value: unknown): DbQuery
  lt(column: string, value: unknown): DbQuery
  gt(column: string, value: unknown): DbQuery
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
const ACTIVE_SESSION_STATUSES = ['scheduled', 'completed', 'absent']

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isSha256Fingerprint(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
}

function serializeProgressiveResult(result: Awaited<ReturnType<typeof createProgressiveBooking>>) {
  return {
    bookingId: result.bookingId,
    totalPrice: result.totalPrice,
    status: 'pending_payment',
    pricingScopeId: result.scopeId,
    pricingRevision: result.scopeRevision,
    sourceKind: 'progressive_kids_group_v1',
    idempotentReplay: result.idempotentReplay,
  }
}

function progressiveWriteError(error: unknown) {
  if (error instanceof Task10Error) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  if (!(error instanceof ProgressiveBookingWriteError)) throw error
  const conflictCodes = new Set([
    'PROGRESSIVE_BOOKING_CONFLICT',
    'PROGRESSIVE_DUPLICATE_SESSION', 'PROGRESSIVE_IDEMPOTENCY_CONFLICT',
    'PROGRESSIVE_LEGACY_BASELINE_CONFLICT', 'PROGRESSIVE_LEGACY_BASELINE_DRIFT',
    'PROGRESSIVE_SCOPE_LOCKED', 'PROGRESSIVE_SCOPE_REVISION_CONFLICT',
  ])
  const unavailableCodes = new Set(['PROGRESSIVE_RPC_UNAVAILABLE', 'PROGRESSIVE_WRITES_DISABLED', 'PROGRESSIVE_COUPON_LIFECYCLE_DISABLED'])
  const status = unavailableCodes.has(error.code) ? 503 : conflictCodes.has(error.code) ? 409 : 400
  return NextResponse.json({ error: error.message, code: error.code }, { status })
}

async function resolveProgressiveExpectedRevision({
  client,
  userId,
  clientRequestId,
  suppliedRevision,
  mutation,
  bookingId,
}: {
  client: AdminSupabase
  userId: string
  clientRequestId: string
  suppliedRevision: number
  mutation: 'create' | 'update' | 'cancel'
  bookingId?: string
}) {
  const { data: receipt, error } = await client
    .from('progressive_booking_mutation_receipts')
    .select('mutation_type, booking_id, expected_scope_revision')
    .eq('user_id', userId)
    .eq('client_request_id', clientRequestId)
    .maybeSingle() as unknown as {
      data: { mutation_type: string; booking_id: string | null; expected_scope_revision: number } | null
      error: DbError | null
    }
  if (error) throw new ProgressiveBookingWriteError('PROGRESSIVE_RPC_UNAVAILABLE', error.message)
  if (!receipt) return { expectedScopeRevision: suppliedRevision, replayCandidate: false }
  if (receipt.mutation_type !== mutation || (bookingId && receipt.booking_id !== bookingId)) {
    throw new ProgressiveBookingWriteError('PROGRESSIVE_IDEMPOTENCY_CONFLICT', 'PROGRESSIVE_IDEMPOTENCY_CONFLICT')
  }
  return { expectedScopeRevision: Number(receipt.expected_scope_revision), replayCandidate: true }
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

function sessionsOverlap(left: BookingSessionPayload, right: BookingSessionPayload) {
  return getLearnerKey(left.childId) === getLearnerKey(right.childId)
    && left.date === right.date
    && normalizeTime(left.startTime) < normalizeTime(right.endTime)
    && normalizeTime(left.endTime) > normalizeTime(right.startTime)
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
  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index]
    if (sessions.slice(0, index).some((prior) => sessionsOverlap(prior, session))) {
      throw new Error(`เลือกรอบเวลาซ้อนกันในรายการเดียวกัน: ${formatDuplicateSessionMessage(session, childNames)}`)
    }
  }

  for (const session of sessions) {
    let query = (adminSupabase.from('booking_sessions') as unknown as DbTable)
      .select('id, booking_id, date, start_time, end_time, branch_id, child_id, bookings!inner(id, user_id, status)')
      .eq('date', session.date)
      .lt('start_time', normalizeTime(session.endTime))
      .gt('end_time', normalizeTime(session.startTime))
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
      throw new Error(`จองรอบเวลาซ้ำหรือซ้อนกันไม่ได้: ${formatDuplicateSessionMessage(session, childNames)}`)
    }
  }
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

    const entryDecision = decideProgressiveBookingEntry(courseType.name)
    if (entryDecision.mode === 'progressive') {
      const dependency = getProgressiveBookingEntryDependencyState()
      if (!dependency.ready) {
        return NextResponse.json({
          error: 'ระบบสร้างการจองยังไม่พร้อม กรุณาลองใหม่ภายหลัง',
          code: 'PROGRESSIVE_BOOKING_DEPENDENCY_UNAVAILABLE',
        }, { status: 503 })
      }
      if (!isUuid(body.clientRequestId)
        || !isNonNegativeInteger(body.expectedScopeRevision)
        || !isNonNegativeInteger(body.expectedLegacyBaselineSessions)
        || !isSha256Fingerprint(body.expectedLegacyBaselineFingerprint)) {
        return NextResponse.json({
          error: 'กรุณาคำนวณราคาล่าสุดก่อนยืนยันการจอง',
          code: 'PROGRESSIVE_PREVIEW_REQUIRED',
        }, { status: 409 })
      }

      try {
        const { expectedScopeRevision, replayCandidate } = await resolveProgressiveExpectedRevision({
          client: adminSupabase,
          userId: user.id,
          clientRequestId: body.clientRequestId,
          suppliedRevision: body.expectedScopeRevision,
          mutation: 'create',
        })
        if (!replayCandidate) {
          try {
            await assertNoDuplicateActiveSessions(adminSupabase, user.id, sessions, childNameMap)
          } catch (duplicateError) {
            const message = duplicateError instanceof Error ? duplicateError.message : 'ไม่สามารถจองรอบซ้ำได้'
            return NextResponse.json({ error: message }, { status: 409 })
          }
        }
        const result = await createProgressiveBooking({
          expectedPolicyFingerprint: body.expectedPolicyFingerprint,
          userId: user.id,
          learnerType,
          childId: getResolvedBookingChildId(learnerType, childId, sessions),
          branchId,
          courseTypeId,
          sessions,
          couponId: couponInput?.id || null,
          clientRequestId: body.clientRequestId,
          expectedScopeRevision,
          expectedLegacyBaselineSessions: body.expectedLegacyBaselineSessions,
          expectedLegacyBaselineFingerprint: body.expectedLegacyBaselineFingerprint,
        })
        return NextResponse.json({ success: true, ...serializeProgressiveResult(result) })
      } catch (error) {
        return progressiveWriteError(error)
      }
    }

    const result = await writeLegacyBooking(adminSupabase, { userId: user.id, action: 'create',
      requestId: isUuid(body.clientRequestId) ? body.clientRequestId : crypto.randomUUID(),
      booking: { learnerType, childId: getResolvedBookingChildId(learnerType, childId, sessions), branchId, courseTypeId, month, year, totalSessions, totalAmount, expectedTotalPrice, sessions, coupon: couponInput || null },
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Task10Error) return NextResponse.json({ error: error.message, code: error.code, refreshRequired: error.status === 409 }, { status: error.status })
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
      .select('id, user_id, status, pricing_scope_id')
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .single() as { data: { id: string; user_id: string; status: string; pricing_scope_id: string | null } | null; error: DbError | null }

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'ไม่พบการจองที่ต้องการยกเลิก' }, { status: 404 })
    }

    if (booking.pricing_scope_id && booking.status !== 'pending_payment') {
      return NextResponse.json({ error: 'ยกเลิกจากหน้านี้ได้เฉพาะรายการที่ยังรอชำระเงินเท่านั้น' }, { status: 400 })
    }

    if (booking.pricing_scope_id) {
      if (!isUuid(body.clientRequestId) || !isNonNegativeInteger(body.expectedScopeRevision)) {
        return NextResponse.json({ error: 'ข้อมูลยืนยันรายการล่าสุดไม่ครบ กรุณารีเฟรชแล้วลองใหม่', code: 'PROGRESSIVE_INVALID_REQUEST' }, { status: 409 })
      }
      try {
        const { expectedScopeRevision } = await resolveProgressiveExpectedRevision({
          client: adminSupabase,
          userId: user.id,
          clientRequestId: body.clientRequestId,
          suppliedRevision: body.expectedScopeRevision,
          mutation: 'cancel',
          bookingId,
        })
        const result = await cancelProgressivePendingBooking({
          userId: user.id,
          bookingId,
          clientRequestId: body.clientRequestId,
          expectedScopeRevision,
        })
        return NextResponse.json({ success: true, ...serializeProgressiveResult(result) })
      } catch (error) {
        return progressiveWriteError(error)
      }
    }

    const result = await writeLegacyBooking(adminSupabase, { userId: user.id, action: 'cancel',
      requestId: isUuid(body.clientRequestId) ? body.clientRequestId : crypto.randomUUID(),
      booking: { bookingId },
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Task10Error) return NextResponse.json({ error: error.message, code: error.code, refreshRequired: error.status === 409 }, { status: error.status })
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Cancel booking error:', error)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${message}` }, { status: 500 })
  }
}
