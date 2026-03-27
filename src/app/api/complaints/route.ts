import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { notifyRoles } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { branch_id, subject, message } = await request.json()

    if (!branch_id || !subject?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
    }

    const adminSupabase = getServiceRoleClient()

    const { data: complaint, error } = await (adminSupabase.from('complaints') as any)
      .insert({
        user_id: user.id,
        branch_id,
        subject: subject.trim(),
        message: message.trim(),
        status: 'open',
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: profile } = await ((adminSupabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()) as any)

    await notifyRoles(adminSupabase as any, {
      roles: ['admin', 'super_admin'],
      title: 'มีเรื่องร้องเรียนใหม่',
      message: `${profile?.full_name || 'ผู้ใช้'} ส่งเรื่องร้องเรียน: ${subject.trim()}`,
      type: 'complaint',
      link_url: '/admin/complaints',
    })

    return NextResponse.json({ success: true, complaintId: complaint.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
