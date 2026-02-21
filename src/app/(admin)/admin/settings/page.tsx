import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from '@/components/admin/settings-client'

export default async function SettingsPage() {
  const supabase = createClient()

  const { data: settings } = await (supabase
    .from('system_settings')
    .select('id, key, value, updated_by, updated_at')
    .order('key') as any)

  // Fetch updater names
  const updaterIds = Array.from(new Set((settings || []).map((s: any) => s.updated_by).filter(Boolean))) as string[]
  let updaterMap: Record<string, string> = {}
  if (updaterIds.length > 0) {
    const { data: updaters } = await (supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', updaterIds) as any)
    updaterMap = (updaters || []).reduce((m: Record<string, string>, v: any) => {
      m[v.id] = v.full_name
      return m
    }, {})
  }

  const settingList = (settings || []).map((s: any) => ({
    id: s.id,
    key: s.key,
    value: s.value,
    updated_by: s.updated_by,
    updated_at: s.updated_at,
    updated_by_name: s.updated_by ? (updaterMap[s.updated_by] || null) : null,
  }))

  return <SettingsClient settings={settingList} />
}
