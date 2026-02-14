import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { code, totalAmount } = await request.json()

    if (!code || !totalAmount) {
      return NextResponse.json({ error: 'กรุณากรอกรหัสคูปอง' }, { status: 400 })
    }

    // Find coupon by code
    const { data: coupon, error: couponErr } = await (supabase
      .from('coupons') as any)
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .eq('is_active', true)
      .single()

    if (couponErr || !coupon) {
      return NextResponse.json({ error: 'ไม่พบคูปองนี้ หรือคูปองไม่สามารถใช้งานได้' }, { status: 404 })
    }

    // Check validity dates
    const now = new Date().toISOString().split('T')[0]
    if (coupon.valid_from && now < coupon.valid_from) {
      return NextResponse.json({ error: 'คูปองยังไม่เริ่มใช้งาน' }, { status: 400 })
    }
    if (coupon.valid_to && now > coupon.valid_to) {
      return NextResponse.json({ error: 'คูปองหมดอายุแล้ว' }, { status: 400 })
    }

    // Check max uses
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return NextResponse.json({ error: 'คูปองถูกใช้งานครบจำนวนแล้ว' }, { status: 400 })
    }

    // Check min purchase
    if (coupon.min_purchase && totalAmount < coupon.min_purchase) {
      return NextResponse.json({
        error: `ยอดขั้นต่ำสำหรับคูปองนี้คือ ฿${Number(coupon.min_purchase).toLocaleString()}`
      }, { status: 400 })
    }

    // Check if user already used this coupon (optional: limit per user)
    const { data: existingUsage } = await (supabase
      .from('coupon_usages') as any)
      .select('id')
      .eq('coupon_id', coupon.id)
      .eq('user_id', user.id)

    if (existingUsage && existingUsage.length > 0) {
      return NextResponse.json({ error: 'คุณใช้คูปองนี้ไปแล้ว' }, { status: 400 })
    }

    // Calculate discount
    let discountAmount = 0
    if (coupon.discount_type === 'fixed') {
      discountAmount = Math.min(Number(coupon.discount_value), totalAmount)
    } else if (coupon.discount_type === 'percent') {
      discountAmount = Math.round(totalAmount * Number(coupon.discount_value) / 100)
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
      finalAmount: totalAmount - discountAmount,
    })
  } catch (err: any) {
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${err.message}` }, { status: 500 })
  }
}
