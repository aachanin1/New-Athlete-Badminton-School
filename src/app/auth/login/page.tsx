'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { getHomePathForRole } from '@/lib/auth/redirects'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import type { UserRole } from '@/types/database'

const EMAIL_CONFIRMATION_ERROR =
  'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ หากใช้ Hotmail/Outlook ให้ตรวจสอบ Junk/Spam หรือกดส่งอีเมลยืนยันใหม่'

function getAuthEmailRedirectTo() {
  return `${window.location.origin}/auth/callback?next=/dashboard`
}

function isEmailConfirmationError(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('email not confirmed') || normalized.includes('email_not_confirmed')
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false)
  const busy = loading || redirecting || resending
  const resendBusyLabel = 'กำลังส่งอีเมลยืนยัน...'
  const busyLabel = redirecting ? 'กำลังพาไปหน้าแดชบอร์ด...' : 'กำลังเข้าสู่ระบบ...'

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const callbackError = searchParams.get('error')
    const verified = searchParams.get('verified')

    if (verified === '1') {
      setNotice('ยืนยันอีเมลสำเร็จแล้ว กรุณาเข้าสู่ระบบ')
    }

    if (!callbackError) return

    const needsConfirmation = isEmailConfirmationError(callbackError)
    setNeedsEmailConfirmation(needsConfirmation)
    setError(
      needsConfirmation
        ? EMAIL_CONFIRMATION_ERROR
        : `ยืนยันบัญชีไม่สำเร็จ: ${callbackError}`
    )
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)
    setNeedsEmailConfirmation(false)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo new-athlete-school.jpg"
              alt="New Athlete School"
              width={80}
              height={80}
              className="rounded-full"
            />
          </div>
          <CardTitle className="text-2xl font-bold text-[#153c85]">เข้าสู่ระบบ</CardTitle>
          <CardDescription>New Athlete Badminton School</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
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
                {needsEmailConfirmation && (
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
                        กำลังส่งอีเมลยืนยัน...
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
            <div className="space-y-2">
              <Label htmlFor="email">อีเมล</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={busy}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
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
                'เข้าสู่ระบบ'
              )}
            </Button>
            <p className="text-sm text-gray-500 text-center">
              ยังไม่มีบัญชี?{' '}
              <Link href="/auth/register" className="text-[#2748bf] hover:underline font-medium">
                สมัครสมาชิก
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
