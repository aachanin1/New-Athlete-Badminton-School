import { AdminSidebar } from '@/components/layout/admin-sidebar'
import { requireAdminPageAccess } from '@/lib/auth/admin'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { supabase, user, profile, role } = await requireAdminPageAccess()

  const isSuperAdmin = role === 'super_admin'
  const { count: unreadNotificationCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar
        userName={profile?.full_name}
        isSuperAdmin={isSuperAdmin}
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
