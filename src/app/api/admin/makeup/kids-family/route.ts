import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { consumeKidsFamilyMakeup } from '@/lib/kids-family-makeup'
import { Task10Error } from '@/lib/task10-policy'
import { consumeNextKidsFamilyMakeup, readKidsFamilyMakeupWithDestinations } from '@/lib/kids-family-makeup-server'
import { assertMakeupWriterReady, prepareMakeupIntent, settleMakeupIntent } from '@/lib/admin-makeup-credit-intent'

function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof Error ? error.message : 'อ่านข้อมูลสิทธิ์ชดเชยไม่สำเร็จ',
    code: error instanceof Task10Error ? error.code : 'TASK10_UNAVAILABLE' },
    { status: error instanceof Task10Error ? error.status : 503 })
}

export async function GET(request: NextRequest) {
  const access = await requireAdminMenuAccess('makeup')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  const parentId = request.nextUrl.searchParams.get('parentId')
  const sourceMonth = request.nextUrl.searchParams.get('sourceMonth')
  if (!parentId || !sourceMonth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(sourceMonth)) {
    return NextResponse.json({ error: 'เลือกครอบครัวและเดือนต้นทางให้ครบ' }, { status: 400 })
  }
  try {
    return NextResponse.json(await readKidsFamilyMakeupWithDestinations(getServiceRoleClient(), access.ctx.user.id, parentId, sourceMonth))
  } catch (error) { return failure(error) }
}

export async function POST(request: NextRequest) {
  const access = await requireAdminMenuAccess('makeup')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  try {
    const body = await request.json()
    if (!body || typeof body.request_id !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.request_id)
      || body.read_only !== undefined && typeof body.read_only !== 'boolean') {
      return NextResponse.json({ error: 'รหัสคำขอไม่ถูกต้อง', code: 'TASK10_INVALID_REQUEST' }, { status: 400 })
    }
    const client = getServiceRoleClient(), actor = access.ctx.user.id
    if (body.read_only !== true) await assertMakeupWriterReady(client, actor)
    await prepareMakeupIntent(client, actor, 'use', body, body.read_only === true)
    if (body.read_only === true) {
      const { data, error } = await client.from('task10_family_makeup_uses').select('id').eq('actor_id', actor).eq('request_id', body.request_id).maybeSingle()
      if (error) throw error
      if (!data) return NextResponse.json({ confirmed: false }, { headers: { 'Cache-Control': 'private, no-store' } })
    }
    // Preserve explicit-source compatibility callers; new cards send family/month.
    const result = body.parent_id !== undefined || body.source_month !== undefined
      ? await consumeNextKidsFamilyMakeup(client, actor, body)
      : await consumeKidsFamilyMakeup(client, actor, body)
    await settleMakeupIntent(client, actor, body.request_id)
    return NextResponse.json({ ...result, confirmed: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return failure(error) }
}
