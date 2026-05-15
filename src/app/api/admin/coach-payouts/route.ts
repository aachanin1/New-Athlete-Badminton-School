import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { logActivity } from '@/lib/activity-log'
import {
  calculateTeachingPayEntries,
  COACH_TEACHING_RULES_SETTING_KEY,
  getCoachTeachingRule,
  getHoursBetween,
  normalizeCoachTeachingRulesSettings,
  normalizeCoachEmploymentType,
  type CoachEmploymentType,
  type TeachingSlotForCalculation,
} from '@/lib/coach-teaching-rules'

interface CloseWeeklyPayload {
  coachId?: string
  weekStart?: string
  weekEnd?: string
  notes?: string | null
}

interface AssignmentRow {
  id: string
  coach_id: string
  schedule_slot_id: string
  profiles?: {
    full_name: string | null
    coach_employment_type: string | null
  } | null
  schedule_slots?: {
    id: string
    branch_id: string
    date: string
    start_time: string
    end_time: string
    branches?: { name: string | null } | null
    course_types?: { name: string | null } | null
  } | null
}

interface CheckinRow {
  id: string
  coach_id: string
  schedule_slot_id: string
  checkin_time: string
  photo_url: string | null
}

interface CalculationRow extends TeachingSlotForCalculation {
  assignment_id: string
  coach_id: string
  schedule_slot_id: string
  branch_name: string | null
  checkin_id: string | null
  checkin_time: string | null
  photo_url: string | null
}

interface DbError {
  message: string
}

interface CoachTeachingRulesSettingRow {
  value: unknown
}

function isInputDate(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to close weekly teaching summary'
}

