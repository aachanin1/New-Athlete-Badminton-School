import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NotificationsClient } from '@/components/dashboard/notifications-client'

export default async function NotificationsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: notifications } = await ((supabase
    .from('notifications')
    .select('id, title, message, type, is_read, link_url, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })) as any)

  return <NotificationsClient notifications={notifications || []} />
}
