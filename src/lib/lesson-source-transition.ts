import type { Json } from '@/types/database'

export type LessonSourceOperation = 'reschedule' | 'store' | 'redeem' | 'makeup' | 'return_entitlement'

interface TransitionClient {
  rpc(name: 'lesson_source_transition_v1', args: {
    p_actor_id: string; p_operation: string; p_id: string; p_payload: Json
  }): PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>
}

const walletMessages: Record<string, string> = {
    LESSON_WALLET_COURSE_INVALID: 'ข้อมูลคอร์สของสิทธิ์ไม่ถูกต้อง',
  LESSON_WALLET_CREDIT_STALE: 'สิทธิ์นี้ถูกใช้ไปแล้วหรือไม่พร้อมใช้งาน กรุณารีเฟรชหน้า',
  LESSON_WALLET_UNIT_STALE: 'รอบเรียนนี้ถูกเก็บเข้ากระเป๋าแล้ว กรุณารีเฟรชหน้า',
  LESSON_WALLET_TARGET_CONFLICT: 'ผู้เรียนอย่างน้อยหนึ่งคนมีรอบเรียนที่ซ้ำหรือซ้อนกับเวลานี้แล้ว',
  LESSON_WALLET_SAME_MONTH_REQUIRED: 'สิทธิ์นี้ใช้ได้เฉพาะเดือนเดียวกับรอบเดิม',
  LESSON_WALLET_ENTITLEMENT_EXPIRED: 'สิทธิ์นี้หมดอายุแล้วและไม่สามารถนำกลับมาใช้ใหม่ได้',
  LESSON_WALLET_TARGET_AFTER_EXPIRY: 'รอบที่เลือกอยู่หลังวันหมดอายุของสิทธิ์',
  LESSON_WALLET_TEMPLATE_NOT_FOUND: 'ไม่พบรอบเรียนประจำที่เปิดใช้งานตรงกับสาขา คอร์ส วัน และเวลาที่เลือก',
  LESSON_WALLET_TEMPLATE_AMBIGUOUS: 'พบรอบเรียนประจำที่เปิดใช้งานซ้ำกัน กรุณาให้ผู้ดูแลตรวจสอบ',
  LESSON_WALLET_TARGET_UNAVAILABLE: 'รอบเรียนนี้ถูกยกเลิกหรือไม่พร้อมใช้งานแล้ว',
  LESSON_WALLET_PAYMENT_EVIDENCE_MISSING: 'ไม่พบหลักฐาน Payment ที่อนุมัติครบถ้วน จึงยังเก็บสิทธิ์ไม่ได้',
  LESSON_WALLET_PAYMENT_EVIDENCE_AMBIGUOUS: 'พบหลักฐาน Payment มากกว่าหนึ่งรายการ จึงยังเก็บสิทธิ์ไม่ได้',
  LESSON_WALLET_TIER_EVIDENCE_MISSING: 'ไม่พบ pricing tier ที่ตรงกับแพ็กเกจ ณ วันที่อนุมัติ Payment',
  LESSON_WALLET_TIER_EVIDENCE_AMBIGUOUS: 'พบ pricing tier ที่มีผลทับซ้อนกัน จึงยังเก็บสิทธิ์ไม่ได้',
  LESSON_WALLET_UNIT_NOT_STORABLE: 'ผู้เรียนอย่างน้อยหนึ่งคนในรอบนี้ไม่ผ่านเงื่อนไขเก็บก่อน 48 ชั่วโมง',
  LESSON_WALLET_ATTENDANCE_EXISTS: 'รอบนี้มีการเช็คชื่อแล้ว ไม่สามารถเก็บเข้ากระเป๋าได้',
}

export class LessonSourceTransitionError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(walletMessages[code] || (code === 'LESSON_SOURCE_RETRY'
      ? 'มีรายการอื่นกำลังใช้สิทธิ์นี้ กรุณาลองคำขอเดิมอีกครั้ง'
      : 'ต้นทางนี้ไม่พร้อมใช้หรือถูกใช้ไปแล้ว กรุณาโหลดข้อมูลใหม่'))
  }
}

/** The database owns eligibility, locking, replay and every committed effect. */
export async function transitionLessonSource<T>(client: TransitionClient, actorId: string,
  operation: LessonSourceOperation, id: string, payload: Json = {}): Promise<T> {
  const { data, error } = await client.rpc('lesson_source_transition_v1', {
    p_actor_id: actorId, p_operation: operation, p_id: id, p_payload: payload,
  })
  if (error) {
    const code = ['40P01', '40001', '55P03', '57014'].includes(error.code || '')
      ? 'LESSON_SOURCE_RETRY'
      : /(?:LESSON_SOURCE|LESSON_WALLET|TASK10)_[A-Z_]+/.exec(error.message)?.[0] || 'LESSON_SOURCE_FAILED'
    const status = code.startsWith('LESSON_WALLET_')
      ? code.endsWith('_NOT_FOUND') ? 404 : /(STALE|CONFLICT|AMBIGUOUS|UNAVAILABLE)/.test(code) ? 409 : /(EVIDENCE|INVALID)/.test(code) ? 422 : 400
      : /UNAUTHORIZED|FORBIDDEN/.test(code) ? 403
      : code.endsWith('_NOT_FOUND') ? 404
        : /INVALID_REQUEST/.test(code) ? 400 : code === 'LESSON_SOURCE_FAILED' ? 500 : 409
    throw new LessonSourceTransitionError(code, status)
  }
  if (!data) throw new LessonSourceTransitionError('LESSON_SOURCE_FAILED', 500)
  return data as T
}
