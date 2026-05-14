import { NextRequest, NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity-log'
import { getServiceRoleClient, requireSuperAdminUser } from '@/lib/auth/admin'

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
    const tiers = Array.isArray(body.tiers) ? body.tiers as PricingTierUpdate[] : []

    if (tiers.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายการราคาที่ต้องบันทึก' }, { status: 400 })
    }

    for (const tier of tiers) {
      const error = validateTier(tier)
      if (error) return NextResponse.json({ error }, { status: 400 })
    }

    const supabaseAdmin = getServiceRoleClient()
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
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
