import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { logActivity } from '@/lib/activity-log'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { formatNotificationSlotDateTime } from '@/lib/date-format'
import {
  LessonWalletEntitlementError,
  resolveLessonWalletErrorCode,
  resolveLessonWalletEntitlement,
  type LessonWalletEntitlement,
  type LessonWalletPricingTierEvidence,
} from '@/lib/lesson-wallet-entitlement'
import { notifyRoles, notifyUser } from '@/lib/notifications'
import { getBangkokDayOfWeek, normalizeCourseTypeName, normalizeScheduleTime } from '@/lib/schedule-template-utils'
import { createClient } from '@/lib/supabase/server'
import type { CourseTypeName, Database } from '@/types/database'

const ACTIVE_BOOKING_STATUSES = ['pending_payment', 'paid', 'verified']
const ACTIVE_SESSION_STATUSES = ['scheduled', 'completed', 'absent']

interface WalletPayload {
  action?: 'store' | 'redeem'
  sessionId?: string
  creditId?: string
  targetDate?: string
  startTime?: string
  endTime?: string
  branchId?: string
  scheduleTemplateId?: string | null
}

interface DbError {
  message: string
  code?: string
}

interface BookingRelation {
  user_id: string
  course_type_id: string
  total_sessions: number
  status: string
  course_types?: { name: CourseTypeName | null } | null
}

interface SessionRow {
  id: string
  booking_id: string
  schedule_slot_id: string | null
  date: string
  start_time: string
  end_time: string
  branch_id: string
  child_id: string | null
  status: string
  is_makeup: boolean | null
  bookings: BookingRelation | null
}

interface TemplateRow {
  id: string
  start_time: string
  end_time: string
}

interface CreditRelation {
  id: string
  user_id: string
  booking_id: string
  original_session_id: string
  branch_id: string
  course_type_id: string
  original_date: string
  original_start_time: string
  original_end_time: string
  status: string
  expires_at: string
  entitlement_policy: 'same_month' | 'ten_month_package' | null
  entitlement_started_at: string | null
  entitlement_payment_id: string | null
  entitlement_pricing_tier_id: string | null
  entitlement_evidence: Record<string, unknown> | null
  stored_at: string
  course_types?: { name: CourseTypeName | null } | null
}

interface StoreRpcResult {
  credit_id: string
  unit_type: 'single' | 'family_private'
  policy_type: 'same_month' | 'ten_month_package'
  entitlement_started_at: string
  expires_at: string
  participant_count: number
  original_schedule_slot_id: string
  original_date: string
  original_start_time: string
  original_end_time: string
  branch_id: string
  assigned_coach_ids: string[]
  removed_membership_ids: string[]
  participant_session_ids: string[]
}

interface RedeemRpcResult {
  credit_id: string
  schedule_slot_id: string
  participant_count: number
  session_ids: string[]
  representative_session_id: string
  original_date: string
  original_start_time: string
  original_end_time: string
  target_date: string
  target_start_time: string
  target_end_time: string
  branch_id: string
}

interface CoachBranchRow {
  coach_id: string
  profiles?: { role: string | null } | null
}

interface RemainingSlotSessionRow {
  id: string
  status: string
  bookings?: { status: string } | null
}

interface RemainingAssignmentRow {
  booking_session_id: string
  coach_assignment_groups?: { coach_id: string | null } | null
}

interface PostWalletAssignmentState {
  activeSessionIds: string[]
  assignedSessionIds: string[]
  unassignedSessionIds: string[]
  needsReview: boolean
  hasActiveLearners: boolean
}

type AdminSupabase = ReturnType<typeof getServiceRoleClient>

function monthKey(date: string) {
  return date.slice(0, 7)
}

function slotLabel(date: string, startTime: string, endTime: string) {
  return formatNotificationSlotDateTime(date, startTime, endTime)
}

function isFutureSlot(date: string, time: string) {
  return new Date(`${date}T${time.slice(0, 5)}:00+07:00`).getTime() > Date.now()
}

async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

async function fetchSession(adminSupabase: AdminSupabase, sessionId: string) {
  const { data, error } = await adminSupabase
    .from('booking_sessions')
    .select(`
      id, booking_id, schedule_slot_id, date, start_time, end_time, branch_id, child_id, status, is_makeup,
      bookings!inner(user_id, course_type_id, total_sessions, status, course_types(name))
    `)
    .eq('id', sessionId)
    .maybeSingle() as unknown as { data: SessionRow | null; error: DbError | null }

  if (error) throw new Error(`โหลดรอบเรียนไม่สำเร็จ: ${error.message}`)
  return data
}

