import { CoachOtSettingsClient } from '@/components/admin/coach-ot-settings-client'
import { requireSuperAdminPageAccess } from '@/lib/auth/admin'
import { COACH_OT_SETTING_KEY, normalizeCoachOtSettings } from '@/lib/coach-ot-settings'

interface CoachOtSettingRow {
  value: unknown
  updated_at: string | null
}

export default async function CoachOtSettingsPage() {
  const { supabase } = await requireSuperAdminPageAccess()

  const { data: setting } = await supabase
    .from('system_settings')
    .select('value, updated_at')
    .eq('key', COACH_OT_SETTING_KEY)
    .maybeSingle() as unknown as { data: CoachOtSettingRow | null }

  return (
    <CoachOtSettingsClient
      settings={normalizeCoachOtSettings(setting?.value)}
      updatedAt={setting?.updated_at || null}
    />
  )
}
