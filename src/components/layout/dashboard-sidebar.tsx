'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  ArrowLeftRight,
  Bell,
  CalendarDays,
  History,
  Home,
  LogOut,
  Menu,
  MessageSquareWarning,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const USER_NAV = [
  { href: '/dashboard', label: 'หน้าหลัก', icon: Home },
  { href: '/dashboard/children', label: 'จัดการข้อมูลลูก', icon: Users },
  { href: '/dashboard/booking', label: 'จองคอร์สเรียน', icon: CalendarDays },
  { href: '/dashboard/history', label: 'ประวัติการจอง', icon: History },
  { href: '/dashboard/schedule', label: 'ตารางเรียน', icon: CalendarDays },
  { href: '/dashboard/reschedule', label: 'เปลี่ยนวัน/สาขา', icon: ArrowLeftRight },
  { href: '/dashboard/progress', label: 'พัฒนาการ & Ranking', icon: TrendingUp },
  { href: '/dashboard/complaint', label: 'ร้องเรียน', icon: MessageSquareWarning },
  { href: '/dashboard/notifications', label: 'แจ้งเตือน', icon: Bell },
]

interface DashboardSidebarProps {
  userName?: string
  notificationUnreadCount?: number
}

function SidebarContent({
  userName,
  notificationUnreadCount = 0,
  onNavigate,
}: DashboardSidebarProps & {
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
          <p className="mt-2 truncate text-xs text-gray-500">สวัสดี, {userName}</p>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {USER_NAV.map((item) => {
          const isActive = pathname === item.href
          const showBadge = item.href === '/dashboard/notifications' && notificationUnreadCount > 0

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
              <item.icon className="h-4 w-4 shrink-0" />
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

export function DashboardSidebar({ userName, notificationUnreadCount = 0 }: DashboardSidebarProps) {
  const [open, setOpen] = useState(false)

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
              notificationUnreadCount={notificationUnreadCount}
              onNavigate={() => setOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <span className="ml-2 text-sm font-bold text-[#153c85]">New Athlete School</span>
        {notificationUnreadCount > 0 && (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-none text-white">
            {notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}
          </span>
        )}
      </div>

      <aside className="hidden border-r bg-white lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <SidebarContent userName={userName} notificationUnreadCount={notificationUnreadCount} />
      </aside>
    </>
  )
}