async function findMatchingTemplate(
  adminSupabase: AdminSupabase,
  courseTypeId: string,
  payload: Required<Pick<WalletPayload, 'targetDate' | 'startTime' | 'endTime' | 'branchId'>> & Pick<WalletPayload, 'scheduleTemplateId'>,
) {
  const bangkokDayOfWeek = getBangkokDayOfWeek(payload.targetDate)
  if (bangkokDayOfWeek === null) return null

  const loadTemplates = async (scheduleTemplateId?: string | null) => {
    let query = adminSupabase
      .from('schedule_templates')
      .select('id, start_time, end_time')
      .eq('branch_id', payload.branchId)
      .eq('course_type_id', courseTypeId)
      .eq('day_of_week', bangkokDayOfWeek)
      .eq('is_active', true)

    if (scheduleTemplateId) query = query.eq('id', scheduleTemplateId)

    const { data, error } = await query as unknown as { data: TemplateRow[] | null; error: DbError | null }
    if (error) throw new Error(`โหลดรอบเรียนประจำไม่สำเร็จ: ${error.message}`)

    return (data || []).find((template) => (
      normalizeScheduleTime(template.start_time, payload.targetDate) === normalizeScheduleTime(payload.startTime, payload.targetDate)
      && normalizeScheduleTime(template.end_time, payload.targetDate) === normalizeScheduleTime(payload.endTime, payload.targetDate)
    )) || null
  }

  if (payload.scheduleTemplateId) {
    const templateById = await loadTemplates(payload.scheduleTemplateId)
    if (templateById) return templateById
  }
  return loadTemplates()
}

function inheritedEntitlement(credit: CreditRelation): LessonWalletEntitlement {
  const evidence = credit.entitlement_evidence || {}
  return {
    policyType: credit.entitlement_policy || 'same_month',
    entitlementStartedAt: credit.entitlement_started_at || credit.stored_at,
    expiresAt: credit.expires_at,
    paymentId: credit.entitlement_payment_id || String(evidence.payment_id || ''),
    pricingTier: {
      id: credit.entitlement_pricing_tier_id || String(evidence.pricing_tier_id || ''),
      min: Number(evidence.pricing_tier_min || 0),
      max: evidence.pricing_tier_max === null ? null : Number(evidence.pricing_tier_max || 0),
      unit: evidence.pricing_unit === 'hour' ? 'hour' : 'session',
      pricePerUnit: Number(evidence.price_per_unit || 0),
      packagePrice: Number(evidence.package_price || 0),
      validFrom: typeof evidence.tier_valid_from === 'string' ? evidence.tier_valid_from : null,
      validTo: typeof evidence.tier_valid_to === 'string' ? evidence.tier_valid_to : null,
    },
  }
}

