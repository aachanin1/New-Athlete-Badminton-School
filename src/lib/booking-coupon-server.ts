import 'server-only'
import { checkoutRpc } from '@/lib/booking-checkout-server'

export interface BookingCouponQuote {
  id: string; code: string; discount_type: 'fixed' | 'percent'; discount_value: number
  grossPrice: number; discountAmount: number; totalPrice: number
}

export const quoteBookingCoupon = (actor: string, coupon: string, course: string, gross: number, booking?: string | null) =>
  checkoutRpc<BookingCouponQuote>('booking_ux_coupon_quote_v2', { p_actor: actor, p_coupon: coupon, p_course: course, p_gross: gross, p_booking: booking || null })
