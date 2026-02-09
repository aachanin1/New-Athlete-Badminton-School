'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
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
import { Loader2 } from 'lucide-react'

type AuthMode = 'login' | 'register'

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultMode?: AuthMode
}

export function AuthModal({ open, onOpenChange, defaultMode = 'login' }: AuthModalProps) {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>(defaultMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setFullName('')
    setPhone('')
    setError(null)
    setSuccess(false)
    setLoading(false)
  }

  const switchMode = (newMode: AuthMode) => {
    resetForm()
    setMode(newMode)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      setLoading(false)
      return
    }

    onOpenChange(false)
    resetForm()
    router.push('/dashboard')
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

  const handleOpenChange = (v: boolean) => {
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
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-200">
              {error}
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
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="modal-password">รหัสผ่าน</Label>
            <Input
              id="modal-password"
              type="password"
              placeholder={mode === 'register' ? 'อย่างน้อย 6 ตัวอักษร' : '••••••••'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {mode === 'register' && (
            <div className="space-y-2">
              <Label htmlFor="modal-confirmPassword">ยืนยันรหัสผ่าน</Label>
              <Input
                id="modal-confirmPassword"
                type="password"
                placeholder="กรอกรหัสผ่านอีกครั้ง"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-[#2748bf] hover:bg-[#153c85]"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === 'login' ? 'กำลังเข้าสู่ระบบ...' : 'กำลังสมัครสมาชิก...'}
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
                  className="text-[#2748bf] hover:underline font-medium"
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
                  className="text-[#2748bf] hover:underline font-medium"
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