async function resolveAuthoritativeEntitlement(adminSupabase: AdminSupabase, session: SessionRow) {
  const booking = session.bookings
  const courseType = normalizeCourseTypeName(booking?.course_types?.name)
  if (!booking || !courseType) {
    throw new LessonWalletEntitlementError('LESSON_WALLET_TIER_EVIDENCE_MISSING', 'ข้อมูลคอร์สไม่ครบ')
  }

  const [{ data: directPrior }, { data: memberPrior }] = await Promise.all([
    adminSupabase
      .from('lesson_wallet_credits')
      .select(`
        id, user_id, booking_id, original_session_id, branch_id, course_type_id,
        original_date, original_start_time, original_end_time, status, expires_at,
        entitlement_policy, entitlement_started_at, entitlement_payment_id,
        entitlement_pricing_tier_id, entitlement_evidence, stored_at, course_types(name)
      `)
      .eq('redeemed_session_id', session.id) as unknown as PromiseLike<{ data: CreditRelation[] | null }>,
    adminSupabase
      .from('lesson_wallet_credit_members')
      .select(`
        lesson_wallet_credits!inner(
          id, user_id, booking_id, original_session_id, branch_id, course_type_id,
          original_date, original_start_time, original_end_time, status, expires_at,
          entitlement_policy, entitlement_started_at, entitlement_payment_id,
          entitlement_pricing_tier_id, entitlement_evidence, stored_at, course_types(name)
        )
      `)
      .eq('redeemed_session_id', session.id) as unknown as PromiseLike<{
        data: { lesson_wallet_credits: CreditRelation | null }[] | null
      }>,
  ])

  const priorById = new Map<string, CreditRelation>()
  for (const credit of directPrior || []) priorById.set(credit.id, credit)
  for (const row of memberPrior || []) {
    if (row.lesson_wallet_credits) priorById.set(row.lesson_wallet_credits.id, row.lesson_wallet_credits)
  }
  if (priorById.size > 1) {
    throw new LessonWalletEntitlementError('LESSON_WALLET_PAYMENT_EVIDENCE_AMBIGUOUS', 'Entitlement chain is ambiguous')
  }

  const priorCredit = priorById.values().next().value as CreditRelation | undefined
  if (priorCredit) {
    return resolveLessonWalletEntitlement({
      courseType,
      purchasedQuantity: booking.total_sessions,
      originalSessionDate: session.date,
      payments: [],
      pricingTiers: [],
      inheritedEntitlement: inheritedEntitlement(priorCredit),
    })
  }

  const [{ data: payments, error: paymentError }, { data: tiers, error: tierError }] = await Promise.all([
    adminSupabase
      .from('payments')
      .select('id, status, verified_at')
      .eq('booking_id', session.booking_id)
      .eq('user_id', booking.user_id) as unknown as PromiseLike<{
        data: { id: string; status: string; verified_at: string | null }[] | null
        error: DbError | null
      }>,
    adminSupabase
      .from('pricing_tiers')
      .select('id, min_sessions, max_sessions, price_per_session, package_price, valid_from, valid_to, course_types!inner(name)')
      .eq('course_type_id', booking.course_type_id) as unknown as PromiseLike<{
        data: (Omit<LessonWalletPricingTierEvidence, 'course_type_name'> & { course_types?: { name: string | null } | null })[] | null
        error: DbError | null
      }>,
  ])

  if (paymentError) throw new Error(`โหลดหลักฐาน Payment ไม่สำเร็จ: ${paymentError.message}`)
  if (tierError) throw new Error(`โหลดหลักฐาน pricing tier ไม่สำเร็จ: ${tierError.message}`)

  return resolveLessonWalletEntitlement({
    courseType,
    purchasedQuantity: booking.total_sessions,
    originalSessionDate: session.date,
    payments: payments || [],
    pricingTiers: (tiers || []).map((tier) => ({
      ...tier,
      course_type_name: tier.course_types?.name || null,
    })),
  })
}

async function fetchPostWalletAssignmentState(adminSupabase: AdminSupabase, scheduleSlotId: string): Promise<PostWalletAssignmentState> {
  const { data: sessions, error: sessionError } = await adminSupabase
    .from('booking_sessions')
    .select('id, status, bookings!inner(status)')
    .eq('schedule_slot_id', scheduleSlotId)
    .in('status', ACTIVE_SESSION_STATUSES)
    .in('bookings.status', ACTIVE_BOOKING_STATUSES) as unknown as { data: RemainingSlotSessionRow[] | null; error: DbError | null }
  if (sessionError) throw new Error(`ตรวจสอบผู้เรียนที่เหลือในรอบไม่สำเร็จ: ${sessionError.message}`)

  const activeSessionIds = (sessions || []).map((row) => row.id)
  if (activeSessionIds.length === 0) {
    return { activeSessionIds: [], assignedSessionIds: [], unassignedSessionIds: [], needsReview: false, hasActiveLearners: false }
  }

  const { data: assignmentRows, error: assignmentError } = await adminSupabase
    .from('coach_assignment_group_students')
    .select('booking_session_id, coach_assignment_groups!inner(coach_id)')
    .in('booking_session_id', activeSessionIds) as unknown as { data: RemainingAssignmentRow[] | null; error: DbError | null }
  if (assignmentError) throw new Error(`ตรวจสอบกลุ่มโค้ชที่เหลือไม่สำเร็จ: ${assignmentError.message}`)

  const assignedSessionIds = Array.from(new Set((assignmentRows || []).map((row) => row.booking_session_id)))
  const assignedSet = new Set(assignedSessionIds)
  const unassignedSessionIds = activeSessionIds.filter((sessionId) => !assignedSet.has(sessionId))
  return {
    activeSessionIds,
    assignedSessionIds,
    unassignedSessionIds,
    needsReview: unassignedSessionIds.length > 0,
    hasActiveLearners: true,
  }
}

