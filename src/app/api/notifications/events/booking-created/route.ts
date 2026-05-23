import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { notifyRoles, notifyUser } from '@/lib/notifications'
import type { Database } from '@/types/database'

interface BookingCreatedPayload {
  bookingId?: string
  targetUserId?: string
  totalSessions?: number
  totalPrice?: number
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
    const { bookingId, targetUserId, totalSessions, totalPrice } = await request.json() as BookingCreatedPayload

    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 })
    }

    const adminSupabase = getServiceRoleClient()
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle() as unknown as { data: ProfileRow | null }

    const sessionText = totalSessions ? ` ${totalSessions} ครั้ง` : ''
    const priceText = totalPrice ? ` - ฿${Number(totalPrice).toLocaleString('th-TH')}` : ''
    const notificationClient = adminSupabase as unknown as SupabaseClient<Database>

    await notifyRoles(notificationClient, {
      roles: ['admin', 'super_admin'],
      title: 'มีการจองใหม่',
      message: `${profile?.full_name || 'ผู้ใช้'} สร้างการจองใหม่${sessionText}${priceText}`,
      type: 'schedule',
      link_url: '/admin/schedules',
    })

    if (targetUserId && targetUserId !== user.id) {
      await notifyUser(notificationClient, {
        user_id: targetUserId,
        title: 'มีการจองใหม่ในระบบ',
        message: `มีการสร้างการจองให้คุณแล้ว${sessionText}`,
        type: 'schedule',
        link_url: '/dashboard/history',
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
