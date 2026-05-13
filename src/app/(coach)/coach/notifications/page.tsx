import { NotificationsClient } from '@/components/dashboard/notifications-client'
import { createClient } from '@/lib/supabase/server'
import type { NotificationType } from '@/types/database'

interface NotificationRow {
  id: string
  title: string
  message: string
  type: NotificationType
  is_read: boolean
  link_url: string | null
  created_at: string
}

export default async function CoachNotificationsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: notifications } = await (supabase
    .from('notifications')
    .select('id, title, message, type, is_read, link_url, created_at')
    .eq('user_id', user?.id || '')
    .order('created_at', { ascending: false })
    .limit(100) as unknown as Promise<{ data: NotificationRow[] | null }>)

  return <NotificationsClient notifications={notifications || []} />
}
