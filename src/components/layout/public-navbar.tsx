'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AuthModal } from '@/components/shared/auth-modal'
import { Menu, LogIn, UserPlus, User, LogOut, LayoutDashboard } from 'lucide-react'

type AuthMode = 'login' | 'register'

const NAV_SECTIONS = [
  { id: 'hero', label: 'หน้าแรก' },
  { id: 'pricing', label: 'คอร์สเรียน & ราคา', shortLabel: 'คอร์ส' },
  { id: 'levels', label: 'Level พัฒนาการ', shortLabel: 'Level' },
  { id: 'branches', label: 'สาขาต่างๆ' },
  { id: 'contact', label: 'ติดต่อสอบถาม', shortLabel: 'ติดต่อ' },
  { href: '/ranking', label: 'อันดับนักเรียน', shortLabel: 'อันดับ' },
]

export function PublicNavbar() {
  const router = useRouter()
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [userName, setUserName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', user.id)
          .single() as { data: { full_name: string; role: string } | null }
        setUserName(profile?.full_name || user.email || 'ผู้ใช้')
      }
      setLoading(false)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUserName(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode)
    setAuthOpen(true)
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUserName(null)
    router.refresh()
  }

  const scrollToSection = (id: string) => {
    if (pathname !== '/') {
      router.push(`/#${id}`)
      setSheetOpen(false)
      return
    }
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setSheetOpen(false)
  }

  const handleNavClick = (item: typeof NAV_SECTIONS[number]) => {
    if ('href' in item && item.href) {
      setSheetOpen(false)
      router.push(item.href)
    } else if ('id' in item && item.id) {
      scrollToSection(item.id)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <button
            onClick={() => scrollToSection('hero')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Image
              src="/logo new-athlete-school.jpg"
              alt="New Athlete School"
              width={40}
              height={40}
              className="rounded-full"
            />
            <span className="font-bold text-[#153c85] text-lg whitespace-nowrap">
              New Athlete School
            </span>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-5">
            {NAV_SECTIONS.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNavClick(item)}
                className="text-sm font-medium text-gray-600 hover:text-[#2748bf] transition-colors"
              >
                <span className="hidden xl:inline">{item.label}</span>
                <span className="xl:hidden">{item.shortLabel || item.label}</span>
              </button>
            ))}

            {loading ? (
              <div className="w-24 h-9 bg-gray-100 rounded-md animate-pulse" />
            ) : userName ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="border-[#2748bf]/30 text-[#153c85] gap-2">
                    <User className="h-4 w-4" />
                    <span className="max-w-[120px] truncate">{userName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => router.push('/auth')}>
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    แดชบอร์ด
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    ออกจากระบบ
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="border-[#2748bf]/30 text-[#2748bf] hover:bg-[#2748bf]/5"
                  onClick={() => openAuth('login')}
                >
                  <LogIn className="h-4 w-4 mr-1" />
                  เข้าสู่ระบบ
                </Button>
                <Button
                  className="bg-[#2748bf] hover:bg-[#153c85]"
                  onClick={() => openAuth('register')}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  สมัครสมาชิก
                </Button>
              </div>
            )}
          </nav>

          {/* Mobile Nav */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="flex flex-col gap-1 mt-8">
                {NAV_SECTIONS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleNavClick(item)}
                    className="text-left text-base font-medium text-gray-700 hover:text-[#2748bf] hover:bg-[#2748bf]/5 py-3 px-3 rounded-md transition-colors"
                  >
                    {item.label}
                  </button>
                ))}

                <div className="border-t my-3" />

                {userName ? (
                  <>
                    <div className="px-3 py-2 text-sm text-gray-500">
                      สวัสดี, <span className="font-semibold text-[#153c85]">{userName}</span>
                    </div>
                    <Link
                      href="/dashboard"
                      onClick={() => setSheetOpen(false)}
                      className="text-base font-medium text-gray-700 hover:text-[#2748bf] hover:bg-[#2748bf]/5 py-3 px-3 rounded-md transition-colors flex items-center gap-2"
                    >
                      <LayoutDashboard className="h-5 w-5" />
                      แดชบอร์ด
                    </Link>
                    <button
                      onClick={() => { handleLogout(); setSheetOpen(false) }}
                      className="text-left text-base font-medium text-red-600 hover:bg-red-50 py-3 px-3 rounded-md transition-colors flex items-center gap-2"
                    >
                      <LogOut className="h-5 w-5" />
                      ออกจากระบบ
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col gap-2 px-3">
                    <Button
                      className="w-full bg-[#2748bf] hover:bg-[#153c85]"
                      onClick={() => { setSheetOpen(false); openAuth('login') }}
                    >
                      <LogIn className="h-4 w-4 mr-2" />
                      เข้าสู่ระบบ
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-[#2748bf]/30 text-[#2748bf]"
                      onClick={() => { setSheetOpen(false); openAuth('register') }}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      สมัครสมาชิก
                    </Button>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} defaultMode={authMode} />
    </>
  )
}
