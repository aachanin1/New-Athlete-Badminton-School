'use client'

import { useMemo, useState } from 'react'
import { COACH_OVERTIME } from '@/constants/pricing'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertCircle,
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Search,
  ShieldCheck,
  TrendingUp,
  User,
  Wallet,
  XCircle,
} from 'lucide-react'

interface PayrollSourceRow {
  assignment_id: string
  coach_id: string
  coach_name: string
  schedule_slot_id: string
  branch_name: string
  course_type: string
  date: string
  start_time: string
  end_time: string
  checkin_id: string | null
  checkin_time: string | null
  photo_url: string | null
}

interface PayableEntry {
  row: PayrollSourceRow
  hours: number
  regularHours: number
  otHours: number
  otPay: number
  isPrivate: boolean
  weekKey: string
  weekLabel: string
}

interface WeeklySummary {
  key: string
  label: string
  totalHours: number
  groupHours: number
  privateHours: number
  regularHours: number
  otGroupHours: number
  otPrivateHours: number
  otHours: number
  otPay: number
  entries: PayableEntry[]
}

interface CoachSummary {
  coach_id: string
  coach_name: string
  assignedRows: PayrollSourceRow[]
  payableRows: PayrollSourceRow[]
  payableEntries: PayableEntry[]
  missingRows: PayrollSourceRow[]
  noPhotoRows: PayrollSourceRow[]
  weeklyBreakdown: WeeklySummary[]
  groupHours: number
  privateHours: number
  totalHours: number
  regularHours: number
  otGroupHours: number
  otPrivateHours: number
  otHours: number
  otPay: number
}

interface PayrollClientProps {
  rows: PayrollSourceRow[]
  currentMonth: number
  currentYear: number
}

const MONTH_LABELS = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const OT_THRESHOLD_WEEKLY = COACH_OVERTIME.weeklyThreshold
const OT_RATE_PRIVATE = COACH_OVERTIME.privateRate
const OT_RATE_GROUP = COACH_OVERTIME.groupRate

function getHours(row: PayrollSourceRow) {
  const start = new Date(`${row.date}T${row.start_time}`)
  const end = new Date(`${row.date}T${row.end_time}`)
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60))
}

function isPrivateCourse(courseType: string) {
  const value = courseType.toLowerCase()
  return value.includes('private') || value.includes('ส่วน')
}

function isPastSlot(row: PayrollSourceRow) {
  return new Date(`${row.date}T${row.end_time}`).getTime() < Date.now()
}

function isPayable(row: PayrollSourceRow) {
  return Boolean(row.checkin_id && row.photo_url)
}

