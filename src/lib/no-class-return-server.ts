import 'server-only'
import { getServiceRoleClient } from '@/lib/auth/admin'

interface NoClassReturnClient {
  rpc(name: 'admin_no_class_return_hourly_v1', args: {
    p_actor: string; p_anchor: string; p_mode: 'preview' | 'commit' | 'status'
    p_request: string | null; p_expected: string | null; p_reason: string | null; p_ip: string | null
  }): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>
}

export class NoClassReturnServerError extends Error {
  constructor(message: string, public readonly databaseCode?: string) { super(message) }
}

export async function readOrReturnUntaughtRound(input: {
  actor: string; anchor: string; mode: 'preview' | 'commit' | 'status'
  requestId?: string; expected?: string; reason?: string; ip?: string | null
}) {
  const client = getServiceRoleClient() as unknown as NoClassReturnClient
  const { data, error } = await client.rpc('admin_no_class_return_hourly_v1', {
    p_actor: input.actor, p_anchor: input.anchor, p_mode: input.mode, p_request: input.requestId || null,
    p_expected: input.expected || null, p_reason: input.reason?.trim() || null, p_ip: input.ip || null,
  })
  if (error) throw new NoClassReturnServerError(error.message, error.code)
  if (!data) throw new NoClassReturnServerError('NO_CLASS_RETURN_RESULT_UNAVAILABLE')
  return data
}
