import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { logActivity } from '@/lib/activity-log'
import { notifyRoles } from '@/lib/notifications'
import type { Coupon, LearnerType } from '@/types/database'

interface BookingSessionPayload {
  date: string
  startTime: string
  endTime: string
  branchId: string
  childId: string | null
}

interface CreateBookingPayload {
  learnerType?: LearnerType
  childId?: string | null
  branchId?: string | null
  courseTypeId?: string
  month?: number
  year?: number
  totalSessions?: number
  totalAmount?: number
  expectedTotalPrice?: number
  sessions?: BookingSessionPayload[]
  coupon?: {
    id?: string
    code?: string
  } | null
}

interface DbError {
  message: string
}

type AdminSupabase = ReturnType<typeof getServiceRoleClient>

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function normalizeCode(code: string | undefined) {
  return (code || '').trim().toUpperCase()
}

function getDateOnlyNow() {
  return new Date().toISOString().split('T')[0]
}

function isSessionStillBookable(session: BookingSessionPayload) {
  const [hour, minute] = session.startTime.split(':').map(Number)
  const slotStart = new Date(`${session.date}T00:00:00`)
  slotStart.setHours(hour, minute, 0, 0)
  return slotStart.getTime() > Date.now()
}

function calculateDiscount(coupon: Coupon, totalAmount: number) {
  if (coupon.discount_type === 'fixed') {
    return Math.min(Number(coupon.discount_value), totalAmount)
  }

  if (coupon.discount_type === 'percent') {
    return Math.round((totalAmount * Number(coupon.discount_value)) / 100)
  }

  return 0
}

async function cleanupBooking(adminSupabase: AdminSupabase, bookingId: string) {
  await (adminSupabase.from('coupon_usages') as any).delete().eq('booking_id', bookingId)
  await (adminSupabase.from('booking_sessions') as any).delete().eq('booking_id', bookingId)
  await (adminSupabase.from('bookings') as any).delete().eq('id', bookingId)
}

