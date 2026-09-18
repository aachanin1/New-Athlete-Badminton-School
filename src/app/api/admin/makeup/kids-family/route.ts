import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { consumeKidsFamilyMakeup } from '@/lib/kids-family-makeup'
import { Task10Error } from '@/lib/task10-policy'
import { consumeNextKidsFamilyMakeup, readKidsFamilyMakeupWithDestinations } from '@/lib/kids-family-makeup-server'

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
    // Preserve explicit-source compatibility callers; new cards send family/month.
    const result = body.parent_id !== undefined || body.source_month !== undefined
      ? await consumeNextKidsFamilyMakeup(getServiceRoleClient(), access.ctx.user.id, body)
      : await consumeKidsFamilyMakeup(getServiceRoleClient(), access.ctx.user.id, body)
    return NextResponse.json(result)
  } catch (error) { return failure(error) }
}
