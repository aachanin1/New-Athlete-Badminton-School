import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { notifyRoles, notifyUser } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { bookingId, targetUserId, totalSessions, totalPrice } = await request.json()

    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 })
    }

    const adminSupabase = getServiceRoleClient()
    const { data: profile } = await ((adminSupabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()) as any)

    await notifyRoles(adminSupabase as any, {
      roles: ['admin', 'super_admin'],
      title: 'มีการจองใหม่',
      message: `${profile?.full_name || 'ผู้ใช้'} สร้างการจองใหม่${totalSessions ? ` ${totalSessions} ครั้ง` : ''}${totalPrice ? ` • ฿${Number(totalPrice).toLocaleString('th-TH')}` : ''}`,
      type: 'schedule',
      link_url: '/admin',
    })

    if (targetUserId && targetUserId !== user.id) {
      await notifyUser(adminSupabase as any, {
        user_id: targetUserId,
        title: 'มีการจองใหม่ในระบบ',
        message: `มีการสร้างการจองให้คุณแล้ว${totalSessions ? ` ${totalSessions} ครั้ง` : ''}`,
        type: 'schedule',
        link_url: '/dashboard/history',
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
