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

// PATCH: Update complaint status (open → in_progress → resolved)
export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { complaintId, status } = await request.json()

    if (!complaintId || !status) {
      return NextResponse.json({ error: 'complaintId and status are required' }, { status: 400 })
    }

    const validStatuses = ['open', 'in_progress', 'resolved']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const adminSupabase = getAdminSupabase()

    const updates: Record<string, any> = { status }
    if (status === 'resolved') {
      updates.resolved_by = admin.id
      updates.resolved_at = new Date().toISOString()
    }

    const { error: updateErr } = await adminSupabase
      .from('complaints')
      .update(updates)
      .eq('id', complaintId)

    if (updateErr) {
      return NextResponse.json({ error: `อัปเดตไม่สำเร็จ: ${updateErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Update complaint error:', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${err.message}` }, { status: 500 })
  }
}
