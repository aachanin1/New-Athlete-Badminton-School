'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { getHomePathForRole } from '@/lib/auth/redirects'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import type { UserRole } from '@/types/database'

type AuthMode = 'login' | 'register'

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultMode?: AuthMode
}

const EMAIL_CONFIRMATION_ERROR =
  'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ หากใช้ Hotmail/Outlook ให้ตรวจสอบ Junk/Spam หรือกดส่งอีเมลยืนยันใหม่'

function getAuthEmailRedirectTo() {
  return `${window.location.origin}/auth/callback?next=/dashboard`
}

function isEmailConfirmationError(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('email not confirmed') || normalized.includes('email_not_confirmed')
}

export function AuthModal({ open, onOpenChange, defaultMode = 'login' }: AuthModalProps) {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>(defaultMode)
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (open) {
      setMode(defaultMode)
    }
  }, [open, defaultMode])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false)
  const [success, setSuccess] = useState(false)
  const busy = loading || redirecting || resending
  const resendBusyLabel = 'กำลังส่งอีเมลยืนยัน...'
  const busyLabel = redirecting
    ? 'กำลังพาไปหน้าแดชบอร์ด...'
    : mode === 'login'
      ? 'กำลังเข้าสู่ระบบ...'
      : 'กำลังสมัครสมาชิก...'

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirmPassword(false)
    setFullName('')
    setPhone('')
    setError(null)
    setNotice(null)
    setNeedsEmailConfirmation(false)
    setSuccess(false)
    setLoading(false)
    setRedirecting(false)
    setResending(false)
  }

  const switchMode = (newMode: AuthMode) => {
    resetForm()
    setMode(newMode)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)
    setNeedsEmailConfirmation(false)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      if (isEmailConfirmationError(error.message)) {
        setNeedsEmailConfirmation(true)
        setError(EMAIL_CONFIRMATION_ERROR)
        setLoading(false)
        return
      }
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      setLoading(false)
      return
    }

    const { data: profile } = (await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle()) as { data: { role: UserRole } | null }

    setLoading(false)
    setRedirecting(true)
    router.replace(getHomePathForRole(profile?.role))
    router.refresh()
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน')
      return
    }

    if (password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthEmailRedirectTo(),
        data: { full_name: fullName, phone },
      },
    })

    if (error) {
      setError(
        error.message === 'User already registered'
          ? 'อีเมลนี้ถูกใช้งานแล้ว'
          : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
      )
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  const handleResendConfirmation = async () => {
    const targetEmail = email.trim()
    setError(null)
    setNotice(null)

    if (!targetEmail) {
      setNeedsEmailConfirmation(true)
      setError('กรุณากรอกอีเมลก่อนส่งลิงก์ยืนยันใหม่')
      return
    }

    setResending(true)

    const supabase = createClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: targetEmail,
      options: {
        emailRedirectTo: getAuthEmailRedirectTo(),
      },
    })

    setResending(false)

    if (error) {
      setError(`ส่งอีเมลยืนยันใหม่ไม่สำเร็จ: ${error.message}`)
      return
    }

    setNeedsEmailConfirmation(false)
    setNotice('ส่งอีเมลยืนยันใหม่แล้ว กรุณาตรวจสอบ Inbox/Junk/Spam แล้วกดยืนยันอีกครั้ง')
  }

  const handleOpenChange = (v: boolean) => {
    if (!v && busy) return
    if (!v) resetForm()
    onOpenChange(v)
  }

  // Success state after register
  if (success) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✅</span>
            </div>
            <DialogTitle className="text-2xl font-bold text-[#153c85] mb-2">
              สมัครสมาชิกสำเร็จ!
            </DialogTitle>
            <DialogDescription className="mb-6">
              กรุณาตรวจสอบอีเมลของคุณเพื่อยืนยันบัญชี
            </DialogDescription>
            <Button
              className="w-full bg-[#2748bf] hover:bg-[#153c85]"
              onClick={() => {
                setSuccess(false)
                switchMode('login')
              }}
            >
              ไปหน้าเข้าสู่ระบบ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center items-center">
          <Image
            src="/logo new-athlete-school.jpg"
            alt="New Athlete School"
            width={64}
            height={64}
            className="rounded-full mb-2"
          />
          <DialogTitle className="text-2xl font-bold text-[#153c85]">
            {mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
          </DialogTitle>
          <DialogDescription>New Athlete Badminton School</DialogDescription>
        </DialogHeader>

        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4 mt-2">
          {redirecting && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-[#153c85]">
              <div className="flex items-center gap-2 font-semibold">
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังพาไปหน้าแดชบอร์ด...
              </div>
              <p className="mt-1 text-xs text-blue-700">ระบบกำลังตรวจสิทธิ์และเปิดหน้าที่เหมาะกับบัญชีของคุณ</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-200">
              {error}
              {mode === 'login' && needsEmailConfirmation && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full border-red-200 bg-white text-red-700 hover:bg-red-50"
                  onClick={handleResendConfirmation}
                  disabled={busy}
                >
                  {resending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {resendBusyLabel}
                    </>
                  ) : (
                    'ส่งอีเมลยืนยันใหม่'
                  )}
                </Button>
              )}
            </div>
          )}
          {notice && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {notice}
            </div>
          )}

          {mode === 'register' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="modal-fullName">ชื่อ-นามสกุล</Label>
                <Input
                  id="modal-fullName"
                  type="text"
                  placeholder="ชื่อ นามสกุล"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={busy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-phone">เบอร์โทรศัพท์</Label>
                <Input
                  id="modal-phone"
                  type="tel"
                  placeholder="0812345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  disabled={busy}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="modal-email">อีเมล</Label>
            <Input
              id="modal-email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="modal-password">รหัสผ่าน</Label>
            <div className="relative">
              <Input
                id="modal-password"
                type={showPassword ? 'text' : 'password'}
                placeholder={mode === 'register' ? 'อย่างน้อย 6 ตัวอักษร' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={busy}
                className="pr-10"
              />
              <button
                type="button"
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setShowPassword((value) => !value)}
                disabled={busy}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div className="space-y-2">
              <Label htmlFor="modal-confirmPassword">ยืนยันรหัสผ่าน</Label>
              <div className="relative">
                <Input
                  id="modal-confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={busy}
                  className="pr-10"
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? 'ซ่อนรหัสผ่านยืนยัน' : 'แสดงรหัสผ่านยืนยัน'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  disabled={busy}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-[#2748bf] hover:bg-[#153c85]"
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {resending ? resendBusyLabel : busyLabel}
              </>
            ) : (
              mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'
            )}
          </Button>

          <p className="text-sm text-gray-500 text-center">
            {mode === 'login' ? (
              <>
                ยังไม่มีบัญชี?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  disabled={busy}
                  className="text-[#2748bf] hover:underline font-medium disabled:pointer-events-none disabled:opacity-60"
                >
                  สมัครสมาชิก
                </button>
              </>
            ) : (
              <>
                มีบัญชีอยู่แล้ว?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  disabled={busy}
                  className="text-[#2748bf] hover:underline font-medium disabled:pointer-events-none disabled:opacity-60"
                >
                  เข้าสู่ระบบ
                </button>
              </>
            )}
          </p>
        </form>
      </DialogContent>
    </Dialog>
  )
}
