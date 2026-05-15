import { NextRequest, NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity-log'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import type { UserRole } from '@/types/database'

type UserAction = 'update_profile' | 'update_role' | 'reset_password'

interface AdminUserPayload {
  action?: UserAction
  userId?: string
  fullName?: string
  phone?: string | null
  role?: UserRole
  password?: string
}

interface TargetProfileRow {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  role: UserRole
}

interface DbError {
  message: string
}

const VALID_ROLES: UserRole[] = ['user', 'coach', 'head_coach', 'admin', 'super_admin']

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

function isElevated(role: UserRole | string | null | undefined) {
  return role === 'admin' || role === 'super_admin'
}

function cleanPhone(phone: string | null | undefined) {
  const value = phone?.trim()
  return value || null
}

async function getTargetProfile(adminSupabase: ReturnType<typeof getServiceRoleClient>, userId: string) {
  const { data, error } = await adminSupabase
    .from('profiles')
    .select('id, full_name, email, phone, role')
    .eq('id', userId)
    .single() as unknown as { data: TargetProfileRow | null; error: DbError | null }

  return { data, error }
}

export async function PATCH(request: NextRequest) {
  const access = await requireAdminMenuAccess('users')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  const admin = access.ctx

  try {
    const payload = await request.json() as AdminUserPayload
    const action = payload.action || 'update_role'

    if (!payload.userId) {
      return NextResponse.json({ error: 'กรุณาระบุผู้ใช้ที่ต้องการจัดการ' }, { status: 400 })
    }

    const adminSupabase = getServiceRoleClient()
    const { data: targetProfile, error: targetErr } = await getTargetProfile(adminSupabase, payload.userId)

    if (targetErr || !targetProfile) {
      return NextResponse.json({ error: 'ไม่พบผู้ใช้ที่ต้องการแก้ไข' }, { status: 404 })
    }

    if (admin.role !== 'super_admin' && isElevated(targetProfile.role)) {
      return NextResponse.json({ error: 'เฉพาะ Super Admin เท่านั้นที่จัดการผู้ใช้ระดับ Admin ได้' }, { status: 403 })
    }

    if (action === 'update_profile') {
      const fullName = payload.fullName?.trim()

      if (!fullName) {
        return NextResponse.json({ error: 'กรุณากรอกชื่อผู้ใช้' }, { status: 400 })
      }

      const updates = {
        full_name: fullName,
        phone: cleanPhone(payload.phone),
      }

      const { error: updateErr } = await adminSupabase
        .from('profiles')
        .update(updates)
        .eq('id', payload.userId) as unknown as { error: DbError | null }

      if (updateErr) {
        return NextResponse.json({ error: `บันทึกข้อมูลไม่สำเร็จ: ${updateErr.message}` }, { status: 500 })
      }

      await adminSupabase.auth.admin.updateUserById(payload.userId, {
        user_metadata: { full_name: fullName, phone: updates.phone },
      })

      await logActivity({
        userId: admin.user.id,
        action: 'admin_update_user_profile',
        entityType: 'profile',
        entityId: payload.userId,
        details: { fullName, phone: updates.phone, emailLocked: true },
        ipAddress: request.headers.get('x-forwarded-for'),
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'update_role') {
      const nextRole = payload.role

      if (!nextRole || !VALID_ROLES.includes(nextRole)) {
        return NextResponse.json({ error: 'Role ไม่ถูกต้อง' }, { status: 400 })
      }

      if (payload.userId === admin.user.id) {
        return NextResponse.json({ error: 'ไม่สามารถเปลี่ยน role ของตัวเองได้' }, { status: 400 })
      }

      if (admin.role !== 'super_admin' && (isElevated(targetProfile.role) || isElevated(nextRole))) {
        return NextResponse.json({ error: 'เฉพาะ Super Admin เท่านั้นที่จัดการ role ระดับสูงได้' }, { status: 403 })
      }

      const { error: updateErr } = await adminSupabase
        .from('profiles')
        .update({ role: nextRole })
        .eq('id', payload.userId) as unknown as { error: DbError | null }

      if (updateErr) {
        return NextResponse.json({ error: `เปลี่ยน role ไม่สำเร็จ: ${updateErr.message}` }, { status: 500 })
      }

      await logActivity({
        userId: admin.user.id,
        action: 'admin_update_user_role',
        entityType: 'profile',
        entityId: payload.userId,
        details: { previousRole: targetProfile.role, nextRole },
        ipAddress: request.headers.get('x-forwarded-for'),
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'reset_password') {
      const password = payload.password || ''

      if (payload.userId === admin.user.id) {
        return NextResponse.json({ error: 'กรุณาเปลี่ยนรหัสผ่านของตัวเองผ่านหน้าโปรไฟล์ของฉัน' }, { status: 400 })
      }

      if (password.length < 6) {
        return NextResponse.json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' }, { status: 400 })
      }

      const { error: authError } = await adminSupabase.auth.admin.updateUserById(payload.userId, {
        password,
      })

      if (authError) {
        return NextResponse.json({ error: `ตั้งรหัสผ่านใหม่ไม่สำเร็จ: ${authError.message}` }, { status: 500 })
      }

      await logActivity({
        userId: admin.user.id,
        action: 'admin_reset_user_password',
        entityType: 'profile',
        entityId: payload.userId,
        details: { targetEmail: targetProfile.email },
        ipAddress: request.headers.get('x-forwarded-for'),
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Action ไม่ถูกต้อง' }, { status: 400 })
  } catch (error) {
    console.error('Admin user management error:', error)
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
