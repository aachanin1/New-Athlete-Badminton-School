import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { notifyCoachesByBranch, notifyRoles } from '@/lib/notifications'
import type { Database } from '@/types/database'

interface RescheduleNotificationPayload {
  sessionId?: string
  oldBranchId?: string | null
  newBranchId?: string
  newDate?: string
  newStartTime?: string
}

interface ProfileRow {
  full_name: string | null
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { oldBranchId, newBranchId, newDate, newStartTime } = await request.json() as RescheduleNotificationPayload

    if (!newBranchId || !newDate || !newStartTime) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบสำหรับการแจ้งเตือนเปลี่ยนวัน/สาขา' }, { status: 400 })
    }

    const adminSupabase = getServiceRoleClient()
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle() as unknown as { data: ProfileRow | null }

    const message = `${profile?.full_name || 'ผู้ใช้'} เปลี่ยนวันเรียนเป็น ${newDate} ${newStartTime}`
    const notificationClient = adminSupabase as unknown as SupabaseClient<Database>

    await notifyRoles(notificationClient, {
      roles: ['admin', 'super_admin'],
      title: 'มีการเปลี่ยนวัน/สาขา',
      message,
      type: 'schedule',
      link_url: '/admin/schedules',
    })

    await notifyCoachesByBranch(notificationClient, newBranchId, {
      title: 'มีการเปลี่ยนวัน/สาขา',
      message,
      type: 'schedule',
      link_url: '/coach/today',
    })

    if (oldBranchId && oldBranchId !== newBranchId) {
      await notifyCoachesByBranch(notificationClient, oldBranchId, {
        title: 'มีการเปลี่ยนวัน/สาขา',
        message,
        type: 'schedule',
        link_url: '/coach/today',
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
