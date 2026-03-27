import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminUser } from '@/lib/auth/admin'

// PATCH: Update user role
export async function PATCH(request: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { userId, role } = await request.json()

    if (!userId || !role) {
      return NextResponse.json({ error: 'userId and role are required' }, { status: 400 })
    }

    const validRoles = ['user', 'coach', 'head_coach', 'admin', 'super_admin']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Prevent changing own role
    if (userId === admin.user.id) {
      return NextResponse.json({ error: 'ไม่สามารถเปลี่ยน role ตัวเองได้' }, { status: 400 })
    }

    const adminSupabase = getServiceRoleClient()

    const { data: targetProfile, error: targetErr } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single() as any

    if (targetErr || !targetProfile) {
      return NextResponse.json({ error: 'ไม่พบผู้ใช้ที่ต้องการแก้ไข' }, { status: 404 })
    }

    const elevatedRoles = ['admin', 'super_admin']
    const targetIsElevated = elevatedRoles.includes(targetProfile.role)
    const nextIsElevated = elevatedRoles.includes(role)

    if (admin.role !== 'super_admin' && (targetIsElevated || nextIsElevated)) {
      return NextResponse.json({ error: 'เฉพาะ Super Admin เท่านั้นที่จัดการ role ระดับสูงได้' }, { status: 403 })
    }

    const { error: updateErr } = await adminSupabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)

    if (updateErr) {
      return NextResponse.json({ error: `อัปเดตไม่สำเร็จ: ${updateErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Update user role error:', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${err.message}` }, { status: 500 })
  }
}
