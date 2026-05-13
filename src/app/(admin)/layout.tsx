import { AdminSidebar } from '@/components/layout/admin-sidebar'
import { requireAdminPageAccess } from '@/lib/auth/admin'
import { ADMIN_MENU_PERMISSION_SETTING_KEY, getAllowedAdminMenuKeys } from '@/lib/admin-navigation'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { supabase, user, profile, role } = await requireAdminPageAccess()

  const isSuperAdmin = role === 'super_admin'
  let allowedMenuKeys = getAllowedAdminMenuKeys(null)

  if (!isSuperAdmin) {
    const { data: permissionSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', ADMIN_MENU_PERMISSION_SETTING_KEY)
      .maybeSingle() as unknown as { data: { value: unknown } | null }

    allowedMenuKeys = getAllowedAdminMenuKeys(permissionSetting?.value)
  }

  const { count: unreadNotificationCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar
        userName={profile?.full_name}
        userAvatarUrl={profile?.avatar_url}
        isSuperAdmin={isSuperAdmin}
        notificationUnreadCount={unreadNotificationCount || 0}
        allowedMenuKeys={allowedMenuKeys}
      />
      <main className="lg:pl-64 pt-14 lg:pt-0">
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
