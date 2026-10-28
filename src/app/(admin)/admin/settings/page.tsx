import type { ReactNode } from 'react'
import { AdminMenuPermissionsClient } from '@/components/admin/admin-menu-permissions-client'
import { CoachOtSettingsClient } from '@/components/admin/coach-ot-settings-client'
import { LevelsSettingsClient } from '@/components/admin/levels-settings-client'
import { PricingSettingsClient } from '@/components/admin/pricing-settings-client'
import { PackageDurationSettings } from '@/components/admin/package-duration-settings'
import { KidsMakeupSettingsClient } from '@/components/admin/kids-makeup-settings-client'
import type { KidsMakeupSettings } from '@/lib/kids-makeup-settings'
import { callTask10 } from '@/lib/task10-policy'
import { loadAdminPricingSettings } from '@/lib/admin-pricing-settings'
import { SettingsClient, type SettingsSection } from '@/components/admin/settings-client'
import { ADMIN_MENU_ITEMS, ADMIN_MENU_PERMISSION_SETTING_KEY, getAllowedAdminMenuKeys } from '@/lib/admin-navigation'
import { getServiceRoleClient, requireSuperAdminPageAccess } from '@/lib/auth/admin'
import { COACH_TEACHING_RULES_SETTING_KEY, normalizeCoachTeachingRulesSettings } from '@/lib/coach-teaching-rules'
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

interface CoachOtSettingRow {
  value: unknown
  updated_at: string | null
}

interface SettingsPageProps {
  searchParams?: Promise<{
    section?: string
  }>
}

const VALID_SECTIONS: SettingsSection[] = ['admin-menus', 'levels', 'pricing', 'coach-ot', 'kids-makeup']

function getActiveSection(value?: string): SettingsSection {
  return value && VALID_SECTIONS.includes(value as SettingsSection) ? value as SettingsSection : 'admin-menus'
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { supabase, user } = await requireSuperAdminPageAccess()
  const resolvedSearchParams = await searchParams
  const activeSection = getActiveSection(resolvedSearchParams?.section)

  let sectionContent: ReactNode = null

  if (activeSection === 'kids-makeup') {
    let setting: KidsMakeupSettings | null = null
    let loadError: string | undefined
    try {
      setting = await callTask10<KidsMakeupSettings>(getServiceRoleClient(), 'task10_read_makeup_setting_v1', { p_actor_id: user!.id })
    } catch {
      loadError = 'อ่านค่าขั้นต่ำไม่สำเร็จ กรุณาโหลดข้อมูลใหม่'
    }
    sectionContent = <KidsMakeupSettingsClient key={setting ? `${setting.id}:${setting.revision}` : 'unavailable'} initial={setting} loadError={loadError} />
  }

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
    const settings = await loadAdminPricingSettings(user!.id)
    sectionContent = (
      <><PackageDurationSettings /><PricingSettingsClient {...settings} /></>
    )
  }

  if (activeSection === 'coach-ot') {
    const { data: setting } = await supabase
      .from('system_settings')
      .select('value, updated_at')
      .eq('key', COACH_TEACHING_RULES_SETTING_KEY)
      .maybeSingle() as unknown as { data: CoachOtSettingRow | null }

    sectionContent = (
      <CoachOtSettingsClient
        settings={normalizeCoachTeachingRulesSettings(setting?.value)}
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