export async function POST(request: NextRequest) {
  const access = await requireAdminMenuAccess('payroll')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  const admin = access.ctx

  try {
    const payload = await request.json() as CloseWeeklyPayload
    const coachId = payload.coachId
    const weekStart = payload.weekStart
    const weekEnd = payload.weekEnd

    if (!coachId || !isInputDate(weekStart) || !isInputDate(weekEnd)) {
      return NextResponse.json({ error: 'coachId, weekStart, and weekEnd are required' }, { status: 400 })
    }

    const supabase = getServiceRoleClient()
    const [{ data: assignments }, { data: checkins }, { data: teachingRulesSetting }] = await Promise.all([
      supabase
        .from('coach_assignments')
        .select(`
          id, coach_id, schedule_slot_id,
          profiles!coach_assignments_coach_id_fkey(full_name, coach_employment_type),
          schedule_slots!inner(id, branch_id, date, start_time, end_time,
            branches(name),
            course_types(name)
          )
        `)
        .eq('coach_id', coachId)
        .gte('schedule_slots.date', weekStart)
        .lte('schedule_slots.date', weekEnd)
        .limit(1000) as unknown as PromiseLike<{ data: AssignmentRow[] | null }>,
      supabase
        .from('coach_checkins')
        .select('id, coach_id, schedule_slot_id, checkin_time, photo_url')
        .eq('coach_id', coachId)
        .gte('checkin_time', `${weekStart}T00:00:00`)
        .lt('checkin_time', `${weekEnd}T23:59:59`)
        .order('checkin_time', { ascending: false })
        .limit(1000) as unknown as PromiseLike<{ data: CheckinRow[] | null }>,
      supabase
        .from('system_settings')
        .select('value')
        .eq('key', COACH_TEACHING_RULES_SETTING_KEY)
        .maybeSingle() as unknown as PromiseLike<{ data: CoachTeachingRulesSettingRow | null }>,
    ])

    const firstAssignment = assignments?.find((assignment) => assignment.profiles)
    const employmentType = normalizeCoachEmploymentType(firstAssignment?.profiles?.coach_employment_type)
    if (!employmentType) {
      return NextResponse.json({ error: 'กรุณากำหนดประเภทโค้ชก่อนปิดสัปดาห์' }, { status: 400 })
    }

    const checkinMap = new Map<string, CheckinRow>()
    ;(checkins || []).forEach((checkin) => {
      const key = `${checkin.coach_id}:${checkin.schedule_slot_id}`
      if (!checkinMap.has(key)) checkinMap.set(key, checkin)
    })

    let missingCheckinCount = 0
    let missingPhotoCount = 0

    const calculationRows = (assignments || [])
      .filter((assignment) => assignment.schedule_slots)
      .map<CalculationRow | null>((assignment) => {
        const slot = assignment.schedule_slots
        if (!slot) return null
        const checkin = checkinMap.get(`${assignment.coach_id}:${assignment.schedule_slot_id}`)

        if (!checkin?.id) {
          missingCheckinCount += 1
          return null
        }
        if (!checkin.photo_url) {
          missingPhotoCount += 1
          return null
        }

        return {
          assignment_id: assignment.id,
          coach_id: assignment.coach_id,
          schedule_slot_id: assignment.schedule_slot_id,
          branch_name: slot.branches?.name || null,
          course_type: slot.course_types?.name || '',
          date: slot.date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          checkin_id: checkin.id,
          checkin_time: checkin.checkin_time,
          photo_url: checkin.photo_url,
        }
      })
      .filter((row): row is CalculationRow => Boolean(row))

    if (calculationRows.length === 0) {
      return NextResponse.json({ error: 'No verified teaching slots found for this coach and week' }, { status: 400 })
    }

    const teachingRules = normalizeCoachTeachingRulesSettings(teachingRulesSetting?.value)
    const rule = getCoachTeachingRule(employmentType as CoachEmploymentType, teachingRules)
    const entries = calculateTeachingPayEntries(calculationRows, rule)

    const totals = entries.reduce((summary, entry) => {
      summary.totalHours += entry.hours
      summary.regularHours += entry.regularHours
      summary.payableHours += entry.payableHours
      summary.payableAmount += entry.payableAmount
      if (entry.isPrivate) {
        summary.privateHours += entry.hours
        summary.payablePrivateHours += entry.payableHours
      } else {
        summary.groupHours += entry.hours
        summary.payableGroupHours += entry.payableHours
      }
      return summary
    }, {
      groupHours: 0,
      privateHours: 0,
      totalHours: 0,
      regularHours: 0,
      payableGroupHours: 0,
      payablePrivateHours: 0,
      payableHours: 0,
      payableAmount: 0,
    })

    const snapshotEntries = entries.map((entry) => ({
      assignment_id: entry.row.assignment_id,
      schedule_slot_id: entry.row.schedule_slot_id,
      branch_name: entry.row.branch_name,
      course_type: entry.row.course_type,
      date: entry.row.date,
      start_time: entry.row.start_time,
      end_time: entry.row.end_time,
      checkin_id: entry.row.checkin_id,
      checkin_time: entry.row.checkin_time,
      photo_url: entry.row.photo_url,
      hours: getHoursBetween(entry.row.date, entry.row.start_time, entry.row.end_time),
      regular_hours: entry.regularHours,
      payable_hours: entry.payableHours,
      payable_amount: entry.payableAmount,
      week_key: entry.weekKey,
    }))

    const { data: summary, error } = await supabase
      .from('coach_weekly_teaching_summaries')
      .upsert({
        coach_id: coachId,
        week_start: weekStart,
        week_end: weekEnd,
        coach_employment_type: employmentType,
        threshold_hours: rule.thresholdHours,
        group_hours: totals.groupHours,
        private_hours: totals.privateHours,
        total_hours: totals.totalHours,
        regular_hours: totals.regularHours,
        payable_group_hours: totals.payableGroupHours,
        payable_private_hours: totals.payablePrivateHours,
        payable_hours: totals.payableHours,
        private_rate: rule.privateRate,
        group_rate: rule.groupRate,
        payable_amount: totals.payableAmount,
        payable_session_count: entries.length,
        missing_checkin_count: missingCheckinCount,
        missing_photo_count: missingPhotoCount,
        status: 'closed',
        notes: payload.notes?.trim() || null,
        snapshot: {
          rule,
          entries: snapshotEntries,
          coachName: firstAssignment?.profiles?.full_name || null,
        },
        closed_by: admin.user.id,
        closed_at: new Date().toISOString(),
      }, { onConflict: 'coach_id,week_start' })
      .select('id')
      .single() as unknown as { data: { id: string } | null; error: DbError | null }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logActivity({
      userId: admin.user.id,
      action: 'close_coach_weekly_teaching_summary',
      entityType: 'coach_weekly_teaching_summary',
      entityId: summary?.id || null,
      details: {
        coachId,
        weekStart,
        weekEnd,
        employmentType,
        totalHours: totals.totalHours,
        payableHours: totals.payableHours,
        payableAmount: totals.payableAmount,
        payableSessionCount: entries.length,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({
      success: true,
      summaryId: summary?.id,
      payableAmount: totals.payableAmount,
    })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
