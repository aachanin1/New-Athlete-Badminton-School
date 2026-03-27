import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { notifyCoachesByBranch, notifyRoles } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { sessionId, oldBranchId, newBranchId, newDate, newStartTime } = await request.json()

    if (!sessionId || !newBranchId || !newDate || !newStartTime) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบสำหรับการแจ้งเตือนเปลี่ยนวัน/สาขา' }, { status: 400 })
    }

    const adminSupabase = getServiceRoleClient()
    const { data: profile } = await ((adminSupabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()) as any)

    const message = `${profile?.full_name || 'ผู้ใช้'} เปลี่ยนวันเรียนเป็น ${newDate} ${newStartTime}`

    await notifyRoles(adminSupabase as any, {
      roles: ['admin', 'super_admin'],
      title: 'มีการเปลี่ยนวัน/สาขา',
      message,
      type: 'schedule',
      link_url: '/admin',
    })

    await notifyCoachesByBranch(adminSupabase as any, newBranchId, {
      title: 'มีการเปลี่ยนวัน/สาขา',
      message,
      type: 'schedule',
      link_url: '/coach/today',
    })

    if (oldBranchId && oldBranchId !== newBranchId) {
      await notifyCoachesByBranch(adminSupabase as any, oldBranchId, {
        title: 'มีการเปลี่ยนวัน/สาขา',
        message,
        type: 'schedule',
        link_url: '/coach/today',
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
