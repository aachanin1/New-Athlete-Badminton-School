import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HistoryClient } from '@/components/dashboard/history-client'

export default async function HistoryPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Fetch bookings with related data
  const { data: bookings } = await (supabase
    .from('bookings') as any)
    .select('*, branches(name), children(full_name, nickname), course_types(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch payments for this user's bookings
  const { data: payments } = await (supabase
    .from('payments') as any)
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">ประวัติการจอง</h1>
        <p className="text-gray-500 text-sm mt-1">ดูประวัติการจองและการชำระเงินทั้งหมด</p>
      </div>
      <HistoryClient
        bookings={bookings || []}
        payments={payments || []}
        userId={user.id}
      />
    </div>
  )
}
