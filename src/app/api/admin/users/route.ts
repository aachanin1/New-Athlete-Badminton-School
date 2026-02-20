import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createAdminClient(url, serviceKey)
}

async function requireAdmin(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as any
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) return null
  return user
}

// PATCH: Update user role
export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const admin = await requireAdmin(supabase)
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
    if (userId === admin.id) {
      return NextResponse.json({ error: 'ไม่สามารถเปลี่ยน role ตัวเองได้' }, { status: 400 })
    }

    const adminSupabase = getAdminSupabase()
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
