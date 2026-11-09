import 'server-only'
import { getServiceRoleClient } from '@/lib/auth/admin'
import type { BookingPackage } from './booking-checkout'
import type { KidsRateTier } from './booking-pricing-policy'

export async function readPublicBookingPrices(): Promise<{ kids: KidsRateTier[]; packages: BookingPackage[] } | null> {
  try {
    // Catalog heads are private. Return only public rate fields from this server boundary.
    const db = getServiceRoleClient()
    const [kids, packs] = await Promise.all([
      db.from('task10_pricing_catalog_heads').select('catalog:task10_pricing_catalog_versions(tiers)').eq('regime', 'early').single(),
      db.rpc('booking_ux_catalog_v1'),
    ])
    if (kids.error || packs.error) return null
    const catalog = kids.data as unknown as { catalog: { tiers: KidsRateTier[] } }
    const packages = packs.data as unknown as BookingPackage[]
    if (!Array.isArray(catalog?.catalog?.tiers) || !Array.isArray(packages)) return null
    return { kids: catalog.catalog.tiers.map(t => ({ id: null, minSessions: t.minSessions, maxSessions: t.maxSessions, ratePerSession: t.ratePerSession })), packages }
  } catch { return null }
}
