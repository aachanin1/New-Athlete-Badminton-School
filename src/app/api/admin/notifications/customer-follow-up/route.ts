import { NextRequest, NextResponse } from 'next/server'
import { logActivity } from '@/lib/activity-log'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { normalizeFollowUpWorkspaceSnapshot } from '@/lib/admin-notification-recommendations'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const FORGED_SOURCE_KEYS = [
  'batch_id',
  'batchId',
  'notification_id',
  'notificationId',
  'source',
  'source_marker',
  'sourceMarker',
  'verified',
]

interface RpcError {
  code?: string
  message: string
}

function errorStatus(error: RpcError) {
  if (error.code === '42501') return 403
  if (error.code === '23505') return 409
  if (error.code === 'P0002') return 409
  if (error.code === '22023') return 409
  return 500
}

async function readWorkspace() {
  const service = getServiceRoleClient()
  const { data, error } = await service.rpc('admin_notification_follow_up_workspace_v1')
  if (error) throw error
  return normalizeFollowUpWorkspaceSnapshot(data)
}

export async function GET() {
  const access = await requireAdminMenuAccess('notifications')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })

  try {
    return NextResponse.json({ workspace: await readWorkspace() })
  } catch (error) {
    const rpcError = error as RpcError
    return NextResponse.json(
      { error: rpcError.message || 'โหลดคิวติดตามลูกค้าไม่สำเร็จ' },
      { status: errorStatus(rpcError) }
    )
  }
}

export async function POST(request: NextRequest) {
  const access = await requireAdminMenuAccess('notifications')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })

  try {
    const body = await request.json() as Record<string, unknown>
    if (FORGED_SOURCE_KEYS.some((key) => Object.prototype.hasOwnProperty.call(body, key))) {
      return NextResponse.json({ error: 'ไม่รับ source marker หรือ batch identity จาก Client' }, { status: 400 })
    }

    const action = typeof body.action === 'string' ? body.action : ''
    const service = getServiceRoleClient()

    if (action === 'start_batch' || action === 'load_next') {
      const { error } = await service.rpc('admin_notification_follow_up_start_batch_v1', {
        p_actor_id: access.ctx.user.id,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: errorStatus(error) })

      await logActivity({
        userId: access.ctx.user.id,
        action: action === 'start_batch' ? 'start_customer_follow_up_batch' : 'load_next_customer_follow_up_batch',
        entityType: 'admin_notification_follow_up_batch',
        details: { source: 'admin_notification_recommendations' },
        ipAddress: request.headers.get('x-forwarded-for'),
      })
      return NextResponse.json({ workspace: await readWorkspace() })
    }

    if (action !== 'send') {
      return NextResponse.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 })
    }

    const requestKey = typeof body.requestKey === 'string' ? body.requestKey : ''
    const rawUserIds = Array.isArray(body.userIds) ? body.userIds : []
    const userIds = rawUserIds.filter((value): value is string => typeof value === 'string')
    if (!UUID_PATTERN.test(requestKey)) {
      return NextResponse.json({ error: 'requestKey ไม่ถูกต้อง' }, { status: 400 })
    }
    if (
      userIds.length !== rawUserIds.length
      || userIds.length < 1
      || userIds.length > 10
      || new Set(userIds).size !== userIds.length
      || userIds.some((userId) => !UUID_PATTERN.test(userId))
    ) {
      return NextResponse.json({ error: 'เลือกผู้รับได้ 1–10 รายและห้ามซ้ำ' }, { status: 400 })
    }

    const { data, error } = await service.rpc('admin_notification_follow_up_send_v1', {
      p_actor_id: access.ctx.user.id,
      p_request_key: requestKey,
      p_user_ids: userIds,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: errorStatus(error) })

    await logActivity({
      userId: access.ctx.user.id,
      action: userIds.length === 1 ? 'send_customer_follow_up_notification' : 'bulk_send_customer_follow_up_notifications',
      entityType: 'admin_notification_follow_up_batch',
      details: {
        recipient_count: userIds.length,
        request_key: requestKey,
        result: data,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ result: data, workspace: await readWorkspace() })
  } catch (error) {
    const rpcError = error as RpcError
    return NextResponse.json(
      { error: rpcError.message || 'ดำเนินการคิวติดตามลูกค้าไม่สำเร็จ' },
      { status: errorStatus(rpcError) }
    )
  }
}
