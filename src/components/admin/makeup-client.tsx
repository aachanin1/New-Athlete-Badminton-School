'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getAvailableSlots, DAY_LABELS } from '@/lib/branch-schedules'
import {
  AlertCircle,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Search,
  User,
  Users,
  XCircle,
} from 'lucide-react'

type CourseKey = 'kids_group' | 'adult_group' | 'private'

interface BookingSessionData {
  id: string
  booking_id: string
  branch_id: string
  rescheduled_from_id: string | null
  date: string
  start_time: string
  end_time: string
  status: string
  user_name: string
  learner_name: string
  branch_name: string
  course_type: string
  is_makeup: boolean
}

interface BranchOption {
  id: string
  name: string
  slug: string
}

interface MakeupClientProps {
  sessions: BookingSessionData[]
  branches: BranchOption[]
}

interface MonthGroup {
  key: string
  monthKey: string
  monthLabel: string
  nextMonthLabel: string
  deadlineLabel: string
  canCreate: boolean
  hasMakeup: boolean
  isExpired: boolean
  absentCount: number
  overdueCount: number
  sessions: BookingSessionData[]
  sourceSession: BookingSessionData
}

interface LearnerGroup {
  key: string
  learnerName: string
  userName: string
  branches: string[]
  months: MonthGroup[]
}

interface PickedSlot {
  date: string
  dayOfWeek: number
  start: string
  end: string
  branchId: string
  branchName: string
}

interface AvailableDay {
  date: Date
  dateInput: string
  dayOfWeek: number
  slotsByBranch: {
    branch: BranchOption
    slots: { start: string; end: string }[]
  }[]
}

function getSessionEndDate(session: BookingSessionData) {
  return new Date(`${session.date}T${session.end_time}`)
}

function isOverdueSession(session: BookingSessionData) {
  return session.status === 'scheduled' && !session.is_makeup && getSessionEndDate(session).getTime() < Date.now()
}

function isMissedSession(session: BookingSessionData) {
  return !session.is_makeup && (session.status === 'absent' || isOverdueSession(session))
}

function getMonthKey(date: string) {
  return date.slice(0, 7)
}

function getMonthRange(date: string) {
  const [yearText, monthText] = date.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1
  const start = new Date(year, monthIndex, 1)
  const nextStart = new Date(year, monthIndex + 1, 1)
  const nextEnd = new Date(year, monthIndex + 2, 0)
  const followingStart = new Date(year, monthIndex + 2, 1)
  const toInput = (value: Date) => {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return {
    monthLabel: new Intl.DateTimeFormat('th-TH', { month: 'short', year: '2-digit' }).format(start),
    nextMonthLabel: new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' }).format(nextStart),
    nextMonthStart: toInput(nextStart),
    nextMonthEnd: toInput(nextEnd),
    followingStart,
    deadlineLabel: new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }).format(nextEnd),
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  }).format(new Date(`${value}T00:00:00`))
}

function formatTime(start: string, end: string) {
  return `${start.slice(0, 5)}-${end.slice(0, 5)}`
}

function normalizeCourseType(courseType: string): CourseKey {
  const value = courseType.toLowerCase()
  if (value.includes('private')) return 'private'
  if (value.includes('adult') || value.includes('ผู้ใหญ่')) return 'adult_group'
  return 'kids_group'
}

function getDaysInRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const days: Date[] = []
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    days.push(new Date(cursor))
  }
  return days
}

