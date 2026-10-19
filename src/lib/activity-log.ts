import { getServiceRoleClient } from '@/lib/auth/admin'

interface LogActivityInput {
  userId: string
  action: string
  entityType: string
  entityId?: string | null
  details?: Record<string, unknown> | null
  ipAddress?: string | null
}

export interface ReviewClosureResult {
  confirmed: boolean
  sessionId: string
  requestId: string
  auditId?: string
  closedAt?: string
}

/** Close depends on this durable audit. Other logging keeps its existing contract. */
export async function recordReviewClosure(input: { actor: string; session: string; reason: string; requestId: string; readOnly?: boolean; ip?: string | null }) {
  const { data, error } = await getServiceRoleClient().rpc('admin_close_makeup_review_v1', {
    p_actor: input.actor, p_session: input.session, p_reason: input.reason, p_request: input.requestId,
    p_read_only: Boolean(input.readOnly), p_ip: input.ip || null,
  })
  if (error || !data) throw new Error(error?.message || 'ADMIN_REVIEW_CLOSE_UNAVAILABLE')
  return data as ReviewClosureResult
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
    const { error } = await supabase.from('activity_logs').insert({
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