async function notifyHeadCoachesAndAssignedCoach(
  adminSupabase: AdminSupabase,
  branchId: string,
  assignedCoachIds: string[],
  payload: { title: string; message: string; link_url: string },
) {
  const { data } = await adminSupabase
    .from('coach_branches')
    .select('coach_id, profiles!coach_branches_coach_id_fkey(role)')
    .eq('branch_id', branchId) as unknown as { data: CoachBranchRow[] | null }
  const headCoachIds = (data || [])
    .filter((row) => row.profiles?.role === 'head_coach')
    .map((row) => row.coach_id)
  const userIds = Array.from(new Set([...headCoachIds, ...assignedCoachIds]))
  const notificationClient = adminSupabase as unknown as SupabaseClient<Database>

  await Promise.all(userIds.map((userId) => notifyUser(notificationClient, {
    user_id: userId,
    title: payload.title,
    message: payload.message,
    type: 'schedule',
    link_url: payload.link_url,
  }))).catch(() => null)
}

function rpcErrorResponse(error: DbError) {
  const code = resolveLessonWalletErrorCode(error)
  const status = code.endsWith('_NOT_FOUND') ? 404
    : /(STALE|CONFLICT|AMBIGUOUS|UNAVAILABLE)/.test(code) ? 409
      : /(EVIDENCE|INVALID)/.test(code) ? 422
        : 400
  const messages: Record<string, string> = {
    LESSON_WALLET_CREDIT_STALE: 'สิทธิ์นี้ถูกใช้ไปแล้วหรือไม่พร้อมใช้งาน กรุณารีเฟรชหน้า',
    LESSON_WALLET_UNIT_STALE: 'รอบเรียนนี้ถูกเก็บเข้ากระเป๋าแล้ว กรุณารีเฟรชหน้า',
    LESSON_WALLET_TARGET_CONFLICT: 'ผู้เรียนอย่างน้อยหนึ่งคนมีรอบเรียนที่ซ้ำหรือซ้อนกับเวลานี้แล้ว',
    LESSON_WALLET_SAME_MONTH_REQUIRED: 'สิทธิ์นี้ใช้ได้เฉพาะเดือนเดียวกับรอบเดิม',
    LESSON_WALLET_ENTITLEMENT_EXPIRED: 'สิทธิ์นี้หมดอายุแล้วและไม่สามารถนำกลับมาใช้ใหม่ได้',
    LESSON_WALLET_TARGET_AFTER_EXPIRY: 'รอบที่เลือกอยู่หลังวันหมดอายุของสิทธิ์',
    LESSON_WALLET_TEMPLATE_NOT_FOUND: 'ไม่พบรอบเรียนประจำที่เปิดใช้งานตรงกับสาขา คอร์ส วัน และเวลาที่เลือก',
    LESSON_WALLET_TARGET_UNAVAILABLE: 'รอบเรียนนี้ถูกยกเลิกหรือไม่พร้อมใช้งานแล้ว',
    LESSON_WALLET_PAYMENT_EVIDENCE_MISSING: 'ไม่พบหลักฐาน Payment ที่อนุมัติครบถ้วน จึงยังเก็บสิทธิ์ไม่ได้',
    LESSON_WALLET_PAYMENT_EVIDENCE_AMBIGUOUS: 'พบหลักฐาน Payment มากกว่าหนึ่งรายการ จึงยังเก็บสิทธิ์ไม่ได้',
    LESSON_WALLET_TIER_EVIDENCE_MISSING: 'ไม่พบ pricing tier ที่ตรงกับแพ็กเกจ ณ วันที่อนุมัติ Payment',
    LESSON_WALLET_TIER_EVIDENCE_AMBIGUOUS: 'พบ pricing tier ที่มีผลทับซ้อนกัน จึงยังเก็บสิทธิ์ไม่ได้',
    LESSON_WALLET_UNIT_NOT_STORABLE: 'ผู้เรียนอย่างน้อยหนึ่งคนในรอบนี้ไม่ผ่านเงื่อนไขเก็บก่อน 48 ชั่วโมง',
    LESSON_WALLET_ATTENDANCE_EXISTS: 'รอบนี้มีการเช็คชื่อแล้ว ไม่สามารถเก็บเข้ากระเป๋าได้',
  }
  return NextResponse.json({ code, error: messages[code] || 'ทำรายการกระเป๋าวันเรียนไม่สำเร็จ กรุณาลองใหม่' }, { status })
}