function toDateInput(value: Date) {
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function buildAvailableDays(month: MonthGroup | null, branches: BranchOption[]): AvailableDay[] {
  if (!month) return []
  const range = getMonthRange(month.sourceSession.date)
  const courseType = normalizeCourseType(month.sourceSession.course_type)

  return getDaysInRange(range.nextMonthStart, range.nextMonthEnd)
    .map((date) => {
      const dayOfWeek = date.getDay()
      const slotsByBranch = branches
        .map((branch) => ({
          branch,
          slots: getAvailableSlots(branch.slug, courseType, dayOfWeek),
        }))
        .filter((item) => item.slots.length > 0)

      return {
        date,
        dateInput: toDateInput(date),
        dayOfWeek,
        slotsByBranch,
      }
    })
    .filter((day) => day.slotsByBranch.length > 0)
}

export function MakeupClient({ sessions, branches }: MakeupClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterBranch, setFilterBranch] = useState('all')
  const [filterType, setFilterType] = useState('actionable')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<MonthGroup | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [pickedSlot, setPickedSlot] = useState<PickedSlot | null>(null)

  const makeupSourceIds = useMemo(
    () => new Set(sessions.map((session) => session.rescheduled_from_id).filter(Boolean) as string[]),
    [sessions]
  )

  const monthGroups = useMemo(() => {
    const groups = new Map<string, MonthGroup & { learnerName: string; userName: string; branches: string[] }>()

    sessions.filter(isMissedSession).forEach((session) => {
      const learnerKey = `${session.user_name}::${session.learner_name}`
      const monthKey = getMonthKey(session.date)
      const key = `${learnerKey}::${monthKey}`
      const range = getMonthRange(session.date)
      const isExpired = Date.now() >= range.followingStart.getTime()

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          monthKey,
          monthLabel: range.monthLabel,
          nextMonthLabel: range.nextMonthLabel,
          deadlineLabel: range.deadlineLabel,
          canCreate: false,
          hasMakeup: false,
          isExpired,
          absentCount: 0,
          overdueCount: 0,
          sessions: [],
          sourceSession: session,
          learnerName: session.learner_name,
          userName: session.user_name,
          branches: [],
        })
      }

      const group = groups.get(key)
      if (!group) return
      group.sessions.push(session)
      if (session.status === 'absent') group.absentCount += 1
      if (isOverdueSession(session)) group.overdueCount += 1
      if (!group.branches.includes(session.branch_name)) group.branches.push(session.branch_name)
      if (makeupSourceIds.has(session.id)) group.hasMakeup = true
      group.sourceSession = group.sessions[0]
    })

    return Array.from(groups.values()).map((group) => ({
      ...group,
      canCreate: !group.hasMakeup && !group.isExpired,
      sessions: group.sessions.sort((a, b) => a.date.localeCompare(b.date)),
    }))
  }, [makeupSourceIds, sessions])

  const filteredMonthGroups = useMemo(() => {
    const q = search.trim().toLowerCase()

    return monthGroups.filter((group) => {
      if (filterType === 'actionable' && !group.canCreate) return false
      if (filterType === 'expired' && !group.isExpired) return false
      if (filterType === 'makeup' && !group.hasMakeup) return false
      if (filterBranch !== 'all' && !group.sessions.some((session) => session.branch_id === filterBranch)) return false
      if (!q) return true

      return [
        group.learnerName,
        group.userName,
        group.monthLabel,
        group.nextMonthLabel,
        ...group.branches,
        ...group.sessions.map((session) => session.course_type),
      ].some((value) => value.toLowerCase().includes(q))
    })
  }, [filterBranch, filterType, monthGroups, search])

  const learnerGroups = useMemo<LearnerGroup[]>(() => {
    const groups = new Map<string, LearnerGroup>()

    filteredMonthGroups.forEach((month) => {
      const learnerKey = `${month.userName}::${month.learnerName}`
      if (!groups.has(learnerKey)) {
        groups.set(learnerKey, {
          key: learnerKey,
          learnerName: month.learnerName,
          userName: month.userName,
          branches: [],
          months: [],
        })
      }

      const group = groups.get(learnerKey)
      if (!group) return
      month.branches.forEach((branch) => {
        if (!group.branches.includes(branch)) group.branches.push(branch)
      })
      group.months.push(month)
    })

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        months: group.months.sort((a, b) => b.monthKey.localeCompare(a.monthKey)),
      }))
      .sort((a, b) => b.months.length - a.months.length || a.learnerName.localeCompare(b.learnerName))
  }, [filteredMonthGroups])

  const stats = useMemo(() => ({
    total: monthGroups.length,
    actionable: monthGroups.filter((group) => group.canCreate).length,
    expired: monthGroups.filter((group) => group.isExpired && !group.hasMakeup).length,
    makeups: monthGroups.filter((group) => group.hasMakeup).length,
    learners: new Set(monthGroups.map((group) => `${group.userName}:${group.learnerName}`)).size,
  }), [monthGroups])

  const availableDays = useMemo(() => buildAvailableDays(selectedMonth, branches), [branches, selectedMonth])
  const selectedDay = useMemo(
    () => availableDays.find((day) => day.dateInput === selectedDate) || null,
    [availableDays, selectedDate]
  )
  const calendarCells = useMemo(() => {
    if (!selectedMonth) return []
    const range = getMonthRange(selectedMonth.sourceSession.date)
    const start = new Date(`${range.nextMonthStart}T00:00:00`)
    const end = new Date(`${range.nextMonthEnd}T00:00:00`)
    const cells: ({ date: Date; dateInput: string; availableDay: AvailableDay | null } | null)[] = []
    for (let i = 0; i < start.getDay(); i++) cells.push(null)
    for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const date = new Date(cursor)
      const dateInput = toDateInput(date)
      cells.push({
        date,
        dateInput,
        availableDay: availableDays.find((day) => day.dateInput === dateInput) || null,
      })
    }
    return cells
  }, [availableDays, selectedMonth])

  const openMakeupDialog = (month: MonthGroup) => {
    const days = buildAvailableDays(month, branches)
    setError(null)
    setSelectedMonth(month)
    setSelectedDate(days[0]?.dateInput || '')
    setPickedSlot(null)
    setDialogOpen(true)
  }

  const createMakeup = async () => {
    if (!selectedMonth || !pickedSlot) {
      setError('กรุณาเลือกวันและรอบเรียนสำหรับชดเชย')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/makeup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_session_id: selectedMonth.sourceSession.id,
          booking_id: selectedMonth.sourceSession.booking_id,
          makeup_date: pickedSlot.date,
          start_time: pickedSlot.start,
          end_time: pickedSlot.end,
          branch_id: pickedSlot.branchId,
        }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        setError(result?.error || 'สร้างวันชดเชยไม่สำเร็จ')
        return
      }

      setDialogOpen(false)
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#2748bf]">
            <CalendarPlus className="h-4 w-4" />
            Makeup Sessions
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">วันชดเชย</h1>
          <p className="mt-1 text-sm text-gray-500">สรุปสิทธิ์ชดเชยรายผู้เรียนและรายเดือน โดย 1 เดือนชดเชยได้สูงสุด 1 ครั้ง</p>
        </div>
        <Badge variant="outline" className="w-fit border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
          ขาดหลายครั้งในเดือนเดียวกัน ชดเชยได้ 1 ครั้ง
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-5">
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">เดือนที่มีสิทธิ์</p>
              <p className="mt-1 text-xl font-bold text-[#2748bf] sm:text-2xl">{stats.total}</p>
            </div>
            <Calendar className="h-5 w-5 text-[#2748bf]" />
          </CardContent>
        </Card>
        <Card className={stats.actionable > 0 ? 'border-red-300 bg-red-50/40' : 'border-gray-200'}>
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">ยังชดเชยได้</p>
              <p className="mt-1 text-xl font-bold text-red-600 sm:text-2xl">{stats.actionable}</p>
            </div>
            <AlertCircle className="h-5 w-5 text-red-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">หมดเขต</p>
              <p className="mt-1 text-xl font-bold text-gray-500 sm:text-2xl">{stats.expired}</p>
            </div>
            <XCircle className="h-5 w-5 text-gray-400" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">ชดเชยแล้ว</p>
              <p className="mt-1 text-xl font-bold text-emerald-600 sm:text-2xl">{stats.makeups}</p>
            </div>
            <CalendarCheck className="h-5 w-5 text-emerald-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200 max-xl:col-span-2">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">ผู้เรียน</p>
              <p className="mt-1 text-xl font-bold text-orange-500 sm:text-2xl">{stats.learners}</p>
            </div>
            <Users className="h-5 w-5 text-orange-500" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200">
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(260px,1fr)_220px_220px_auto] lg:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-10"
              placeholder="ค้นหาผู้เรียน, ผู้ปกครอง, สาขา, เดือน..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select value={filterBranch} onValueChange={setFilterBranch}>
            <SelectTrigger>
              <SelectValue placeholder="ทุกสาขา" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสาขา</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger>
              <SelectValue placeholder="สถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="actionable">ยังชดเชยได้</SelectItem>
              <SelectItem value="expired">หมดเขต</SelectItem>
              <SelectItem value="makeup">ชดเชยแล้ว</SelectItem>
              <SelectItem value="all">ทั้งหมด</SelectItem>
            </SelectContent>
          </Select>
          <p className="whitespace-nowrap text-sm text-gray-500">แสดง {filteredMonthGroups.length} เดือน จาก {monthGroups.length} เดือน</p>
        </CardContent>
      </Card>

      {learnerGroups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center text-gray-400">
            <Calendar className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</p>
            <p className="mt-1 text-sm">ลองเปลี่ยนตัวกรองหรือคำค้นหา</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {learnerGroups.map((group) => (
            <Card key={group.key} className="border-gray-200">
              <CardContent className="p-4">
                <div className="flex flex-col gap-2 border-b pb-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#153c85]">{group.learnerName}</p>
                      <Badge variant="outline" className="text-xs">{group.months.length} เดือน</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {group.userName}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {group.branches.join(', ')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  {group.months.map((month) => (
                    <div key={month.key} className={`rounded-lg border p-3 ${month.canCreate ? 'border-orange-200 bg-orange-50/40' : month.hasMakeup ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-200 bg-gray-50/70'}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-gray-950">{month.monthLabel}</p>
                            {month.canCreate && <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">ยังชดเชยได้</Badge>}
                            {month.hasMakeup && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">ชดเชยแล้ว</Badge>}
                            {month.isExpired && !month.hasMakeup && <Badge variant="outline" className="border-gray-200 bg-white text-gray-500">หมดเขต</Badge>}
                          </div>
                          <p className="mt-2 text-sm text-gray-600">
                            ขาด/เลยวันเรียน {month.sessions.length} ครั้ง
                            {month.absentCount > 0 && ` • ขาด ${month.absentCount}`}
                            {month.overdueCount > 0 && ` • เลยวัน ${month.overdueCount}`}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {month.sessions.map((session) => (
                              <Badge key={session.id} variant="outline" className="bg-white text-xs">
                                {formatDate(session.date)} {formatTime(session.start_time, session.end_time)}
                              </Badge>
                            ))}
                          </div>
                          <p className="mt-2 text-xs text-gray-500">
                            ชดเชยได้ใน {month.nextMonthLabel} • หมดเขต {month.deadlineLabel}
                          </p>
                        </div>
                        <div className="sm:shrink-0">
                          {month.canCreate ? (
                            <Button size="sm" className="h-9 bg-[#f57e3b] text-white hover:bg-[#e06d2e]" onClick={() => openMakeupDialog(month)}>
                              <CalendarPlus className="mr-2 h-4 w-4" />
                              เลือกรอบชดเชย
                            </Button>
                          ) : month.hasMakeup ? (
                            <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                              <CheckCircle2 className="h-4 w-4" />
                              ใช้สิทธิ์แล้ว
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2 text-sm font-medium text-gray-500">
                              <XCircle className="h-4 w-4" />
                              เลยกำหนด
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">เลือกวันและรอบเรียนชดเชย</DialogTitle>
          </DialogHeader>
          {selectedMonth && (
            <div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-hidden">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                <p className="font-semibold text-gray-950">{selectedMonth.sourceSession.learner_name}</p>
                <p className="mt-1 text-xs text-gray-500">
                  ชดเชยแทน {selectedMonth.sessions.length} ครั้งในเดือน {selectedMonth.monthLabel} • เลือกได้เฉพาะ {selectedMonth.nextMonthLabel}
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {availableDays.length === 0 ? (
                  <div className="rounded-lg border border-dashed py-10 text-center text-sm text-gray-400">
                    ไม่มีรอบเรียนที่เปิดในเดือนนี้สำหรับคอร์สนี้
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,.95fr)]">
                    <div className="rounded-lg border border-gray-200 p-3">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-950">{selectedMonth.nextMonthLabel}</p>
                          <p className="text-xs text-gray-500">เลือกวันที่มีรอบเรียนเพื่อดูเวลา</p>
                        </div>
                        <Badge variant="outline" className="bg-white">{availableDays.length} วัน</Badge>
                      </div>
                      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-gray-400">
                        {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((day) => (
                          <span key={day}>{day}</span>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1 sm:gap-2">
                        {calendarCells.map((cell, index) => {
                          if (!cell) return <div key={`empty-${index}`} className="aspect-square" />
                          const isAvailable = Boolean(cell.availableDay)
                          const isSelected = selectedDate === cell.dateInput
                          const slotCount = cell.availableDay?.slotsByBranch.reduce((sum, item) => sum + item.slots.length, 0) || 0

                          return (
                            <button
                              key={cell.dateInput}
                              type="button"
                              disabled={!isAvailable}
                              className={`flex aspect-square min-h-11 flex-col items-center justify-center rounded-lg border text-xs transition sm:min-h-14 ${
                                isSelected
                                  ? 'border-[#2748bf] bg-[#2748bf] text-white shadow-sm'
                                  : isAvailable
                                    ? 'border-blue-100 bg-blue-50 text-[#153c85] hover:border-[#2748bf]'
                                    : 'border-gray-100 bg-gray-50 text-gray-300'
                              }`}
                              onClick={() => {
                                if (!cell.availableDay) return
                                setSelectedDate(cell.dateInput)
                                setPickedSlot(null)
                              }}
                            >
                              <span className="font-semibold">{cell.date.getDate()}</span>
                              {isAvailable && (
                                <span className={`mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] ${isSelected ? 'bg-white/20 text-white' : 'bg-white text-blue-600'}`}>
                                  {slotCount} รอบ
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 p-3">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                        <Calendar className="h-4 w-4 text-[#2748bf]" />
                        {selectedDay ? `${DAY_LABELS[selectedDay.dayOfWeek]} ${formatDate(selectedDay.dateInput)}` : 'เลือกรอบเรียน'}
                      </div>
                      {!selectedDay ? (
                        <div className="rounded-lg border border-dashed py-10 text-center text-sm text-gray-400">
                          เลือกวันที่ในปฏิทินก่อน
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedDay.slotsByBranch.map(({ branch, slots }) => (
                            <div key={branch.id}>
                              <p className="mb-2 flex items-center gap-1 text-xs text-gray-500">
                                <Building2 className="h-3.5 w-3.5" />
                                {branch.name}
                              </p>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {slots.map((slot) => {
                                  const isPicked = pickedSlot?.date === selectedDay.dateInput && pickedSlot.start === slot.start && pickedSlot.branchId === branch.id
                                  return (
                                    <Button
                                      key={`${branch.id}-${selectedDay.dateInput}-${slot.start}`}
                                      type="button"
                                      size="sm"
                                      variant={isPicked ? 'default' : 'outline'}
                                      className={`justify-start ${isPicked ? 'bg-[#2748bf] hover:bg-[#153c85]' : ''}`}
                                      onClick={() => setPickedSlot({
                                        date: selectedDay.dateInput,
                                        dayOfWeek: selectedDay.dayOfWeek,
                                        start: slot.start,
                                        end: slot.end,
                                        branchId: branch.id,
                                        branchName: branch.name,
                                      })}
                                    >
                                      <Clock className="mr-1 h-3.5 w-3.5" />
                                      {formatTime(slot.start, slot.end)}
                                    </Button>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {pickedSlot && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  เลือกแล้ว: {DAY_LABELS[pickedSlot.dayOfWeek]} {formatDate(pickedSlot.date)} • {formatTime(pickedSlot.start, pickedSlot.end)} • {pickedSlot.branchName}
                </div>
              )}

              <Button className="h-10 w-full bg-[#f57e3b] hover:bg-[#e06d2e]" onClick={createMakeup} disabled={loading || !pickedSlot}>
                {loading ? 'กำลังบันทึก...' : 'สร้างวันชดเชย'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
