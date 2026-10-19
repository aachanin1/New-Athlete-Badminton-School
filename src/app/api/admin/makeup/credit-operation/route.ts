import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { assertMakeupWriterReady, assertStoreRequestPolicy, prepareMakeupIntent, readMakeupIntent } from '@/lib/admin-makeup-credit-intent'
import { adminMakeupStorePolicy } from '@/lib/admin-makeup-store-policy'
import { Task10Error } from '@/lib/task10-policy'

export async function POST(request: NextRequest) {
  const access = await requireAdminMenuAccess('makeup')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  try {
    const body = await request.json(), payload = body?.payload
    if (!['store', 'approval', 'use'].includes(body?.kind) || !payload || typeof payload !== 'object' || Array.isArray(payload)
      || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(payload.request_id || '')
      || typeof payload.reason !== 'string' || !payload.reason.trim() || payload.reason.length > 1000) {
      return NextResponse.json({ error: 'ข้อมูลคำขอไม่ครบ', code: 'TASK10_INVALID_REQUEST' }, { status: 400 })
    }
    const client = getServiceRoleClient()
    if (body.kind === 'store') await assertStoreRequestPolicy(client, access.ctx.user.id, payload)
    await assertMakeupWriterReady(client, access.ctx.user.id, body.kind === 'store' && payload.store_policy === adminMakeupStorePolicy)
    await prepareMakeupIntent(client, access.ctx.user.id, body.kind, payload)
    return NextResponse.json({ prepared: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Task10Error ? error.message : 'ยังเก็บคำขอเดิมไม่ได้', code: error instanceof Task10Error ? error.code : 'TASK10_UNAVAILABLE' },
      { status: error instanceof Task10Error ? error.status : 503 })
  }
}

export async function GET(request: NextRequest) {
  const access = await requireAdminMenuAccess('makeup')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  const id = request.nextUrl.searchParams.get('request') || ''
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: 'รหัสคำขอไม่ถูกต้อง' }, { status: 400 })
  try {
    const client = getServiceRoleClient(), intent = await readMakeupIntent(client, access.ctx.user.id, id)
    let context = null
    if (intent?.kind === 'store' && typeof intent.payload.session_id === 'string' && /^[0-9a-f-]{36}$/i.test(intent.payload.session_id)) {
      const { data, error } = await client.from('booking_sessions').select('id,date,child_id,bookings!inner(user_id,course_types(name))').eq('id', intent.payload.session_id).maybeSingle()
      if (error) throw error
      const source = data as unknown as { id: string; date: string; child_id: string | null; bookings: { user_id: string; course_types: { name: string } | null } } | null
      if (source?.child_id && source.bookings.course_types?.name === 'kids_group') context = { parentId: source.bookings.user_id, childId: source.child_id, sourceMonth: source.date.slice(0, 7), sourceSessionId: source.id }
    }
    return NextResponse.json(intent ? { found: true, kind: intent.kind, payload: intent.payload, context } : { found: false }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch { return NextResponse.json({ error: 'ยังอ่านคำขอเดิมไม่ได้' }, { status: 503 }) }
}
