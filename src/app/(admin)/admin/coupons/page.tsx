import { createClient } from '@/lib/supabase/server'
import { CouponsClient } from '@/components/admin/coupons-client'

export default async function CouponsPage() {
  const supabase = createClient()

  const { data: coupons } = await (supabase
    .from('coupons')
    .select('id, code, discount_type, discount_value, min_purchase, max_uses, current_uses, valid_from, valid_to, is_active, created_at, created_by, profiles!coupons_created_by_fkey(full_name)')
    .order('created_at', { ascending: false }) as any)

  const couponIds = (coupons || []).map((coupon: any) => coupon.id)
  let usageCountMap: Record<string, number> = {}

  if (couponIds.length > 0) {
    const { data: couponUsages } = await (supabase
      .from('coupon_usages')
      .select('coupon_id')
      .in('coupon_id', couponIds) as any)

    usageCountMap = (couponUsages || []).reduce((map: Record<string, number>, usage: any) => {
      map[usage.coupon_id] = (map[usage.coupon_id] || 0) + 1
      return map
    }, {})
  }

  const couponList = (coupons || []).map((c: any) => ({
    id: c.id,
    code: c.code,
    discount_type: c.discount_type,
    discount_value: c.discount_value,
    min_purchase: c.min_purchase,
    max_uses: c.max_uses,
    current_uses: usageCountMap[c.id] || 0,
    valid_from: c.valid_from,
    valid_to: c.valid_to,
    is_active: c.is_active,
    created_at: c.created_at,
    created_by_name: c.profiles?.full_name || 'ไม่ทราบ',
    usage_count: usageCountMap[c.id] || 0,
  }))

  return <CouponsClient coupons={couponList} />
}
