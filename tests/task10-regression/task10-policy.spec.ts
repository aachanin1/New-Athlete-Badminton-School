import { expect, test } from '@playwright/test'
import { bangkokDate, callTask10, familyMakeupQuota, kidsPricingRegime, nextLessonMonth, task10RpcError } from '../../src/lib/task10-policy'
import { parseKidsMakeupMinimum } from '../../src/lib/kids-makeup-settings'
import { INITIAL_LATE_KIDS_TIERS, validateKidsTierSet } from '../../src/lib/booking-pricing-policy'
import { calculateProgressiveBookingPrice } from '../../src/lib/progressive-booking-pricing'
import { bookingSessionLifecycle, type BookingPaymentLifecycle } from '../../src/lib/booking-payment-lifecycle'
import { formatThaiDateWithWeekday, formatThaiDateTimeWithWeekday, formatThaiMonthYear } from '../../src/lib/date-format'

test('History lifecycle labels and active counts share cancellation and deadline evidence', () => {
  const session = { status: 'scheduled', display_status: 'upcoming', cancelled_at: null as string | null }
  const lifecycle: BookingPaymentLifecycle = { bookingId: 'fixture', status: 'pending_payment', inCohort: true, deadline: '2031-08-01T00:00:00Z', acceptedReceipt: false, due: false, cancelledAt: null, cancellationReason: null, originalExpiresAt: null }
  expect(bookingSessionLifecycle(session, { status: 'pending_payment', lifecycle })).toEqual({ status: 'upcoming', active: true, label: null })
  expect(bookingSessionLifecycle(session, { status: 'pending_payment', lifecycle: { ...lifecycle, due: true } })).toEqual({ status: 'payment_due', active: false, label: 'หมดกำหนดรับสลิป — รอยกเลิก' })
  for (const status of ['scheduled', 'cancelled', 'completed']) {
    expect(bookingSessionLifecycle({ ...session, status, cancelled_at: '2031-08-01T00:00:00Z' }, { status: 'verified' })).toMatchObject({ status: 'cancelled', active: false, label: 'ยกเลิกแล้ว' })
  }
  expect(bookingSessionLifecycle(session, { status: 'cancelled', lifecycle: { ...lifecycle, due: true } })).toMatchObject({ status: 'cancelled', active: false })
  for (const status of ['paid', 'verified']) expect(bookingSessionLifecycle(session, { status, lifecycle: { ...lifecycle, status, acceptedReceipt: true } })).toMatchObject({ active: true, label: null })
  expect(bookingSessionLifecycle({ status: 'walleted' }, { status: 'verified' }).active).toBe(false)
})

test('Corrective Thai presentation uses the shared Bangkok date standard', () => {
  expect(formatThaiDateWithWeekday('2026-06-29')).toBe('จันทร์ 29 มิ.ย. 69')
  expect(formatThaiDateTimeWithWeekday('2026-06-29T07:33:00Z')).toBe('จันทร์ 29 มิ.ย. 69 14:33')
  expect(formatThaiMonthYear('2026-10-01')).toBe('ตุลาคม 2569')
})

test('Owner quota boundary examples', () => {
  for (const [n, expected] of [[0,0],[3,0],[4,1],[7,1],[8,2],[11,2],[12,3],[15,3],[16,4],[19,4],[20,5],[24,5]]) expect(familyMakeupQuota(n)).toBe(expected)
  for (const n of [-1,0.5,NaN,Infinity]) expect(() => familyMakeupQuota(n)).toThrow()
})

test('Bangkok midnight, UTC and December boundaries', () => {
  expect(kidsPricingRegime('2026-09-15T16:59:59.999Z')).toBe('early')
  expect(kidsPricingRegime('2026-09-15T17:00:00.000Z')).toBe('late')
  expect(bangkokDate('2026-12-31T17:00:00Z')).toBe('2027-01-01')
  expect(nextLessonMonth('2026-12')).toBe('2027-01')
  expect(nextLessonMonth('2026-09')).toBe('2026-10')
  expect(() => bangkokDate('2026-09-16T00:00:00')).toThrow()
})

test('Minimum validation rejects blanks, fractions and coercion', () => {
  for (const input of ['', ' ', '0', '-1', '1.5', null, {}, true, '1e2', NaN, Infinity]) expect(parseKidsMakeupMinimum(input)).toBeNull()
  for (const input of [1,'2',3,'1000']) expect(parseKidsMakeupMinimum(input)).toBe(Number(input))
})

test('Owner late-regime examples and separate lesson-month baselines', () => {
  const price = (previous: number, quantity: number) => {
    const result = calculateProgressiveBookingPrice({ previousActiveSessions:previous, newBookingEntitlementSessions:quantity, pricingTiers:validateKidsTierSet(INITIAL_LATE_KIDS_TIERS) })
    if (!result.ok) throw new Error(result.error.message)
    return result.value.grossBookingPrice
  }
  expect(price(0,4)).toBe(2000)
  expect(price(0,10)).toBe(3500)
  expect(price(0,6)).toBe(2598)
  expect(price(0,4)+price(4,6)).toBe(4100)
})

test('Whole catalogs reject gaps, overlaps and incomplete coverage', () => {
  expect(validateKidsTierSet(INITIAL_LATE_KIDS_TIERS)).toHaveLength(6)
  expect(() => validateKidsTierSet(INITIAL_LATE_KIDS_TIERS.slice(1))).toThrow()
  expect(() => validateKidsTierSet([...INITIAL_LATE_KIDS_TIERS, INITIAL_LATE_KIDS_TIERS[0]])).toThrow()
  expect(() => validateKidsTierSet([{id:null,minSessions:1,maxSessions:2,ratePerSession:1}])).toThrow()
})

test('Payment and entitlement conflicts show Thai instructions without leaking SQL details', async () => {
  expect(task10RpcError('TASK10_BOOKING_DEADLINE')).toMatchObject({code:'TASK10_BOOKING_DEADLINE',status:409,message:expect.stringContaining('หมดเวลารับสลิป')})
  expect(task10RpcError('TASK10_SOURCE_CONFLICT').message).toContain('สิทธิ์ต้นทาง')
  expect(task10RpcError('TASK10_UNAUTHORIZED').status).toBe(403)
  const failed={rpc:async()=>({data:null,error:{message:'TASK10_BOOKING_DEADLINE: private SQL diagnostic',details:'private row data'}})}
  await expect(callTask10(failed,'example')).rejects.toMatchObject({message:task10RpcError('TASK10_BOOKING_DEADLINE').message})
})
