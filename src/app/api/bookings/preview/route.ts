import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { calculateBookingBasePrice } from '@/lib/booking-pricing'
import { previewProgressiveKidsGroupBooking, ProgressiveBookingPreviewError } from '@/lib/progressive-booking-preview'
import {
  decideProgressiveBookingEntry,
  getProgressiveBookingEntryDependencyState,
} from '@/lib/progressive-pricing-feature'
import { createClient } from '@/lib/supabase/server'
import type { CourseTypeName } from '@/types/database'

interface PreviewPayload {
  bookingId?: string | null
  courseTypeId?: string
  month?: number
  year?: number
  totalSessions?: number
  couponId?: string | null
}

function previewError(error: unknown) {
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
    if (body.bookingId) {
      const { data: booking } = await client
        .from('bookings')
        .select('id, pricing_scope_id, course_type_id')
        .eq('id', body.bookingId)
        .eq('user_id', user.id)
        .maybeSingle() as unknown as { data: { id: string; pricing_scope_id: string | null; course_type_id: string } | null }
      if (!booking) return NextResponse.json({ error: 'ไม่พบการจองที่ต้องการแก้ไข' }, { status: 404 })
      if (booking.course_type_id !== courseType.id) return NextResponse.json({ error: 'ประเภทคอร์สไม่ตรงกับรายการจอง' }, { status: 400 })
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
          error: 'ระบบ Progressive Booking ยังไม่พร้อม กรุณาลองใหม่ภายหลัง',
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

    const totalPrice = await calculateBookingBasePrice({
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
    return NextResponse.json({ mode: 'legacy', totalPrice, grossPrice: totalPrice, discountAmount: 0 })
  } catch (error) {
    return previewError(error)
  }
}
