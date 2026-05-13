import { createClient } from '@/lib/supabase/server'
import { ComplaintsClient } from '@/components/admin/complaints-client'
import { requireAdminPageAccess } from '@/lib/auth/admin'

type ComplaintStatus = 'open' | 'in_progress' | 'resolved'

interface ComplaintRow {
  id: string
  user_id: string
  branch_id: string | null
  subject: string
  message: string
  status: ComplaintStatus
  resolved_by: string | null
  resolved_at: string | null
  admin_note: string | null
  last_updated_by: string | null
  updated_at: string
  created_at: string
  profiles?: { full_name: string | null; email: string | null } | null
  branches?: { name: string | null } | null
}

interface ResolverRow {
  id: string
  full_name: string | null
}

export default async function ComplaintsPage() {
  await requireAdminPageAccess()
  const supabase = createClient()

  const { data: complaints } = await supabase
    .from('complaints')
    .select(`
      id, user_id, branch_id, subject, message, status, resolved_by, resolved_at,
      admin_note, last_updated_by, updated_at, created_at,
      profiles!complaints_user_id_fkey(full_name, email),
      branches(name)
    `)
    .order('created_at', { ascending: false }) as unknown as { data: ComplaintRow[] | null }

  const adminIds = Array.from(new Set((complaints || [])
    .flatMap((complaint) => [complaint.resolved_by, complaint.last_updated_by])
    .filter(Boolean))) as string[]

  let adminNameMap: Record<string, string> = {}
  if (adminIds.length > 0) {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', adminIds) as unknown as { data: ResolverRow[] | null }

    adminNameMap = (admins || []).reduce((map: Record<string, string>, admin) => {
      map[admin.id] = admin.full_name || ''
      return map
    }, {})
  }

  const complaintList = (complaints || []).map((complaint) => ({
    id: complaint.id,
    user_id: complaint.user_id,
    branch_id: complaint.branch_id || '',
    subject: complaint.subject,
    message: complaint.message,
    status: complaint.status,
    resolved_by: complaint.resolved_by,
    resolved_at: complaint.resolved_at,
    admin_note: complaint.admin_note,
    last_updated_by: complaint.last_updated_by,
    updated_at: complaint.updated_at,
    created_at: complaint.created_at,
    user_name: complaint.profiles?.full_name || 'ไม่ทราบ',
    user_email: complaint.profiles?.email || '',
    branch_name: complaint.branches?.name || 'ไม่ทราบ',
    resolved_by_name: complaint.resolved_by ? (adminNameMap[complaint.resolved_by] || null) : null,
    last_updated_by_name: complaint.last_updated_by ? (adminNameMap[complaint.last_updated_by] || null) : null,
  }))

  return <ComplaintsClient complaints={complaintList} />
}
