import { NextRequest, NextResponse } from 'next/server'
import { requireAdminMenuAccess } from '@/lib/auth/admin'
import { recordReviewClosure } from '@/lib/activity-log'

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
export async function POST(request: NextRequest) {
  const access = await requireAdminMenuAccess('makeup')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'ข้อมูลคำขอไม่ถูกต้อง', definitive: true }, { status: 400 }) }
  if (!body || typeof body.session !== 'string' || !uuid.test(body.session) || typeof body.requestId !== 'string' || !uuid.test(body.requestId)
    || typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 1000 || typeof body.readOnly !== 'boolean') {
    return NextResponse.json({ error: 'เลือกรอบเรียนและเหตุผลให้ครบ', definitive: true }, { status: 400 })
  }
  try {
    const result = await recordReviewClosure({ actor: access.ctx.user.id, session: body.session, requestId: body.requestId,
      reason: body.reason.trim(), readOnly: body.readOnly, ip: request.headers.get('x-forwarded-for') })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const definitive = /ADMIN_REVIEW_CLOSE_INELIGIBLE|TASK10_INVALID_REQUEST|TASK10_UNAUTHORIZED|TASK10_IDEMPOTENCY_CONFLICT/.test(message)
    return NextResponse.json({ error: definitive ? 'ข้อมูลเคสเปลี่ยนแล้ว กรุณาตรวจรายการและสิทธิ์อีกครั้ง' : 'ยังยืนยันผลปิดเคสไม่ได้ กรุณาตรวจสอบผลเดิม', definitive }, { status: definitive ? 409 : 503 })
  }
}
