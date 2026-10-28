import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardSidebar } from '@/components/layout/dashboard-sidebar'
import { BookingEntryBar } from '@/components/dashboard/booking-entry-bar'
import { checkoutRpc } from '@/lib/booking-checkout-server'
import type { UserRole } from '@/types/database'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const [profileResult, notificationResult, pending] = await Promise.all([supabase
    .from('profiles')
    .select('full_name, role, avatar_url')
    .eq('id', user.id)
    .single() as unknown as PromiseLike<{ data: { full_name: string; role: UserRole; avatar_url: string | null } | null }>, supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false), checkoutRpc<{count:number;amount:number;deadline:string|null}>('booking_ux_pending_summary_v1',{p_actor:user.id}).catch(()=>undefined)])
  const profile=profileResult.data,unreadNotificationCount=notificationResult.count

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardSidebar
        userName={profile?.full_name}
        userAvatarUrl={profile?.avatar_url}
        notificationUnreadCount={unreadNotificationCount || 0}
        pendingPaymentCount={pending?.count || 0}
      />
      <main className="lg:pl-64 pt-14 lg:pt-0">
        <div className="p-4 md:p-6 lg:p-8">
          <BookingEntryBar pending={pending}/>
          {children}
        </div>
      </main>
    </div>
  )
}
