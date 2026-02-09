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
  Home,
  CalendarCheck,
  UserCheck,
  Camera,
  BarChart3,
  FileText,
  Users,
  Clock,
  UsersRound,
  LogOut,
} from 'lucide-react'

const COACH_NAV = [
  { href: '/coach', label: 'หน้าหลัก', icon: Home },
  { href: '/coach/today', label: 'รอบสอนวันนี้', icon: CalendarCheck },
  { href: '/coach/attendance', label: 'เช็คชื่อนักเรียน', icon: UserCheck },
  { href: '/coach/checkin', label: 'เช็คอิน', icon: Camera },
  { href: '/coach/levels', label: 'กรอก LV นักเรียน', icon: BarChart3 },
  { href: '/coach/programs', label: 'โปรแกรมสอน', icon: FileText },
  { href: '/coach/students', label: 'รายชื่อนักเรียน', icon: Users },
  { href: '/coach/hours', label: 'สรุปชั่วโมงสอน', icon: Clock },
  { href: '/coach/assign-groups', label: 'แบ่งกลุ่มนักเรียน', icon: UsersRound, headCoachOnly: true },
]

interface CoachSidebarProps {
  userName?: string
  isHeadCoach?: boolean
}

function SidebarContent({
  userName,
  isHeadCoach,
  onNavigate,
}: {
  userName?: string
  isHeadCoach?: boolean
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

  const filteredNav = COACH_NAV.filter(
    (item) => !item.headCoachOnly || isHeadCoach
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
            โค้ช {userName}
            {isHeadCoach && (
              <span className="ml-1 text-[#f57e3b] font-medium">(หัวหน้า)</span>
            )}
          </p>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {filteredNav.map((item) => {
          const isActive = pathname === item.href
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

export function CoachSidebar({ userName, isHeadCoach }: CoachSidebarProps) {
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
            <SidebarContent userName={userName} isHeadCoach={isHeadCoach} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="font-bold text-[#153c85] text-sm ml-2">โค้ช - New Athlete</span>
      </div>

      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r">
        <SidebarContent userName={userName} isHeadCoach={isHeadCoach} />
      </aside>
    </>
  )
}
