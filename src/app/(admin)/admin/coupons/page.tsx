import { createClient } from '@/lib/supabase/server'
import { CouponsClient } from '@/components/admin/coupons-client'

interface CouponRow {
  id: string
  code: string
  discount_type: 'fixed' | 'percent'
  discount_value: number
  min_purchase: number | null
  max_uses: number | null
  current_uses: number
  valid_from: string
  valid_to: string | null
  is_active: boolean
  created_at: string
  created_by: string
  profiles?: { full_name: string | null } | null
}

interface CouponUsageRow {
  id: string
  coupon_id: string
  user_id: string
  booking_id: string
  discount_amount: number
  used_at: string
  profiles?: { full_name: string | null; email: string | null } | null
  bookings?: { total_price: number | null; month: number | null; year: number | null } | null
}

interface CouponUpdateQuery {
  update: (values: { is_active: boolean }) => {
    in: (column: string, values: string[]) => Promise<unknown>
  }
}

export default async function CouponsPage() {
  const supabase = createClient()

  const { data: coupons } = await supabase
    .from('coupons')
    .select('id, code, discount_type, discount_value, min_purchase, max_uses, current_uses, valid_from, valid_to, is_active, created_at, created_by, profiles!coupons_created_by_fkey(full_name)')
    .order('created_at', { ascending: false }) as unknown as { data: CouponRow[] | null }

  const couponIds = (coupons || []).map((coupon) => coupon.id)
  let usages: CouponUsageRow[] = []

  if (couponIds.length > 0) {
    const { data } = await supabase
      .from('coupon_usages')
      .select(`
        id, coupon_id, user_id, booking_id, discount_amount, used_at,
        profiles(full_name, email),
        bookings(total_price, month, year)
      `)
      .in('coupon_id', couponIds)
      .order('used_at', { ascending: false }) as unknown as { data: CouponUsageRow[] | null }
    usages = data || []
  }

  const usageMap = usages.reduce<Record<string, CouponUsageRow[]>>((map, usage) => {
    if (!map[usage.coupon_id]) map[usage.coupon_id] = []
    map[usage.coupon_id].push(usage)
    return map
  }, {})

  const today = new Date().toISOString().split('T')[0]
  const autoCloseIds = (coupons || [])
    .filter((coupon) => {
      if (!coupon.is_active) return false
      const usageCount = usageMap[coupon.id]?.length || 0
      const expired = Boolean(coupon.valid_to && coupon.valid_to < today)
      const maxed = coupon.max_uses !== null && usageCount >= coupon.max_uses
      return expired || maxed
    })
    .map((coupon) => coupon.id)

  if (autoCloseIds.length > 0) {
    await (supabase.from('coupons') as unknown as CouponUpdateQuery)
      .update({ is_active: false })
      .in('id', autoCloseIds)
  }

  const couponList = (coupons || []).map((coupon) => {
    const couponUsages = usageMap[coupon.id] || []
    const autoClosed = autoCloseIds.includes(coupon.id)
    return {
      id: coupon.id,
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: Number(coupon.discount_value || 0),
      min_purchase: coupon.min_purchase === null ? null : Number(coupon.min_purchase),
      max_uses: coupon.max_uses,
      current_uses: couponUsages.length,
      valid_from: coupon.valid_from,
      valid_to: coupon.valid_to,
      is_active: autoClosed ? false : coupon.is_active,
      created_at: coupon.created_at,
      created_by_name: coupon.profiles?.full_name || 'ไม่ทราบชื่อ',
      usage_count: couponUsages.length,
      total_discount: couponUsages.reduce((sum, usage) => sum + Number(usage.discount_amount || 0), 0),
      usages: couponUsages.slice(0, 12).map((usage) => ({
        id: usage.id,
        user_name: usage.profiles?.full_name || usage.profiles?.email || 'ไม่ทราบชื่อ',
        booking_id: usage.booking_id,
        discount_amount: Number(usage.discount_amount || 0),
        booking_total: usage.bookings?.total_price === null || usage.bookings?.total_price === undefined ? null : Number(usage.bookings.total_price),
        booking_month: usage.bookings?.month || null,
        booking_year: usage.bookings?.year || null,
        used_at: usage.used_at,
      })),
    }
  })

  return <CouponsClient coupons={couponList} />
}
