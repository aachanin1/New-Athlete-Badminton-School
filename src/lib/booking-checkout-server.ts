import 'server-only'
import { getServiceRoleClient } from '@/lib/auth/admin'
import type { BookingPackage } from '@/lib/booking-checkout'
import type { PreviousBooking } from '@/lib/booking-previous'
import { PACKAGE_DATE_ERROR } from '@/lib/booking-package-validity'

interface CheckoutRpc {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string;code?:string } | null }>
}
export class CheckoutRpcError extends Error {
  readonly definitive:boolean
  readonly requiresReadback:boolean
  constructor(error:{message:string;code?:string}){
    super(error.message);this.name='CheckoutRpcError'
    this.definitive=Boolean(error.code&&/^(P0001|22[A-Z0-9]{3}|23[A-Z0-9]{3})$/.test(error.code))
    this.requiresReadback=error.message.includes('IDEMPOTENCY_CONFLICT')
  }
}

export async function checkoutRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const client = getServiceRoleClient() as unknown as CheckoutRpc
  const { data, error } = await client.rpc(name, args)
  if (error) throw new CheckoutRpcError(error)
  if (data === null) throw new Error('BOOKING_UX_UNAVAILABLE')
  return data as T
}

export const loadBookingPackages = () => checkoutRpc<BookingPackage[]>('booking_ux_catalog_v1')

/** Latest verified course purchase; expand only proven payment-set membership. */
export async function loadPreviousBookings(actor: string): Promise<PreviousBooking[]> {
  const db = getServiceRoleClient()
  const types = await db.from('course_types').select('id').in('name', ['kids_group', 'adult_group', 'private'])
  if (types.error) throw types.error
  const recent = await Promise.all((types.data || []).map(t => db.from('bookings').select('id,course_type_id,branch_id,total_sessions,package_snapshot,package_participants,child_id,course_types(name)').eq('user_id', actor).eq('course_type_id', t.id).eq('status', 'verified').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1)))
  if (recent.some(r => r.error)) throw Error('BOOKING_UX_READ_FAILED')
  const latest = recent.flatMap(r => r.data || [])
  return Promise.all(latest.map(async b => {
    const member = await db.from('progressive_payment_batch_bookings').select('payment_batch_id,progressive_payment_batches!inner(user_id,status)').eq('booking_id', b.id).eq('progressive_payment_batches.user_id', actor).eq('progressive_payment_batches.status', 'approved').limit(2)
    if (member.error || (member.data?.length || 0) > 1) throw Error('BOOKING_UX_READ_FAILED')
    let ids = [b.id]
    if (member.data?.[0]) {
      const members = await db.from('progressive_payment_batch_bookings').select('booking_id').eq('payment_batch_id', member.data[0].payment_batch_id).limit(101)
      if (members.error || !members.data?.length || members.data.length > 100) throw Error('BOOKING_UX_SCOPE_LIMIT')
      ids = members.data.map(x => x.booking_id)
    }
    const [bills, sessions] = await Promise.all([
      db.from('bookings').select('id,branch_id,total_sessions,package_participants,child_id').eq('user_id', actor).eq('status', 'verified').eq('course_type_id', b.course_type_id).in('id', ids),
      db.from('booking_sessions').select('booking_id,branch_id,child_id').in('booking_id', ids).limit(2001),
    ])
    if (bills.error || sessions.error || (sessions.data?.length || 0) > 2000) throw Error('BOOKING_UX_READ_FAILED')
    const owned = new Set((bills.data || []).map(x => x.id))
    const rows = (sessions.data || []).filter(s => owned.has(s.booking_id))
    const participants = [...new Set((bills.data || []).flatMap(x => Array.isArray(x.package_participants) ? x.package_participants as Array<string | null> : rows.some(s => s.booking_id === x.id) ? [] : [x.child_id]).concat(rows.map(s => s.child_id)))]
    const snapshot = b.package_snapshot as { id?: string } | null
    const course = b.course_types as unknown as { name: string } | null
    return { course: course?.name || '', branchIds: [...new Set([...(bills.data || []).map(x => x.branch_id), ...rows.map(x => x.branch_id)])], quantity: (bills.data || []).reduce((n, x) => n + x.total_sessions, 0), packageId: snapshot?.id || null, participants }
  }))
}

