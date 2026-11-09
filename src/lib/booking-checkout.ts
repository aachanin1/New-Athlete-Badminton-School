import type { BookingPurchaseTerms } from './booking-purchase'

export interface BookingPackage extends BookingPurchaseTerms {
  id: string
  course: 'adult_group' | 'private'
  quantity: number
  price: number
  validity_months: number
  revision: number
}

export const BOOKING_STAGES = ['เลือกคอร์ส', 'ผู้เรียนและวันเรียน', 'สรุปและชำระเงิน'] as const

/** One bounded request; a timeout is an unknown outcome, never permission to replay. */
export async function checkoutRequest<T>(url: string, init: RequestInit = {}, budgetMs = 12000): Promise<T> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (init.signal?.aborted) controller.abort()
  init.signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => controller.abort(), budgetMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
    const result = await response.json()
    if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'ดำเนินการไม่สำเร็จ กรุณาตรวจสอบผลเดิม')
    return result as T
  } finally { clearTimeout(timer); init.signal?.removeEventListener('abort', abort) }
}

/** Recover a read only; never replay a payment mutation in an automatic loop. */
export async function readCheckoutResult<T>(read: (budgetMs: number) => Promise<T>, signal?: AbortSignal) {
  const end = Date.now() + 20000
  for (let attempt = 0; attempt < 3 && Date.now() < end; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try { return await read(Math.min(6000, end - Date.now())) }
    catch { if (signal?.aborted) throw new DOMException('Aborted', 'AbortError') }
  }
  throw Error('ยังตรวจผลไม่ได้ กรุณาลองอีกครั้งเมื่อเชื่อมต่อได้')
}

export function paymentTimeLeft(deadline: string | null | undefined, now: number) {
  if (!deadline) return null
  const seconds = Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000))
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}
