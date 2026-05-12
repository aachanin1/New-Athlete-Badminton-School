import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from '@/components/admin/settings-client'
import { requireSuperAdminPageAccess } from '@/lib/auth/admin'

interface SettingRow {
  id: string
  key: string
  value: unknown
  updated_by: string | null
  updated_at: string | null
}

interface UpdaterRow {
  id: string
  full_name: string | null
}

export default async function SettingsPage() {
  await requireSuperAdminPageAccess()
  const supabase = createClient()

  const { data: settings } = await supabase
    .from('system_settings')
    .select('id, key, value, updated_by, updated_at')
    .order('key') as unknown as { data: SettingRow[] | null }

  // Fetch updater names
  const updaterIds = Array.from(new Set((settings || []).map((s) => s.updated_by).filter(Boolean))) as string[]
  let updaterMap: Record<string, string> = {}
  if (updaterIds.length > 0) {
    const { data: updaters } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', updaterIds) as unknown as { data: UpdaterRow[] | null }
    updaterMap = (updaters || []).reduce((m: Record<string, string>, v) => {
      m[v.id] = v.full_name || ''
      return m
    }, {})
  }

  const settingList = (settings || []).map((s) => ({
    id: s.id,
    key: s.key,
    value: s.value,
    updated_by: s.updated_by,
    updated_at: s.updated_at || new Date(0).toISOString(),
    updated_by_name: s.updated_by ? (updaterMap[s.updated_by] || null) : null,
  }))

  return <SettingsClient settings={settingList} />
}
