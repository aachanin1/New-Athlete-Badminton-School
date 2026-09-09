// Pure contract: safe in client components. Activation is supplied by the DB,
// never inferred from deployment/environment names or a browser clock.
export type Task10State = 'never_activated' | 'active' | 'paused'
export type KidsPricingRegime = 'early' | 'late'

export interface Task10Policy {
  state: Task10State
  revision: number
  effectiveAt: string | null
  pricingEnabled: boolean
  makeupEnabled: boolean
  expiryEnabled: boolean
}

export interface Task10RpcClient {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{
    data: unknown
    error: { message: string; code?: string; details?: string } | null
  }>
}

export class Task10Error extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 409) {
    super(message)
    this.name = 'Task10Error'
  }
}

export function task10RpcError(code?: string): Task10Error {
  const messages: Record<string, string> = {
      TASK10_BOOKING_DEADLINE: 'หมดเวลารับสลิปของบิลนี้แล้ว กรุณารีเฟรชเพื่อตรวจสอบสถานะล่าสุด',
      TASK10_BOOKING_CANCELLED: 'บิลนี้ถูกยกเลิกแล้ว กรุณารีเฟรชเพื่อตรวจสอบรายการ',
      TASK10_BOOKING_STATE_CONFLICT: 'สถานะบิลเปลี่ยนแล้ว กรุณารีเฟรชก่อนทำรายการอีกครั้ง',
      TASK10_AMOUNT_CONFLICT: 'ยอดชำระเปลี่ยนแล้ว กรุณาคำนวณราคาใหม่',
      TASK10_PREVIEW_CONFLICT: 'ชุดราคาหรือวันที่จองเปลี่ยนแล้ว กรุณาคำนวณราคาใหม่ก่อนยืนยัน',
      TASK10_PRICING_PAUSED: 'ระบบรับการจองเด็กใหม่หยุดชั่วคราว กรุณาลองใหม่ภายหลัง',
      TASK10_PROGRESSIVE_ENTRY_REQUIRED: 'การจองเด็กใหม่ต้องใช้หน้าคำนวณราคาล่าสุด กรุณารีเฟรชแล้วลองใหม่',
      TASK10_UNAUTHORIZED: 'คุณไม่มีสิทธิ์ทำรายการนี้',
      TASK10_INVALID_REQUEST: 'ข้อมูลคำขอไม่ครบหรือไม่ถูกต้อง',
      TASK10_INVALID_TEMPLATE: 'รอบเรียนไม่ตรงกับรอบประจำที่เปิดใช้งาน กรุณาเลือกรอบใหม่',
      TASK10_DUPLICATE_SESSION: 'ผู้เรียนมีรอบเรียนในเวลาที่ซ้ำหรือซ้อนกันแล้ว',
      TASK10_COUPON_CONFLICT: 'คูปองไม่พร้อมใช้งานแล้ว กรุณาตรวจสอบราคาและคูปองอีกครั้ง',
      TASK10_RESCHEDULE_CUTOFF: 'ต้องเปลี่ยนล่วงหน้าอย่างน้อย 12 ชั่วโมงก่อนเวลาเรียนเดิม',
      TASK10_SOURCE_CONFLICT: 'สิทธิ์ต้นทางเปลี่ยนหรือถูกใช้แล้ว กรุณารีเฟรชเพื่อตรวจสอบรายการ',
      TASK10_MAKEUP_INELIGIBLE: 'เงื่อนไขชดเชยของครอบครัวเปลี่ยนแล้ว กรุณาตรวจสอบสิทธิ์และยอดยืนยันล่าสุด',
      PROGRESSIVE_LEGACY_BASELINE_DRIFT: 'หลักฐานสิทธิ์เดิมเปลี่ยนไม่ตรงกับฐานราคา กรุณาให้ผู้ดูแลตรวจสอบ',
  }
  return new Task10Error(code || 'TASK10_UNAVAILABLE', (code && messages[code]) || 'ข้อมูลรายการเปลี่ยนหรือยังตรวจสอบไม่ได้ กรุณารีเฟรชแล้วลองใหม่',
    code?.endsWith('_UNAUTHORIZED') ? 403 : code?.endsWith('_INVALID_REQUEST') ? 400 : code ? 409 : 503)
}

export async function callTask10<T>(client: Task10RpcClient, name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name, args)
  if (error) throw task10RpcError(/(?:TASK10|PROGRESSIVE)_[A-Z_]+/.exec(error.message)?.[0])
  if (data === null) throw new Task10Error('TASK10_UNAVAILABLE', 'ไม่สามารถอ่านข้อมูลกติกาได้', 503)
  return data as T
}

export function loadTask10Policy(client: Task10RpcClient) {
  return callTask10<Task10Policy>(client, 'task10_policy_status_v1')
}

export function bangkokDate(instant: string): string {
  // An explicit offset is mandatory; parsing a local date-time is ambiguous.
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(instant) || !Number.isFinite(Date.parse(instant))) {
    throw new Task10Error('TASK10_INVALID_REQUEST', 'เวลาอ้างอิงไม่ถูกต้อง', 400)
  }
  return new Date(Date.parse(instant) + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function kidsPricingRegime(instant: string): KidsPricingRegime {
  return Number(bangkokDate(instant).slice(8, 10)) <= 15 ? 'early' : 'late'
}

export function nextLessonMonth(sourceMonth: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(sourceMonth)
  if (!match) throw new Task10Error('TASK10_INVALID_REQUEST', 'เดือนต้นทางไม่ถูกต้อง', 400)
  const year = Number(match[1])
  const month = Number(match[2])
  return month === 12 ? `${year + 1}-01` : `${match[1]}-${String(month + 1).padStart(2, '0')}`
}

export function familyMakeupQuota(verifiedPurchasedSessions: number): number {
  if (!Number.isSafeInteger(verifiedPurchasedSessions) || verifiedPurchasedSessions < 0) {
    throw new Task10Error('TASK10_INVALID_EVIDENCE', 'หลักฐานสิทธิ์ซื้อไม่ถูกต้อง')
  }
  return Math.min(5, Math.floor(verifiedPurchasedSessions / 4))
}
