import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ComplaintClient } from '@/components/dashboard/complaint-client'

interface ComplaintRow {
  id: string
  user_id: string
  branch_id: string
  subject: string
  message: string
  status: string
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  branches?: { name: string } | null
}

export default async function ComplaintPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: complaints } = await supabase
    .from('complaints')
    .select('*, branches(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }) as unknown as { data: ComplaintRow[] | null }

  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">ร้องเรียน</h1>
        <p className="text-gray-500 text-sm mt-1">แจ้งปัญหาหรือข้อร้องเรียน</p>
      </div>
      <ComplaintClient
        complaints={complaints || []}
        branches={branches || []}
      />
    </div>
  )
}
