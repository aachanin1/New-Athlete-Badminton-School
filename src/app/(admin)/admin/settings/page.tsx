import type { ReactNode } from 'react'
import { AdminMenuPermissionsClient } from '@/components/admin/admin-menu-permissions-client'
import { CoachOtSettingsClient } from '@/components/admin/coach-ot-settings-client'
import { LevelsSettingsClient } from '@/components/admin/levels-settings-client'
import { PricingSettingsClient } from '@/components/admin/pricing-settings-client'
import { SettingsClient, type SettingsSection } from '@/components/admin/settings-client'
import { ADMIN_MENU_ITEMS, ADMIN_MENU_PERMISSION_SETTING_KEY, getAllowedAdminMenuKeys } from '@/lib/admin-navigation'
import { requireSuperAdminPageAccess } from '@/lib/auth/admin'
import { COACH_OT_SETTING_KEY, normalizeCoachOtSettings } from '@/lib/coach-ot-settings'
import type { CourseCategory } from '@/lib/pricing'
import type { LevelCategory } from '@/types/database'

interface LevelRow {
  id: number
  name: string
  description: string | null
  category: LevelCategory
  program_name: string | null
  requirements: string | null
  is_active: boolean | null
  updated_at: string | null
}

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

interface CoachOtSettingRow {
  value: unknown
  updated_at: string | null
}

interface SettingsPageProps {
  searchParams?: {
    section?: string
  }
}

const VALID_SECTIONS: SettingsSection[] = ['admin-menus', 'levels', 'pricing', 'coach-ot']

function getActiveSection(value?: string): SettingsSection {
  return value && VALID_SECTIONS.includes(value as SettingsSection) ? value as SettingsSection : 'admin-menus'
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { supabase } = await requireSuperAdminPageAccess()
  const activeSection = getActiveSection(searchParams?.section)

  let sectionContent: ReactNode = null

  if (activeSection === 'admin-menus') {
    const { data: permissionSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', ADMIN_MENU_PERMISSION_SETTING_KEY)
      .maybeSingle() as unknown as { data: { value: unknown } | null }

    sectionContent = (
      <AdminMenuPermissionsClient
        menuItems={ADMIN_MENU_ITEMS}
        initialAllowedMenuKeys={getAllowedAdminMenuKeys(permissionSetting?.value)}
        hasSetting={!!permissionSetting}
      />
    )
  }

  if (activeSection === 'levels') {
    const { data: levels } = await supabase
      .from('levels')
      .select('id, name, description, category, program_name, requirements, is_active, updated_at')
      .order('id', { ascending: true }) as { data: LevelRow[] | null }

    sectionContent = (
      <LevelsSettingsClient
        levels={(levels || []).map((level) => ({
          id: level.id,
          name: level.name,
          description: level.description,
          category: level.category,
          program_name: level.program_name,
          requirements: level.requirements,
          is_active: level.is_active ?? true,
          updated_at: level.updated_at,
        }))}
      />
    )
  }

  if (activeSection === 'pricing') {
    const { data: tiers } = await supabase
      .from('pricing_tiers')
      .select(`
        id, course_type_id, min_sessions, max_sessions, price_per_session, package_price, valid_from, valid_to, created_at,
        course_types(name)
      `)
      .order('course_type_id')
      .order('min_sessions', { ascending: true }) as unknown as { data: PricingTierRow[] | null }

    sectionContent = (
      <PricingSettingsClient
        tiers={(tiers || [])
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
          }))}
      />
    )
  }

  if (activeSection === 'coach-ot') {
    const { data: setting } = await supabase
      .from('system_settings')
      .select('value, updated_at')
      .eq('key', COACH_OT_SETTING_KEY)
      .maybeSingle() as unknown as { data: CoachOtSettingRow | null }

    sectionContent = (
      <CoachOtSettingsClient
        settings={normalizeCoachOtSettings(setting?.value)}
        updatedAt={setting?.updated_at || null}
      />
    )
  }

  return (
    <SettingsClient activeSection={activeSection}>
      {sectionContent}
    </SettingsClient>
  )
}
