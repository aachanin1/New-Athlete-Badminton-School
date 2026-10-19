import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { callTask10, Task10Error } from '@/lib/task10-policy'
import { assertMakeupWriterReady, prepareMakeupIntent, settleMakeupIntent } from '@/lib/admin-makeup-credit-intent'

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
export async function POST(request: NextRequest) {
  const access = await requireAdminMenuAccess('makeup')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  try {
    const body = await request.json()
    if (!body || !uuid.test(body.credit_id || '') || !uuid.test(body.request_id || '') || !['approve', 'revoke'].includes(body.operation)
      || typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 1000 || body.read_only !== undefined && typeof body.read_only !== 'boolean') {
      return NextResponse.json({ error: 'เลือกเครดิตและระบุเหตุผลภายในให้ครบ', code: 'TASK10_INVALID_REQUEST' }, { status: 400 })
    }
    const client = getServiceRoleClient(), actor = access.ctx.user.id
    if (body.read_only !== true) await assertMakeupWriterReady(client, actor)
    await prepareMakeupIntent(client, actor, 'approval', body, body.read_only === true)
    const result = await callTask10<{ confirmed: boolean }>(client, 'admin_makeup_credit_decide_v1', {
      p_actor: actor, p_credit: body.credit_id, p_operation: body.operation, p_reason: body.reason,
      p_request: body.request_id, p_read_only: body.read_only === true,
    })
    if (result.confirmed) await settleMakeupIntent(client, actor, body.request_id)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Task10Error ? error.message : 'ยังยืนยันผลการอนุมัติไม่ได้', code: error instanceof Task10Error ? error.code : 'TASK10_UNAVAILABLE' },
      { status: error instanceof Task10Error ? error.status : 503 })
  }
}
