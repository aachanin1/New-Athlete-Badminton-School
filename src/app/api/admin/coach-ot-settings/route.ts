import { NextRequest, NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity-log'
import { getServiceRoleClient, requireSuperAdminUser } from '@/lib/auth/admin'
import { COACH_OT_SETTING_KEY, type CoachOtSettings } from '@/lib/coach-ot-settings'

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

function parseNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function validateSettings(body: Partial<CoachOtSettings>) {
  const weeklyThreshold = parseNumber(body.weeklyThreshold)
  const privateRate = parseNumber(body.privateRate)
  const groupRate = parseNumber(body.groupRate)

  if (weeklyThreshold === null || weeklyThreshold <= 0 || weeklyThreshold > 168) {
    return { error: 'เกณฑ์ OT ต่อสัปดาห์ต้องมากกว่า 0 และไม่เกิน 168 ชั่วโมง' }
  }

  if (privateRate === null || privateRate < 0) {
    return { error: 'เรท OT Private ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป' }
  }

  if (groupRate === null || groupRate < 0) {
    return { error: 'เรท OT กลุ่มต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป' }
  }

  return {
    settings: {
      weeklyThreshold,
      privateRate,
      groupRate,
    },
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await requireSuperAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const validation = validateSettings(body)

    if ('error' in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const supabaseAdmin = getServiceRoleClient()
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .upsert({
        key: COACH_OT_SETTING_KEY,
        value: validation.settings,
        updated_by: admin.user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logActivity({
      userId: admin.user.id,
      action: 'coach_ot_settings_updated',
      entityType: 'system_settings',
      entityId: COACH_OT_SETTING_KEY,
      details: validation.settings,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
