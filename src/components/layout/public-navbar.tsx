'use client'

import { useState, useEffect, useCallback, type MouseEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AuthModal } from '@/components/shared/auth-modal'
import { Menu, LogIn, UserPlus, User, LogOut, LayoutDashboard, Loader2 } from 'lucide-react'
import { getHomePathForRole } from '@/lib/auth/redirects'
import type { UserRole } from '@/types/database'

type AuthMode = 'login' | 'register'

const HEADER_OFFSET = 80
const SCROLL_DURATION_MS = 720
const REDUCED_SCROLL_DURATION_MS = 220
const SHEET_SCROLL_DELAY_MS = 180

const easeInOutCubic = (progress: number) => (
  progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2
)

const prefersReducedMotion = () => (
  typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
)

const scrollWindowTo = (targetTop: number) => {
  const startTop = window.scrollY
  const distance = targetTop - startTop

  if (Math.abs(distance) < 8) {
    window.scrollTo({ top: targetTop, behavior: 'auto' })
    return
  }

  const startTime = window.performance.now()
  const duration = prefersReducedMotion() ? REDUCED_SCROLL_DURATION_MS : SCROLL_DURATION_MS

  const step = (currentTime: number) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    window.scrollTo(0, startTop + distance * easeInOutCubic(progress))

    if (progress < 1) {
      window.requestAnimationFrame(step)
    }
  }

  window.requestAnimationFrame(step)
}

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
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [dashboardNavigating, setDashboardNavigating] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    const loadProfile = async (userId?: string, fallbackEmail?: string | null) => {
      if (!userId) {
        if (mounted) {
          setUserName(null)
          setUserRole(null)
          setDashboardNavigating(false)
        }
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', userId)
        .maybeSingle() as { data: { full_name: string | null; role: UserRole } | null }

      if (!mounted) return

      if (profile?.role) {
        setUserName(profile.full_name || fallbackEmail || 'ผู้ใช้')
        setUserRole(profile.role)
      } else {
        setUserName(null)
        setUserRole(null)
      }
    }

    const getUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      await loadProfile(error ? undefined : user?.id, user?.email)
      if (mounted) setLoading(false)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadProfile(session?.user?.id, session?.user?.email)
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode)
    setAuthOpen(true)
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUserName(null)
    setUserRole(null)
    setDashboardNavigating(false)
    router.refresh()
  }

  const handleDashboardNavigation = () => {
    if (!userRole || dashboardNavigating) return
    setDashboardNavigating(true)
    router.push(getHomePathForRole(userRole))
  }

  const scrollToSection = useCallback((id: string, options: { updateHash?: boolean } = {}) => {
    const { updateHash = true } = options
    if (pathname !== '/') {
      router.push(`/#${id}`)
      setSheetOpen(false)
      return
    }
    const scroll = () => {
      const el = document.getElementById(id)
      if (!el) return

      const targetTop = Math.max(0, el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET)
      scrollWindowTo(targetTop)
      if (updateHash) {
        window.history.replaceState(null, '', `#${id}`)
      }
    }

    if (sheetOpen) {
      setSheetOpen(false)
      window.setTimeout(scroll, SHEET_SCROLL_DELAY_MS)
    } else {
      scroll()
    }
  }, [pathname, router, sheetOpen])

  useEffect(() => {
    if (pathname !== '/') return
    const hash = window.location.hash.replace('#', '')
    if (!hash) return

    window.requestAnimationFrame(() => {
      scrollToSection(hash, { updateHash: false })
    })
  }, [pathname, scrollToSection])

  const getSectionHref = (id: string) => pathname === '/' ? `#${id}` : `/#${id}`

  const handleSectionAnchorClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault()
    scrollToSection(id)
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <button
            onClick={() => scrollToSection('hero')}
            className="flex items-center gap-2 rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2748bf] focus-visible:ring-offset-4"
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
            {NAV_SECTIONS.map((item) => {
              const linkClassName = 'rounded-md px-1 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-[#2748bf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2748bf] focus-visible:ring-offset-4'
              const label = (
                <>
                  <span className="hidden xl:inline">{item.label}</span>
                  <span className="xl:hidden">{item.shortLabel || item.label}</span>
                </>
              )

              if ('href' in item && item.href) {
                return (
                  <Link key={item.label} href={item.href} className={linkClassName}>
                    {label}
                  </Link>
                )
              }

              if ('id' in item && item.id) {
                return (
                  <a
                    key={item.label}
                    href={getSectionHref(item.id)}
                    onClick={(event) => handleSectionAnchorClick(event, item.id)}
                    className={linkClassName}
                  >
                    {label}
                  </a>
                )
              }

              return null
            })}

            {loading ? (
              <div className="w-24 h-9 bg-gray-100 rounded-md animate-pulse" />
            ) : userName && userRole ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="border-[#2748bf]/30 text-[#153c85] gap-2">
                    <User className="h-4 w-4" />
                    <span className="max-w-[120px] truncate">{userName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    disabled={dashboardNavigating}
                    onSelect={(event) => {
                      event.preventDefault()
                      handleDashboardNavigation()
                    }}
                  >
                    {dashboardNavigating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <LayoutDashboard className="h-4 w-4 mr-2" />
                    )}
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
              <SheetHeader className="sr-only">
                <SheetTitle>Website navigation</SheetTitle>
                <SheetDescription>Open the New Athlete School website menu to navigate sections, ranking, login, and registration.</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-1 mt-8">
                {NAV_SECTIONS.map((item) => (
                  'href' in item && item.href ? (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => {
                        setSheetOpen(false)
                        if (userRole && item.href === getHomePathForRole(userRole)) {
                          setDashboardNavigating(true)
                        }
                      }}
                      className="text-left text-base font-medium text-gray-700 hover:text-[#2748bf] hover:bg-[#2748bf]/5 py-3 px-3 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2748bf] focus-visible:ring-offset-2"
                    >
                      {item.label}
                    </Link>
                  ) : 'id' in item && item.id ? (
                    <a
                      key={item.label}
                      href={getSectionHref(item.id)}
                      onClick={(event) => handleSectionAnchorClick(event, item.id)}
                      className="text-left text-base font-medium text-gray-700 hover:text-[#2748bf] hover:bg-[#2748bf]/5 py-3 px-3 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2748bf] focus-visible:ring-offset-2"
                    >
                      {item.label}
                    </a>
                  ) : null
                ))}

                <div className="border-t my-3" />

                {userName && userRole ? (
                  <>
                    <div className="px-3 py-2 text-sm text-gray-500">
                      สวัสดี, <span className="font-semibold text-[#153c85]">{userName}</span>
                    </div>
                    <Link
                      href={getHomePathForRole(userRole)}
                      onClick={() => {
                        setSheetOpen(false)
                        setDashboardNavigating(true)
                      }}
                      className="text-base font-medium text-gray-700 hover:text-[#2748bf] hover:bg-[#2748bf]/5 py-3 px-3 rounded-md transition-colors flex items-center gap-2"
                    >
                      {dashboardNavigating ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <LayoutDashboard className="h-5 w-5" />
                      )}
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
