import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NotificationsClient } from '@/components/dashboard/notifications-client'
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

export default async function NotificationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, title, message, type, is_read, link_url, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }) as unknown as { data: NotificationRow[] | null }

  return <NotificationsClient notifications={notifications || []} />
}
