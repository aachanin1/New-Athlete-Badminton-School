import { NextRequest, NextResponse } from 'next/server'
import { requireAdminMenuAccess } from '@/lib/auth/admin'
import { recordReviewRoundRequest } from '@/lib/activity-log'
import { isSameOriginMutation } from '@/lib/progressive-payment-integration'
import { reviewRequestsReadOnly } from '@/lib/admin-makeup-review-release'

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Invalid request origin', definitive: true }, { status: 403 })
  const access = await requireAdminMenuAccess('makeup')
  if (!access.ok) return NextResponse.json({ error: access.message, definitive: true }, { status: access.status })
  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'ข้อมูลคำขอไม่ถูกต้อง', definitive: true }, { status: 400 }) }
  if (!body || !uuid.test(body.anchor || '') || !uuid.test(body.requestId || '') || typeof body.group !== 'string' || body.group.length > 2000
    || !['request_coach_review', 'request_coach_evidence'].includes(body.action) || !Array.isArray(body.members)
    || !body.members.length || body.members.length > 10000 || body.members.some((id: unknown) => typeof id !== 'string' || !uuid.test(id))
    || (body.readOnly !== undefined && typeof body.readOnly !== 'boolean')) {
    return NextResponse.json({ error: 'ข้อมูลคำขอไม่ถูกต้อง', definitive: true }, { status: 400 })
  }
  if (reviewRequestsReadOnly && body.readOnly !== true) {
    return NextResponse.json({ error: 'พักการส่งคำขอใหม่ชั่วคราว กรุณาตรวจผลคำขอเดิม', definitive: true }, { status: 409 })
  }
  try {
    const result = await recordReviewRoundRequest({ actor: access.ctx.user.id, anchor: body.anchor, group: body.group,
      action: body.action, members: body.members, requestId: body.requestId, readOnly: body.readOnly === true,
      ip: request.headers.get('x-forwarded-for') })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/ADMIN_REVIEW_(SCOPE_CHANGED|NO_COACH)/.test(message)) return NextResponse.json({ error: 'ข้อมูลรอบเปลี่ยนแล้ว กรุณาอ่านข้อมูลล่าสุดก่อนส่งอีกครั้ง', definitive: true, scopeChanged: true }, { status: 409 })
    if (/ADMIN_REVIEW_REQUEST_MISMATCH/.test(message)) return NextResponse.json({ error: 'คำขอเดิมไม่ตรงกับรอบนี้ กรุณาตรวจสอบผลเดิม', definitive: true }, { status: 409 })
    if (/ADMIN_REVIEW_BUSY|could not obtain lock|lock timeout/.test(message)) return NextResponse.json({ error: 'รอบนี้กำลังมีรายการอื่น กรุณาลองคำขอเดิมอีกครั้ง', definitive: true }, { status: 409 })
    if (/ADMIN_REVIEW_INVALID_REQUEST/.test(message)) return NextResponse.json({ error: 'ข้อมูลคำขอไม่ถูกต้อง', definitive: true }, { status: 400 })
    if (/UNAUTHORIZED|FORBIDDEN/.test(message)) return NextResponse.json({ error: 'ไม่มีสิทธิ์ดำเนินการ', definitive: true }, { status: 403 })
    // Unknown transport failures can have committed. The client must read the
    // original receipt before permitting another write.
    return NextResponse.json({ error: 'ยังยืนยันผลการส่งไม่ได้ กรุณาตรวจสอบคำขอเดิม', definitive: false }, { status: 503 })
  }
}