export function checkoutError(error: unknown) {
  const source = error instanceof Error ? error.message : ''
  const messages: Record<string, string> = {
    PROGRESSIVE_BOOKING_CONFLICT: 'พบข้อมูลชุดราคาของรายการเดิมไม่สอดคล้องกัน กรุณาติดต่อเจ้าหน้าที่เพื่อตรวจสอบ',
    BOOKING_UX_LEARNER_ADDITION_ONLY: 'กรุณาคงผู้เรียนเดิมไว้ และเลือกผู้เรียนที่ต้องการเพิ่มก่อนบันทึก',
    BOOKING_UX_LEARNER_ROUND_REQUIRED: 'กรุณาเลือกวันและรอบเรียนให้ผู้เรียนที่เลือกครบทุกคน',
    BOOKING_UX_QUOTE_CHANGED: 'ยอดเงินหรือเงื่อนไขคูปองเปลี่ยนแล้ว กรุณาตรวจยอดล่าสุดก่อนบันทึกอีกครั้ง',
    BOOKING_UX_LEGACY_COUPON_REVIEW_REQUIRED: 'บิลเดิมมีเงื่อนไขคูปองที่ต้องตรวจสอบก่อนเปลี่ยนยอด ระบบยังเก็บวันเรียนและยอดเดิมไว้ กรุณาติดต่อผู้ดูแล',
    BOOKING_UX_COUPON_ACK_REQUIRED: 'ยอดใหม่ไม่เข้าเงื่อนไขคูปอง กรุณาตรวจและยืนยันยอดที่ไม่มีส่วนลดก่อนบันทึก',
    PROGRESSIVE_COUPON_NOT_FOUND: 'ไม่พบคูปองนี้',
    PROGRESSIVE_COUPON_INACTIVE: 'คูปองนี้ไม่สามารถใช้งานได้',
    PROGRESSIVE_COUPON_NOT_STARTED: 'คูปองยังไม่เริ่มใช้งาน',
    PROGRESSIVE_COUPON_EXPIRED: 'คูปองหมดอายุแล้ว',
    PROGRESSIVE_COUPON_MIN_PURCHASE: 'ยอดจองไม่ถึงยอดขั้นต่ำของคูปอง กรุณาตรวจยอดหรือเลือกโค้ดอื่น',
    PROGRESSIVE_COUPON_COURSE_NOT_ALLOWED: 'คูปองนี้ใช้กับคอร์สที่เลือกไม่ได้',
    PROGRESSIVE_COUPON_ALREADY_USED: 'คูปองนี้ใช้สำเร็จแล้วหรือกันสิทธิ์ไว้ในบิลที่ยังเปิดอยู่',
    PROGRESSIVE_COUPON_MAX_USES: 'สิทธิ์คูปองถูกใช้หรือกันไว้ครบจำนวนแล้ว',
    BOOKING_UX_SET_CHANGED: 'ชุดรายการเปลี่ยนไปหรือมีการส่งสลิปแล้ว กรุณาเปิดข้อมูลล่าสุดก่อนแก้ไข',
    PROGRESSIVE_SCOPE_REVISION_CONFLICT: 'มีการเปลี่ยนรายการจากอีกหน้าต่าง กรุณาเปิดข้อมูลล่าสุด',
    PROGRESSIVE_INVALID_REQUEST: 'กรุณาเลือกวันเรียนอย่างน้อยหนึ่งรอบให้แต่ละรายการ',
    BOOKING_UX_DISABLED: 'ระบบจองใหม่ยังไม่เปิดรับรายการ กรุณาลองอีกครั้งภายหลัง',
    BOOKING_UX_PACKAGE_CHANGED: 'อายุหรือเงื่อนไขแพ็กเกจเปลี่ยนแล้ว กรุณาโหลดแพ็กเกจล่าสุดและตรวจสอบอีกครั้ง',
    BOOKING_UX_START_WITHIN_PAYMENT_WINDOW: 'รอบนี้จะเริ่มภายในช่วงชำระ 30 นาที กรุณาเลือกรอบถัดไป',
    BOOKING_UX_PACKAGE_QUANTITY: 'จำนวนวันที่เลือกไม่ตรงกับแพ็กเกจ กรุณาตรวจสอบอีกครั้ง',
    BOOKING_UX_INVALID_LEARNER: 'ข้อมูลผู้เรียนไม่ตรงกับบัญชี กรุณาเลือกผู้เรียนใหม่',
    BOOKING_UX_FAMILY_PARTICIPANTS: 'กรุณาเลือกผู้เข้าร่วมครอบครัวให้ครบทุกชั่วโมง',
    BOOKING_UX_IDEMPOTENCY_CONFLICT: 'คำขอเดิมมีข้อมูลต่างกัน กรุณาตรวจสอบผลเดิมก่อนเริ่มรายการใหม่',
    BOOKING_UX_TARGET_AFTER_EXPIRY: PACKAGE_DATE_ERROR,
    BOOKING_UX_PAYMENT_EVIDENCE_REQUIRED: 'ยังยืนยันหลักฐานการชำระไม่ได้ กรุณาตรวจสอบสถานะเดิม',
    TASK10_DUPLICATE_SESSION: 'ผู้เรียนมีรอบเรียนซ้ำหรือเวลาทับซ้อนแล้ว กรุณาเลือกเวลาอื่น',
    TASK10_AMOUNT_CONFLICT: 'ราคามีการเปลี่ยนแปลง กรุณาตรวจยอดล่าสุดก่อนยืนยัน',
    BOOKING_UX_FORBIDDEN: 'ไม่มีสิทธิ์ดำเนินการรายการนี้',
    BOOKING_UX_DURATION_INVALID: 'ระบุอายุแพ็กเกจเป็นจำนวนเต็ม 1–120 เดือน',
    BOOKING_UX_REFRESH_REQUIRED: 'กรุณาเปิดหน้าจองล่าสุดเพื่อแก้ไขรายการนี้',
    BOOKING_UX_TOO_MANY_ROUNDS: 'เลือกได้ครั้งละไม่เกิน 500 รายชื่อ–รอบ กรุณาลดรอบที่เลือก หรือซื้อแพ็กเกจแล้วเลือกวันภายหลัง',
    BOOKING_UX_ENTITLEMENT_UNAVAILABLE: 'สิทธินี้ถูกใช้หรือหมดอายุแล้ว กรุณาอ่านกระเป๋าล่าสุดและเลือกใหม่',
    BOOKING_UX_TARGET_INVALID: 'รอบที่เลือกเริ่มแล้วหรือเวลาไม่ถูกต้อง กรุณาเลือกรอบถัดไป',
    TASK10_LEARNER_OVERLAP: 'ผู้เรียนมีเวลาเรียนทับซ้อนแล้ว กรุณาเลือกวันหรือเวลาอื่น',
    BOOKING_UX_PRIVATE_HOUR_OVERLAP: 'บิล Private นี้มีรอบเรียนในเวลานี้แล้ว กรุณาเลือกรอบอื่นเพื่อไม่ใช้สิทธิ์ซ้ำ',
    BOOKING_UX_PRIVATE_HOUR_BUSY: 'กำลังปรับรอบ Private ของบิลนี้ กรุณาอ่านข้อมูลล่าสุดแล้วลองใหม่',
    TASK10_INVALID_TEMPLATE: 'รอบเรียนเปลี่ยนไปแล้ว กรุณาอ่านตารางล่าสุดและเลือกใหม่',
    TASK10_MAKEUP_INELIGIBLE: 'ยังใช้กระเป๋าข้ามเดือนไม่ได้ กรุณาตรวจจำนวนที่ชำระเดือนปลายทาง โควตา และวันหมดอายุในกระเป๋า',
    TASK10_MAKEUP_PAUSED: 'ระบบใช้กระเป๋าข้ามเดือนหยุดชั่วคราว กรุณาลองใหม่ภายหลัง',
    TASK10_APPROVAL_REQUIRED: 'โควตาข้ามเดือนหมดแล้ว กรุณาเลือกสิทธิอื่นที่ยังใช้ได้',
    TASK10_TARGET_MONTH: 'สิทธินี้ใช้ได้เฉพาะเดือนที่กำหนด กรุณาเลือกวันใหม่',
    BRANCH_DATE_CLOSED: 'สาขาปิดในวันที่เลือก กรุณาเลือกวันหรือสาขาอื่น',
  }
  return Object.entries(messages).find(([code]) => source.includes(code))?.[1]
    || 'ข้อมูลรายการเปลี่ยนไปหรือระบบยังไม่พร้อม กรุณาตรวจผลเดิมและลองอีกครั้ง'
}