function formatInputDate(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getWeekInfo(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`)
  const start = new Date(date)
  start.setDate(date.getDate() - date.getDay())
  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  return {
    key: formatInputDate(start),
    label: `${formatDate(formatInputDate(start))} - ${formatDate(formatInputDate(end))}`,
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }).format(new Date(`${value}T00:00:00`))
}

function formatTime(value: string) {
  return value.slice(0, 5)
}

function formatNumber(value: number) {
  return value.toLocaleString('th-TH', { maximumFractionDigits: 1 })
}

function formatCurrency(value: number) {
  return value.toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

function buildPayrollEntries(payableRows: PayrollSourceRow[]) {
  const weeklyHours = new Map<string, number>()

  return [...payableRows]
    .sort((a, b) => `${a.date}T${a.start_time}`.localeCompare(`${b.date}T${b.start_time}`))
    .map<PayableEntry>((row) => {
      const hours = getHours(row)
      const week = getWeekInfo(row.date)
      const usedHours = weeklyHours.get(week.key) || 0
      const regularCapacity = Math.max(0, OT_THRESHOLD_WEEKLY - usedHours)
      const regularHours = Math.min(hours, regularCapacity)
      const otHours = Math.max(0, hours - regularHours)
      const isPrivate = isPrivateCourse(row.course_type)
      const otPay = otHours * (isPrivate ? OT_RATE_PRIVATE : OT_RATE_GROUP)

      weeklyHours.set(week.key, usedHours + hours)

      return {
        row,
        hours,
        regularHours,
        otHours,
        otPay,
        isPrivate,
        weekKey: week.key,
        weekLabel: week.label,
      }
    })
}

function buildWeeklyBreakdown(entries: PayableEntry[]) {
  const weeks = new Map<string, WeeklySummary>()

  entries.forEach((entry) => {
    if (!weeks.has(entry.weekKey)) {
      weeks.set(entry.weekKey, {
        key: entry.weekKey,
        label: entry.weekLabel,
        totalHours: 0,
        groupHours: 0,
        privateHours: 0,
        regularHours: 0,
        otGroupHours: 0,
        otPrivateHours: 0,
        otHours: 0,
        otPay: 0,
        entries: [],
      })
    }

    const week = weeks.get(entry.weekKey)
    if (!week) return

    week.totalHours += entry.hours
    week.regularHours += entry.regularHours
    week.otHours += entry.otHours
    week.otPay += entry.otPay
    week.entries.push(entry)

    if (entry.isPrivate) {
      week.privateHours += entry.hours
      week.otPrivateHours += entry.otHours
    } else {
      week.groupHours += entry.hours
      week.otGroupHours += entry.otHours
    }
  })

  return Array.from(weeks.values()).sort((a, b) => a.key.localeCompare(b.key))
}

export function PayrollClient({ rows, currentMonth, currentYear }: PayrollClientProps) {
  const [search, setSearch] = useState('')
  const [viewMonth, setViewMonth] = useState(currentMonth)
  const [viewYear, setViewYear] = useState(currentYear)
  const [filterStatus, setFilterStatus] = useState('all')

  const years = useMemo(() => {
    const values = new Set(rows.map((row) => new Date(`${row.date}T00:00:00`).getFullYear()))
    values.add(currentYear)
    return Array.from(values).sort((a, b) => b - a)
  }, [currentYear, rows])

  const monthRows = useMemo(() => {
    return rows.filter((row) => {
      const date = new Date(`${row.date}T00:00:00`)
      if (date.getMonth() + 1 !== viewMonth || date.getFullYear() !== viewYear) return false
      if (filterStatus === 'payable' && !isPayable(row)) return false
      if (filterStatus === 'missing' && (row.checkin_id || !isPastSlot(row))) return false
      if (filterStatus === 'no_photo' && !(row.checkin_id && !row.photo_url)) return false
      if (!search.trim()) return true

      const q = search.trim().toLowerCase()
      return [row.coach_name, row.branch_name, row.course_type, row.schedule_slot_id].some((value) => value.toLowerCase().includes(q))
    })
  }, [filterStatus, rows, search, viewMonth, viewYear])

  const coachSummaries = useMemo<CoachSummary[]>(() => {
    const groups = new Map<string, PayrollSourceRow[]>()
    monthRows.forEach((row) => {
      if (!groups.has(row.coach_id)) groups.set(row.coach_id, [])
      groups.get(row.coach_id)?.push(row)
    })

    return Array.from(groups.entries())
      .map(([coachId, entries]) => {
        const payableRows = entries.filter(isPayable)
        const missingRows = entries.filter((row) => !row.checkin_id && isPastSlot(row))
        const noPhotoRows = entries.filter((row) => row.checkin_id && !row.photo_url)
        const payableEntries = buildPayrollEntries(payableRows)
        const weeklyBreakdown = buildWeeklyBreakdown(payableEntries)

        return payableEntries.reduce<CoachSummary>((summary, entry) => {
          if (entry.isPrivate) {
            summary.privateHours += entry.hours
            summary.otPrivateHours += entry.otHours
          } else {
            summary.groupHours += entry.hours
            summary.otGroupHours += entry.otHours
          }

          summary.totalHours += entry.hours
          summary.regularHours += entry.regularHours
          summary.otHours += entry.otHours
          summary.otPay += entry.otPay
          return summary
        }, {
          coach_id: coachId,
          coach_name: entries[0]?.coach_name || 'ไม่ทราบชื่อ',
          assignedRows: entries,
          payableRows,
          payableEntries,
          missingRows,
          noPhotoRows,
          weeklyBreakdown,
          groupHours: 0,
          privateHours: 0,
          totalHours: 0,
          regularHours: 0,
          otGroupHours: 0,
          otPrivateHours: 0,
          otHours: 0,
          otPay: 0,
        })
      })
      .sort((a, b) => b.otPay - a.otPay || b.totalHours - a.totalHours || b.assignedRows.length - a.assignedRows.length)
  }, [monthRows])

  const stats = useMemo(() => {
    const payable = monthRows.filter(isPayable)
    const missing = monthRows.filter((row) => !row.checkin_id && isPastSlot(row))
    const noPhoto = monthRows.filter((row) => row.checkin_id && !row.photo_url)
    const payableHours = payable.reduce((sum, row) => sum + getHours(row), 0)
    const otHours = coachSummaries.reduce((sum, coach) => sum + coach.otHours, 0)
    const otPay = coachSummaries.reduce((sum, coach) => sum + coach.otPay, 0)

    return {
      coaches: coachSummaries.length,
      assigned: monthRows.length,
      payable: payable.length,
      missing: missing.length,
      noPhoto: noPhoto.length,
      payableHours,
      otHours,
      otPay,
      coachesWithOT: coachSummaries.filter((coach) => coach.otHours > 0).length,
    }
  }, [coachSummaries, monthRows])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#2748bf]">
            <Wallet className="h-4 w-4" />
            Payroll Review
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">เงินเดือนโค้ช</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            สรุปรอบสอนที่พร้อมนำไปคิดเงิน โดยนับเฉพาะรอบที่โค้ชเช็คอินและมีรูปหลักฐาน พร้อมคำนวณ OT รายสัปดาห์ตาม requirement
          </p>
        </div>

        <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
          <p className="font-semibold">กฎ OT: เกิน {OT_THRESHOLD_WEEKLY} ชม./สัปดาห์</p>
          <p>Private {formatCurrency(OT_RATE_PRIVATE)} บาท/ชม. • กลุ่ม {formatCurrency(OT_RATE_GROUP)} บาท/ชม.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <p className="text-xs text-gray-500">โค้ช</p>
              <p className="mt-1 text-xl font-bold text-[#2748bf]">{stats.coaches}</p>
            </div>
            <User className="h-5 w-5 text-[#2748bf]" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <p className="text-xs text-gray-500">รอบมอบหมาย</p>
              <p className="mt-1 text-xl font-bold text-blue-600">{stats.assigned}</p>
            </div>
            <CalendarDays className="h-5 w-5 text-blue-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <p className="text-xs text-gray-500">พร้อมคิดเงิน</p>
              <p className="mt-1 text-xl font-bold text-emerald-600">{stats.payable}</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
          </CardContent>
        </Card>
        <Card className={stats.missing + stats.noPhoto > 0 ? 'border-red-300 bg-red-50/40' : 'border-gray-200'}>
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <p className="text-xs text-gray-500">ยังไม่ครบ</p>
              <p className="mt-1 text-xl font-bold text-red-600">{stats.missing + stats.noPhoto}</p>
            </div>
            <AlertCircle className="h-5 w-5 text-red-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <p className="text-xs text-gray-500">ชั่วโมงพร้อมจ่าย</p>
              <p className="mt-1 text-xl font-bold text-orange-500">{formatNumber(stats.payableHours)} ชม.</p>
            </div>
            <Clock className="h-5 w-5 text-orange-500" />
          </CardContent>
        </Card>
        <Card className={stats.otHours > 0 ? 'border-orange-300 bg-orange-50/50' : 'border-gray-200'}>
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <p className="text-xs text-gray-500">OT / ค่า OT</p>
              <p className="mt-1 text-lg font-bold text-orange-600">{formatNumber(stats.otHours)} ชม.</p>
              <p className="text-xs font-semibold text-gray-700">฿{formatCurrency(stats.otPay)}</p>
            </div>
            <Banknote className="h-5 w-5 text-orange-500" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200">
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(260px,1fr)_150px_130px_190px_auto] lg:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-10"
              placeholder="ค้นหาโค้ช, สาขา, คอร์ส..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select value={String(viewMonth)} onValueChange={(value) => setViewMonth(Number(value))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_LABELS.slice(1).map((label, index) => (
                <SelectItem key={index + 1} value={String(index + 1)}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(viewYear)} onValueChange={(value) => setViewYear(Number(value))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>{year + 543}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue placeholder="ทุกสถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              <SelectItem value="payable">พร้อมคิดเงิน</SelectItem>
              <SelectItem value="missing">ยังไม่เช็คอิน</SelectItem>
              <SelectItem value="no_photo">ไม่มีรูป</SelectItem>
            </SelectContent>
          </Select>
          <p className="whitespace-nowrap text-sm text-gray-500">แสดง {coachSummaries.length} โค้ช</p>
        </CardContent>
      </Card>

      {coachSummaries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center text-gray-400">
            <Wallet className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ไม่พบข้อมูลเงินเดือนตามเงื่อนไขที่เลือก</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {coachSummaries.map((coach) => (
            <Card key={coach.coach_id} className={coach.missingRows.length + coach.noPhotoRows.length > 0 ? 'border-amber-200' : 'border-gray-200'}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 border-b pb-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#2748bf]">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-950">{coach.coach_name}</p>
                      <p className="text-xs text-gray-500">{MONTH_LABELS[viewMonth]} {viewYear + 543}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                    <div className="rounded-lg bg-blue-50 px-3 py-2">
                      <p className="text-xs text-gray-500">กลุ่ม</p>
                      <p className="font-bold text-blue-600">{formatNumber(coach.groupHours)} ชม.</p>
                    </div>
                    <div className="rounded-lg bg-orange-50 px-3 py-2">
                      <p className="text-xs text-gray-500">Private</p>
                      <p className="font-bold text-orange-600">{formatNumber(coach.privateHours)} ชม.</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 px-3 py-2">
                      <p className="text-xs text-gray-500">รวมจ่าย</p>
                      <p className="font-bold text-emerald-700">{formatNumber(coach.totalHours)} ชม.</p>
                    </div>
                    <div className={coach.otHours > 0 ? 'rounded-lg bg-orange-100 px-3 py-2' : 'rounded-lg bg-gray-50 px-3 py-2'}>
                      <p className="text-xs text-gray-500">OT</p>
                      <p className="font-bold text-orange-700">{formatNumber(coach.otHours)} ชม.</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-3 py-2">
                      <p className="text-xs text-gray-500">ค่า OT</p>
                      <p className="font-bold text-gray-900">฿{formatCurrency(coach.otPay)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/70 p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#153c85]">
                      <TrendingUp className="h-4 w-4" />
                      สรุปรายสัปดาห์
                    </div>
                    {coach.otHours > 0 && (
                      <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                        OT {formatNumber(coach.otGroupHours)} ชม. กลุ่ม / {formatNumber(coach.otPrivateHours)} ชม. Private
                      </Badge>
                    )}
                  </div>

                  {coach.weeklyBreakdown.length === 0 ? (
                    <p className="text-sm text-gray-400">ยังไม่มีรอบที่พร้อมคิดเงินในเดือนนี้</p>
                  ) : (
                    <div className="grid gap-2 xl:grid-cols-2">
                      {coach.weeklyBreakdown.map((week) => (
                        <div key={week.key} className={week.otHours > 0 ? 'rounded-lg border border-orange-200 bg-white p-3' : 'rounded-lg border bg-white p-3'}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{week.label}</p>
                              <p className="mt-0.5 text-xs text-gray-500">
                                กลุ่ม {formatNumber(week.groupHours)} ชม. • Private {formatNumber(week.privateHours)} ชม.
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-gray-950">{formatNumber(week.totalHours)} ชม.</p>
                              <p className={week.otHours > 0 ? 'text-xs font-semibold text-orange-600' : 'text-xs text-gray-400'}>
                                OT {formatNumber(week.otHours)} ชม. / ฿{formatCurrency(week.otPay)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className={week.otHours > 0 ? 'h-full rounded-full bg-orange-400' : 'h-full rounded-full bg-emerald-400'}
                              style={{ width: `${Math.min(100, (week.totalHours / OT_THRESHOLD_WEEKLY) * 100)}%` }}
                            />
                          </div>
                          <p className="mt-1 text-[11px] text-gray-400">
                            ปกติ {formatNumber(week.regularHours)} ชม. • เกณฑ์ {OT_THRESHOLD_WEEKLY} ชม./สัปดาห์
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      รอบพร้อมคิดเงิน
                    </div>
                    {coach.payableEntries.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-gray-400">ยังไม่มีรอบที่เช็คอินพร้อมรูป</div>
                    ) : (
                      <div className="space-y-2">
                        {coach.payableEntries.slice(0, 8).map((entry) => (
                          <div key={entry.row.assignment_id} className={entry.otHours > 0 ? 'rounded-lg border border-orange-200 bg-orange-50/40 p-3 text-sm' : 'rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 text-sm'}>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">พร้อมจ่าย</Badge>
                              {entry.otHours > 0 && (
                                <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                                  OT {formatNumber(entry.otHours)} ชม.
                                </Badge>
                              )}
                              <span className="font-medium">{formatDate(entry.row.date)} {formatTime(entry.row.start_time)}-{formatTime(entry.row.end_time)}</span>
                            </div>
                            <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-gray-500">
                              <Building2 className="h-3.5 w-3.5" />
                              {entry.row.branch_name} • {entry.row.course_type || '-'} • รวม {formatNumber(entry.hours)} ชม.
                              {entry.otPay > 0 && <span className="font-semibold text-orange-700">• ค่า OT ฿{formatCurrency(entry.otPay)}</span>}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700">
                      <AlertCircle className="h-4 w-4" />
                      รอบที่ต้องตรวจ
                    </div>
                    {[...coach.missingRows, ...coach.noPhotoRows].length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-gray-400">ไม่มีรอบค้างตรวจ</div>
                    ) : (
                      <div className="space-y-2">
                        {[...coach.missingRows, ...coach.noPhotoRows].slice(0, 8).map((row) => (
                          <div key={row.assignment_id} className="rounded-lg border border-amber-100 bg-amber-50/40 p-3 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              {row.checkin_id ? (
                                <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
                                  <ImageIcon className="mr-1 h-3.5 w-3.5" />
                                  ไม่มีรูป
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                                  <XCircle className="mr-1 h-3.5 w-3.5" />
                                  ยังไม่เช็คอิน
                                </Badge>
                              )}
                              <span className="font-medium">{formatDate(row.date)} {formatTime(row.start_time)}-{formatTime(row.end_time)}</span>
                            </div>
                            <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                              <Building2 className="h-3.5 w-3.5" />
                              {row.branch_name} • {row.course_type || '-'}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
