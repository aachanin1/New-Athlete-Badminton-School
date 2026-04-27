import { getServiceRoleClient } from '@/lib/auth/admin'

interface LogActivityInput {
  userId: string
  action: string
  entityType: string
  entityId?: string | null
  details?: Record<string, unknown> | null
  ipAddress?: string | null
}

export async function logActivity({
  userId,
  action,
  entityType,
  entityId = null,
  details = null,
  ipAddress = null,
}: LogActivityInput) {
  try {
    const supabase = getServiceRoleClient()
    const { error } = await (supabase.from('activity_logs') as any).insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      ip_address: ipAddress,
    })

    if (error) {
      console.error('Activity log insert error:', error)
    }
  } catch (error) {
    console.error('Activity log error:', error)
  }
}
