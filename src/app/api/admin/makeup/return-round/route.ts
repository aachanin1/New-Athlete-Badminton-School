import { NextRequest, NextResponse } from 'next/server'
import { requireAdminMenuAccess } from '@/lib/auth/admin'
import { isSameOriginMutation } from '@/lib/progressive-payment-integration'
import { noClassReturnUuid, isNoClassReturnPreview, isNoClassReturnReceipt } from '@/lib/no-class-return'
import { NoClassReturnServerError, readOrReturnUntaughtRound } from '@/lib/no-class-return-server'
import { noClassReturnReadOnly } from '@/lib/no-class-return-release'

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const allowed = new Set(['mode', 'anchor', 'requestId', 'expected', 'reason'])

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return json({ error: 'Invalid request origin', definitive: true }, 403)
  const access = await requireAdminMenuAccess('makeup')
  if (!access.ok) return json({ error: access.message, definitive: true }, access.status)
  let body: unknown
  try { body = await request.json() } catch { return json({ error: 'ข้อมูลคำขอไม่ถูกต้อง', definitive: true }, 400) }
  if (!isRecord(body) || Object.keys(body).some(key => !allowed.has(key))
    || typeof body.mode !== 'string' || !['preview', 'commit', 'status'].includes(body.mode) || typeof body.anchor !== 'string' || !noClassReturnUuid.test(body.anchor)
    || (body.requestId !== undefined && (typeof body.requestId !== 'string' || !noClassReturnUuid.test(body.requestId)))
    || (body.mode !== 'preview' && !body.requestId)
    || (body.expected !== undefined && (typeof body.expected !== 'string' || !body.expected.length || body.expected.length > 512))
    || (body.reason !== undefined && (typeof body.reason !== 'string' || body.reason.trim().length > 2000))
    || (body.mode === 'commit' && (!body.expected || typeof body.reason !== 'string' || !body.reason.trim()))) {
    return json({ error: 'ข้อมูลคำขอไม่ถูกต้อง กรุณาตรวจรอบและเหตุผลอีกครั้ง', definitive: true }, 400)
  }
  if (noClassReturnReadOnly && body.mode === 'commit') return json({ error: 'พักการคืนสิทธิ์ใหม่ชั่วคราว ยังตรวจผลคำขอเดิมได้', definitive: true }, 409)
  const input = { actor: access.ctx.user.id, anchor: body.anchor, mode: body.mode as 'preview' | 'commit' | 'status',
    requestId: body.requestId as string | undefined, expected: body.expected as string | undefined,
    reason: body.reason as string | undefined, ip: request.headers.get('x-forwarded-for') }
  try {
    const result = await readOrReturnUntaughtRound(input)
    if (input.mode === 'preview' && isNoClassReturnPreview(result, input.anchor)) return json(result)
    if (input.mode !== 'preview' && isNoClassReturnReceipt(result, input.requestId!, input.anchor)) return json(result)
    if (input.mode === 'status' && isRecord(result) && result.confirmed === false && result.requestId === input.requestId
      && typeof result.definitive === 'boolean' && (result.pending === undefined || typeof result.pending === 'boolean')) return json(result)
    return json({ error: 'ยังยืนยันผลไม่ได้ กรุณาตรวจผลคำขอเดิมก่อนดำเนินการต่อ', definitive: false }, 503)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const code = error instanceof NoClassReturnServerError ? error.databaseCode : undefined
    if (/UNAUTHORIZED|FORBIDDEN/.test(message)) return json({ error: 'ไม่มีสิทธิ์คืนสิทธิ์รอบนี้', definitive: true }, 403)
    if (/NO_CLASS_RETURN_(INVALID_REQUEST|REASON_REQUIRED)/.test(message)) return json({ error: 'ข้อมูลคำขอหรือเหตุผลไม่ถูกต้อง', definitive: true }, 400)
    if (/NO_CLASS_RETURN_REQUEST_MISMATCH/.test(message)) return json({ error: 'คำขอเดิมไม่ตรงกับข้อมูลนี้ กรุณาตรวจผลคำขอเดิม', definitive: true }, 409)
    if (/NO_CLASS_RETURN_(SCOPE_CHANGED|STALE)/.test(message)) return json({ error: 'ข้อมูลรอบเปลี่ยนแล้ว กรุณาอ่านผลกระทบล่าสุดก่อนยืนยัน', definitive: true, scopeChanged: true }, 409)
    if (/NO_CLASS_RETURN_(INELIGIBLE|NOT_ENDED|ALREADY_USED|INCOMPLETE|ATTENDANCE|EXPIRED|FAMILY|CLOSED|PAYROLL|AMBIGUOUS|SOURCE|NO_LEARNER|NOT_FOUND)/.test(message)) return json({ error: 'รอบนี้ยังคืนสิทธิ์ไม่ได้ กรุณาตรวจข้อมูลล่าสุดและเงื่อนไขของรอบ', definitive: true, scopeChanged: true }, 409)
    if (/NO_CLASS_RETURN_BUSY|could not obtain lock|lock timeout/.test(message) || ['40P01', '40001', '55P03', '57014'].includes(code || '')) return json({ error: 'รอบนี้กำลังมีรายการอื่น กรุณาตรวจผลเดิมแล้วลองใหม่', definitive: true }, 409)
    // An unrecognized transport failure may follow a successful commit.
    return json({ error: 'ยังยืนยันผลคืนสิทธิ์ไม่ได้ กรุณาตรวจผลคำขอเดิมก่อนส่งอีกครั้ง', definitive: false }, 503)
  }
}
