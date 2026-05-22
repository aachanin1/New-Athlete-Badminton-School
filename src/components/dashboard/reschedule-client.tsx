'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeftRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  ShieldAlert,
} from 'lucide-react'
import { getTemplateSlots, hasTemplateSlots, type ScheduleTemplateOption } from '@/lib/schedule-template-utils'
import { fmtTime } from '@/lib/utils'
import type { CourseTypeName } from '@/types/database'

interface SessionRow {
  id: string
  booking_id: string
  date: string
  start_time: string
  end_time: string
  branch_id: string
  status: string
  is_makeup: boolean
  child_id: string | null
  schedule_slot_id: string | null
  children?: { full_name: string; nickname?: string | null } | null
  bookings?: { user_id: string; course_type_id: string; status?: string; course_types?: { name: CourseTypeName | null } | null } | null
  branches?: { name: string } | null
}

interface BranchOption {
  id: string
  name: string
  slug: string
}

interface RescheduleClientProps {
  sessions: SessionRow[]
  branches: BranchOption[]
  scheduleTemplates: ScheduleTemplateOption[]
}

interface PickedSlot {
  date: string
  dayOfWeek: number
  start: string
  end: string
  branchId: string
  branchName: string
  templateId?: string
}

const MONTH_NAMES_TH = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
]

const DAY_LABELS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
const COURSE_LABELS: Record<CourseTypeName, string> = {
  kids_group: 'เด็กกลุ่ม',
  adult_group: 'ผู้ใหญ่กลุ่ม',
  private: 'Private',
}
const RESCHEDULE_PREVIEW_PER_MONTH = 6

function getStartDate(date: string, time: string) {
  return new Date(`${date}T${time.slice(0, 5)}:00`)
}

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value
}

function canReschedule(sessionDate: string, sessionTime: string) {
  return getStartDate(sessionDate, sessionTime).getTime() - Date.now() >= 24 * 60 * 60 * 1000
}

function isFutureSlot(date: string, time: string) {
  return getStartDate(date, time).getTime() > Date.now()
}

