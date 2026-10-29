import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { quoteBookingCoupon } from '@/lib/booking-coupon-server'
import { checkoutError } from '@/lib/booking-checkout-server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { code, totalAmount, courseTypeId } = await request.json() as { code?: string; totalAmount?: number; courseTypeId?: string }
    if (typeof code !== 'string' || !code.trim() || !Number.isFinite(totalAmount) || Number(totalAmount) <= 0 || !courseTypeId) {
      return NextResponse.json({ error: 'กรุณาระบุคอร์สและรหัสคูปองให้ครบ' }, { status: 400 })
    }
    const { data: coupon, error } = await getServiceRoleClient().from('coupons').select('id').eq('code', code.trim().toUpperCase()).maybeSingle()
    if (error) throw error
    if (!coupon) return NextResponse.json({ error: 'ไม่พบคูปองนี้' }, { status: 400 })
    const quote = await quoteBookingCoupon(user.id, coupon.id, courseTypeId, Number(totalAmount))
    return NextResponse.json({ coupon: { id: quote.id, code: quote.code, discount_type: quote.discount_type, discount_value: quote.discount_value }, discountAmount: quote.discountAmount, finalAmount: quote.totalPrice }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return NextResponse.json({ error: checkoutError(error) }, { status: 400 })
  }
}
