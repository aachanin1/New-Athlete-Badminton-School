import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BookingClient } from '@/components/dashboard/booking-client'

export default async function BookingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Fetch children for this parent
  const { data: children } = await supabase
    .from('children')
    .select('*')
    .eq('parent_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch branches
  const { data: branches } = await supabase
    .from('branches')
    .select('*')
    .eq('is_active', true)
    .order('name')

  // Fetch course types to get UUIDs
  const { data: courseTypes } = await supabase
    .from('course_types')
    .select('id, name')

  // Fetch user profile
  const { data: profile } = await (supabase
    .from('profiles') as any)
    .select('full_name, phone')
    .eq('id', user.id)
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">จองคอร์สเรียน</h1>
        <p className="text-gray-500 text-sm mt-1">เลือกประเภท สาขา วัน/เวลา และจองคอร์สเรียน</p>
      </div>
      <BookingClient
        userId={user.id}
        userName={(profile as any)?.full_name || ''}
        children={children || []}
        branches={branches || []}
        courseTypes={(courseTypes as any) || []}
      />
    </div>
  )
}
