import { createClient } from '@/lib/supabase/server'
import { NotificationsAdminClient } from '@/components/admin/notifications-admin-client'

export default async function AdminNotificationsPage() {
  const supabase = createClient()

  const [{ data: notifications }, { data: users }] = await Promise.all([
    supabase
      .from('notifications')
      .select('id, user_id, title, message, type, is_read, link_url, created_at, profiles!notifications_user_id_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(200) as any,
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name') as any,
  ])

  const notifList = (notifications || []).map((n: any) => ({
    id: n.id,
    user_id: n.user_id,
    title: n.title,
    message: n.message,
    type: n.type,
    is_read: n.is_read,
    link_url: n.link_url,
    created_at: n.created_at,
    user_name: n.profiles?.full_name || 'ไม่ทราบ',
  }))

  return <NotificationsAdminClient notifications={notifList} users={users || []} />
}
