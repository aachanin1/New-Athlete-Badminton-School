import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChildrenClient } from '@/components/dashboard/children-client'

export default async function ChildrenPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: children } = await supabase
    .from('children')
    .select('*')
    .eq('parent_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">จัดการข้อมูลลูก</h1>
        <p className="text-gray-500 text-sm mt-1">เพิ่ม แก้ไข ข้อมูลลูกของคุณ</p>
      </div>
      <ChildrenClient initialChildren={children || []} />
    </div>
  )
}
