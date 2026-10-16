'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getHomePathForRole } from '@/lib/auth/redirects'
import { readPublicIdentity, type PublicIdentity } from '@/lib/public-identity'
import { AuthModal } from './auth-modal'
import { BrandLoading } from './brand-loading'

type AuthMode = 'login' | 'register'
type Snapshot = { status: 'checking' | 'authenticated' | 'anonymous' | 'recovering'; identity: PublicIdentity | null }
type PublicAuth = Snapshot & {
  navigating: boolean
  enter: (mode?: AuthMode) => void
  loginSucceeded: () => void
  logout: () => void
  cancelEntry: (destination?: string) => void
}
const PublicAuthContext = createContext<PublicAuth | null>(null)
const initial: Snapshot = { status: 'checking', identity: null }

export function usePublicAuth() {
  const value = useContext(PublicAuthContext)
  if (!value) throw new Error('Public auth requires its public-page provider')
  return value
}

export function PublicAuthProvider({ children, initialLoader = true, redirectAuthenticated = false }: { children: React.ReactNode; initialLoader?: boolean; redirectAuthenticated?: boolean }) {
  const router = useRouter()
  const [snapshot, setSnapshot] = useState<Snapshot>(initial)
  const snapshotRef = useRef(snapshot)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [intent, setIntent] = useState<AuthMode | null>(null)
  const intentRef = useRef<AuthMode | null>(null)
  const [navigating, setNavigating] = useState(false)
  const navigatingRef = useRef(false)
  const [transitionPending, startTransition] = useTransition()
  const refreshRef = useRef<(force?: boolean) => void>(() => {})
  const logoutRef = useRef<() => void>(() => {})
  const continueRef = useRef<(next: Snapshot) => void>(() => {})
  const contentRef = useRef<HTMLDivElement>(null)

  const cancelEntry = useCallback((destination?: string) => {
    const wasNavigating = navigatingRef.current
    intentRef.current = null
    setIntent(null)
    navigatingRef.current = false
    setNavigating(false)
    if (wasNavigating && destination) {
      startTransition(() => router.replace(destination, { scroll: false }))
    }
  }, [router])

  const continueEntry = useCallback((next: Snapshot) => {
    const requested = intentRef.current
    if (!requested) return
    if (next.status === 'anonymous') {
      navigatingRef.current = false
      setNavigating(false)
      intentRef.current = null
      setIntent(null)
      setAuthMode(requested)
      setAuthOpen(true)
    } else if (next.identity && !navigatingRef.current && navigator.onLine) {
      intentRef.current = 'login'
      setIntent('login')
      setAuthOpen(false)
      navigatingRef.current = true
      setNavigating(true)
      startTransition(() => router.push(getHomePathForRole(next.identity!.role)))
    }
  }, [router])
  useEffect(() => { continueRef.current = continueEntry }, [continueEntry])

  const enter = useCallback((mode: AuthMode = 'register') => {
    if (navigatingRef.current) return
    intentRef.current = mode
    setIntent(mode)
    continueRef.current(snapshotRef.current)
    if (!snapshotRef.current.identity && snapshotRef.current.status !== 'anonymous') refreshRef.current()
  }, [])

  const loginSucceeded = useCallback(() => {
    setAuthOpen(false)
    intentRef.current = 'login'
    setIntent('login')
    refreshRef.current(true)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let mounted = true
    let generation = 0
    let active: AbortController | null = null
    let retry: ReturnType<typeof setTimeout> | undefined
    let eventTimer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    let lastVerified = 0
    let logoutRequested = false
    let observedUserId: string | null | undefined
    const publish = (next: Snapshot) => {
      if (!mounted) return
      snapshotRef.current = next
      setSnapshot(next)
      if (redirectAuthenticated && next.identity && !intentRef.current) {
        intentRef.current = 'login'
        setIntent('login')
      }
      continueRef.current(next)
    }
    const invalidate = () => {
      generation++
      active?.abort()
      active = null
      clearTimeout(retry)
    }
    const resolve = async (force = false) => {
      if (!mounted || (active && !force)) return
      if (force) invalidate()
      clearTimeout(retry)
      const current = ++generation
      const controller = new AbortController()
      active = controller
      const timeout = setTimeout(() => controller.abort(), 3500)
      try {
        if (!navigator.onLine) throw new Error('Offline')
        if (logoutRequested) {
          const { error } = await supabase.auth.signOut()
          if (error) throw error
          if (!mounted || current !== generation) return
          logoutRequested = false
          publish({ status: 'anonymous', identity: null })
        } else {
          const identity = await readPublicIdentity(supabase, controller.signal)
          if (!mounted || current !== generation || controller.signal.aborted) return
          lastVerified = Date.now()
          failures = 0
          publish({ status: identity ? 'authenticated' : 'anonymous', identity })
        }
      } catch {
        if (!mounted || current !== generation) return
        failures++
        publish({ status: 'recovering', identity: snapshotRef.current.identity })
        retry = setTimeout(() => { void resolve() }, failures <= 3 ? Math.min(500 * 2 ** (failures - 1), 2000) : 15000)
      } finally {
        clearTimeout(timeout)
        if (current === generation) active = null
      }
    }
    refreshRef.current = (force = false) => { void resolve(force) }
    logoutRef.current = () => {
      cancelEntry()
      logoutRequested = true
      invalidate()
      publish({ status: 'checking', identity: null })
      void resolve()
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        observedUserId = null
        invalidate()
        logoutRequested = false
        failures = 0
        publish({ status: 'anonymous', identity: null })
        router.refresh()
        return
      }
      if (logoutRequested) return
      const sessionUserId = session?.user.id ?? null
      const changedUser = (observedUserId !== undefined && observedUserId !== sessionUserId)
        || (snapshotRef.current.identity && sessionUserId !== snapshotRef.current.identity.id)
      observedUserId = sessionUserId
      if (changedUser) {
        invalidate()
        publish({ status: 'checking', identity: null })
      }
      if (event === 'INITIAL_SESSION' || changedUser || !snapshotRef.current.identity) {
        // Leave the Auth callback/lock before performing another SDK read.
        clearTimeout(eventTimer)
        eventTimer = setTimeout(() => { void resolve() }, 0)
      }
    })
    const reconnect = () => { if (!document.hidden) void resolve() }
    const resume = () => {
      if (!document.hidden && (snapshotRef.current.status === 'recovering' || Date.now() - lastVerified > 30000)) void resolve()
    }
    const back = () => cancelEntry()
    window.addEventListener('online', reconnect)
    window.addEventListener('focus', resume)
    window.addEventListener('popstate', back)
    document.addEventListener('visibilitychange', resume)
    void resolve()
    return () => {
      mounted = false
      invalidate()
      clearTimeout(eventTimer)
      subscription.unsubscribe()
      window.removeEventListener('online', reconnect)
      window.removeEventListener('focus', resume)
      window.removeEventListener('popstate', back)
      document.removeEventListener('visibilitychange', resume)
      refreshRef.current = () => {}
      logoutRef.current = () => {}
    }
  }, [cancelEntry, redirectAuthenticated, router])

  // Retry a failed read-only navigation, without another user click. Going back or
  // selecting another destination cancels the intent before this can run again.
  useEffect(() => {
    if (!navigating || transitionPending) return
    const timer = setInterval(() => {
      const identity = snapshotRef.current.identity
      if (navigatingRef.current && intentRef.current && identity && navigator.onLine) {
        startTransition(() => router.replace(getHomePathForRole(identity.role)))
      }
    }, 8500)
    return () => clearInterval(timer)
  }, [navigating, transitionPending, router])

  const waiting = (initialLoader && snapshot.status === 'checking') || intent !== null || navigating
  const [presentation, setPresentation] = useState<'hidden' | 'full' | 'compact'>('hidden')
  useEffect(() => {
    if (!waiting) return
    const show = setTimeout(() => setPresentation('full'), 180)
    const release = setTimeout(() => setPresentation('compact'), 4000)
    return () => { clearTimeout(show); clearTimeout(release); setPresentation('hidden') }
  }, [waiting])
  const fullscreen = waiting && presentation === 'full'
  useEffect(() => {
    const content = contentRef.current
    if (content) content.inert = fullscreen
    return () => { if (content) content.inert = false }
  }, [fullscreen])
  const value = useMemo<PublicAuth>(() => ({
    ...snapshot, navigating: navigating || transitionPending, enter, loginSucceeded, cancelEntry,
    logout: () => logoutRef.current(),
  }), [snapshot, navigating, transitionPending, enter, loginSucceeded, cancelEntry])

  return (
    <PublicAuthContext.Provider value={value}>
      <div ref={contentRef} onClickCapture={(event) => {
        const anchor = (event.target as HTMLElement).closest?.('a')
        if (anchor && intentRef.current) cancelEntry()
      }}>
        {children}
      </div>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} defaultMode={authMode} onAuthenticated={loginSucceeded} />
      {fullscreen && <BrandLoading title={navigating ? 'กำลังพาไปแดชบอร์ด' : 'กำลังเตรียมหน้าเว็บ'} />}
      {!fullscreen && (snapshot.status === 'recovering' || (waiting && presentation === 'compact')) && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[110] -translate-x-1/2 rounded-full border border-[#2748bf]/15 bg-white px-4 py-2 text-xs text-[#153c85] shadow-sm" role="status" aria-live="polite">
          กำลังเชื่อมต่อ…
        </div>
      )}
    </PublicAuthContext.Provider>
  )
}
