import { createClient } from '@/lib/supabase/server'
import { ComplaintsClient } from '@/components/admin/complaints-client'

export default async function ComplaintsPage() {
  const supabase = createClient()

  // Fetch complaints with user and branch info
  const { data: complaints } = await (supabase
    .from('complaints')
    .select('id, user_id, branch_id, subject, message, status, resolved_by, resolved_at, created_at, profiles!complaints_user_id_fkey(full_name, email), branches(name)')
    .order('created_at', { ascending: false }) as any)

  // Fetch resolver names
  const resolverIds = Array.from(new Set((complaints || []).map((c: any) => c.resolved_by).filter(Boolean))) as string[]
  let resolverMap: Record<string, string> = {}
  if (resolverIds.length > 0) {
    const { data: resolvers } = await (supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', resolverIds) as any)
    resolverMap = (resolvers || []).reduce((m: Record<string, string>, v: any) => {
      m[v.id] = v.full_name
      return m
    }, {})
  }

  const complaintList = (complaints || []).map((c: any) => ({
    id: c.id,
    user_id: c.user_id,
    branch_id: c.branch_id,
    subject: c.subject,
    message: c.message,
    status: c.status,
    resolved_by: c.resolved_by,
    resolved_at: c.resolved_at,
    created_at: c.created_at,
    user_name: c.profiles?.full_name || 'ไม่ทราบ',
    user_email: c.profiles?.email || '',
    branch_name: c.branches?.name || 'ไม่ทราบ',
    resolved_by_name: c.resolved_by ? (resolverMap[c.resolved_by] || null) : null,
  }))

  return <ComplaintsClient complaints={complaintList} />
}
