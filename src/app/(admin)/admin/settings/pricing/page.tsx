import { PricingSettingsClient } from '@/components/admin/pricing-settings-client'
import { requireSuperAdminPageAccess } from '@/lib/auth/admin'
import type { CourseCategory } from '@/lib/pricing'

interface PricingTierRow {
  id: string
  course_type_id: string
  min_sessions: number
  max_sessions: number | null
  price_per_session: number | string
  package_price: number | string
  valid_from: string
  valid_to: string | null
  created_at: string | null
  course_types?: { name: CourseCategory | null } | null
}

export default async function PricingSettingsPage() {
  const { supabase } = await requireSuperAdminPageAccess()

  const { data: tiers } = await supabase
    .from('pricing_tiers')
    .select(`
      id, course_type_id, min_sessions, max_sessions, price_per_session, package_price, valid_from, valid_to, created_at,
      course_types(name)
    `)
    .order('course_type_id')
    .order('min_sessions', { ascending: true }) as unknown as { data: PricingTierRow[] | null }

  const tierList = (tiers || [])
    .filter((tier) => tier.course_types?.name)
    .map((tier) => ({
      id: tier.id,
      course_type_id: tier.course_type_id,
      course_type_name: tier.course_types!.name!,
      min_sessions: tier.min_sessions,
      max_sessions: tier.max_sessions,
      price_per_session: Number(tier.price_per_session),
      package_price: Number(tier.package_price),
      valid_from: tier.valid_from,
      valid_to: tier.valid_to,
      created_at: tier.created_at,
    }))

  return <PricingSettingsClient tiers={tierList} />
}
