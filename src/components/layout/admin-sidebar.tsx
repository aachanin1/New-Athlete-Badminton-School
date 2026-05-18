'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  Bell,
  BookOpenCheck,
  Building2,
  CalendarClock,
  CalendarDays,
  Camera,
  Clock,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareWarning,
  PieChart,
  ScrollText,
  Settings,
  Ticket,
  Trophy,
  UserCog,
  UserCircle,
  Users,
  Wallet,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { createClient } from '@/lib/supabase/client'
import { ADMIN_MENU_ITEMS, getAllowedAdminMenuKeys, type AdminMenuKey } from '@/lib/admin-navigation'
import { cn } from '@/lib/utils'

const ADMIN_MENU_ICONS: Record<AdminMenuKey, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  branches: Building2,
  schedules: CalendarDays,
  schedule_templates: Clock,
  users: Users,
  ranking: Trophy,
  makeup: CalendarClock,
  coaches: UserCog,
  payments: CreditCard,
  coupons: Ticket,
  payroll: Wallet,
  finance: PieChart,
  coach_checkins: Camera,
  teaching_programs: BookOpenCheck,
  complaints: MessageSquareWarning,
  notifications: Bell,
  logs: ScrollText,
  settings: Settings,
}

interface AdminSidebarProps {
  userName?: string
  userAvatarUrl?: string | null
  isSuperAdmin?: boolean
  notificationUnreadCount?: number
  allowedMenuKeys?: AdminMenuKey[]
}

function SidebarContent({
  userName,
  userAvatarUrl,
  isSuperAdmin,
  notificationUnreadCount = 0,
  allowedMenuKeys,
  onNavigate,
}: AdminSidebarProps & {
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const isProfileActive = pathname === '/profile'
  const adminAllowedKeys = allowedMenuKeys || getAllowedAdminMenuKeys(null)
  const filteredNav = ADMIN_MENU_ITEMS.filter((item) => {
    if (isSuperAdmin) return true
    if (item.superAdminOnly) return false
    return adminAllowedKeys.includes(item.key)
  })

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4">
        <Link href="/" className="flex items-center gap-2" onClick={onNavigate}>
          <Image
            src="/logo new-athlete-school.jpg"
            alt="New Athlete School"
            width={36}
            height={36}
            className="rounded-full"
          />
          <span className="text-sm font-bold text-[#153c85]">New Athlete School</span>
        </Link>
        {userName && (
          <p className="mt-2 truncate text-xs text-gray-500">
            {isSuperAdmin ? 'Super Admin' : 'Admin'}: {userName}
          </p>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {filteredNav.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(`${item.href}/`))
          const showBadge = item.href === '/admin/notifications' && notificationUnreadCount > 0
          const Icon = ADMIN_MENU_ICONS[item.key]

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[#2748bf] text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-[#2748bf]'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {showBadge && (
                <span
                  className={cn(
                    'ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none',
                    isActive ? 'bg-white text-[#2748bf]' : 'bg-red-500 text-white'
                  )}
                >
                  {notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="border-t p-3">
        <Link
          href="/profile"
          onClick={onNavigate}
          className={cn(
            'mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            isProfileActive
              ? 'bg-[#2748bf] text-white'
              : 'text-gray-600 hover:bg-gray-100 hover:text-[#2748bf]'
          )}
        >
          <Avatar className="h-6 w-6">
            {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt={userName || 'Profile'} className="object-cover" />}
            <AvatarFallback className={cn('text-[10px] font-bold', isProfileActive ? 'bg-white text-[#2748bf]' : 'bg-[#2748bf]/10 text-[#153c85]')}>
              {(userName || 'NA').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate">โปรไฟล์ของฉัน</span>
          <UserCircle className="h-4 w-4 shrink-0" />
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          ออกจากระบบ
        </button>
      </div>
    </div>
  )
}

export function AdminSidebar({ userName, userAvatarUrl, isSuperAdmin, notificationUnreadCount = 0, allowedMenuKeys }: AdminSidebarProps) {
  const [open, setOpen] = useState(false)
  const adminAllowedKeys = allowedMenuKeys || getAllowedAdminMenuKeys(null)
  const canShowNotificationBadge = Boolean(isSuperAdmin || adminAllowedKeys.includes('notifications'))

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center border-b bg-white px-4 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SidebarContent
              userName={userName}
              userAvatarUrl={userAvatarUrl}
              isSuperAdmin={isSuperAdmin}
              notificationUnreadCount={notificationUnreadCount}
              allowedMenuKeys={adminAllowedKeys}
              onNavigate={() => setOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <span className="ml-2 text-sm font-bold text-[#153c85]">Admin - New Athlete</span>
        {canShowNotificationBadge && notificationUnreadCount > 0 && (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-none text-white">
            {notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}
          </span>
        )}
      </div>

      <aside className="hidden border-r bg-white lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <SidebarContent
          userName={userName}
          userAvatarUrl={userAvatarUrl}
          isSuperAdmin={isSuperAdmin}
          notificationUnreadCount={notificationUnreadCount}
          allowedMenuKeys={adminAllowedKeys}
        />
      </aside>
    </>
  )
}
