'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight, LayoutDashboard, Calendar, Loader2 } from 'lucide-react'
import { usePublicAuth } from './public-auth-provider'

interface RegisterButtonProps {
  variant?: 'hero' | 'cta'
}

export function RegisterButton({ variant = 'hero' }: RegisterButtonProps) {
  const { identity, status, navigating, enter } = usePublicAuth()
  const knownGuest = status === 'anonymous'
  const text = identity
    ? variant === 'hero' ? 'ไปแดชบอร์ด' : 'ดูโปรแกรมเรียน'
    : knownGuest ? variant === 'hero' ? 'สมัครเรียนเลย' : 'สมัครสมาชิกฟรี' : 'เข้าใช้งาน'

  return (
    <Button
      size="lg"
      disabled={navigating}
      aria-busy={navigating}
      className={variant === 'hero'
        ? `${identity ? 'bg-[#2748bf] hover:bg-[#153c85]' : 'bg-[#f57e3b] hover:bg-[#e06a2a]'} text-white text-lg px-8 py-6 w-[220px] disabled:opacity-90`
        : `${identity ? 'bg-white/20 hover:bg-white/30' : 'bg-[#f57e3b] hover:bg-[#e06a2a]'} text-white text-lg px-10 py-6 disabled:opacity-90`}
      onClick={() => enter(knownGuest ? 'register' : 'login')}
    >
      {navigating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        : identity ? variant === 'hero' ? <LayoutDashboard className="mr-2 h-5 w-5" /> : <Calendar className="mr-2 h-5 w-5" />
          : null}
      {navigating ? 'กำลังโหลด…' : text}
      {!identity && !navigating && <ArrowRight className="ml-2 h-5 w-5" />}
    </Button>
  )
}
