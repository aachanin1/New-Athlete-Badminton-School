import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { LessonSourceTransitionError, transitionLessonSource } from '@/lib/lesson-source-transition'
import { formatLearnerDisplayName } from '@/lib/learner-display-name'
import { isValidDateKey } from '@/lib/date-format'
import { normalizeScheduleTime } from '@/lib/schedule-template-utils'
import { assertMakeupWriterReady, assertStoreRequestPolicy, prepareMakeupIntent, settleMakeupIntent } from '@/lib/admin-makeup-credit-intent'
import { adminMakeupStorePolicy } from '@/lib/admin-makeup-store-policy'
import { Task10Error, task10RpcError } from '@/lib/task10-policy'

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const access = await requireAdminMenuAccess('makeup')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  const q = request.nextUrl.searchParams
  const month = q.get('month') || '', branch = q.get('branch') || null, session = q.get('session') || null
  const search = q.get('search')?.trim() || '', course = q.get('course') || null, page = Number(q.get('page') || 1)
  if (!session || !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month) || month.slice(0,4)>='9999' || search.length > 200 || (branch && !uuid.test(branch))
    || (session && !uuid.test(session)) || !Number.isInteger(page) || page < 1 || page > 100000
    || (course && !['kids_group', 'adult_group', 'private'].includes(course))) {
    return NextResponse.json({ error: 'ข้อมูลตัวกรองไม่ถูกต้อง' }, { status: 400 })
  }
  const { data, error } = await getServiceRoleClient().rpc('admin_lesson_sessions_v1', {
    p_actor_id: access.ctx.user.id, p_month: `${month}-01`, p_search: search, p_branch: branch,
    p_course: course, p_page: page, p_session: session,
  })
  if (error || !data) return NextResponse.json({ error: 'อ่านรายการเรียนไม่สำเร็จ กรุณาลองใหม่' }, { status: 503 })
  const result = data as unknown as { items: Array<Record<string, unknown>>; total: number; page: number; pageSize: number }
  return NextResponse.json({ ...result, items: result.items.map(row => ({ ...row,
    learner_name: row.identity_valid === false ? formatLearnerDisplayName({}) : formatLearnerDisplayName({ fullName: String(row.child_id ? row.child_full_name || '' : row.parent_name || ''), nickname: row.child_id ? String(row.child_nickname || '') : null }),
  })) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const access = await requireAdminMenuAccess('makeup')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  try {
    const body = await request.json()
    if (!body || !uuid.test(body.session_id || '') || !uuid.test(body.request_id || '') || !['store', 'reschedule'].includes(body.operation)
      || typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 1000
      || body.approve_credit !== undefined && (typeof body.approve_credit !== 'boolean' || body.operation !== 'store')
      || body.store_policy !== undefined && (body.store_policy !== adminMakeupStorePolicy || body.operation !== 'store')
      || body.read_only !== undefined && (typeof body.read_only !== 'boolean' || body.operation !== 'store')) {
      return NextResponse.json({ error: 'เลือกรายการและระบุเหตุผลให้ครบ', code: 'LESSON_SOURCE_INVALID_REQUEST' }, { status: 400 })
    }
    if (body.operation === 'reschedule' && (!isValidDateKey(body.target_date || '') || !uuid.test(body.branch_id || '') || !uuid.test(body.template_id || '')
      || typeof body.start_time !== 'string' || typeof body.end_time !== 'string' || !normalizeScheduleTime(body.start_time) || !normalizeScheduleTime(body.end_time)
      || normalizeScheduleTime(body.start_time)! >= normalizeScheduleTime(body.end_time)!)) {
      return NextResponse.json({ error: 'เลือกวัน สาขา และรอบใหม่ให้ครบ', code: 'LESSON_SOURCE_INVALID_REQUEST' }, { status: 400 })
    }
    const client = getServiceRoleClient(), actor = access.ctx.user.id
    if (body.operation === 'store' && body.read_only !== true) {
      await assertStoreRequestPolicy(client, actor, body)
      await assertMakeupWriterReady(client, actor, body.store_policy === adminMakeupStorePolicy)
    }
    if (body.operation === 'store') await prepareMakeupIntent(client, actor, 'store', body, body.read_only === true)
    if (body.operation === 'store' && body.read_only === true) {
      // A readback never invokes the transition writer, including during an
      // app/schema rollback where an older writer ignores unknown payload keys.
      const { data, error } = await client.from('admin_makeup_store_requests').select('source_session_id,result').eq('actor_id', actor).eq('request_id', body.request_id).maybeSingle()
      if (error) throw task10RpcError()
      if (data && data.source_session_id !== body.session_id.toLowerCase()) throw task10RpcError('TASK10_IDEMPOTENCY_CONFLICT')
      return NextResponse.json({ success: true, result: data?.result || { confirmed: false } }, { headers: { 'Cache-Control': 'private, no-store' } })
    }
    const result = await transitionLessonSource<Record<string, unknown>>(client, actor,
      body.operation === 'store' ? 'admin_store' : 'admin_reschedule', body.session_id,
      { reason: body.reason.trim(), requestId: body.request_id, targetDate: body.target_date,
        startTime: body.start_time, endTime: body.end_time, branchId: body.branch_id, templateId: body.template_id,
        ...(body.approve_credit !== undefined ? { approveCredit: body.approve_credit } : {}),
        ...(body.store_policy !== undefined ? { storePolicy: body.store_policy } : {}),
        ...(body.read_only === true && body.operation === 'store' ? { readOnly: true } : {}) },
      body.operation === 'store' ? 'admin_makeup_credit_store_v1' : 'lesson_source_transition_v1')
    if (body.operation === 'store' && result.confirmed !== false) await settleMakeupIntent(client, actor, body.request_id)
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ยังยืนยันผลการจัดการไม่ได้',
      code: error instanceof LessonSourceTransitionError || error instanceof Task10Error ? error.code : 'LESSON_SOURCE_UNAVAILABLE' },
    { status: error instanceof LessonSourceTransitionError || error instanceof Task10Error ? error.status : 503 })
  }
}
