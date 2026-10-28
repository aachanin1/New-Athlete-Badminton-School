import { getServiceRoleClient } from '@/lib/auth/admin'
import { loadKidsPricingCatalogs } from '@/lib/booking-pricing-policy'

export interface AdminPricingTier {
  id: string
  course_type_id: string
  course_type_name: 'adult_group' | 'private'
  min_sessions: number
  max_sessions: number | null
  price_per_session: number
  package_price: number
  valid_from: string
  valid_to: string | null
}

export interface AdminPricingSnapshot {
  asOfDate: string
  tiers: AdminPricingTier[]
}

export async function readAdminCurrentPricing(actor: string): Promise<AdminPricingSnapshot> {
  const { data, error } = await getServiceRoleClient().rpc('admin_current_pricing_v1', { p_actor: actor })
  if (error || !data) throw new Error(error?.message || 'ADMIN_PRICING_UNAVAILABLE')
  return data as AdminPricingSnapshot
}

/** Both settings entry points must show the same authoritative, fail-closed data. */
export async function loadAdminPricingSettings(actor: string) {
  const [pricing, kids] = await Promise.allSettled([
    readAdminCurrentPricing(actor), loadKidsPricingCatalogs(getServiceRoleClient(), actor),
  ])
  return {
    initialPricing: pricing.status === 'fulfilled' ? pricing.value : null,
    pricingLoadError: pricing.status === 'rejected' ? 'อ่านราคาปัจจุบันไม่สำเร็จ กรุณาโหลดราคาล่าสุดก่อนแก้ไข' : undefined,
    kidsCatalogs: kids.status === 'fulfilled' ? kids.value : null,
    kidsCatalogError: kids.status === 'rejected' ? 'อ่านชุดราคาสองช่วงไม่สำเร็จ กรุณาโหลดข้อมูลใหม่' : undefined,
  }
}
