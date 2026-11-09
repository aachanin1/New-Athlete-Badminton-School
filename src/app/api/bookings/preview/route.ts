import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { calculateBookingBasePricePreview } from '@/lib/booking-pricing'
import { previewProgressiveKidsGroupBooking, ProgressiveBookingPreviewError } from '@/lib/progressive-booking-preview'
import {
  decideProgressiveBookingEntry,
  getProgressiveBookingEntryDependencyState,
} from '@/lib/progressive-pricing-feature'
import { createClient } from '@/lib/supabase/server'
import type { CourseTypeName } from '@/types/database'
import { Task10Error } from '@/lib/task10-policy'
import { quoteBookingCoupon } from '@/lib/booking-coupon-server'
import { CheckoutRpcError, checkoutError, checkoutRpc } from '@/lib/booking-checkout-server'
import type { SelectedPricingTierEvidence } from '@/lib/pricing'

interface PreviewPayload {
  bookingId?: string | null
  courseTypeId?: string
  month?: number
  year?: number
  totalSessions?: number
  couponId?: string | null
  packageId?: string
  packageRevision?: number
}

function previewError(error: unknown) {
  if (error instanceof CheckoutRpcError) return NextResponse.json({ error: checkoutError(error), code: error.message }, { status: 400 })
  if (error instanceof Task10Error) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  if (error instanceof ProgressiveBookingPreviewError) {
    const status = error.code === 'PROGRESSIVE_SCOPE_LOCKED'
      || error.code === 'PROGRESSIVE_LEGACY_SCOPE_NOT_READY'
      || error.code === 'PROGRESSIVE_LEGACY_BASELINE_DRIFT'
      || error.code === 'PROGRESSIVE_BOOKING_CONFLICT'
      ? 409
      : error.code === 'PROGRESSIVE_RPC_UNAVAILABLE' ? 503 : 400
    return NextResponse.json({ error: error.message, code: error.code }, { status })
  }
  const message = error instanceof Error ? error.message : 'Unknown preview error'
  return NextResponse.json({ error: `คำนวณราคาไม่สำเร็จ: ${message}` }, { status: 500 })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json() as PreviewPayload
    if (!body.courseTypeId || !Number.isInteger(body.month) || !Number.isInteger(body.year)
      || !Number.isInteger(body.totalSessions) || Number(body.totalSessions) <= 0) {
      return NextResponse.json({ error: 'ข้อมูลคำนวณราคาไม่ครบ' }, { status: 400 })
    }

    const client = getServiceRoleClient()
    const { data: courseType } = await client
      .from('course_types')
      .select('id, name')
      .eq('id', body.courseTypeId)
      .single() as unknown as { data: { id: string; name: CourseTypeName } | null }
    if (!courseType) return NextResponse.json({ error: 'ไม่พบประเภทคอร์สในระบบ' }, { status: 400 })

    const decision = decideProgressiveBookingEntry(courseType.name)
    let usePurchaseQuote = !body.bookingId && Boolean(body.packageId)
    if (body.bookingId) {
      const { data: booking } = await client
        .from('bookings')
        .select('id, pricing_scope_id, course_type_id, package_snapshot')
        .eq('id', body.bookingId)
        .eq('user_id', user.id)
        .maybeSingle() as unknown as { data: { id: string; pricing_scope_id: string | null; course_type_id: string; package_snapshot?: { policyVersion?: number } | null } | null }
      if (!booking) return NextResponse.json({ error: 'ไม่พบการจองที่ต้องการแก้ไข' }, { status: 404 })
      if (booking.course_type_id !== courseType.id) return NextResponse.json({ error: 'ประเภทคอร์สไม่ตรงกับรายการจอง' }, { status: 400 })
      usePurchaseQuote = booking.package_snapshot?.policyVersion === 2
      if (booking.pricing_scope_id) {
        const result = await previewProgressiveKidsGroupBooking({
          userId: user.id,
          courseTypeId: courseType.id,
          month: Number(body.month),
          year: Number(body.year),
          entitlementSessions: Number(body.totalSessions),
          bookingId: booking.id,
        })
        return NextResponse.json(result)
      }
    } else if (decision.mode === 'progressive') {
      const dependency = getProgressiveBookingEntryDependencyState()
      if (!dependency.ready) {
        return NextResponse.json({
          error: 'ระบบคำนวณราคายังไม่พร้อม กรุณาลองใหม่ภายหลัง',
          code: 'PROGRESSIVE_BOOKING_DEPENDENCY_UNAVAILABLE',
        }, { status: 503 })
      }
      const result = await previewProgressiveKidsGroupBooking({
        userId: user.id,
        courseTypeId: courseType.id,
        month: Number(body.month),
        year: Number(body.year),
        entitlementSessions: Number(body.totalSessions),
        couponId: body.couponId || null,
      })
      return NextResponse.json(result)
    }

    const purchaseQuote = courseType.name !== 'kids_group' && usePurchaseQuote
      ? await checkoutRpc<{ grossPrice: number; selectedTier: SelectedPricingTierEvidence; existingSessions: number; existingPaid: number; totalSessionsAfter: number }>('booking_bill_package_quote_v2', {
        p_actor: user.id, p_course: courseType.id, p_quantity: body.totalSessions,
        p_package_id: body.packageId || null, p_package_revision: body.packageRevision ?? null, p_booking: body.bookingId || null,
      }) : null
    const price = purchaseQuote ? { ...purchaseQuote, totalPrice: Number(purchaseQuote.grossPrice) } : await calculateBookingBasePricePreview({
      supabase: client,
      userId: user.id,
      courseTypeId: courseType.id,
      courseTypeName: courseType.name,
      month: Number(body.month),
      year: Number(body.year),
      newSessions: Number(body.totalSessions),
      existingStatuses: ['paid', 'verified'],
      excludeBookingId: body.bookingId || undefined,
    })
    let couponId = body.couponId
    if (body.bookingId && !couponId) {
      const hold = await client.from('progressive_coupon_reservations').select('coupon_id').eq('booking_id', body.bookingId).eq('user_id', user.id).eq('status', 'reserved').maybeSingle()
      if (hold.error) throw hold.error
      couponId = hold.data?.coupon_id
    }
    const coupon = couponId ? await quoteBookingCoupon(user.id, couponId, courseType.id, price.totalPrice, body.bookingId) : null
    let historicalDiscount = 0
    if (body.bookingId && !coupon) {
      const [usage, saved] = await Promise.all([
        client.from('coupon_usages').select('discount_amount').eq('booking_id', body.bookingId).eq('user_id', user.id),
        client.from('bookings').select('total_price').eq('id', body.bookingId).eq('user_id', user.id).single(),
      ])
      if (usage.error || saved.error) throw usage.error || saved.error
      historicalDiscount = (usage.data || []).reduce((sum, row) => sum + Number(row.discount_amount), 0)
      if (historicalDiscount && price.totalPrice !== Number(saved.data.total_price) + historicalDiscount) {
        return NextResponse.json({ error: checkoutError(new Error('BOOKING_UX_LEGACY_COUPON_REVIEW_REQUIRED')) }, { status: 409 })
      }
    }
    return NextResponse.json({
      mode: 'legacy',
      policy: 'policy' in price ? price.policy : undefined,
      totalPrice: coupon?.totalPrice ?? price.totalPrice - historicalDiscount,
      grossPrice: price.totalPrice,
      discountAmount: coupon?.discountAmount ?? historicalDiscount,
      selectedTier: price.selectedTier,
      existingSessions: price.existingSessions,
      existingPaid: price.existingPaid,
      totalSessionsAfter: price.totalSessionsAfter,
    })
  } catch (error) {
    return previewError(error)
  }
}