function formatDateThai(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function getCourseType(session: SessionRow | null): CourseTypeName {
  const name = session?.bookings?.course_types?.name
  if (name === 'kids_group' || name === 'adult_group' || name === 'private') return name
  return 'kids_group'
}

function getMonthKey(date: string) {
  return date.slice(0, 7)
}

export function RescheduleClient({ sessions, branches, scheduleTemplates }: RescheduleClientProps) {
  const router = useRouter()
  const now = new Date()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null)
  const [pickedSlot, setPickedSlot] = useState<PickedSlot | null>(null)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [expandedMonthKeys, setExpandedMonthKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const groupedSessions = useMemo(() => {
    const map = new Map<string, SessionRow[]>()
    sessions.forEach((session) => {
      const key = getMonthKey(session.date)
      map.set(key, [...(map.get(key) || []), session])
    })
    return Array.from(map.entries()).map(([monthKey, rows]) => ({ monthKey, rows }))
  }, [sessions])

  const selectedMonth = selectedSession ? new Date(`${selectedSession.date}T00:00:00`).getMonth() : now.getMonth()
  const selectedYear = selectedSession ? new Date(`${selectedSession.date}T00:00:00`).getFullYear() : now.getFullYear()

  const calendarDays = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth, 1)
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0)
    const days: (number | null)[] = []
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null)
    for (let day = 1; day <= lastDay.getDate(); day++) days.push(day)
    return days
  }, [selectedMonth, selectedYear])

  const getDateStr = (day: number) => `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const isSameLearner = (a: SessionRow, b: SessionRow) => a.child_id === b.child_id

  const isSameSlotContext = (
    session: SessionRow,
    date: string,
    start: string,
    end: string,
    branchId: string,
  ) => (
    session.date === date &&
    normalizeTime(session.start_time) === normalizeTime(start) &&
    normalizeTime(session.end_time) === normalizeTime(end) &&
    session.branch_id === branchId
  )

  const isSlotBlocked = (
    date: string,
    start: string,
    end: string,
    branchId: string,
  ) => {
    if (!selectedSession) return false
    return sessions.some((session) => (
      isSameLearner(session, selectedSession) &&
      session.bookings?.course_type_id === selectedSession.bookings?.course_type_id &&
      isSameSlotContext(session, date, start, end, branchId) &&
      !['rescheduled', 'walleted'].includes(session.status)
    ))
  }

  const isDateSelectable = (day: number) => {
    if (!selectedSession) return false
    const courseType = getCourseType(selectedSession)
    const date = new Date(selectedYear, selectedMonth, day)
    const dateStr = getDateStr(day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (date < today) return false

    return branches.some((branch) => {
      if (!hasTemplateSlots(scheduleTemplates, branch.slug, courseType, date)) return false
      return getTemplateSlots(scheduleTemplates, branch.slug, courseType, date.getDay()).some((slot) => (
        isFutureSlot(dateStr, slot.start) &&
        !isSlotBlocked(dateStr, slot.start, slot.end, branch.id)
      ))
    })
  }

  const openDialog = (session: SessionRow) => {
    setSelectedSession(session)
    setPickedSlot(null)
    setExpandedDate(null)
    setError(null)
    setSuccess(false)
    setDialogOpen(true)
  }

  const handleDayClick = (day: number) => {
    if (!isDateSelectable(day)) return
    const dateStr = getDateStr(day)
    setExpandedDate(expandedDate === dateStr ? null : dateStr)
    setPickedSlot(null)
  }

  const handleSlotPick = (day: number, start: string, end: string, branch: BranchOption, templateId?: string) => {
    const dateStr = getDateStr(day)
    if (!isFutureSlot(dateStr, start)) return
    if (isSlotBlocked(dateStr, start, end, branch.id)) return
    const date = new Date(selectedYear, selectedMonth, day)
    setPickedSlot({
      date: dateStr,
      dayOfWeek: date.getDay(),
      start,
      end,
      branchId: branch.id,
      branchName: branch.name,
      templateId,
    })
  }

  const toggleMonthExpanded = (monthKey: string) => {
    setExpandedMonthKeys((prev) => {
      const next = new Set(prev)
      if (next.has(monthKey)) {
        next.delete(monthKey)
      } else {
        next.add(monthKey)
      }
      return next
    })
  }

  const handleSubmit = async () => {
    if (!selectedSession || !pickedSlot) {
      setError('กรุณาเลือกวันและรอบเรียนใหม่')
      return
    }

    setLoading(true)
    setError(null)

    const response = await fetch('/api/reschedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: selectedSession.id,
        targetDate: pickedSlot.date,
        startTime: pickedSlot.start,
        endTime: pickedSlot.end,
        branchId: pickedSlot.branchId,
        scheduleTemplateId: pickedSlot.templateId || null,
      }),
    })

    const result = await response.json() as { success?: boolean; error?: string }

    if (!response.ok || !result.success) {
      setError(result.error || 'เปลี่ยนวันเรียนไม่สำเร็จ กรุณาลองใหม่')
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => {
      setDialogOpen(false)
      router.refresh()
    }, 900)
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-14">
          <div className="text-center text-gray-400">
            <ArrowLeftRight className="mx-auto mb-4 h-14 w-14 opacity-50" />
            <p className="text-lg font-medium">ไม่มีรอบเรียนที่สามารถเปลี่ยนได้</p>
            <p className="mt-1 text-sm">จะแสดงเฉพาะรอบที่จองสำเร็จ ยังไม่เริ่ม และยังไม่ถูกเปลี่ยนวัน</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">กฎการเปลี่ยนวัน/สาขา</p>
            <p>เปลี่ยนได้เฉพาะรอบที่ยังไม่เริ่ม ล่วงหน้าอย่างน้อย 24 ชั่วโมง และอยู่ภายในเดือนที่จองเท่านั้น</p>
            <p className="mt-1 text-yellow-700">รอบชดเชยเป็นหน้าที่ Admin จัดการ ผู้เรียนจะเห็นในตารางเรียนหลัง Admin เพิ่มให้แล้ว</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {groupedSessions.map(({ monthKey, rows }) => {
          const [year, month] = monthKey.split('-').map(Number)
          const isExpanded = expandedMonthKeys.has(monthKey)
          const visibleRows = isExpanded ? rows : rows.slice(0, RESCHEDULE_PREVIEW_PER_MONTH)
          const hiddenCount = rows.length - visibleRows.length

          return (
            <section key={monthKey} className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#153c85]">
                  {MONTH_NAMES_TH[month - 1]} {year + 543}
                </h2>
                <Badge variant="outline">{rows.length} รอบ</Badge>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {visibleRows.map((session) => {
                  const courseType = getCourseType(session)
                  const canChange = canReschedule(session.date, session.start_time) && !session.is_makeup
                  return (
                    <Card key={session.id} className={!canChange ? 'opacity-65' : ''}>
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-start gap-3">
                            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-[#2748bf]/10">
                              <span className="text-xs font-medium text-[#2748bf]">
                                {new Date(`${session.date}T00:00:00`).toLocaleDateString('th-TH', { weekday: 'short' })}
                              </span>
                              <span className="text-lg font-bold text-[#2748bf]">{new Date(`${session.date}T00:00:00`).getDate()}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900">{formatDateThai(session.date)}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {fmtTime(session.start_time)} - {fmtTime(session.end_time)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {session.branches?.name || '-'}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <Badge variant="outline">{COURSE_LABELS[courseType]}</Badge>
                                {session.children && <Badge variant="secondary">{session.children.nickname || session.children.full_name}</Badge>}
                                {session.is_makeup && <Badge className="bg-orange-50 text-orange-700">รอบชดเชย</Badge>}
                              </div>
                            </div>
                          </div>

                          {canChange ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-[#2748bf]/30 text-[#2748bf] hover:bg-[#2748bf]/5"
                              onClick={() => openDialog(session)}
                            >
                              <ArrowLeftRight className="mr-1 h-3.5 w-3.5" />
                              เปลี่ยน
                            </Button>
                          ) : (
                            <Badge variant="outline" className="self-start text-gray-400 sm:self-center">
                              เปลี่ยนไม่ได้
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
              {rows.length > RESCHEDULE_PREVIEW_PER_MONTH && (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleMonthExpanded(monthKey)}
                  >
                    {isExpanded ? 'ย่อรายการ' : `ดูเพิ่มอีก ${hiddenCount} รอบ`}
                  </Button>
                </div>
              )}
            </section>
          )
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          {success ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <DialogTitle className="mb-2 text-xl font-bold text-green-700">เปลี่ยนวันสำเร็จ</DialogTitle>
              <DialogDescription>ตารางเรียนถูกอัปเดตแล้ว</DialogDescription>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-[#153c85]">เลือกวันและรอบเรียนใหม่</DialogTitle>
                <DialogDescription>
                  รอบเดิม: {selectedSession && formatDateThai(selectedSession.date)} · {fmtTime(selectedSession?.start_time)} - {fmtTime(selectedSession?.end_time)}
                  {selectedSession?.branches?.name && ` · ${selectedSession.branches.name}`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">เลือกวันใหม่ในเดือนเดิม</p>
                    <span className="text-xs font-medium text-gray-500">
                      {MONTH_NAMES_TH[selectedMonth]} {selectedYear + 543}
                    </span>
                  </div>

                  <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-gray-400">
                    {DAY_LABELS.map((day, index) => (
                      <div key={day} className={index === 0 ? 'text-red-500' : ''}>{day}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, index) => {
                      if (day === null) return <div key={`empty-${index}`} />
                      const selectable = isDateSelectable(day)
                      const dateStr = getDateStr(day)
                      const isExpanded = expandedDate === dateStr
                      const isPicked = pickedSlot?.date === dateStr

                      return (
                        <button
                          key={dateStr}
                          type="button"
                          onClick={() => handleDayClick(day)}
                          disabled={!selectable}
                          className={`h-9 rounded-md text-sm font-medium transition-all ${
                            selectable ? 'hover:bg-[#2748bf]/10' : 'cursor-not-allowed text-gray-300'
                          } ${isPicked ? 'bg-[#2748bf] text-white' : ''} ${isExpanded && !isPicked ? 'ring-2 ring-[#f57e3b]' : ''}`}
                        >
                          {day}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {expandedDate && selectedSession && (() => {
                  const day = Number(expandedDate.split('-')[2])
                  const date = new Date(selectedYear, selectedMonth, day)
                  const dayIndex = date.getDay()
                  const courseType = getCourseType(selectedSession)

                  return (
                    <div className="space-y-3 rounded-lg border bg-gray-50 p-3">
                      <p className="text-sm font-semibold text-gray-700">
                        <CalendarDays className="mr-1 inline h-4 w-4" />
                        {DAY_LABELS[dayIndex]} {day} {MONTH_NAMES_TH[selectedMonth]} · เลือกรอบเรียน
                      </p>

                      {branches.map((branch) => {
                        const slots = getTemplateSlots(scheduleTemplates, branch.slug, courseType, dayIndex)
                          .filter((slot) => isFutureSlot(expandedDate, slot.start))
                        if (slots.length === 0) return null

                        return (
                          <div key={branch.id}>
                            <p className="mb-1 flex items-center gap-1 text-xs text-gray-500">
                              <MapPin className="h-3 w-3" />
                              {branch.name}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {slots.map((slot) => {
                                const isSlotPicked = pickedSlot?.date === expandedDate && pickedSlot.start === slot.start && pickedSlot.branchId === branch.id
                                const isBlocked = isSlotBlocked(expandedDate, slot.start, slot.end, branch.id)
                                return (
                                  <Button
                                    key={`${branch.id}-${slot.start}-${slot.end}`}
                                    type="button"
                                    size="sm"
                                    disabled={isBlocked}
                                    variant={isSlotPicked ? 'default' : 'outline'}
                                    className={isSlotPicked ? 'bg-[#2748bf]' : isBlocked ? 'cursor-not-allowed border-orange-200 bg-orange-50 text-orange-700 opacity-70' : ''}
                                    onClick={() => handleSlotPick(day, slot.start, slot.end, branch, slot.templateId)}
                                  >
                                    <Clock className="mr-1 h-3.5 w-3.5" />
                                    {fmtTime(slot.start)}-{fmtTime(slot.end)}
                                    {isBlocked && <span className="ml-1 text-[11px]">(รอบเดิม)</span>}
                                  </Button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}

                {pickedSlot && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                    <p className="font-medium">รอบใหม่ที่เลือก</p>
                    <p>
                      {formatDateThai(pickedSlot.date)} · {fmtTime(pickedSlot.start)} - {fmtTime(pickedSlot.end)} · {pickedSlot.branchName}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)} disabled={loading}>
                    ยกเลิก
                  </Button>
                  <Button className="flex-1 bg-[#2748bf] hover:bg-[#153c85]" disabled={loading || !pickedSlot} onClick={handleSubmit}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        กำลังเปลี่ยน...
                      </>
                    ) : (
                      <>
                        <ArrowLeftRight className="mr-2 h-4 w-4" />
                        ยืนยันการเปลี่ยน
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
