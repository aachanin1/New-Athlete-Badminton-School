import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CoachSidebar } from '@/components/layout/coach-sidebar'
import type { UserRole } from '@/types/database'

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, avatar_url')
    .eq('id', user.id)
    .single() as { data: { full_name: string; role: UserRole; avatar_url: string | null } | null }

  const isHeadCoach = profile?.role === 'head_coach' || profile?.role === 'super_admin'
  const { count: unreadNotificationCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  return (
    <div className="min-h-screen bg-gray-50">
      <CoachSidebar
        userName={profile?.full_name}
        userAvatarUrl={profile?.avatar_url}
        isHeadCoach={isHeadCoach}
        notificationUnreadCount={unreadNotificationCount || 0}
      />
      <main className="lg:pl-64 pt-14 lg:pt-0">
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
