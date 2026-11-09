import type { AdminPricingTier } from './admin-pricing-settings'
import type { BookingPackage } from './booking-checkout'

/** Resolve each actual purchase option using the existing server threshold rule. */
export function adminPurchaseOptions(tiers: AdminPricingTier[], packages: BookingPackage[]) {
  return packages.map(pack => {
    const eligible = tiers.filter(t => t.course_type_name === pack.course && t.min_sessions <= pack.quantity)
    const threshold = Math.max(...eligible.map(t => t.min_sessions))
    const matches = eligible.filter(t => t.min_sessions === threshold)
    if (matches.length !== 1) throw Error('อ่านราคาของรูปแบบการซื้อไม่ครบ กรุณาโหลดราคาล่าสุด')
    return { pack, tier: matches[0] }
  })
}

export function adminOptionTotal(tier: AdminPricingTier, quantity: number): number {
  // Keep the existing saved package-price rule; this presentation does not reprice data.
  return tier.min_sessions === 1
    ? Math.round((quantity * tier.price_per_session + Number.EPSILON) * 100) / 100
    : Math.round(tier.min_sessions * tier.price_per_session)
}
