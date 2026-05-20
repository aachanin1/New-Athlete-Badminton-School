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

interface DbError {
  message: string
}

interface ProfileIdRow {
  id: string
}

interface CoachBranchRow {
  coach_id: string
}

type NotificationInsertQuery = PromiseLike<{ error: DbError | null }>

interface NotificationTable {
  insert(values: NotificationInsert[]): NotificationInsertQuery
}

type NotificationExistsQuery = PromiseLike<{ data: { id: string }[] | null; error: DbError | null }>

interface NotificationSelectQuery extends NotificationExistsQuery {
  eq(column: string, value: string): NotificationSelectQuery
  is(column: string, value: null): NotificationSelectQuery
  limit(count: number): NotificationExistsQuery
}

interface NotificationSelectTable {
  select(columns: string): NotificationSelectQuery
}

export async function insertNotifications(
  supabase: SupabaseClient<Database>,
  notifications: NotificationInsert[]
) {
  if (notifications.length === 0) return { error: null }

  const table = supabase.from('notifications') as unknown as NotificationTable

  return table.insert(
    notifications.map<NotificationInsert>((notification) => ({
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

export async function notifyUserOnce(
  supabase: SupabaseClient<Database>,
  notification: NotificationInsert
) {
  const table = supabase.from('notifications') as unknown as NotificationSelectTable
  let query = table
    .select('id')
    .eq('user_id', notification.user_id)
    .eq('title', notification.title)
    .eq('message', notification.message)

  query = notification.link_url
    ? query.eq('link_url', notification.link_url)
    : query.is('link_url', null)

  const { data, error } = await query.limit(1)
  if (error) return { error }
  if (data && data.length > 0) return { error: null, skipped: true }

  const result = await notifyUser(supabase, notification)
  return { ...result, skipped: false }
}

export async function notifyRoles(
  supabase: SupabaseClient<Database>,
  input: RoleNotificationInput
) {
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .in('role', input.roles) as unknown as { data: ProfileIdRow[] | null; error: DbError | null }

  if (profileError) {
    return { error: profileError }
  }

  return insertNotifications(
    supabase,
    (profiles || []).map((profile) => ({
      user_id: profile.id,
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
  const { data: coachBranches, error } = await supabase
    .from('coach_branches')
    .select('coach_id')
    .eq('branch_id', branchId) as unknown as { data: CoachBranchRow[] | null; error: DbError | null }

  if (error) {
    return { error }
  }

  const uniqueCoachIds = Array.from(new Set((coachBranches || []).map((item) => item.coach_id)))

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
