import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { logActivity } from '@/lib/activity-log'
import type { NotificationType, UserRole } from '@/types/database'

interface NotificationUserRow {
  id: string
  role: UserRole
}

const VALID_TYPES: NotificationType[] = ['payment', 'schedule', 'reminder', 'complaint', 'system']

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

function resolveTargetRoles(targetMode: string): UserRole[] | null {
  if (targetMode === 'students') return ['user']
  if (targetMode === 'coaches') return ['coach', 'head_coach']
  if (targetMode === 'admins') return ['admin', 'super_admin']
  if (targetMode === 'all_users') return ['user', 'coach', 'head_coach', 'admin', 'super_admin']
  return null
}

export async function POST(request: NextRequest) {
  const access = await requireAdminMenuAccess('notifications')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  const admin = access.ctx

  try {
    const supabaseAdmin = getServiceRoleClient()
    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    const targetMode = typeof body.targetMode === 'string' ? body.targetMode : (body.user_id ? 'specific' : 'all_users')
    const userId = typeof body.user_id === 'string' ? body.user_id : null
    const requestedType = typeof body.type === 'string' ? body.type : 'system'
    const type = VALID_TYPES.includes(requestedType as NotificationType) ? requestedType as NotificationType : 'system'
    const linkUrl = typeof body.link_url === 'string' && body.link_url.trim() ? body.link_url.trim() : null

    if (!title || !message) {
      return NextResponse.json({ error: 'กรุณากรอกหัวข้อและข้อความ' }, { status: 400 })
    }

    let recipients: NotificationUserRow[] = []

    if (targetMode === 'specific') {
      if (!userId || userId === 'all') {
        return NextResponse.json({ error: 'กรุณาเลือกผู้รับ' }, { status: 400 })
      }

      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('id', userId)
        .single() as unknown as { data: NotificationUserRow | null; error: { message: string } | null }

      if (error || !profile) {
        return NextResponse.json({ error: 'ไม่พบผู้รับแจ้งเตือน' }, { status: 404 })
      }

      recipients = [profile]
    } else {
      const targetRoles = resolveTargetRoles(targetMode)
      if (!targetRoles) {
        return NextResponse.json({ error: 'กลุ่มผู้รับไม่ถูกต้อง' }, { status: 400 })
      }

      const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .in('role', targetRoles) as unknown as { data: NotificationUserRow[] | null; error: { message: string } | null }

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      recipients = profiles || []
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'ไม่พบผู้รับในกลุ่มที่เลือก' }, { status: 400 })
    }

    const { error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert(recipients.map((recipient) => ({
        user_id: recipient.id,
        title,
        message,
        type,
        link_url: linkUrl,
      })))

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    await logActivity({
      userId: admin.user.id,
      action: 'send_notification',
      entityType: 'notification',
      entityId: null,
      details: {
        targetMode,
        recipient_count: recipients.length,
        type,
        title,
        link_url: linkUrl,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ success: true, sent_to: recipients.length })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requireAdminMenuAccess('notifications')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  const admin = access.ctx

  try {
    const { action, notificationId, markAll } = await request.json()

    if (action !== 'mark_read') {
      return NextResponse.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 })
    }

    const supabaseAdmin = getServiceRoleClient()
    let query = supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', admin.user.id)

    if (markAll) {
      query = query.eq('is_read', false)
    } else if (notificationId) {
      query = query.eq('id', notificationId)
    } else {
      return NextResponse.json({ error: 'กรุณาระบุ notificationId หรือ markAll' }, { status: 400 })
    }

    const { error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
