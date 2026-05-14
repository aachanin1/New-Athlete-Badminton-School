import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { logActivity } from '@/lib/activity-log'
import type { ComplaintStatus } from '@/types/database'

interface ComplaintPayload {
  complaintId?: string
  status?: ComplaintStatus
  adminNote?: string | null
}

interface DbError {
  message: string
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

export async function PATCH(request: NextRequest) {
  const access = await requireAdminMenuAccess('complaints')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  const admin = access.ctx

  try {
    const { complaintId, status, adminNote } = await request.json() as ComplaintPayload

    if (!complaintId || !status) {
      return NextResponse.json({ error: 'complaintId and status are required' }, { status: 400 })
    }

    const validStatuses: ComplaintStatus[] = ['open', 'in_progress', 'resolved']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const updates: Record<string, string | null> = {
      status,
      admin_note: adminNote?.trim() || null,
      last_updated_by: admin.user.id,
      updated_at: now,
      resolved_by: status === 'resolved' ? admin.user.id : null,
      resolved_at: status === 'resolved' ? now : null,
    }

    const supabaseAdmin = getServiceRoleClient()
    const { error } = await supabaseAdmin
      .from('complaints')
      .update(updates)
      .eq('id', complaintId) as unknown as { error: DbError | null }

    if (error) {
      return NextResponse.json({ error: `อัปเดตไม่สำเร็จ: ${error.message}` }, { status: 500 })
    }

    await logActivity({
      userId: admin.user.id,
      action: 'update_complaint',
      entityType: 'complaint',
      entityId: complaintId,
      details: { status, adminNote: updates.admin_note },
      ipAddress: request.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update complaint error:', error)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${getErrorMessage(error)}` }, { status: 500 })
  }
}
