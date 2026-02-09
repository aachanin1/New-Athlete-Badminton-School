'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AuthModal } from '@/components/shared/auth-modal'
import { ArrowRight } from 'lucide-react'

interface RegisterButtonProps {
  variant?: 'hero' | 'cta'
}

export function RegisterButton({ variant = 'hero' }: RegisterButtonProps) {
  const [open, setOpen] = useState(false)

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
