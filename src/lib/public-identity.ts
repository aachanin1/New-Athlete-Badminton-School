import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, UserRole } from '@/types/database'

export interface PublicIdentity {
  id: string
  name: string
  role: UserRole
}

const roles = new Set<UserRole>(['user', 'coach', 'head_coach', 'admin', 'super_admin'])
const endedSessions = new Set(['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'session_expired', 'user_not_found', 'user_banned', 'bad_jwt'])

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const aborted = () => reject(new DOMException('Identity read cancelled', 'AbortError'))
    if (signal.aborted) { aborted(); return }
    signal.addEventListener('abort', aborted, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted))
  })
}

// Presentation identity only. Protected pages, APIs and RLS still authorize each request.
// The explicit Auth read can be cancelled without changing the shared client's fetch
// or waiting behind an Auth lock while querying profiles from an Auth callback.
export async function readPublicIdentity(
  supabase: SupabaseClient<Database>,
  signal: AbortSignal,
): Promise<PublicIdentity | null> {
  const { data, error } = await abortable(supabase.auth.getSession(), signal)
  if (error) {
    if (error.code && endedSessions.has(error.code)) return null
    throw error
  }
  if (!data.session) return null

  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
      Authorization: `Bearer ${data.session.access_token}`,
    },
    signal,
    cache: 'no-store',
  })
  if (response.status === 401 || response.status === 403) return null
  if (!response.ok) throw new Error('Identity service temporarily unavailable')
  const user = await response.json() as { id?: string; email?: string }
  if (!user.id || user.id !== data.session.user.id) throw new Error('Identity changed during read')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .abortSignal(signal)
    .maybeSingle() as { data: { full_name: string | null; role: UserRole } | null; error: unknown }
  if (profileError) throw profileError
  if (!profile || !roles.has(profile.role)) throw new Error('Account profile not ready')
  return { id: user.id, name: profile.full_name || user.email || 'ผู้ใช้', role: profile.role }
}
