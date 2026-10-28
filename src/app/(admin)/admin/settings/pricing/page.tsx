import { PricingSettingsClient } from '@/components/admin/pricing-settings-client'
import { PackageDurationSettings } from '@/components/admin/package-duration-settings'
import { requireSuperAdminPageAccess } from '@/lib/auth/admin'
import { loadAdminPricingSettings } from '@/lib/admin-pricing-settings'

export default async function PricingSettingsPage() {
  const { user } = await requireSuperAdminPageAccess()
  const settings = await loadAdminPricingSettings(user!.id)
  return <><PackageDurationSettings /><PricingSettingsClient {...settings} /></>
}
