import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { Task10Error } from '@/lib/task10-policy'
import {callMakeupWorkspace} from '@/lib/admin-makeup-workspace-rpc'
import { createHash } from 'node:crypto'
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const month = /^[1-9]\d{3}-(0[1-9]|1[0-2])$/
const headers = { 'Cache-Control': 'private, no-store' }
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof Error ? error.message : 'อ่านข้อมูลไม่สำเร็จ', code: error instanceof Task10Error ? error.code : 'TASK10_UNAVAILABLE' }, { status: error instanceof Task10Error ? error.status : 503, headers })
}
export async function GET(request: NextRequest) {
  const access = await requireAdminMenuAccess('makeup')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  const q = request.nextUrl.searchParams, client = getServiceRoleClient(), actor = access.ctx.user.id
  try {
    const pending = q.get('request')
    if (pending) {
      if (!uuid.test(pending)) throw new Task10Error('TASK10_INVALID_REQUEST', 'คำขอไม่ถูกต้อง', 400)
      const { data, error } = await client.from('admin_makeup_requests_v2').select('payload').eq('actor_id', actor).eq('request_id', pending).maybeSingle()
      if (error) throw error
      return NextResponse.json({ payload: data?.payload || null }, { headers })
    }
    const m = q.get('month') || '', reference = q.get('reference'), course = q.get('course') || '', page = Number(q.get('page') || 1), branch = q.get('branch') || 'all', search = (q.get('search') || '').trim(), status = q.get('status') || 'all'
    if (!month.test(m) || reference && !uuid.test(reference) || !reference && !['kids_group', 'adult_group', 'private'].includes(course) || !Number.isInteger(page) || page < 1 || page > 10000 || search.length > 200 || branch !== 'all' && !uuid.test(branch) || !['all', 'actionable', 'makeup', 'expired'].includes(status)) throw new Task10Error('TASK10_INVALID_REQUEST', 'ข้อมูลตัวกรองไม่ถูกต้อง', 400)
    const data = await callMakeupWorkspace(client, reference ? 'admin_makeup_context_v2' : 'admin_makeup_workspace_v2', reference
      ? { p_actor: actor, p_reference: reference, p_month: m + '-01' }
      : { p_actor: actor, p_month: m + '-01', p_course: course, p_search: search, p_branch: branch === 'all' ? null : branch, p_status: status, p_page: page })
    return NextResponse.json(data, { headers })
  } catch (error) { return failure(error) }
}
export async function POST(request: NextRequest) {
  const access = await requireAdminMenuAccess('makeup')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  try {
    const input = await request.json(), keys = ['operation', 'reference', 'month', 'childId', 'templateId', 'date', 'requestId', 'reason', 'sourceId', 'grantId', 'branchId', 'startTime', 'endTime']
    if (!input || typeof input !== 'object' || Array.isArray(input) || input.prepare_only !== undefined && typeof input.prepare_only !== 'boolean') throw new Task10Error('TASK10_INVALID_REQUEST','คำขอไม่ถูกต้อง',400)
    const body = Object.fromEntries(keys.filter(key => input[key] !== undefined).map(key => [key, input[key]]))
    if (!['grant', 'use', 'revoke'].includes(body.operation) || !uuid.test(body.requestId || '') || typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 1000
      || body.operation !== 'revoke' && (!uuid.test(body.reference || '') || !month.test(body.month || '') || !uuid.test(body.templateId || '') || !uuid.test(body.branchId || '') || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(body.startTime || '') || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(body.endTime || '') || body.startTime.slice(0,5)>=body.endTime.slice(0,5) || !/^\d{4}-\d{2}-\d{2}$/.test(body.date || '') || body.childId !== undefined && body.childId !== null && !uuid.test(body.childId))
      || body.operation === 'use' && !uuid.test(body.sourceId || '') || body.operation === 'revoke' && !uuid.test(body.grantId || '')) throw new Task10Error('TASK10_INVALID_REQUEST', 'ข้อมูลคำขอไม่ครบ', 400)
    const client = getServiceRoleClient(), actor = access.ctx.user.id
    const fingerprint = createHash('sha256').update(JSON.stringify(body, Object.keys(body).sort())).digest('hex')
    const prepared = await client.from('admin_makeup_requests_v2').insert({ actor_id: actor, request_id: body.requestId, payload: body, fingerprint })
    if (prepared.error) {
      if (prepared.error.code !== '23505') throw prepared.error
      const { data, error } = await client.from('admin_makeup_requests_v2').select('fingerprint').eq('actor_id', actor).eq('request_id', body.requestId).single()
      if (error) throw error
      if (data.fingerprint !== fingerprint) throw new Task10Error('TASK10_IDEMPOTENCY_CONFLICT', 'คำขอเดิมมีข้อมูลต่างกัน', 409)
    }
    if (input.prepare_only === true) return NextResponse.json({prepared:true},{headers})
    let result
    if (body.operation === 'grant') result = await callMakeupWorkspace(client, 'admin_makeup_grant_v2', { p_actor: actor, p_reference: body.reference, p_month: body.month + '-01', p_child: body.childId || null, p_template: body.templateId, p_date: body.date, p_request: body.requestId, p_reason: body.reason, p_target: {branchId:body.branchId,startTime:body.startTime,endTime:body.endTime} })
    else if (body.operation === 'revoke') result = await callMakeupWorkspace(client, 'admin_makeup_revoke_v2', { p_actor: actor, p_grant: body.grantId, p_request: body.requestId, p_reason: body.reason })
    else {
      result = await callMakeupWorkspace(client, 'admin_makeup_use_v2', { p_actor: actor, p_reference: body.reference, p_month: body.month + '-01', p_source: body.sourceId, p_request: body.requestId,
        p_payload: { targetDate: body.date, startTime: body.startTime.length===5?body.startTime+':00':body.startTime, endTime: body.endTime.length===5?body.endTime+':00':body.endTime, branchId: body.branchId, templateId: body.templateId, reason: body.reason } })
    }
    return NextResponse.json(result, { headers })
  } catch (error) { return failure(error) }
}
