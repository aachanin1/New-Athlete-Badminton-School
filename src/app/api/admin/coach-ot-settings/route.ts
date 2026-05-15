import { NextRequest, NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity-log'
import { getServiceRoleClient, requireSuperAdminUser } from '@/lib/auth/admin'
import {
  COACH_EMPLOYMENT_OPTIONS,
  COACH_TEACHING_RULES_SETTING_KEY,
  normalizeCoachTeachingRulesSettings,
  type CoachTeachingRules,
} from '@/lib/coach-teaching-rules'

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

function parseNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function validateSettings(body: unknown) {
  const settings = normalizeCoachTeachingRulesSettings(body)

  for (const option of COACH_EMPLOYMENT_OPTIONS) {
    const rule = settings[option.employmentType]
    const thresholdHours = parseNumber(rule.thresholdHours)
    const privateRate = parseNumber(rule.privateRate)
    const groupRate = parseNumber(rule.groupRate)

    if (thresholdHours === null || thresholdHours < 0 || thresholdHours > 168 || (!rule.paysAllHours && thresholdHours <= 0)) {
      return { error: `${rule.label}: เกณฑ์ชั่วโมงต่อสัปดาห์ต้องมากกว่า 0 และไม่เกิน 168 ชั่วโมง` }
    }

    if (privateRate === null || privateRate < 0) {
      return { error: `${rule.label}: เรท Private ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป` }
    }

    if (groupRate === null || groupRate < 0) {
      return { error: `${rule.label}: เรทกลุ่มต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป` }
    }
  }

  return { settings }
}

export async function PATCH(req: NextRequest) {
  const admin = await requireSuperAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json() as { rules?: Partial<CoachTeachingRules> }
    const validation = validateSettings(body)

    if ('error' in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const supabaseAdmin = getServiceRoleClient()
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .upsert({
        key: COACH_TEACHING_RULES_SETTING_KEY,
        value: {
          rules: validation.settings,
          updatedAt: new Date().toISOString(),
        },
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
      action: 'coach_teaching_rules_updated',
      entityType: 'system_settings',
      entityId: COACH_TEACHING_RULES_SETTING_KEY,
      details: validation.settings,
      ipAddress: req.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
