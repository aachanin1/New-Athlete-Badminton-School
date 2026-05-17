import { NotificationsClient } from '@/components/dashboard/notifications-client'
import { getServiceRoleClient } from '@/lib/auth/admin'
import {
  createCoachAttendanceGapNotifications,
  createCoachCheckinWindowNotifications,
} from '@/lib/coach-notifications'
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

  if (user?.id) {
    try {
      const adminSupabase = getServiceRoleClient()
      await createCoachCheckinWindowNotifications(adminSupabase, user.id)
      await createCoachAttendanceGapNotifications(adminSupabase, user.id)
    } catch (error) {
      console.error('Coach notification hydration error:', error)
    }
  }

  const { data: notifications } = await (supabase
    .from('notifications')
    .select('id, title, message, type, is_read, link_url, created_at')
    .eq('user_id', user?.id || '')
    .order('created_at', { ascending: false })
    .limit(100) as unknown as Promise<{ data: NotificationRow[] | null }>)

  return (
    <NotificationsClient
      notifications={notifications || []}
      title="แจ้งเตือนโค้ช"
      description="ติดตามรอบสอนที่ได้รับมอบหมาย การเช็คอิน และงานเช็คชื่อที่ยังต้องปิดให้ครบ"
    />
  )
}
