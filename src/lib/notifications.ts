import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, NotificationType, UserRole } from '@/types/database'

interface NotificationInsert {
  user_id: string
  title: string
  message: string
  type?: NotificationType
  link_url?: string | null
}

interface RoleNotificationInput {
  roles: UserRole[]
  title: string
  message: string
  type?: NotificationType
  link_url?: string | null
}

export async function insertNotifications(
  supabase: SupabaseClient<Database>,
  notifications: NotificationInsert[]
) {
  if (notifications.length === 0) return { error: null }

  return (supabase.from('notifications') as any).insert(
    notifications.map((notification) => ({
      user_id: notification.user_id,
      title: notification.title,
      message: notification.message,
      type: notification.type || 'system',
      link_url: notification.link_url || null,
    }))
  )
}

export async function notifyUser(
  supabase: SupabaseClient<Database>,
  notification: NotificationInsert
) {
  return insertNotifications(supabase, [notification])
}

export async function notifyRoles(
  supabase: SupabaseClient<Database>,
  input: RoleNotificationInput
) {
  const { data: profiles, error: profileError } = await ((supabase
    .from('profiles')
    .select('id')
    .in('role', input.roles)) as any)

  if (profileError) {
    return { error: profileError }
  }

  return insertNotifications(
    supabase,
    (profiles || []).map((profile: any) => ({
      user_id: profile.id as string,
      title: input.title,
      message: input.message,
      type: input.type || 'system',
      link_url: input.link_url || null,
    }))
  )
}

export async function notifyCoachesByBranch(
  supabase: SupabaseClient<Database>,
  branchId: string,
  payload: Omit<NotificationInsert, 'user_id'>
) {
  const { data: coachBranches, error } = await ((supabase
    .from('coach_branches')
    .select('coach_id')
    .eq('branch_id', branchId)) as any)

  if (error) {
    return { error }
  }

  const uniqueCoachIds = Array.from(new Set((coachBranches || []).map((item: any) => item.coach_id)))

  return insertNotifications(
    supabase,
    uniqueCoachIds.map((coachId) => ({
      user_id: coachId as string,
      title: payload.title,
      message: payload.message,
      type: payload.type || 'system',
      link_url: payload.link_url || null,
    }))
  )
}
