import { NextRequest, NextResponse } from 'next/server'

import { recordCurrentPricingUpdate } from '@/lib/activity-log'
import { readAdminCurrentPricing } from '@/lib/admin-pricing-settings'
import { getServiceRoleClient, requireSuperAdminUser } from '@/lib/auth/admin'
import { validateKidsTierSet } from '@/lib/booking-pricing-policy'
import { callTask10, Task10Error } from '@/lib/task10-policy'
import { isSameOriginMutation } from '@/lib/progressive-payment-integration'

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

const privateHeaders = { 'Cache-Control': 'private, no-store' }

function pricingFailure(error: unknown) {
  const message = getErrorMessage(error)
  if (/ADMIN_PRICING_(CONFLICT|RELOAD_REQUIRED)/.test(message)) return NextResponse.json({
    code: 'ADMIN_PRICING_CONFLICT', error: 'ข้อมูลราคาปรับเปลี่ยนแล้ว กรุณาโหลดราคาล่าสุดก่อนบันทึก',
  }, { status: 409, headers: privateHeaders })
  if (/ADMIN_PRICING_INVALID|invalid input syntax|out of range|numeric field overflow/.test(message)) {
    return NextResponse.json({ error: 'ข้อมูลราคาไม่ถูกต้อง กรุณาตรวจจำนวนและราคาอีกครั้ง' }, { status: 400, headers: privateHeaders })
  }
  if (message.includes('ADMIN_PRICING_FORBIDDEN')) return NextResponse.json({ error: 'Unauthorized' }, { status: 403, headers: privateHeaders })
  return NextResponse.json({ error: 'ยังยืนยันข้อมูลราคาไม่ได้ กรุณาโหลดราคาล่าสุดก่อนทำต่อ' }, { status: 503, headers: privateHeaders })
}

export async function GET() {
  const admin = await requireSuperAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  try {
    return NextResponse.json({ data: await readAdminCurrentPricing(admin.user.id) }, { headers: privateHeaders })
  } catch (error) { return pricingFailure(error) }
}

export async function PATCH(req: NextRequest) {
  const admin = await requireSuperAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'ข้อมูลราคาไม่ถูกต้อง' }, { status: 400 })
    if ('regime' in body) {
      if (!['early', 'late'].includes(body.regime) || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) {
        return NextResponse.json({ error: 'ช่วงราคาหรือรุ่นข้อมูลไม่ถูกต้อง' }, { status: 400 })
      }
      const data = await callTask10(getServiceRoleClient(), 'task10_save_pricing_catalog_v1', {
        p_actor_id: admin.user.id, p_regime: body.regime, p_expected_revision: body.expectedRevision,
        p_tiers: validateKidsTierSet(body.tiers),
      })
      return NextResponse.json({ success: true, data })
    }
    if (!isSameOriginMutation(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!body.expected || !Array.isArray(body.expected.tiers) || !/^\d{4}-\d{2}-\d{2}$/.test(body.expected.asOfDate)) {
      return pricingFailure(new Error('ADMIN_PRICING_RELOAD_REQUIRED'))
    }
    const data = await recordCurrentPricingUpdate({ actor: admin.user.id, expected: body.expected, tiers: body.tiers })
    return NextResponse.json({ success: true, data }, { headers: privateHeaders })
  } catch (error) {
    if (error instanceof Task10Error) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'ข้อมูลราคาไม่ถูกต้อง' }, { status: 400 })
    return pricingFailure(error)
  }
}
