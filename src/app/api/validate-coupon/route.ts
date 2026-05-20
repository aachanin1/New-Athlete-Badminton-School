import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Coupon } from '@/types/database'

interface ValidateCouponPayload {
  code?: string
  totalAmount?: number
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { code, totalAmount } = await request.json() as ValidateCouponPayload

    if (!code?.trim() || !Number.isFinite(totalAmount) || Number(totalAmount) <= 0) {
      return NextResponse.json({ error: 'กรุณากรอกรหัสคูปอง' }, { status: 400 })
    }

    const normalizedCode = code.toUpperCase().trim()
    const { data: coupon, error: couponErr } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', normalizedCode)
      .eq('is_active', true)
      .single() as unknown as { data: Coupon | null; error: { message: string } | null }

    if (couponErr || !coupon) {
      return NextResponse.json({ error: 'ไม่พบคูปองนี้ หรือคูปองไม่สามารถใช้งานได้' }, { status: 404 })
    }

    const today = new Date().toISOString().split('T')[0]
    if (coupon.valid_from && today < coupon.valid_from) {
      return NextResponse.json({ error: 'คูปองยังไม่เริ่มใช้งาน' }, { status: 400 })
    }

    if (coupon.valid_to && today > coupon.valid_to) {
      return NextResponse.json({ error: 'คูปองหมดอายุแล้ว' }, { status: 400 })
    }

    const { count: usageCount } = await supabase
      .from('coupon_usages')
      .select('*', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id)

    if (coupon.max_uses !== null && (usageCount || 0) >= Number(coupon.max_uses)) {
      return NextResponse.json({ error: 'คูปองถูกใช้งานครบจำนวนแล้ว' }, { status: 400 })
    }

    if (coupon.min_purchase !== null && Number(totalAmount) < Number(coupon.min_purchase)) {
      return NextResponse.json({
        error: `ยอดขั้นต่ำสำหรับคูปองนี้คือ ฿${Number(coupon.min_purchase).toLocaleString('th-TH')}`,
      }, { status: 400 })
    }

    const { data: existingUsage } = await supabase
      .from('coupon_usages')
      .select('id')
      .eq('coupon_id', coupon.id)
      .eq('user_id', user.id)

    if (existingUsage && existingUsage.length > 0) {
      return NextResponse.json({ error: 'คุณใช้คูปองนี้ไปแล้ว' }, { status: 400 })
    }

    let discountAmount = 0
    if (coupon.discount_type === 'fixed') {
      discountAmount = Math.min(Number(coupon.discount_value), Number(totalAmount))
    } else if (coupon.discount_type === 'percent') {
      discountAmount = Math.round(Number(totalAmount) * Number(coupon.discount_value) / 100)
    }

    return NextResponse.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: Number(coupon.discount_value),
      },
      discountAmount,
      finalAmount: Number(totalAmount) - discountAmount,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${message}` }, { status: 500 })
  }
}
