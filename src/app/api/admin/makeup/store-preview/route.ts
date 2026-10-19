import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { resolveLessonWalletEntitlement, type LessonWalletEntitlement, type LessonWalletPaymentEvidence, type LessonWalletPricingTierEvidence } from '@/lib/lesson-wallet-entitlement'
import { readKidsFamilyMakeup } from '@/lib/kids-family-makeup'
import type { CourseCategory } from '@/lib/pricing'
import { callTask10 } from '@/lib/task10-policy'

interface Source {
  id: string; booking_id: string; child_id: string | null; schedule_slot_id: string | null; date: string; start_time: string; end_time: string
  status: string; is_makeup: boolean; cancelled_at: string | null
  bookings: { user_id: string; status: string; total_sessions: number; learner_type: string; course_type_id: string; course_types: { name: CourseCategory } }
}
type ReadQuery<T> = (start: number, end: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
async function all<T>(query: ReadQuery<T>) {
  const rows: T[] = []
  for (let start = 0; ; start += 1000) {
    const { data, error } = await query(start, start + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data || [])); if (!data || data.length < 1000) return rows
  }
}
export async function GET(request: NextRequest) {
  const access = await requireAdminMenuAccess('makeup')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  const session = request.nextUrl.searchParams.get('session') || ''
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(session)) return NextResponse.json({ error: 'ข้อมูลรอบเรียนไม่ถูกต้อง' }, { status: 400 })
  const json = (body: Record<string, unknown>) => NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } })
  try {
    const client = getServiceRoleClient()
    const { data, error } = await client.from('booking_sessions').select('id,booking_id,child_id,schedule_slot_id,date,start_time,end_time,status,is_makeup,cancelled_at,bookings!inner(user_id,status,total_sessions,learner_type,course_type_id,course_types!inner(name))').eq('id', session).single()
    if (error || !data) throw new Error('Source read unavailable')
    const s = data as unknown as Source, b = s.bookings, course = b.course_types.name
    if (b.status !== 'verified' || s.status !== 'scheduled' || s.is_makeup || s.cancelled_at || !s.schedule_slot_id) return json({ eligible: false, reason: 'รอบต้นทางเปลี่ยนหรือไม่พร้อมเก็บแล้ว กรุณาตรวจรายการล่าสุด' })
    const members = course === 'private' ? await all<{ id: string; child_id: string | null }>((start, end) => client.from('booking_sessions').select('id,child_id')
      .eq('booking_id', s.booking_id).eq('schedule_slot_id', s.schedule_slot_id).eq('date', s.date).eq('start_time', s.start_time).eq('end_time', s.end_time)
      .eq('status', 'scheduled').eq('is_makeup', false).is('cancelled_at', null).order('id').range(start, end)) : [{ id: s.id, child_id: s.child_id }]
    if (!members.length || new Set(members.map(m => m.child_id || 'self')).size !== members.length) return json({ eligible: false, reason: 'ข้อมูลหน่วยผู้เรียนไม่ชัดเจน กรุณาตรวจรายการเดิม' })
    const priorIds = new Set<string>()
    for (let offset = 0; offset < members.length; offset += 100) {
      const ids = members.slice(offset, offset + 100).map(m => m.id), childIds = members.slice(offset, offset + 100).flatMap(m => m.child_id ? [m.child_id] : [])
      const [attendance, existing, linked, direct, children] = await Promise.all([
        all<{ id: string }>((start, end) => client.from('attendance').select('id').in('booking_session_id', ids).order('id').range(start, end)),
        all<{ id: string }>((start, end) => client.from('lesson_wallet_credits').select('id').in('original_session_id', ids).order('id').range(start, end)),
        all<{ credit_id: string; original_session_id: string; redeemed_session_id: string | null }>((start, end) => client.from('lesson_wallet_credit_members').select('credit_id,original_session_id,redeemed_session_id').or(`original_session_id.in.(${ids.join(',')}),redeemed_session_id.in.(${ids.join(',')})`).order('credit_id').order('original_session_id').range(start, end)),
        all<{ id: string }>((start, end) => client.from('lesson_wallet_credits').select('id').in('redeemed_session_id', ids).order('id').range(start, end)),
        childIds.length ? all<{ id: string }>((start, end) => client.from('children').select('id').in('id', childIds).eq('parent_id', b.user_id).order('id').range(start, end)) : [],
      ])
      if (children.length !== childIds.length || members.some(m => m.child_id === null) && (course === 'kids_group' || b.learner_type === 'child')) return json({ eligible: false, reason: 'ข้อมูลผู้เรียนไม่ครบ กรุณาตรวจรายการเดิม' })
      if (attendance.length) return json({ eligible: false, reason: 'มีการเช็คชื่อแล้ว กรุณาตรวจประวัติในแท็บต้องตรวจสอบ' })
      if (existing.length || linked.some(m => ids.includes(m.original_session_id))) return json({ eligible: false, reason: 'รอบต้นทางมีเครดิตอยู่แล้ว กรุณาตรวจประวัติกระเป๋า' })
      direct.forEach(w => priorIds.add(w.id)); linked.filter(m => m.redeemed_session_id && ids.includes(m.redeemed_session_id)).forEach(m => priorIds.add(m.credit_id))
    }
    if (priorIds.size > 1) return json({ eligible: false, reason: 'หลักฐานเครดิตต้นทางไม่ชัดเจน กรุณาตรวจประวัติ' })
    let inherited: LessonWalletEntitlement | null = null
    if (priorIds.size) {
      const { data: prior, error: priorError } = await client.from('lesson_wallet_credits').select('status,expires_at,entitlement_policy,entitlement_started_at,entitlement_payment_id').eq('id', [...priorIds][0]).eq('user_id', b.user_id).single()
      if (priorError || !prior) throw new Error('Prior credit unavailable')
      if (prior.status !== 'redeemed') return json({ eligible: false, reason: 'เครดิตต้นทางยังไม่พร้อมเก็บซ้ำ กรุณาตรวจประวัติ' })
      inherited = { policyType: prior.entitlement_policy, expiresAt: prior.expires_at, entitlementStartedAt: prior.entitlement_started_at, paymentId: prior.entitlement_payment_id, pricingTier: null }
    }
    const [payments, tiers, family] = await Promise.all([
      course !== 'kids_group' && !inherited ? all<LessonWalletPaymentEvidence>((start, end) => client.from('payments').select('id,status,verified_at').eq('booking_id', s.booking_id).eq('user_id', b.user_id).eq('status', 'approved').order('id').range(start, end)) : [],
      course !== 'kids_group' && !inherited ? all<Omit<LessonWalletPricingTierEvidence, 'course_type_name'>>((start, end) => client.from('pricing_tiers').select('id,min_sessions,max_sessions,price_per_session,package_price,valid_from,valid_to').eq('course_type_id', b.course_type_id).order('id').range(start, end)) : [],
      course === 'kids_group' ? readKidsFamilyMakeup(client, access.ctx.user.id, b.user_id, s.date.slice(0, 7)) : null,
    ])
    const entitlement = resolveLessonWalletEntitlement({ courseType: course, purchasedQuantity: b.total_sessions, originalSessionDate: s.date, payments,
      pricingTiers: tiers.map(t => ({ ...t, course_type_name: course })), inheritedEntitlement: inherited })
    if (Date.parse(entitlement.expiresAt) < Date.now()) return json({ eligible: false, reason: 'สิทธิ์กระเป๋าปกติหมดอายุแล้ว ไม่สามารถเก็บหรือขยายอายุย้อนหลังได้', expiresAt: entitlement.expiresAt })
    const confirmation = await callTask10<{ ready: boolean; confirmCredit: boolean; active: boolean }>(client, 'admin_makeup_store_once_preview_v1', { p_actor: access.ctx.user.id, p_source: s.id })
    if (!confirmation.ready || confirmation.confirmCredit && (!confirmation.active || !family?.creditApprovalsEnabled)) return json({ eligible: false, expiresAt: entitlement.expiresAt, confirmation, family, reason: 'ระบบเก็บสิทธิ์ยังไม่พร้อม กรุณาลองใหม่ภายหลัง' })
    return json({ eligible: true, expiresAt: entitlement.expiresAt, participantCount: members.length, confirmation, family: family?.sourceMonth ? family : null })
  } catch { return NextResponse.json({ error: 'ยังอ่านสิทธิ์สำหรับเก็บกระเป๋าไม่ได้ กรุณาลองใหม่' }, { status: 503 }) }
}