async function storeInWallet(request: NextRequest, userId: string, payload: WalletPayload) {
  if (!payload.sessionId) return NextResponse.json({ error: 'ไม่พบรอบเรียนที่ต้องการเก็บ' }, { status: 400 })
  const adminSupabase = getServiceRoleClient()
  const session = await fetchSession(adminSupabase, payload.sessionId)
  if (!session || session.bookings?.user_id !== userId) {
    return NextResponse.json({ error: 'ไม่พบรอบเรียนที่ต้องการเก็บ' }, { status: 404 })
  }

  const entitlement = await resolveAuthoritativeEntitlement(adminSupabase, session)
  // Atomic contract inside lesson_wallet_store_v2:
  // rpc('retire_coach_assignment_membership_v1', { p_reason: 'wallet_store' })
  const { data, error } = await adminSupabase.rpc('lesson_wallet_store_v2', {
    p_user_id: userId,
    p_session_id: session.id,
    p_actor_id: userId,
  }) as unknown as { data: StoreRpcResult | null; error: DbError | null }
  if (error || !data) return rpcErrorResponse(error || { message: 'LESSON_WALLET_MUTATION_FAILED' })

  const postWalletState = await fetchPostWalletAssignmentState(adminSupabase, data.original_schedule_slot_id)
  const label = slotLabel(data.original_date, data.original_start_time, data.original_end_time)
  const unitCopy = data.unit_type === 'family_private' ? `ทั้งครอบครัว ${data.participant_count} คน` : '1 สิทธิ์'
  const notifications: Promise<unknown>[] = [
    notifyRoles(adminSupabase as unknown as SupabaseClient<Database>, {
      roles: ['admin', 'super_admin'],
      title: 'ผู้เรียนเก็บรอบเรียนเข้ากระเป๋า',
      message: `ผู้เรียนเก็บรอบ ${label} (${unitCopy}) เข้ากระเป๋าวันเรียน`,
      type: 'schedule',
      link_url: '/admin/schedules',
    }),
    logActivity({
      userId,
      action: 'store_lesson_wallet_credit',
      entityType: 'lesson_wallet_credits',
      entityId: data.credit_id,
      details: {
        policyType: entitlement.policyType,
        entitlementStartedAt: entitlement.entitlementStartedAt,
        expiresAt: entitlement.expiresAt,
        paymentId: entitlement.paymentId,
        pricingTier: entitlement.pricingTier,
        unitType: data.unit_type,
        participantCount: data.participant_count,
        participantSessionIds: data.participant_session_ids,
        removedAssignmentStudentIds: data.removed_membership_ids,
        postWalletAssignmentState: postWalletState,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
    }),
  ]
  if (postWalletState.needsReview) {
    notifications.push(notifyHeadCoachesAndAssignedCoach(adminSupabase, data.branch_id, data.assigned_coach_ids, {
      title: 'ผู้เรียนถูกย้ายเข้ากระเป๋า ต้องตรวจกลุ่มสอน',
      message: `ผู้เรียนเก็บรอบ ${label} (${unitCopy}) เข้ากระเป๋าแล้ว และยังมีผู้เรียนที่ต้องมอบหมายโค้ชในรอบนี้`,
      link_url: `/coach/assign-groups?month=${monthKey(data.original_date)}`,
    }))
  }
  await Promise.all(notifications).catch(() => null)

  return NextResponse.json({ success: true, creditId: data.credit_id, participantCount: data.participant_count })
}

async function redeemWalletCredit(request: NextRequest, userId: string, payload: WalletPayload) {
  const { creditId, targetDate, startTime, endTime, branchId, scheduleTemplateId } = payload
  if (!creditId || !targetDate || !startTime || !endTime || !branchId) {
    return NextResponse.json({ error: 'ข้อมูลการใช้วันเรียนจากกระเป๋าไม่ครบ' }, { status: 400 })
  }
  if (!isFutureSlot(targetDate, startTime)) {
    return NextResponse.json({ error: 'ต้องเลือกรอบเรียนที่ยังไม่เริ่มเท่านั้น' }, { status: 400 })
  }

  const adminSupabase = getServiceRoleClient()
  const { data: credit, error: creditError } = await adminSupabase
    .from('lesson_wallet_credits')
    .select(`
      id, user_id, booking_id, original_session_id, branch_id, course_type_id,
      original_date, original_start_time, original_end_time, status, expires_at,
      entitlement_policy, entitlement_started_at, entitlement_payment_id,
      entitlement_pricing_tier_id, entitlement_evidence, stored_at, course_types(name)
    `)
    .eq('id', creditId)
    .maybeSingle() as unknown as { data: CreditRelation | null; error: DbError | null }
  if (creditError || !credit || credit.user_id !== userId) {
    return NextResponse.json({ error: 'ไม่พบสิทธิ์วันเรียนในกระเป๋า' }, { status: 404 })
  }

  const courseType = normalizeCourseTypeName(credit.course_types?.name)
  if (!courseType) return NextResponse.json({ code: 'LESSON_WALLET_COURSE_INVALID', error: 'ข้อมูลคอร์สของสิทธิ์ไม่ถูกต้อง' }, { status: 422 })
  const normalizedStartTime = normalizeScheduleTime(startTime, targetDate)
  const normalizedEndTime = normalizeScheduleTime(endTime, targetDate)
  if (!normalizedStartTime || !normalizedEndTime || normalizedStartTime >= normalizedEndTime) {
    return NextResponse.json({ code: 'LESSON_WALLET_TEMPLATE_NOT_FOUND', error: 'ข้อมูลเวลารอบเรียนไม่ถูกต้อง' }, { status: 400 })
  }

  const template = await findMatchingTemplate(adminSupabase, credit.course_type_id, {
    targetDate,
    startTime: normalizedStartTime,
    endTime: normalizedEndTime,
    branchId,
    scheduleTemplateId: scheduleTemplateId || null,
  })
  if (!template) return NextResponse.json({ code: 'LESSON_WALLET_TEMPLATE_NOT_FOUND', error: 'ไม่พบรอบเรียนประจำที่เปิดใช้งานตรงกับข้อมูลที่เลือก' }, { status: 400 })

  const { data, error } = await adminSupabase.rpc('lesson_wallet_redeem_v2', {
    p_user_id: userId,
    p_credit_id: credit.id,
    p_target_date: targetDate,
    p_start_time: normalizedStartTime,
    p_end_time: normalizedEndTime,
    p_branch_id: branchId,
    p_schedule_template_id: template.id,
  }) as unknown as { data: RedeemRpcResult | null; error: DbError | null }
  if (error || !data) return rpcErrorResponse(error || { message: 'LESSON_WALLET_MUTATION_FAILED' })

  const oldLabel = slotLabel(data.original_date, data.original_start_time, data.original_end_time)
  const newLabel = slotLabel(data.target_date, data.target_start_time, data.target_end_time)
  const unitCopy = data.participant_count > 1 ? `ทั้งครอบครัว ${data.participant_count} คน` : '1 สิทธิ์'
  await Promise.all([
    notifyHeadCoachesAndAssignedCoach(adminSupabase, branchId, [], {
      title: 'ผู้เรียนใช้วันเรียนจากกระเป๋า',
      message: `ผู้เรียนใช้สิทธิ์ ${unitCopy} จากรอบ ${oldLabel} มาลงรอบ ${newLabel} กรุณาจัดกลุ่ม/มอบหมายโค้ช`,
      link_url: `/coach/assign-groups?month=${monthKey(targetDate)}`,
    }),
    notifyRoles(adminSupabase as unknown as SupabaseClient<Database>, {
      roles: ['admin', 'super_admin'],
      title: 'ผู้เรียนใช้วันเรียนจากกระเป๋า',
      message: `ผู้เรียนใช้สิทธิ์ ${unitCopy} จากกระเป๋ามาลงรอบ ${newLabel}`,
      type: 'schedule',
      link_url: '/admin/schedules',
    }),
    logActivity({
      userId,
      action: 'redeem_lesson_wallet_credit',
      entityType: 'lesson_wallet_credits',
      entityId: credit.id,
      details: {
        originalSessionId: credit.original_session_id,
        newSessionIds: data.session_ids,
        scheduleSlotId: data.schedule_slot_id,
        targetDate,
        startTime: normalizedStartTime,
        branchId,
        participantCount: data.participant_count,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
    }),
  ]).catch(() => null)

  return NextResponse.json({
    success: true,
    sessionId: data.representative_session_id,
    sessionIds: data.session_ids,
    scheduleSlotId: data.schedule_slot_id,
    participantCount: data.participant_count,
  })
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json() as WalletPayload
    if (body.action === 'store') return await storeInWallet(request, user.id, body)
    if (body.action === 'redeem') return await redeemWalletCredit(request, user.id, body)
    return NextResponse.json({ error: 'ไม่พบ action ที่รองรับ' }, { status: 400 })
  } catch (error) {
    if (error instanceof LessonWalletEntitlementError) return rpcErrorResponse(error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' }, { status: 500 })
  }
}
