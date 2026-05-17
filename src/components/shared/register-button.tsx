'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AuthModal } from '@/components/shared/auth-modal'
import { ArrowRight, LayoutDashboard, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getHomePathForRole } from '@/lib/auth/redirects'
import type { UserRole } from '@/types/database'

interface RegisterButtonProps {
  variant?: 'hero' | 'cta'
}

export function RegisterButton({ variant = 'hero' }: RegisterButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    const loadRole = async (userId?: string) => {
      if (!userId) {
        if (mounted) setRole(null)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle() as { data: { role: UserRole } | null }

      if (mounted) setRole(profile?.role || null)
    }

    const checkUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      await loadRole(error ? undefined : user?.id)
      if (mounted) setLoading(false)
    }
    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadRole(session?.user?.id)
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div className={variant === 'hero' ? 'w-[220px] h-[52px]' : 'h-[52px] w-[200px]'} />
    )
  }

  if (role) {
    return (
      <Button
        size="lg"
        className={
          variant === 'hero'
            ? 'bg-[#2748bf] hover:bg-[#153c85] text-white text-lg px-8 py-6 w-[220px]'
            : 'bg-white/20 hover:bg-white/30 text-white text-lg px-10 py-6'
        }
        onClick={() => router.push(getHomePathForRole(role))}
      >
        {variant === 'hero' ? (
          <>
            <LayoutDashboard className="mr-2 h-5 w-5" />
            ไปแดชบอร์ด
          </>
        ) : (
          <>
            <Calendar className="mr-2 h-5 w-5" />
            ดูโปรแกรมเรียน
          </>
        )}
      </Button>
    )
  }

  return (
    <>
      <Button
        size="lg"
        className={
          variant === 'hero'
            ? 'bg-[#f57e3b] hover:bg-[#e06a2a] text-white text-lg px-8 py-6 w-[220px]'
            : 'bg-[#f57e3b] hover:bg-[#e06a2a] text-white text-lg px-10 py-6'
        }
        onClick={() => setOpen(true)}
      >
        {variant === 'hero' ? 'สมัครเรียนเลย' : 'สมัครสมาชิกฟรี'}
        <ArrowRight className="ml-2 h-5 w-5" />
      </Button>
      <AuthModal open={open} onOpenChange={setOpen} defaultMode="register" />
    </>
  )
}