async function validateCoupon(
  adminSupabase: AdminSupabase,
  userId: string,
  couponInput: CreateBookingPayload['coupon'],
  totalAmount: number
) {
  if (!couponInput?.id && !couponInput?.code) {
    return { coupon: null, discountAmount: 0, error: null as string | null }
  }

  const code = normalizeCode(couponInput.code)
  let query = (adminSupabase.from('coupons') as any).select('*').eq('is_active', true)

  if (couponInput.id) {
    query = query.eq('id', couponInput.id)
  }

  if (code) {
    query = query.eq('code', code)
  }

  const { data: coupon, error } = await query.single() as { data: Coupon | null; error: DbError | null }

  if (error || !coupon) {
    return { coupon: null, discountAmount: 0, error: 'ไม่พบคูปองนี้ หรือคูปองไม่สามารถใช้งานได้' }
  }

  const today = getDateOnlyNow()
  if (coupon.valid_from && today < coupon.valid_from) {
    return { coupon: null, discountAmount: 0, error: 'คูปองยังไม่เริ่มใช้งาน' }
  }

  if (coupon.valid_to && today > coupon.valid_to) {
    await (adminSupabase.from('coupons') as any).update({ is_active: false }).eq('id', coupon.id)
    return { coupon: null, discountAmount: 0, error: 'คูปองหมดอายุแล้ว' }
  }

  const currentUses = Number(coupon.current_uses || 0)
  if (coupon.max_uses !== null && currentUses >= Number(coupon.max_uses)) {
    await (adminSupabase.from('coupons') as any).update({ is_active: false }).eq('id', coupon.id)
    return { coupon: null, discountAmount: 0, error: 'คูปองถูกใช้งานครบจำนวนแล้ว' }
  }

  if (coupon.min_purchase !== null && totalAmount < Number(coupon.min_purchase)) {
    return {
      coupon: null,
      discountAmount: 0,
      error: `ยอดขั้นต่ำสำหรับคูปองนี้คือ ฿${Number(coupon.min_purchase).toLocaleString('th-TH')}`,
    }
  }

  const { data: existingUsage } = await (adminSupabase
    .from('coupon_usages') as any)
    .select('id')
    .eq('coupon_id', coupon.id)
    .eq('user_id', userId)
    .limit(1)

  if (existingUsage && existingUsage.length > 0) {
    return { coupon: null, discountAmount: 0, error: 'คุณใช้คูปองนี้ไปแล้ว' }
  }

  return { coupon, discountAmount: calculateDiscount(coupon, totalAmount), error: null }
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json() as CreateBookingPayload
    const {
      learnerType,
      childId,
      branchId,
      courseTypeId,
      month,
      year,
      totalSessions,
      totalAmount,
      expectedTotalPrice,
      sessions,
      coupon: couponInput,
    } = body

    if (
      !learnerType ||
      !branchId ||
      !courseTypeId ||
      !month ||
      !year ||
      !totalSessions ||
      !isPositiveNumber(totalAmount) ||
      !isPositiveNumber(expectedTotalPrice) ||
      !sessions ||
      sessions.length === 0
    ) {
      return NextResponse.json({ error: 'ข้อมูลการจองไม่ครบ กรุณาตรวจสอบอีกครั้ง' }, { status: 400 })
    }

    const expiredSession = sessions.find((session) => !isSessionStillBookable(session))
    if (expiredSession) {
      return NextResponse.json({
        error: `รอบ ${expiredSession.startTime}-${expiredSession.endTime} วันที่ ${expiredSession.date} เริ่มไปแล้ว กรุณาเลือกรอบเรียนใหม่`,
      }, { status: 400 })
    }

    const adminSupabase = getServiceRoleClient()

    const childIds = Array.from(new Set([
      childId,
      ...sessions.map((session) => session.childId),
    ].filter(Boolean))) as string[]

    if (childIds.length > 0) {
      const { data: ownedChildren, error: childError } = await (adminSupabase
        .from('children') as any)
        .select('id')
        .eq('parent_id', user.id)
        .in('id', childIds)

      if (childError || !ownedChildren || ownedChildren.length !== childIds.length) {
        return NextResponse.json({ error: 'ไม่สามารถจองให้ผู้เรียนที่ไม่ได้อยู่ในบัญชีนี้ได้' }, { status: 403 })
      }
    }

    const { data: courseType } = await (adminSupabase
      .from('course_types') as any)
      .select('id')
      .eq('id', courseTypeId)
      .single()

    if (!courseType) {
      return NextResponse.json({ error: 'ไม่พบประเภทคอร์สในระบบ' }, { status: 400 })
    }

    const { coupon, discountAmount, error: couponError } = await validateCoupon(
      adminSupabase,
      user.id,
      couponInput,
      totalAmount
    )

    if (couponError) {
      return NextResponse.json({ error: couponError }, { status: 400 })
    }

    const finalPrice = Math.max(0, totalAmount - discountAmount)
    if (Math.abs(finalPrice - expectedTotalPrice) > 1) {
      return NextResponse.json({ error: 'ยอดชำระไม่ตรงกับข้อมูลล่าสุด กรุณาตรวจสอบคูปองและราคาอีกครั้ง' }, { status: 400 })
    }

    const { data: booking, error: bookingError } = await (adminSupabase
      .from('bookings') as any)
      .insert({
        user_id: user.id,
        learner_type: learnerType,
        child_id: childId || null,
        branch_id: branchId,
        course_type_id: courseTypeId,
        month,
        year,
        total_sessions: totalSessions,
        total_price: finalPrice,
        status: 'pending_payment',
      })
      .select('id')
      .single() as { data: { id: string } | null; error: DbError | null }

    if (bookingError || !booking) {
      return NextResponse.json({ error: `สร้างการจองไม่สำเร็จ: ${bookingError?.message || 'ไม่พบข้อมูลการจอง'}` }, { status: 500 })
    }

    const sessionRows = sessions.map((session) => ({
      booking_id: booking.id,
      date: session.date,
      start_time: session.startTime,
      end_time: session.endTime,
      branch_id: session.branchId,
      child_id: session.childId,
      status: 'scheduled',
      is_makeup: false,
    }))

    const { error: sessionError } = await (adminSupabase.from('booking_sessions') as any).insert(sessionRows)
    if (sessionError) {
      await cleanupBooking(adminSupabase, booking.id)
      return NextResponse.json({ error: `สร้างรอบเรียนไม่สำเร็จ: ${sessionError.message}` }, { status: 500 })
    }

    if (coupon) {
      const { error: usageError } = await (adminSupabase.from('coupon_usages') as any).insert({
        coupon_id: coupon.id,
        user_id: user.id,
        booking_id: booking.id,
        discount_amount: discountAmount,
      })

      if (usageError) {
        await cleanupBooking(adminSupabase, booking.id)
        return NextResponse.json({ error: `บันทึกการใช้คูปองไม่สำเร็จ: ${usageError.message}` }, { status: 500 })
      }

      const nextUses = Number(coupon.current_uses || 0) + 1
      const couponUpdate: { current_uses: number; is_active?: boolean } = { current_uses: nextUses }
      if (coupon.max_uses !== null && nextUses >= Number(coupon.max_uses)) {
        couponUpdate.is_active = false
      }

      const { error: couponUpdateError } = await (adminSupabase
        .from('coupons') as any)
        .update(couponUpdate)
        .eq('id', coupon.id)

      if (couponUpdateError) {
        await cleanupBooking(adminSupabase, booking.id)
        return NextResponse.json({ error: `อัปเดตจำนวนคูปองไม่สำเร็จ: ${couponUpdateError.message}` }, { status: 500 })
      }
    }

    await notifyRoles(adminSupabase as any, {
      roles: ['admin', 'super_admin'],
      title: 'มีการจองใหม่',
      message: `${user.email || 'User'} สร้างการจองใหม่ ${totalSessions} ครั้ง · ฿${finalPrice.toLocaleString('th-TH')}`,
      type: 'schedule',
      link_url: '/admin/notifications',
    }).catch(() => null)

    await logActivity({
      userId: user.id,
      action: 'create_booking',
      entityType: 'booking',
      entityId: booking.id,
      details: {
        totalSessions,
        totalPrice: finalPrice,
        couponId: coupon?.id || null,
      },
    })

    return NextResponse.json({ success: true, bookingId: booking.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Create booking error:', error)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${message}` }, { status: 500 })
  }
}
