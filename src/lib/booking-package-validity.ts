import { isPerSessionPurchase, type BookingPurchaseTerms } from './booking-purchase'

/** Package terms are captured on the bill; catalog terms only apply before creation. */
export type PackageValidityTerms = BookingPurchaseTerms

export const PACKAGE_DURATION_RULE = 'เดือนยืนยันชำระเป็นเดือนที่ 1 และหมดอายุสิ้นเดือนตามอายุแพ็กเกจ'
export const PACKAGE_DATE_ERROR = 'วันเรียนเกินอายุแพ็กเกจ กรุณาเลือกวันใหม่ภายในวันหมดอายุที่แสดง'
const thaiDate = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' })

export function bangkokMonthKey(reference: string | number): string {
  return new Date(new Date(reference).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 7)
}

export function packageExpiryAt(terms: PackageValidityTerms | null | undefined, reference: string | number): string | null {
  if (!terms) return null
  if (isPerSessionPurchase(terms)) {
    if (!terms.lessonMonth) return null
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(terms.lessonMonth)) throw Error('BOOKING_UX_DURATION_INVALID')
    const [year, month] = terms.lessonMonth.split('-').map(Number)
    return new Date(Date.UTC(year, month, 1) - 7 * 3600000 - 1).toISOString()
  }
  if (!Number.isInteger(terms.validity_months) || terms.validity_months < 1 || terms.validity_months > 120) throw Error('BOOKING_UX_DURATION_INVALID')
  const [year, month] = bangkokMonthKey(reference).split('-').map(Number)
  // Midnight of the following month in Bangkok, minus one millisecond.
  return new Date(Date.UTC(year, month - 1 + terms.validity_months, 1) - 7 * 3600000 - 1).toISOString()
}

export function packageRoundWithinExpiry(expiresAt: string | null | undefined, date: string, end: string): boolean {
  return !expiresAt || Date.parse(`${date}T${end.slice(0, 5)}:00+07:00`) <= Date.parse(expiresAt)
}

export function packageValidityDescription(terms: PackageValidityTerms, reference: string | number, confirmedExpiry?: string | null): string {
  if (isPerSessionPurchase(terms)) return 'รายครั้ง · ใช้ได้ภายในเดือนเรียนที่เลือก เก็บข้ามเดือนไม่ได้'
  const expiry = confirmedExpiry || packageExpiryAt(terms, reference)!
  return `อายุ ${terms.validity_months} เดือน · ${confirmedExpiry ? 'ใช้ได้ถึง' : 'หากยืนยันชำระเดือนนี้ ใช้ได้ถึง'} ${thaiDate.format(new Date(expiry))}`
}
