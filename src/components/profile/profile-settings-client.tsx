'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Camera, Eye, EyeOff, Loader2, LockKeyhole, Mail, Phone, Save, UserRound } from 'lucide-react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types/database'

interface ProfileFormData {
  id: string
  fullName: string
  phone: string
  email: string
  avatarUrl: string | null
  role: UserRole
}

interface ProfileSettingsClientProps {
  initialProfile: ProfileFormData
}

interface ProfileUpdateQuery {
  update(values: {
    full_name: string
    phone: string | null
    avatar_url: string | null
  }): {
    eq(column: 'id', value: string): Promise<{ error: { message: string } | null }>
  }
}

function getInitials(name: string, email: string) {
  const value = name.trim() || email.trim()
  return value.slice(0, 2).toUpperCase() || 'NA'
}

function isValidImage(file: File) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
}

export function ProfileSettingsClient({ initialProfile }: ProfileSettingsClientProps) {
  const router = useRouter()
  const [fullName, setFullName] = useState(initialProfile.fullName)
  const [phone, setPhone] = useState(initialProfile.phone)
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatarUrl)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialProfile.avatarUrl)
  const [savingProfile, setSavingProfile] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const initials = useMemo(
    () => getInitials(fullName, initialProfile.email),
    [fullName, initialProfile.email],
  )

  const handleAvatarChange = (file: File | undefined) => {
    if (!file) return

    if (!isValidImage(file)) {
      toast.error('รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP')
      return
    }

    if (file.size > 3 * 1024 * 1024) {
      toast.error('รูปโปรไฟล์ต้องไม่เกิน 3 MB')
      return
    }

    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSaveProfile = async () => {
    const cleanName = fullName.trim()
    const cleanPhone = phone.trim()

    if (!cleanName) {
      toast.error('กรุณากรอกชื่อผู้ใช้')
      return
    }

    setSavingProfile(true)
    const supabase = createClient()

    try {
      let nextAvatarUrl = avatarUrl

      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const filePath = `profiles/${initialProfile.id}/${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, {
            cacheControl: '3600',
            contentType: avatarFile.type,
            upsert: true,
          })

        if (uploadError) {
          throw new Error(uploadError.message)
        }

        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
        nextAvatarUrl = data.publicUrl
      }

      const { error } = await (supabase.from('profiles') as unknown as ProfileUpdateQuery)
        .update({
          full_name: cleanName,
          phone: cleanPhone || null,
          avatar_url: nextAvatarUrl,
        })
        .eq('id', initialProfile.id)

      if (error) {
        throw new Error(error.message)
      }

      setAvatarUrl(nextAvatarUrl)
      setAvatarFile(null)
      toast.success('บันทึกโปรไฟล์เรียบร้อย')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'บันทึกโปรไฟล์ไม่สำเร็จ')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('กรุณากรอกรหัสผ่านใหม่และยืนยันรหัสผ่าน')
      return
    }

    if (newPassword.length < 6) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('รหัสผ่านยืนยันไม่ตรงกัน')
      return
    }

    setSavingPassword(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })

      if (error) {
        throw new Error(error.message)
      }

      setNewPassword('')
      setConfirmPassword('')
      toast.success('เปลี่ยนรหัสผ่านเรียบร้อย')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เปลี่ยนรหัสผ่านไม่สำเร็จ')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[#153c85]">
            <UserRound className="h-5 w-5 text-[#2748bf]" />
            ข้อมูลโปรไฟล์
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-4 rounded-lg border bg-gray-50 p-4 sm:flex-row sm:items-center">
            <Avatar className="h-20 w-20 border-4 border-white shadow-sm">
              {avatarPreview && <AvatarImage src={avatarPreview} alt={fullName || initialProfile.email} className="object-cover" />}
              <AvatarFallback className="bg-[#2748bf]/10 text-lg font-bold text-[#153c85]">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900">รูปโปรไฟล์</p>
              <p className="mt-1 text-sm text-gray-500">ใช้แสดงบนโปรไฟล์และ Ranking ตามข้อมูลที่ระบบดึงได้</p>
              <div className="mt-3">
                <Label
                  htmlFor="profile-avatar"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-medium text-[#2748bf] shadow-sm transition hover:bg-blue-50"
                >
                  <Camera className="h-4 w-4" />
                  เลือกรูป
                </Label>
                <Input
                  id="profile-avatar"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => handleAvatarChange(event.target.files?.[0])}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full-name">ชื่อผู้ใช้</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="ชื่อ-นามสกุล"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">เบอร์โทร</Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="08x-xxx-xxxx"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">อีเมลสำหรับเข้าสู่ระบบ</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input id="email" value={initialProfile.email} disabled readOnly className="pl-9" />
            </div>
          </div>

          <Button onClick={handleSaveProfile} disabled={savingProfile} className="w-full bg-[#2748bf] hover:bg-[#153c85] sm:w-auto">
            {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            บันทึกโปรไฟล์
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-[#153c85]">
              <LockKeyhole className="h-5 w-5 text-[#f57e3b]" />
              เปลี่ยนรหัสผ่าน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">รหัสผ่านใหม่</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</Label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="กรอกซ้ำอีกครั้ง"
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={savingPassword}
              variant="outline"
              className="w-full border-[#f57e3b]/40 text-[#f57e3b] hover:bg-orange-50 hover:text-[#f57e3b]"
            >
              {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
              บันทึกรหัสผ่าน
            </Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <div
            className="h-28 bg-gradient-to-br from-[#153c85] via-[#2748bf] to-[#f57e3b]"
            style={avatarPreview ? {
              backgroundImage: `linear-gradient(135deg, rgba(21,60,133,0.82), rgba(39,72,191,0.78), rgba(245,126,59,0.72)), url(${avatarPreview})`,
              backgroundPosition: 'center',
              backgroundSize: 'cover',
            } : undefined}
          >
          </div>
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="text-sm text-gray-500">Preview</p>
              <p className="truncate text-lg font-bold text-[#153c85]">{fullName || initialProfile.email}</p>
              <p className="truncate text-sm text-gray-500">{initialProfile.email}</p>
            </div>
            <Separator />
            <p className="text-xs text-gray-500">ข้อมูลนี้จะถูกใช้ร่วมกับระบบหลังบ้านและหน้าที่ต้องแสดงตัวตนผู้ใช้</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
