'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Banknote,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  Eye,
  Image as ImageIcon,
  Loader2,
  MapPin,
  ReceiptText,
  Search,
  ShieldCheck,
  TrendingUp,
  User,
  Wallet,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { ListPagination } from '@/components/admin/list-pagination'
import {
  calculateTeachingPayEntries,
  getCoachTeachingOptions,
  getCoachTeachingRule,
  getWeekInfo,
  normalizeCoachEmploymentType,
  type CoachEmploymentType,
  type CoachTeachingRules,
  type TeachingPayEntry,
  type TeachingSlotForCalculation,
} from '@/lib/coach-teaching-rules'
import { cn } from '@/lib/utils'

interface PayrollSourceRow extends TeachingSlotForCalculation {
  assignment_id: string
  assignment_source: 'group' | 'legacy'
  coach_id: string
  coach_name: string
  employment_type: string | null
  schedule_slot_id: string
  branch_name: string
  checkin_id: string | null
  checkin_time: string | null
  photo_url: string | null
  location_lat: number | null
  location_lng: number | null
  student_count: number
  attendance_count: number
  has_checkin: boolean
  has_photo: boolean
  has_location: boolean
  has_attendance: boolean
  is_verified: boolean
}

interface WeeklySummaryData {
  id: string
  coach_id: string
  week_start: string
  week_end: string
  coach_employment_type: string
  threshold_hours: number
  group_hours: number
  private_hours: number
  total_hours: number
  regular_hours: number
  payable_group_hours: number
  payable_private_hours: number
  payable_hours: number
  private_rate: number
  group_rate: number
  payable_amount: number
  payable_session_count: number
  missing_checkin_count: number
  missing_photo_count: number
  status: string
  notes: string | null
  closed_at: string
  closed_by: string | null
  closed_by_name: string | null
}

interface WeekBreakdown {
  weekStart: string
  weekEnd: string
  label: string
  assignedRows: PayrollSourceRow[]
  payableEntries: TeachingPayEntry<PayrollSourceRow>[]
  missingRows: PayrollSourceRow[]
  noPhotoRows: PayrollSourceRow[]
  noLocationRows: PayrollSourceRow[]
  noAttendanceRows: PayrollSourceRow[]
  groupHours: number
  privateHours: number
  totalHours: number
  regularHours: number
  payableGroupHours: number
  payablePrivateHours: number
  payableHours: number
  payableAmount: number
}

interface CoachSummary {
  coach_id: string
  coach_name: string
  employmentType: CoachEmploymentType | null
  assignedRows: PayrollSourceRow[]
  payableEntries: TeachingPayEntry<PayrollSourceRow>[]
  missingRows: PayrollSourceRow[]
  noPhotoRows: PayrollSourceRow[]
  noLocationRows: PayrollSourceRow[]
  noAttendanceRows: PayrollSourceRow[]
  weeklyBreakdown: WeekBreakdown[]
  groupHours: number
  privateHours: number
  totalHours: number
  regularHours: number
  payableGroupHours: number
  payablePrivateHours: number
  payableHours: number
  payableAmount: number
}

interface PayrollClientProps {
  rows: PayrollSourceRow[]
  currentMonth: number
  currentYear: number
  teachingRules: CoachTeachingRules
  summaries: WeeklySummaryData[]
}

const MONTH_LABELS = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

const EMPLOYMENT_BADGES: Record<CoachEmploymentType, string> = {
  full_time: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  half_time: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  part_time: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
}

function isPastSlot(row: PayrollSourceRow) {
  return new Date(`${row.date}T${row.end_time}`).getTime() < Date.now()
}

function isPayable(row: PayrollSourceRow) {
  return row.is_verified
}

function isMissingCheckin(row: PayrollSourceRow) {
  return row.student_count > 0 && !row.has_checkin && isPastSlot(row)
}

function isMissingPhoto(row: PayrollSourceRow) {
  return row.has_checkin && !row.has_photo
}

function isMissingLocation(row: PayrollSourceRow) {
  return row.has_checkin && row.has_photo && !row.has_location
}

