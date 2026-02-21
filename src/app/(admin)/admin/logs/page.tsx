import { createClient } from '@/lib/supabase/server'
import { LogsClient } from '@/components/admin/logs-client'

export default async function LogsPage() {
  const supabase = createClient()

  const { data: logs } = await (supabase
    .from('activity_logs')
    .select('id, user_id, action, entity_type, entity_id, details, ip_address, created_at, profiles!activity_logs_user_id_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(300) as any)

  const logList = (logs || []).map((l: any) => ({
    id: l.id,
    user_id: l.user_id,
    action: l.action,
    entity_type: l.entity_type,
    entity_id: l.entity_id,
    details: l.details,
    ip_address: l.ip_address,
    created_at: l.created_at,
    user_name: l.profiles?.full_name || 'ไม่ทราบ',
  }))

  return <LogsClient logs={logList} />
}
