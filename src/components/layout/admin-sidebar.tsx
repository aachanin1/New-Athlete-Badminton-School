'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import {
  Menu,
  LayoutDashboard,
  Building2,
  CalendarDays,
  Users,
  CalendarClock,
  UserCog,
  CreditCard,
  Ticket,
  Wallet,
  PieChart,
  Camera,
  MessageSquareWarning,
  Bell,
  ScrollText,
  Settings,
  LogOut,
} from 'lucide-react'

const ADMIN_NAV = [
  { href: '/admin', label: 'ภาพรวม', icon: LayoutDashboard },
  { href: '/admin/branches', label: 'จัดการสาขา', icon: Building2 },
  { href: '/admin/schedules', label: 'ตารางเรียน', icon: CalendarDays },
  { href: '/admin/users', label: 'จัดการนักเรียน/ผู้ปกครอง', icon: Users },
  { href: '/admin/makeup', label: 'วันชดเชย', icon: CalendarClock },
  { href: '/admin/coaches', label: 'จัดการโค้ช', icon: UserCog },
  { href: '/admin/payments', label: 'ตรวจสอบการชำระเงิน', icon: CreditCard },
  { href: '/admin/coupons', label: 'คูปองส่วนลด', icon: Ticket },
  { href: '/admin/payroll', label: 'เงินเดือนโค้ช', icon: Wallet },
  { href: '/admin/finance', label: 'รายรับ-รายจ่าย', icon: PieChart },
  { href: '/admin/coach-checkins', label: 'เช็คอินโค้ช', icon: Camera },
  { href: '/admin/complaints', label: 'ร้องเรียน', icon: MessageSquareWarning },
  { href: '/admin/notifications', label: 'แจ้งเตือน', icon: Bell },
  { href: '/admin/logs', label: 'Activity Log', icon: ScrollText, superAdminOnly: true },
  { href: '/admin/settings', label: 'ตั้งค่าระบบ', icon: Settings, superAdminOnly: true },
]

interface AdminSidebarProps {
  userName?: string
  isSuperAdmin?: boolean
}

function SidebarContent({
  userName,
  isSuperAdmin,
  onNavigate,
}: {
  userName?: string
  isSuperAdmin?: boolean
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

  const filteredNav = ADMIN_NAV.filter(
    (item) => !item.superAdminOnly || isSuperAdmin
  )

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <Link href="/" className="flex items-center gap-2" onClick={onNavigate}>
          <Image
            src="/logo new-athlete-school.jpg"
            alt="New Athlete School"
            width={36}
            height={36}
            className="rounded-full"
          />
          <span className="font-bold text-[#153c85] text-sm">New Athlete School</span>
        </Link>
        {userName && (
          <p className="text-xs text-gray-500 mt-2 truncate">
            {isSuperAdmin ? 'Super Admin' : 'Admin'}: {userName}
          </p>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {filteredNav.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href + '/'))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[#2748bf] text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-[#2748bf]'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 w-full transition-colors"
        >
          <LogOut className="h-4 w-4" />
          ออกจากระบบ
        </button>
      </div>
    </div>
  )
}

export function AdminSidebar({ userName, isSuperAdmin }: AdminSidebarProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b h-14 flex items-center px-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SidebarContent userName={userName} isSuperAdmin={isSuperAdmin} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="font-bold text-[#153c85] text-sm ml-2">Admin - New Athlete</span>
      </div>

      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r">
        <SidebarContent userName={userName} isSuperAdmin={isSuperAdmin} />
      </aside>
    </>
  )
}