function isMissingAttendance(row: PayrollSourceRow) {
  return row.has_checkin && row.has_photo && row.has_location && !row.has_attendance
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

function getEmploymentLabel(employmentType: CoachEmploymentType | null, teachingRules: CoachTeachingRules) {
  if (!employmentType) return 'ยังไม่กำหนด'
  return getCoachTeachingRule(employmentType, teachingRules).label
}

function buildWeekBreakdown(
  assignedRows: PayrollSourceRow[],
  payableEntries: TeachingPayEntry<PayrollSourceRow>[],
) {
  const weeks = new Map<string, WeekBreakdown>()

  assignedRows.forEach((row) => {
    const week = getWeekInfo(row.date)
    if (!weeks.has(week.key)) {
      weeks.set(week.key, {
        weekStart: week.key,
        weekEnd: week.end,
        label: `${formatDate(week.key)} - ${formatDate(week.end)}`,
        assignedRows: [],
        payableEntries: [],
        missingRows: [],
        noPhotoRows: [],
        noLocationRows: [],
        noAttendanceRows: [],
        groupHours: 0,
        privateHours: 0,
        totalHours: 0,
        regularHours: 0,
        payableGroupHours: 0,
        payablePrivateHours: 0,
        payableHours: 0,
        payableAmount: 0,
      })
    }

    const summary = weeks.get(week.key)
    if (!summary) return
    summary.assignedRows.push(row)
    if (isMissingCheckin(row)) summary.missingRows.push(row)
    if (isMissingPhoto(row)) summary.noPhotoRows.push(row)
    if (isMissingLocation(row)) summary.noLocationRows.push(row)
    if (isMissingAttendance(row)) summary.noAttendanceRows.push(row)
  })

  payableEntries.forEach((entry) => {
    const summary = weeks.get(entry.weekKey)
    if (!summary) return

    summary.payableEntries.push(entry)
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
  })

  return Array.from(weeks.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

function getEvidenceBadge(row: PayrollSourceRow) {
  if (row.is_verified) {
    return {
      label: 'ครบหลักฐาน',
      className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
      icon: CheckCircle2,
    }
  }
  if (!row.has_checkin) {
    return {
      label: 'ยังไม่เช็คอิน',
      className: 'border-red-200 bg-red-50 text-red-700',
      icon: XCircle,
    }
  }
  if (!row.has_photo) {
    return {
      label: 'ไม่มีรูป',
      className: 'border-orange-200 bg-orange-50 text-orange-700',
      icon: ImageIcon,
    }
  }
  if (!row.has_location) {
    return {
      label: 'ไม่มีพิกัด',
      className: 'border-orange-200 bg-orange-50 text-orange-700',
      icon: MapPin,
    }
  }
  return {
    label: 'ยังไม่เช็คชื่อ',
    className: 'border-red-200 bg-red-50 text-red-700',
    icon: XCircle,
  }
}

export function PayrollClient({ rows, currentMonth, currentYear, teachingRules, summaries }: PayrollClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [viewMonth, setViewMonth] = useState(currentMonth)
  const [viewYear, setViewYear] = useState(currentYear)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterEmployment, setFilterEmployment] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [closingKey, setClosingKey] = useState<string | null>(null)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null)
  const [closeTarget, setCloseTarget] = useState<{ coach: CoachSummary; week: WeekBreakdown } | null>(null)
  const [closeNotes, setCloseNotes] = useState('')

  const years = useMemo(() => {
    const values = new Set(rows.map((row) => new Date(`${row.date}T00:00:00`).getFullYear()))
    values.add(currentYear)
    return Array.from(values).sort((a, b) => b - a)
  }, [currentYear, rows])

  const employmentOptions = useMemo(() => getCoachTeachingOptions(teachingRules), [teachingRules])

  const monthRows = useMemo(() => {
    return rows.filter((row) => {
      const date = new Date(`${row.date}T00:00:00`)
      if (date.getMonth() + 1 !== viewMonth || date.getFullYear() !== viewYear) return false

      const employmentType = normalizeCoachEmploymentType(row.employment_type)
      if (filterEmployment !== 'all' && employmentType !== filterEmployment) return false
      if (filterStatus === 'payable' && !isPayable(row)) return false
      if (filterStatus === 'missing' && !isMissingCheckin(row)) return false
      if (filterStatus === 'no_photo' && !isMissingPhoto(row)) return false
      if (filterStatus === 'no_location' && !isMissingLocation(row)) return false
      if (filterStatus === 'no_attendance' && !isMissingAttendance(row)) return false
      if (filterStatus === 'missing_employment' && employmentType) return false
      if (!search.trim()) return true

      const q = search.trim().toLowerCase()
      return [row.coach_name, row.branch_name, row.course_type, row.schedule_slot_id].some((value) => value.toLowerCase().includes(q))
    })
  }, [filterEmployment, filterStatus, rows, search, viewMonth, viewYear])

  const closedSummaryMap = useMemo(() => {
    const map = new Map<string, WeeklySummaryData>()
    summaries.forEach((summary) => {
      map.set(`${summary.coach_id}:${summary.week_start}`, summary)
    })
    return map
  }, [summaries])

  const coachSummaries = useMemo<CoachSummary[]>(() => {
    const groups = new Map<string, PayrollSourceRow[]>()
    monthRows.forEach((row) => {
      if (!groups.has(row.coach_id)) groups.set(row.coach_id, [])
      groups.get(row.coach_id)?.push(row)
    })

    return Array.from(groups.entries())
      .map(([coachId, entries]) => {
        const employmentType = normalizeCoachEmploymentType(entries[0]?.employment_type)
        const payableRows = entries.filter(isPayable)
        const missingRows = entries.filter(isMissingCheckin)
        const noPhotoRows = entries.filter(isMissingPhoto)
        const noLocationRows = entries.filter(isMissingLocation)
        const noAttendanceRows = entries.filter(isMissingAttendance)
        const payableEntries = employmentType
          ? calculateTeachingPayEntries(payableRows, getCoachTeachingRule(employmentType, teachingRules))
          : []
        const weeklyBreakdown = buildWeekBreakdown(entries, payableEntries)

        return payableEntries.reduce<CoachSummary>((summary, entry) => {
          if (entry.isPrivate) {
            summary.privateHours += entry.hours
            summary.payablePrivateHours += entry.payableHours
          } else {
            summary.groupHours += entry.hours
            summary.payableGroupHours += entry.payableHours
          }

          summary.totalHours += entry.hours
          summary.regularHours += entry.regularHours
          summary.payableHours += entry.payableHours
          summary.payableAmount += entry.payableAmount
          return summary
        }, {
          coach_id: coachId,
          coach_name: entries[0]?.coach_name || 'ไม่ทราบชื่อ',
          employmentType,
          assignedRows: entries,
          payableEntries,
          missingRows,
          noPhotoRows,
          noLocationRows,
          noAttendanceRows,
          weeklyBreakdown,
          groupHours: 0,
          privateHours: 0,
          totalHours: 0,
          regularHours: 0,
          payableGroupHours: 0,
          payablePrivateHours: 0,
          payableHours: 0,
          payableAmount: 0,
        })
      })
      .sort((a, b) => b.payableAmount - a.payableAmount || b.totalHours - a.totalHours || a.coach_name.localeCompare(b.coach_name))
  }, [monthRows, teachingRules])

  const stats = useMemo(() => {
    const payable = monthRows.filter(isPayable)
    const missing = monthRows.filter(isMissingCheckin)
    const noPhoto = monthRows.filter(isMissingPhoto)
    const noLocation = monthRows.filter(isMissingLocation)
    const noAttendance = monthRows.filter(isMissingAttendance)
    const missingEmployment = coachSummaries.filter((coach) => !coach.employmentType).length
    const payableHours = coachSummaries.reduce((sum, coach) => sum + coach.payableHours, 0)
    const payableAmount = coachSummaries.reduce((sum, coach) => sum + coach.payableAmount, 0)

    return {
      coaches: coachSummaries.length,
      assigned: monthRows.length,
      payable: payable.length,
      missing: missing.length,
      noPhoto: noPhoto.length,
      noLocation: noLocation.length,
      noAttendance: noAttendance.length,
      missingEmployment,
      payableHours,
      payableAmount,
    }
  }, [coachSummaries, monthRows])

  const selectedCoach = useMemo(() => {
    return coachSummaries.find((coach) => coach.coach_id === selectedCoachId) || null
  }, [coachSummaries, selectedCoachId])

  const totalPages = Math.max(1, Math.ceil(coachSummaries.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedCoachSummaries = coachSummaries.slice((safePage - 1) * pageSize, safePage * pageSize)

  const openCloseWeekDialog = (coach: CoachSummary, week: WeekBreakdown) => {
    if (!coach.employmentType || week.payableEntries.length === 0) return
    setCloseTarget({ coach, week })
    setCloseNotes('')
    setCloseError(null)
  }

  const closeWeek = async (coach: CoachSummary, week: WeekBreakdown, note: string) => {
    if (!coach.employmentType || week.payableEntries.length === 0) return

    const key = `${coach.coach_id}:${week.weekStart}`
    setClosingKey(key)
    setCloseError(null)

    try {
      const response = await fetch('/api/admin/coach-payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId: coach.coach_id,
          weekStart: week.weekStart,
          weekEnd: week.weekEnd,
          notes: note.trim() || null,
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'ปิดสัปดาห์ไม่สำเร็จ')
      setCloseTarget(null)
      setCloseNotes('')
      router.refresh()
    } catch (error) {
      setCloseError(error instanceof Error ? error.message : 'ปิดสัปดาห์ไม่สำเร็จ')
    } finally {
      setClosingKey(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#2748bf]">
            <Wallet className="h-4 w-4" />
            Teaching Hours Review
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">คำนวณชั่วโมงสอน</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            สรุปชั่วโมงสอนรายสัปดาห์จากรอบที่ assign แล้ว โค้ชเช็คอินพร้อมรูปเซลฟี่ พิกัด และเช็คชื่อนักเรียนครบ โดยไม่รวมเงินเดือนฐานของโค้ช
          </p>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <p className="font-semibold">กฎรายสัปดาห์</p>
          <p>FT เกิน 25 ชม. | HT เกิน 12.5 ชม. | PT คิดทุกชั่วโมง</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="โค้ช" value={stats.coaches} icon={User} valueClassName="text-[#2748bf]" />
        <StatCard label="รอบมอบหมาย" value={stats.assigned} icon={CalendarDays} valueClassName="text-blue-600" />
        <StatCard label="รอบครบหลักฐาน" value={stats.payable} icon={ShieldCheck} valueClassName="text-emerald-600" />
        <StatCard
          label="ยังไม่ครบ"
          value={stats.missing + stats.noPhoto + stats.noLocation + stats.noAttendance}
          icon={AlertCircle}
          valueClassName="text-red-600"
          className={stats.missing + stats.noPhoto + stats.noLocation + stats.noAttendance > 0 ? 'border-red-300 bg-red-50/40' : ''}
        />
        <StatCard
          label="ยังไม่ตั้งประเภท"
          value={stats.missingEmployment}
          icon={BriefcaseBusiness}
          valueClassName="text-amber-600"
          className={stats.missingEmployment > 0 ? 'border-amber-300 bg-amber-50/40' : ''}
        />
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <p className="text-xs text-gray-500">ยอดที่ต้องจ่าย</p>
              <p className="mt-1 text-lg font-bold text-orange-600">฿{formatCurrency(stats.payableAmount)}</p>
              <p className="text-xs text-gray-500">{formatNumber(stats.payableHours)} ชม.</p>
            </div>
            <Banknote className="h-5 w-5 text-orange-500" />
          </CardContent>
        </Card>
      </div>

      {closeError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {closeError}
        </div>
      )}

      <Card className="border-gray-200">
        <CardContent className="grid gap-3 p-4 2xl:grid-cols-[minmax(260px,1fr)_150px_130px_160px_190px_auto] 2xl:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-10"
              placeholder="ค้นหาโค้ช, สาขา, คอร์ส..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </div>
          <Select
            value={String(viewMonth)}
            onValueChange={(value) => {
              setViewMonth(Number(value))
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_LABELS.slice(1).map((label, index) => (
                <SelectItem key={index + 1} value={String(index + 1)}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(viewYear)}
            onValueChange={(value) => {
              setViewYear(Number(value))
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>{year + 543}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filterEmployment}
            onValueChange={(value) => {
              setFilterEmployment(value)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="ทุกประเภท" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกประเภท</SelectItem>
              {employmentOptions.map((option) => (
                <SelectItem key={option.employmentType} value={option.employmentType}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filterStatus}
            onValueChange={(value) => {
              setFilterStatus(value)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="ทุกสถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              <SelectItem value="payable">ครบหลักฐาน</SelectItem>
              <SelectItem value="missing">ยังไม่เช็คอิน</SelectItem>
              <SelectItem value="no_photo">ไม่มีรูป</SelectItem>
              <SelectItem value="no_location">ไม่มีพิกัด</SelectItem>
              <SelectItem value="no_attendance">ยังไม่เช็คชื่อ</SelectItem>
              <SelectItem value="missing_employment">ยังไม่ตั้งประเภทโค้ช</SelectItem>
            </SelectContent>
          </Select>
          <p className="whitespace-nowrap text-sm text-gray-500">แสดง {coachSummaries.length} โค้ช</p>
        </CardContent>
      </Card>

      {coachSummaries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center text-gray-400">
            <Wallet className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ไม่พบข้อมูลชั่วโมงสอนตามเงื่อนไขที่เลือก</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <CoachPayrollSummaryTable
            coaches={pagedCoachSummaries}
            teachingRules={teachingRules}
            selectedCoachId={selectedCoachId}
            onSelectCoach={setSelectedCoachId}
          />
          <ListPagination
            page={safePage}
            pageSize={pageSize}
            total={coachSummaries.length}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value)
              setPage(1)
            }}
          />
        </div>
      )}

      <Sheet open={Boolean(selectedCoach)} onOpenChange={(open) => !open && setSelectedCoachId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-5xl">
          <SheetHeader className="pr-8">
            <SheetTitle className="text-[#153c85]">รายละเอียดชั่วโมงสอนโค้ช</SheetTitle>
          </SheetHeader>
          {selectedCoach && (
            <div className="mt-4">
              <CoachPayrollCard
                coach={selectedCoach}
                teachingRules={teachingRules}
                viewMonth={viewMonth}
                viewYear={viewYear}
                closedSummaryMap={closedSummaryMap}
                closingKey={closingKey}
                onCloseWeek={openCloseWeekDialog}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(closeTarget)} onOpenChange={(open) => !open && !closingKey && setCloseTarget(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">ปิดสัปดาห์สอน</DialogTitle>
          </DialogHeader>
          {closeTarget && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-gray-50 p-3 text-sm">
                <p className="font-bold text-gray-950">{closeTarget.coach.coach_name}</p>
                <p className="mt-1 text-gray-500">{closeTarget.week.label}</p>
                <p className="mt-2 text-sm font-semibold text-orange-600">
                  จ่าย {formatNumber(closeTarget.week.payableHours)} ชม. / ฿{formatCurrency(closeTarget.week.payableAmount)}
                </p>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-gray-700">หมายเหตุ</p>
                <Textarea
                  value={closeNotes}
                  onChange={(event) => setCloseNotes(event.target.value)}
                  className="min-h-24"
                  placeholder="เช่น ตรวจหลักฐานครบแล้ว / หมายเหตุการจ่ายประจำสัปดาห์"
                />
              </div>
              {closeError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {closeError}
                </div>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" disabled={Boolean(closingKey)} onClick={() => setCloseTarget(null)}>
                  ยกเลิก
                </Button>
                <Button
                  className="bg-[#2748bf] hover:bg-[#153c85]"
                  disabled={Boolean(closingKey)}
                  onClick={() => closeWeek(closeTarget.coach, closeTarget.week, closeNotes)}
                >
                  {closingKey ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ReceiptText className="mr-2 h-4 w-4" />}
                  ยืนยันปิดสัปดาห์
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CoachPayrollSummaryTable({
  coaches,
  teachingRules,
  selectedCoachId,
  onSelectCoach,
}: {
  coaches: CoachSummary[]
  teachingRules: CoachTeachingRules
  selectedCoachId: string | null
  onSelectCoach: (coachId: string) => void
}) {
  return (
    <Card className="border-gray-200">
      <CardContent className="p-0">
        <div className="flex flex-col gap-1 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-[#153c85]">สรุปโค้ชรายเดือน</p>
            <p className="text-xs text-gray-500">กดดูรายละเอียดเฉพาะโค้ชที่ต้องตรวจ ไม่ต้องเปิด card ยาวทุกคนพร้อมกัน</p>
          </div>
          <Badge variant="outline">{coaches.length} โค้ช</Badge>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="border-b bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">โค้ช</th>
                <th className="px-3 py-3 text-left font-semibold">ประเภท</th>
                <th className="px-3 py-3 text-right font-semibold">รอบ assigned</th>
                <th className="px-3 py-3 text-right font-semibold">ครบหลักฐาน</th>
                <th className="px-3 py-3 text-right font-semibold">ต้องตรวจ</th>
                <th className="px-3 py-3 text-right font-semibold">ชม.จ่าย</th>
                <th className="px-3 py-3 text-right font-semibold">ยอดจ่าย</th>
                <th className="px-4 py-3 text-right font-semibold">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {coaches.map((coach) => {
                const issueCount = coach.missingRows.length + coach.noPhotoRows.length + coach.noLocationRows.length + coach.noAttendanceRows.length
                const isSelected = selectedCoachId === coach.coach_id
                return (
                  <tr key={coach.coach_id} className={cn('transition hover:bg-blue-50/50', isSelected && 'bg-blue-50')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#2748bf]">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-950">{coach.coach_name}</p>
                          <p className="text-xs text-gray-500">{coach.weeklyBreakdown.length} สัปดาห์</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {coach.employmentType ? (
                        <Badge className={`text-xs ${EMPLOYMENT_BADGES[coach.employmentType]}`}>
                          {getEmploymentLabel(coach.employmentType, teachingRules)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">ยังไม่ตั้งประเภท</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold">{coach.assignedRows.length}</td>
                    <td className="px-3 py-3 text-right text-emerald-700">{coach.payableEntries.length}</td>
                    <td className={cn('px-3 py-3 text-right font-semibold', issueCount > 0 ? 'text-red-600' : 'text-gray-400')}>{issueCount}</td>
                    <td className="px-3 py-3 text-right font-semibold">{formatNumber(coach.payableHours)} ชม.</td>
                    <td className="px-3 py-3 text-right font-bold text-orange-600">฿{formatCurrency(coach.payableAmount)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => onSelectCoach(coach.coach_id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        ดูรายละเอียด
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="divide-y lg:hidden">
          {coaches.map((coach) => {
            const issueCount = coach.missingRows.length + coach.noPhotoRows.length + coach.noLocationRows.length + coach.noAttendanceRows.length
            return (
              <button
                key={coach.coach_id}
                type="button"
                onClick={() => onSelectCoach(coach.coach_id)}
                className="block w-full px-4 py-3 text-left transition hover:bg-blue-50/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-950">{coach.coach_name}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {coach.employmentType ? (
                        <Badge className={`text-xs ${EMPLOYMENT_BADGES[coach.employmentType]}`}>
                          {getEmploymentLabel(coach.employmentType, teachingRules)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">ยังไม่ตั้งประเภท</Badge>
                      )}
                      {issueCount > 0 && <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">ต้องตรวจ {issueCount}</Badge>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-orange-600">฿{formatCurrency(coach.payableAmount)}</p>
                    <p className="text-xs text-gray-500">{formatNumber(coach.payableHours)} ชม.</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  valueClassName,
  className = '',
}: {
  label: string
  value: number
  icon: LucideIcon
  valueClassName: string
  className?: string
}) {
  return (
    <Card className={`border-gray-200 ${className}`}>
      <CardContent className="flex items-center justify-between p-3">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className={`mt-1 text-xl font-bold ${valueClassName}`}>{value}</p>
        </div>
        <Icon className="h-5 w-5 text-gray-500" />
      </CardContent>
    </Card>
  )
}

function CoachPayrollCard({
  coach,
  teachingRules,
  viewMonth,
  viewYear,
  closedSummaryMap,
  closingKey,
  onCloseWeek,
}: {
  coach: CoachSummary
  teachingRules: CoachTeachingRules
  viewMonth: number
  viewYear: number
  closedSummaryMap: Map<string, WeeklySummaryData>
  closingKey: string | null
  onCloseWeek: (coach: CoachSummary, week: WeekBreakdown) => void
}) {
  const rule = coach.employmentType ? getCoachTeachingRule(coach.employmentType, teachingRules) : null
  const issueCount = coach.missingRows.length + coach.noPhotoRows.length + coach.noLocationRows.length + coach.noAttendanceRows.length

  return (
    <Card className={!coach.employmentType ? 'border-amber-200 bg-amber-50/20' : issueCount > 0 ? 'border-amber-200' : 'border-gray-200'}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 border-b pb-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#2748bf]">
              <User className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-gray-950">{coach.coach_name}</p>
                {coach.employmentType ? (
                  <Badge className={`text-xs ${EMPLOYMENT_BADGES[coach.employmentType]}`}>
                    {getEmploymentLabel(coach.employmentType, teachingRules)}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">ยังไม่ตั้งประเภท</Badge>
                )}
              </div>
              <p className="text-xs text-gray-500">{MONTH_LABELS[viewMonth]} {viewYear + 543}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            <MiniMetric label="กลุ่ม" value={`${formatNumber(coach.groupHours)} ชม.`} className="bg-blue-50 text-blue-600" />
            <MiniMetric label="Private" value={`${formatNumber(coach.privateHours)} ชม.`} className="bg-orange-50 text-orange-600" />
            <MiniMetric label="รวม" value={`${formatNumber(coach.totalHours)} ชม.`} className="bg-emerald-50 text-emerald-700" />
            <MiniMetric label={rule?.paysAllHours ? 'ชั่วโมงจ่าย' : 'ชั่วโมง OT'} value={`${formatNumber(coach.payableHours)} ชม.`} className="bg-purple-50 text-purple-700" />
            <MiniMetric label="ยอดจ่าย" value={`฿${formatCurrency(coach.payableAmount)}`} className="bg-gray-50 text-gray-900" />
          </div>
        </div>

        {!coach.employmentType && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            ต้องกำหนดประเภทโค้ชในหน้า “จัดการโค้ช” ก่อน ระบบจึงจะคำนวณยอดรายสัปดาห์ได้
          </div>
        )}

        {rule && (
          <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            <p className="font-semibold">
              {rule.label}: {rule.paysAllHours ? 'คิดค่าสอนทุกชั่วโมง' : `คิดเฉพาะส่วนเกิน ${rule.thresholdHours} ชม./สัปดาห์`}
            </p>
            <p>Private {formatCurrency(rule.privateRate)} บาท/ชม. · กลุ่ม {formatCurrency(rule.groupRate)} บาท/ชม.</p>
          </div>
        )}

        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/70 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#153c85]">
              <TrendingUp className="h-4 w-4" />
              สรุปรายสัปดาห์
            </div>
          </div>

          <div className="grid gap-2 xl:grid-cols-2">
            {coach.weeklyBreakdown.map((week) => {
              const closed = closedSummaryMap.get(`${coach.coach_id}:${week.weekStart}`)
              const closingThisWeek = closingKey === `${coach.coach_id}:${week.weekStart}`
              return (
                <div key={week.weekStart} className={closed ? 'rounded-lg border border-emerald-200 bg-white p-3' : week.payableAmount > 0 ? 'rounded-lg border border-orange-200 bg-white p-3' : 'rounded-lg border bg-white p-3'}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{week.label}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        ครบหลักฐาน {week.payableEntries.length} รอบ · ยังไม่เช็คอิน {week.missingRows.length} · ไม่มีรูป {week.noPhotoRows.length} · ไม่มีพิกัด {week.noLocationRows.length} · ยังไม่เช็คชื่อ {week.noAttendanceRows.length}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-bold text-gray-950">{formatNumber(week.totalHours)} ชม.</p>
                      <p className={week.payableAmount > 0 ? 'text-xs font-semibold text-orange-600' : 'text-xs text-gray-400'}>
                        จ่าย {formatNumber(week.payableHours)} ชม. / ฿{formatCurrency(week.payableAmount)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      <span>กลุ่ม {formatNumber(week.groupHours)} ชม.</span>
                      <span>Private {formatNumber(week.privateHours)} ชม.</span>
                      <span>ฐาน/ไม่จ่าย {formatNumber(week.regularHours)} ชม.</span>
                    </div>
                    {closed ? (
                      <Badge className="w-fit bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        ปิดแล้ว ฿{formatCurrency(closed.payable_amount)}
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        className="w-full bg-[#2748bf] hover:bg-[#153c85] sm:w-auto"
                        disabled={!coach.employmentType || week.payableEntries.length === 0 || closingThisWeek}
                        onClick={() => onCloseWeek(coach, week)}
                      >
                        {closingThisWeek ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ReceiptText className="mr-2 h-4 w-4" />}
                        ปิดสัปดาห์
                      </Button>
                    )}
                  </div>

                  {closed && (
                    <p className="mt-2 text-xs text-gray-500">
                      ปิดเมื่อ {formatDate(closed.closed_at.slice(0, 10))} {closed.closed_by_name ? `โดย ${closed.closed_by_name}` : ''}
                      {closed.notes ? ` · ${closed.notes}` : ''}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          <TeachingEvidenceList title="รอบครบหลักฐาน" type="verified" entries={coach.payableEntries} />
          <TeachingIssueList rows={[...coach.missingRows, ...coach.noPhotoRows, ...coach.noLocationRows, ...coach.noAttendanceRows]} />
        </div>
      </CardContent>
    </Card>
  )
}

function MiniMetric({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${className}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  )
}

function TeachingEvidenceList({
  title,
  entries,
}: {
  title: string
  type: 'verified'
  entries: TeachingPayEntry<PayrollSourceRow>[]
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
        <CheckCircle2 className="h-4 w-4" />
        {title}
      </div>
      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-gray-400">ยังไม่มีรอบที่เช็คอินพร้อมรูป พิกัด และเช็คชื่อครบ</div>
      ) : (
        <div className="space-y-2">
          {entries.slice(0, 8).map((entry) => (
            <div key={entry.row.assignment_id} className={entry.payableAmount > 0 ? 'rounded-lg border border-orange-200 bg-orange-50/40 p-3 text-sm' : 'rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 text-sm'}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">ครบหลักฐาน</Badge>
                {entry.payableAmount > 0 && (
                  <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                    จ่าย {formatNumber(entry.payableHours)} ชม.
                  </Badge>
                )}
                <span className="font-medium">{formatDate(entry.row.date)} {formatTime(entry.row.start_time)}-{formatTime(entry.row.end_time)}</span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-gray-500">
                <Building2 className="h-3.5 w-3.5" />
                {entry.row.branch_name} · {entry.row.course_type || '-'} · รวม {formatNumber(entry.hours)} ชม.
                {entry.payableAmount > 0 && <span className="font-semibold text-orange-700">· ยอดจ่าย ฿{formatCurrency(entry.payableAmount)}</span>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TeachingIssueList({ rows }: { rows: PayrollSourceRow[] }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700">
        <AlertCircle className="h-4 w-4" />
        รอบที่ต้องตรวจ
      </div>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-gray-400">ไม่มีรอบค้างตรวจ</div>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 8).map((row) => {
            const badge = getEvidenceBadge(row)
            const Icon = badge.icon
            return (
              <div key={row.assignment_id} className="rounded-lg border border-amber-100 bg-amber-50/40 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={badge.className}>
                    <Icon className="mr-1 h-3.5 w-3.5" />
                    {badge.label}
                  </Badge>
                  <span className="font-medium">{formatDate(row.date)} {formatTime(row.start_time)}-{formatTime(row.end_time)}</span>
                </div>
                <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                  <Building2 className="h-3.5 w-3.5" />
                  {row.branch_name} · {row.course_type || '-'}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
