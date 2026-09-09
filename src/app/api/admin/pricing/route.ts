import { NextRequest, NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity-log'
import { getServiceRoleClient, requireSuperAdminUser } from '@/lib/auth/admin'
import { validateKidsTierSet } from '@/lib/booking-pricing-policy'
import { callTask10, loadTask10Policy, Task10Error } from '@/lib/task10-policy'

interface PricingTierUpdate {
  id?: string
  min_sessions?: number
  max_sessions?: number | null
  price_per_session?: number
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

function calculateAutoPackagePrice(tier: Required<Pick<PricingTierUpdate, 'min_sessions' | 'price_per_session'>>) {
  return Math.round(Number(tier.min_sessions || 0) * Number(tier.price_per_session || 0))
}

function validateTier(tier: PricingTierUpdate) {
  if (!tier.id || typeof tier.id !== 'string') return 'ไม่พบ pricing tier id'

  const minSessions = Number(tier.min_sessions)
  const maxSessions = tier.max_sessions === null || tier.max_sessions === undefined
    ? null
    : Number(tier.max_sessions)
  const pricePerSession = Number(tier.price_per_session)

  if (!Number.isInteger(minSessions) || minSessions < 1) return 'จำนวนเริ่มต้นต้องเป็นเลขจำนวนเต็มตั้งแต่ 1 ขึ้นไป'
  if (maxSessions !== null && (!Number.isInteger(maxSessions) || maxSessions < minSessions)) return 'จำนวนสิ้นสุดต้องมากกว่าหรือเท่ากับจำนวนเริ่มต้น'
  if (!Number.isFinite(pricePerSession) || pricePerSession < 0) return 'ราคา/ครั้ง หรือ ราคา/ชม. ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป'

  return null
}

export async function PATCH(req: NextRequest) {
  const admin = await requireSuperAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
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
    const tiers = Array.isArray(body.tiers) ? body.tiers as PricingTierUpdate[] : []

    if (tiers.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายการราคาที่ต้องบันทึก' }, { status: 400 })
    }

    for (const tier of tiers) {
      const error = validateTier(tier)
      if (error) return NextResponse.json({ error }, { status: 400 })
    }

    const supabaseAdmin = getServiceRoleClient()
    if ((await loadTask10Policy(supabaseAdmin)).effectiveAt) {
      const selected = await supabaseAdmin.from('pricing_tiers').select('id, course_types!inner(name)').in('id', tiers.map((tier) => tier.id!))
      if (selected.error) throw selected.error
      const selectedRows = selected.data as unknown as Array<{ course_types: { name: string } | Array<{ name: string }> | null }> | null
      if (selectedRows?.some(({ course_types: course }) => Array.isArray(course) ? course.some((c) => c.name === 'kids_group') : course?.name === 'kids_group')) {
        return NextResponse.json({ code: 'TASK10_VERSIONED_CATALOG_REQUIRED', error: 'กรุณาบันทึกราคาคอร์สเด็กเป็นชุดตามช่วงวันจอง' }, { status: 409 })
      }
    }
    const updatedRows = []

    for (const tier of tiers) {
      const minSessions = Number(tier.min_sessions)
      const pricePerSession = Number(tier.price_per_session)
      const updateData = {
        min_sessions: minSessions,
        max_sessions: tier.max_sessions === null || tier.max_sessions === undefined ? null : Number(tier.max_sessions),
        price_per_session: pricePerSession,
        package_price: calculateAutoPackagePrice({
          min_sessions: minSessions,
          price_per_session: pricePerSession,
        }),
      }

      const { data, error } = await supabaseAdmin
        .from('pricing_tiers')
        .update(updateData)
        .eq('id', tier.id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      updatedRows.push(data)
    }

    await logActivity({
      userId: admin.user.id,
      action: 'pricing_updated',
      entityType: 'pricing_tiers',
      entityId: 'pricing_settings',
      details: { count: updatedRows.length, packagePriceMode: 'auto' },
    })

    return NextResponse.json({ success: true, data: updatedRows })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error), code: error instanceof Task10Error ? error.code : undefined },
      { status: error instanceof Task10Error ? error.status : 500 })
  }
}
