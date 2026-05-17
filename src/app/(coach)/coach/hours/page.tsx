import { AlertTriangle, Calendar, CheckCircle2, Clock, MapPin, TrendingUp, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  calculateTeachingPayEntries,
  COACH_TEACHING_RULES_SETTING_KEY,
  getCoachTeachingRule,
  getHoursBetween,
  getWeekInfo,
  normalizeCoachEmploymentType,
  normalizeCoachTeachingRulesSettings,
} from '@/lib/coach-teaching-rules'
import { getCoachTeachingHourSourceRows, type CoachTeachingHourSourceRow } from '@/lib/coach-teaching-hours'
import { createClient } from '@/lib/supabase/server'

interface ProfileRow {
  coach_employment_type: string | null
}

interface CoachTeachingRulesSettingRow {
  value: unknown
}

function toInputDate(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }).format(new Date(`${value}T00:00:00`))
}

function formatTime(value: string) {
  return value.slice(0, 5)
}

function formatNumber(value: number, maximumFractionDigits = 1) {
  return value.toLocaleString('th-TH', { maximumFractionDigits })
}

function formatCurrency(value: number) {
  return value.toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

function isPastSlot(row: CoachTeachingHourSourceRow) {
  return new Date(`${row.date}T${row.end_time}`).getTime() < Date.now()
}

function getEvidenceLabel(row: CoachTeachingHourSourceRow) {
  if (row.is_verified) return { label: 'ครบหลักฐาน', className: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 }
  if (!row.has_checkin) {
    return {
      label: isPastSlot(row) ? 'ยังไม่เช็คอิน' : 'รอถึงรอบสอน',
      className: 'border-gray-200 bg-white text-gray-500',
      icon: Clock,
    }
  }
  if (!row.has_photo) return { label: 'ไม่มีรูป', className: 'border-orange-200 bg-orange-50 text-orange-700', icon: AlertTriangle }
  if (!row.has_location) return { label: 'ไม่มีพิกัด', className: 'border-orange-200 bg-orange-50 text-orange-700', icon: MapPin }
  return { label: 'ยังไม่เช็คชื่อ', className: 'border-red-200 bg-red-50 text-red-700', icon: XCircle }
}

export default async function HoursPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const currentWeek = getWeekInfo(toInputDate(now))

  const [{ data: profile }, { data: teachingRulesSetting }, rows] = await Promise.all([
    supabase
      .from('profiles')
      .select('coach_employment_type')
      .eq('id', user.id)
      .single() as unknown as PromiseLike<{ data: ProfileRow | null }>,
    supabase
      .from('system_settings')
      .select('value')
      .eq('key', COACH_TEACHING_RULES_SETTING_KEY)
      .maybeSingle() as unknown as PromiseLike<{ data: CoachTeachingRulesSettingRow | null }>,
    getCoachTeachingHourSourceRows(supabase, {
      coachId: user.id,
      startDate: toInputDate(monthStart),
      endDateExclusive: toInputDate(nextMonthStart),
    }),
  ])

  const teachingRules = normalizeCoachTeachingRulesSettings(teachingRulesSetting?.value)
  const employmentType = normalizeCoachEmploymentType(profile?.coach_employment_type)
  const rule = employmentType ? getCoachTeachingRule(employmentType, teachingRules) : null
  const verifiedRows = rows.filter((row) => row.is_verified)
  const entries = rule ? calculateTeachingPayEntries(verifiedRows, rule) : []
  const weekEntries = entries.filter((entry) => entry.weekKey === currentWeek.key)
  const pendingEvidence = rows.filter((row) => !row.is_verified && isPastSlot(row))

  const totals = entries.reduce((summary, entry) => {
    summary.totalHours += entry.hours
    summary.payableHours += entry.payableHours
    summary.payableAmount += entry.payableAmount
    if (entry.isPrivate) summary.privateHours += entry.hours
    else summary.groupHours += entry.hours
    return summary
  }, { groupHours: 0, privateHours: 0, totalHours: 0, payableHours: 0, payableAmount: 0 })

  const weekTotals = weekEntries.reduce((summary, entry) => {
    summary.totalHours += entry.hours
    summary.payableHours += entry.payableHours
    summary.payableAmount += entry.payableAmount
    if (entry.isPrivate) summary.privateHours += entry.hours
    else summary.groupHours += entry.hours
    return summary
  }, { groupHours: 0, privateHours: 0, totalHours: 0, payableHours: 0, payableAmount: 0 })

  const monthName = now.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
  const entriesByRowId = new Map(entries.map((entry) => [`${entry.row.assignment_source}-${entry.row.assignment_id}`, entry]))
  const weeklyRows = Array.from(rows.reduce((map, row) => {
    const week = getWeekInfo(row.date)
    if (!map.has(week.key)) {
      map.set(week.key, {
        weekStart: week.key,
        weekEnd: week.end,
        rows: [] as CoachTeachingHourSourceRow[],
      })
    }
    map.get(week.key)?.rows.push(row)
    return map
  }, new Map<string, { weekStart: string; weekEnd: string; rows: CoachTeachingHourSourceRow[] }>()).values())
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .map((week) => {
      const weekVerifiedEntries = week.rows
        .map((row) => entriesByRowId.get(`${row.assignment_source}-${row.assignment_id}`))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      const totalHours = weekVerifiedEntries.reduce((sum, entry) => sum + entry.hours, 0)
      const payableHours = weekVerifiedEntries.reduce((sum, entry) => sum + entry.payableHours, 0)
      const payableAmount = weekVerifiedEntries.reduce((sum, entry) => sum + entry.payableAmount, 0)
      const missingEvidence = week.rows.filter((row) => !row.is_verified && isPastSlot(row)).length

      return {
        ...week,
        totalHours,
        payableHours,
        payableAmount,
        missingEvidence,
        verifiedCount: week.rows.filter((row) => row.is_verified).length,
      }
    })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">สรุปชั่วโมงสอน</h1>
        <p className="mt-1 text-sm text-gray-500">
          เดือน{monthName} นับจากรอบที่เช็คอินพร้อมรูป พิกัด และเช็คชื่อนักเรียนครบเท่านั้น
        </p>
      </div>

      {!rule && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-amber-800">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            ยังไม่ได้กำหนดประเภทโค้ชสำหรับคำนวณชั่วโมงสอน กรุณาแจ้ง Admin/Super Admin ตั้งค่า Full-Time, Half-Time หรือ Part-Time
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-gray-500">สัปดาห์นี้</CardTitle>
            <Clock className="h-4 w-4 text-[#2748bf]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(weekTotals.totalHours)} ชม.</div>
            <div className="mt-0.5 text-[11px] text-gray-400">
              กลุ่ม {formatNumber(weekTotals.groupHours)} / Private {formatNumber(weekTotals.privateHours)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-gray-500">เดือนนี้</CardTitle>
            <Calendar className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totals.totalHours)} ชม.</div>
            <div className="mt-0.5 text-[11px] text-gray-400">
              กลุ่ม {formatNumber(totals.groupHours)} / Private {formatNumber(totals.privateHours)}
            </div>
          </CardContent>
        </Card>

        <Card className={weekTotals.payableHours > 0 ? 'ring-2 ring-orange-400' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-gray-500">{rule?.paysAllHours ? 'ชั่วโมงที่จ่าย' : 'OT สัปดาห์นี้'}</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(weekTotals.payableHours)} ชม.</div>
            {rule && <Badge className="mt-0.5 bg-orange-100 text-[10px] text-orange-700">{rule.shortLabel}</Badge>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-gray-500">ยอดโดยประมาณ</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">฿{formatCurrency(totals.payableAmount)}</div>
            <div className="mt-0.5 text-[11px] text-gray-400">{formatNumber(totals.payableHours)} ชม. ที่เข้าเกณฑ์จ่าย</div>
          </CardContent>
        </Card>
      </div>

      {pendingEvidence.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-orange-500" />
            <div>
              <p className="text-sm font-medium text-orange-700">มี {pendingEvidence.length} รอบที่หลักฐานยังไม่ครบ</p>
              <p className="text-xs text-orange-600">
                รอบที่ยังไม่เช็คอิน ไม่มีรูป ไม่มีพิกัด หรือยังไม่เช็คชื่อ จะยังไม่ถูกนับเข้าชั่วโมงสอน
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-lg font-bold text-[#153c85]">รายละเอียดรอบสอนเดือนนี้</h2>
        {rows.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-400">
              <Clock className="mx-auto mb-2 h-10 w-10 opacity-40" />
              <p className="text-sm">ยังไม่มีรอบสอนที่ได้รับมอบหมายในเดือนนี้</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {weeklyRows.map((week, index) => (
              <details key={week.weekStart} className="overflow-hidden rounded-xl border bg-white shadow-sm" open={index === 0}>
                <summary className="cursor-pointer list-none border-b bg-gray-50 px-4 py-3">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-bold text-[#153c85]">
                        สัปดาห์ {formatDate(week.weekStart)} - {formatDate(week.weekEnd)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {week.rows.length} รอบ · หลักฐานครบ {week.verifiedCount} รอบ · ขาดหลักฐาน {week.missingEvidence} รอบ
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline" className="bg-white">{formatNumber(week.totalHours)} ชม.</Badge>
                      <Badge variant="outline" className="bg-white">จ่าย {formatNumber(week.payableHours)} ชม.</Badge>
                      <Badge className="bg-emerald-100 text-emerald-700">฿{formatCurrency(week.payableAmount)}</Badge>
                    </div>
                  </div>
                </summary>
                <div className="space-y-2 p-3">
                  {week.rows.map((row) => {
                    const evidence = getEvidenceLabel(row)
                    const Icon = evidence.icon

                    return (
                      <div key={`${row.assignment_source}-${row.assignment_id}`} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold">{formatDate(row.date)} {formatTime(row.start_time)}-{formatTime(row.end_time)}</p>
                            <Badge variant="outline" className={evidence.className}>
                              <Icon className="mr-1 h-3.5 w-3.5" />
                              {evidence.label}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {row.branch_name} · {row.course_type || '-'} · ผู้เรียน {row.student_count} คน · เช็คชื่อ {row.attendance_count} รายการ
                          </p>
                        </div>
                        <span className="text-sm font-bold">
                          {row.is_verified ? `${formatNumber(getHoursBetween(row.date, row.start_time, row.end_time))} ชม.` : 'ยังไม่นับ'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
