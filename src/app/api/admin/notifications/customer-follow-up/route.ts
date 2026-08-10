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

type FollowUpStatusFilter = 'all' | 'pending' | 'sent' | 'excluded'

interface WorkspaceContext {
  page: number
  status: FollowUpStatusFilter
  search: string
}

function errorStatus(error: RpcError) {
  if (error.code === '42501') return 403
  if (error.code === '23505') return 409
  if (error.code === 'P0002') return 409
  if (error.code === '22023') return 409
  return 500
}

function parseWorkspaceContext(value: URLSearchParams | Record<string, unknown>): WorkspaceContext {
  const read = (key: string) => value instanceof URLSearchParams ? value.get(key) : value[key]
  const rawPage = Number(read('page') || 1)
  const rawStatus = read('status')
  const search = typeof read('search') === 'string' ? String(read('search')).trim() : ''
  const status: FollowUpStatusFilter = rawStatus === 'pending'
    || rawStatus === 'sent'
    || rawStatus === 'excluded'
    ? rawStatus
    : 'all'

  if (!Number.isInteger(rawPage) || rawPage < 1 || search.length > 100) {
    throw Object.assign(new Error('page หรือคำค้นหาไม่ถูกต้อง'), { code: '22023' })
  }
  return { page: rawPage, status, search }
}

async function readWorkspace(context: WorkspaceContext) {
  const service = getServiceRoleClient()
  const { data, error } = await service.rpc('admin_notification_follow_up_workspace_v2', {
    p_page: context.page,
    p_page_size: 10,
    p_status: context.status,
    p_search: context.search,
  })
  if (error) throw error
  return normalizeFollowUpWorkspaceSnapshot(data)
}

export async function GET(request: NextRequest) {
  const access = await requireAdminMenuAccess('notifications')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })

  try {
    const context = parseWorkspaceContext(request.nextUrl.searchParams)
    return NextResponse.json({ workspace: await readWorkspace(context) })
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
    const context = parseWorkspaceContext(body)
    const service = getServiceRoleClient()

    if (action === 'start') {
      const { data, error } = await service.rpc('admin_notification_follow_up_start_v2', {
        p_actor_id: access.ctx.user.id,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: errorStatus(error) })

      await logActivity({
        userId: access.ctx.user.id,
        action: 'start_customer_follow_up_full_roster',
        entityType: 'admin_notification_follow_up_batch',
        details: { source: 'admin_notification_recommendations', result: data },
        ipAddress: request.headers.get('x-forwarded-for'),
      })
      return NextResponse.json({ workspace: await readWorkspace({ ...context, page: 1 }) })
    }

    if (action === 'sync') {
      const { data, error } = await service.rpc('admin_notification_follow_up_sync_v2', {
        p_actor_id: access.ctx.user.id,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: errorStatus(error) })

      await logActivity({
        userId: access.ctx.user.id,
        action: 'sync_customer_follow_up_full_roster',
        entityType: 'admin_notification_follow_up_batch',
        details: { source: 'admin_notification_recommendations', result: data },
        ipAddress: request.headers.get('x-forwarded-for'),
      })
      return NextResponse.json({ workspace: await readWorkspace({ ...context, page: 1 }) })
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

    const { data, error } = await service.rpc('admin_notification_follow_up_send_v2', {
      p_actor_id: access.ctx.user.id,
      p_request_key: requestKey,
      p_user_ids: userIds,
      p_page: context.page,
      p_status: context.status,
      p_search: context.search,
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

    return NextResponse.json({ result: data, workspace: await readWorkspace(context) })
  } catch (error) {
    const rpcError = error as RpcError
    return NextResponse.json(
      { error: rpcError.message || 'ดำเนินการคิวติดตามลูกค้าไม่สำเร็จ' },
      { status: errorStatus(rpcError) }
    )
  }
}
