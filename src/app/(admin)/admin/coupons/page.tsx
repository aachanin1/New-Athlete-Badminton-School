import { createClient } from '@/lib/supabase/server'
import { CouponsClient } from '@/components/admin/coupons-client'

export default async function CouponsPage() {
  const supabase = createClient()

  // Fetch all coupons with creator name
  const { data: coupons } = await (supabase
    .from('coupons')
    .select('id, code, discount_type, discount_value, min_purchase, max_uses, current_uses, valid_from, valid_to, is_active, created_at, created_by, profiles!coupons_created_by_fkey(full_name)')
    .order('created_at', { ascending: false }) as any)

  const couponList = (coupons || []).map((c: any) => ({
    id: c.id,
    code: c.code,
    discount_type: c.discount_type,
    discount_value: c.discount_value,
    min_purchase: c.min_purchase,
    max_uses: c.max_uses,
    current_uses: c.current_uses,
    valid_from: c.valid_from,
    valid_to: c.valid_to,
    is_active: c.is_active,
    created_at: c.created_at,
    created_by_name: c.profiles?.full_name || 'ไม่ทราบ',
    usage_count: c.current_uses,
  }))

  return <CouponsClient coupons={couponList} />
}
