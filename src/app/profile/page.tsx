import { redirect } from 'next/navigation'
import { ArrowLeft, ShieldCheck, UserCircle } from 'lucide-react'
import Link from 'next/link'

import { ProfileSettingsClient } from '@/components/profile/profile-settings-client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getHomePathForRole } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'

export const dynamic = 'force-dynamic'

interface ProfileRow {
  id: string
  full_name: string | null
  phone: string | null
  email: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

const ROLE_LABELS: Record<UserRole, string> = {
  user: 'User',
  coach: 'Coach',
  head_coach: 'Head Coach',
  admin: 'Admin',
  super_admin: 'Super Admin',
}

export default async function ProfilePage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, phone, email, avatar_url, role, created_at, updated_at')
    .eq('id', user.id)
    .single() as unknown as { data: ProfileRow | null }

  if (!profile) {
    redirect('/auth/login')
  }

  const role = profile.role as UserRole
  const homePath = getHomePathForRole(role)

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#2748bf]">
              <UserCircle className="h-4 w-4" />
              Profile Settings
            </div>
            <h1 className="text-2xl font-bold text-[#153c85] md:text-3xl">โปรไฟล์ของฉัน</h1>
            <p className="mt-1 text-sm text-gray-500">
              จัดการชื่อ เบอร์โทร รูปโปรไฟล์ และรหัสผ่าน โดยอีเมลยังใช้เป็นชื่อผู้ใช้สำหรับเข้าสู่ระบบ
            </p>
          </div>
          <Button asChild variant="outline" className="w-full gap-2 md:w-auto">
            <Link href={homePath}>
              <ArrowLeft className="h-4 w-4" />
              กลับหน้าหลัก
            </Link>
          </Button>
        </div>

        <Card className="mb-5 border-blue-100 bg-blue-50/60">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-white p-2 text-[#2748bf]">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-[#153c85]">อีเมลล็อกไว้เพื่อความปลอดภัย</p>
                <p className="text-sm text-gray-600">
                  หากต้องเปลี่ยนอีเมลเข้าสู่ระบบ ให้ Super Admin จัดการแยกต่างหาก เพื่อไม่กระทบ auth identity
                </p>
              </div>
            </div>
            <Badge className="w-fit bg-white text-[#2748bf] hover:bg-white">{ROLE_LABELS[role]}</Badge>
          </CardContent>
        </Card>

        <ProfileSettingsClient
          initialProfile={{
            id: profile.id,
            fullName: profile.full_name || '',
            phone: profile.phone || '',
            email: profile.email || user.email || '',
            avatarUrl: profile.avatar_url,
            role,
          }}
        />
      </div>
    </main>
  )
}
