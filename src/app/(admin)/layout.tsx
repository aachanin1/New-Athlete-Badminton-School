import { AdminSidebar } from '@/components/layout/admin-sidebar'
import { requireAdminPageAccess } from '@/lib/auth/admin'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile, role } = await requireAdminPageAccess()

  const isSuperAdmin = role === 'super_admin'

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar userName={profile?.full_name} isSuperAdmin={isSuperAdmin} />
      <main className="lg:pl-64 pt-14 lg:pt-0">
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
