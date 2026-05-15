import { NextRequest, NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity-log'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import {
  calculateTeachingPayEntries,
  COACH_TEACHING_RULES_SETTING_KEY,
  getCoachTeachingRule,
  getHoursBetween,
  normalizeCoachEmploymentType,
  normalizeCoachTeachingRulesSettings,
} from '@/lib/coach-teaching-rules'
import { getCoachTeachingHourSourceRows } from '@/lib/coach-teaching-hours'

interface CloseWeeklyPayload {
  coachId?: string
  weekStart?: string
  weekEnd?: string
  notes?: string | null
}

interface DbError {
  message: string
}

interface CoachTeachingRulesSettingRow {
  value: unknown
}

function isInputDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to close weekly teaching summary'
}

function getNextDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
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

    const validCoachId = coachId
    const validWeekStart = weekStart
    const validWeekEnd = weekEnd
    const supabase = getServiceRoleClient()
    const [{ data: teachingRulesSetting }, sourceRows] = await Promise.all([
      supabase
        .from('system_settings')
        .select('value')
        .eq('key', COACH_TEACHING_RULES_SETTING_KEY)
        .maybeSingle() as unknown as PromiseLike<{ data: CoachTeachingRulesSettingRow | null }>,
      getCoachTeachingHourSourceRows(supabase, {
        startDate: validWeekStart,
        endDateExclusive: getNextDate(validWeekEnd),
        coachId: validCoachId,
      }),
    ])

    const firstRow = sourceRows[0]
    const employmentType = normalizeCoachEmploymentType(firstRow?.employment_type)
    if (!employmentType) {
      return NextResponse.json({ error: 'กรุณากำหนดประเภทโค้ชก่อนปิดสัปดาห์' }, { status: 400 })
    }

    const missingCheckinCount = sourceRows.filter((row) => row.student_count > 0 && !row.has_checkin).length
    const missingPhotoCount = sourceRows.filter((row) => row.has_checkin && !row.has_photo).length
    const missingLocationCount = sourceRows.filter((row) => row.has_checkin && row.has_photo && !row.has_location).length
    const missingAttendanceCount = sourceRows.filter((row) => row.has_checkin && row.has_photo && row.has_location && !row.has_attendance).length
    const verifiedRows = sourceRows.filter((row) => row.is_verified)

    if (verifiedRows.length === 0) {
      return NextResponse.json({ error: 'No verified teaching slots found for this coach and week' }, { status: 400 })
    }

    const teachingRules = normalizeCoachTeachingRulesSettings(teachingRulesSetting?.value)
    const rule = getCoachTeachingRule(employmentType, teachingRules)
    const entries = calculateTeachingPayEntries(verifiedRows, rule)

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
      assignment_source: entry.row.assignment_source,
      schedule_slot_id: entry.row.schedule_slot_id,
      branch_name: entry.row.branch_name,
      course_type: entry.row.course_type,
      date: entry.row.date,
      start_time: entry.row.start_time,
      end_time: entry.row.end_time,
      checkin_id: entry.row.checkin_id,
      checkin_time: entry.row.checkin_time,
      photo_url: entry.row.photo_url,
      location_lat: entry.row.location_lat,
      location_lng: entry.row.location_lng,
      student_count: entry.row.student_count,
      attendance_count: entry.row.attendance_count,
      hours: getHoursBetween(entry.row.date, entry.row.start_time, entry.row.end_time),
      regular_hours: entry.regularHours,
      payable_hours: entry.payableHours,
      payable_amount: entry.payableAmount,
      week_key: entry.weekKey,
    }))

    const { data: summary, error } = await supabase
      .from('coach_weekly_teaching_summaries')
      .upsert({
        coach_id: validCoachId,
        week_start: validWeekStart,
        week_end: validWeekEnd,
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
          coachName: firstRow?.coach_name || null,
          evidenceCounts: {
            missingCheckinCount,
            missingPhotoCount,
            missingLocationCount,
            missingAttendanceCount,
          },
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
        coachId: validCoachId,
        weekStart: validWeekStart,
        weekEnd: validWeekEnd,
        employmentType,
        totalHours: totals.totalHours,
        payableHours: totals.payableHours,
        payableAmount: totals.payableAmount,
        payableSessionCount: entries.length,
        missingCheckinCount,
        missingPhotoCount,
        missingLocationCount,
        missingAttendanceCount,
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
