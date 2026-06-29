'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CalendarDays, CheckCircle2, Clock, Loader2, MapPin, ShieldAlert, WalletCards, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getTemplateSlots, hasTemplateSlots, normalizeCourseTypeName, type ScheduleTemplateOption } from '@/lib/schedule-template-utils'
import { formatThaiDateWithWeekday } from '@/lib/date-format'
import { fmtTime } from '@/lib/utils'
import type { CourseTypeName } from '@/types/database'

interface WalletCredit {
  id: string
  original_date: string
  original_start_time: string
  original_end_time: string
  status: 'active' | 'redeemed' | 'expired'
  expires_at: string
  stored_at: string
  redeemed_at: string | null
  expired_at: string | null
  child_id: string | null
  course_type_id: string
  children?: { full_name: string; nickname: string | null } | null
  branches?: { name: string; slug: string | null } | null
  course_types?: { name: CourseTypeName | null } | null
}

interface BranchOption {
  id: string
  name: string
  slug: string
}

interface ExistingSession {
  id: string
  date: string
  start_time: string
  end_time: string
  branch_id: string
  child_id: string | null
  status: string
  course_type_id: string
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

interface LessonWalletClientProps {
  credits: WalletCredit[]
  branches: BranchOption[]
  existingSessions: ExistingSession[]
  scheduleTemplates: ScheduleTemplateOption[]
}

const MONTH_NAMES_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const DAY_LABELS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
const COURSE_LABELS: Record<CourseTypeName, string> = {
  kids_group: 'เด็กกลุ่ม',
  adult_group: 'ผู้ใหญ่กลุ่ม',
  private: 'Private',
}

function formatDateThai(date: string) {
  return formatThaiDateWithWeekday(date)
}

function getLearnerName(credit: WalletCredit) {
  return credit.children?.nickname || credit.children?.full_name || 'ตัวเอง'
}

function getCourseType(credit: WalletCredit | null): CourseTypeName | null {
  return normalizeCourseTypeName(credit?.course_types?.name)
}

function getMonthParts(date: string) {
  const [year, month] = date.split('-').map(Number)
  return { year, month: month - 1 }
}

function isFutureSlot(date: string, time: string) {
  return new Date(`${date}T${time.slice(0, 5)}:00+07:00`).getTime() > Date.now()
}

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value
}

export function LessonWalletClient({ credits, branches, existingSessions, scheduleTemplates }: LessonWalletClientProps) {
  const router = useRouter()
  const [selectedCredit, setSelectedCredit] = useState<WalletCredit | null>(null)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [pickedSlot, setPickedSlot] = useState<PickedSlot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeCredits = credits.filter((credit) => credit.status === 'active')
  const usedCredits = credits.filter((credit) => credit.status !== 'active')

  const stats = useMemo(() => ({
    active: activeCredits.length,
    redeemed: credits.filter((credit) => credit.status === 'redeemed').length,
    expired: credits.filter((credit) => credit.status === 'expired').length,
  }), [activeCredits.length, credits])

  const selectedMonthParts = selectedCredit ? getMonthParts(selectedCredit.original_date) : getMonthParts(new Date().toISOString().slice(0, 10))
  const calendarDays = useMemo(() => {
    const firstDay = new Date(selectedMonthParts.year, selectedMonthParts.month, 1)
    const lastDay = new Date(selectedMonthParts.year, selectedMonthParts.month + 1, 0)
    const days: (number | null)[] = []
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null)
    for (let day = 1; day <= lastDay.getDate(); day++) days.push(day)
    return days
  }, [selectedMonthParts.month, selectedMonthParts.year])

  const getDateStr = (day: number) => `${selectedMonthParts.year}-${String(selectedMonthParts.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const isSlotAlreadyBooked = (
    credit: WalletCredit,
    date: string,
    start: string,
    end: string,
    branchId: string,
  ) => existingSessions.some((session) => (
    session.date === date &&
    normalizeTime(session.start_time) === normalizeTime(start) &&
    normalizeTime(session.end_time) === normalizeTime(end) &&
    session.branch_id === branchId &&
    session.course_type_id === credit.course_type_id &&
    session.child_id === credit.child_id &&
    !['rescheduled', 'walleted'].includes(session.status)
  ))

  const isDateSelectable = (day: number) => {
    if (!selectedCredit) return false
    const courseType = getCourseType(selectedCredit)
    if (!courseType) return false
    const date = new Date(selectedMonthParts.year, selectedMonthParts.month, day)
    const dateStr = getDateStr(day)
    return branches.some((branch) => {
      if (!hasTemplateSlots(scheduleTemplates, branch.slug, courseType, date)) return false
      return getTemplateSlots(scheduleTemplates, branch.slug, courseType, date.getDay()).some((slot) => (
        isFutureSlot(dateStr, slot.start) &&
        !isSlotAlreadyBooked(selectedCredit, dateStr, slot.start, slot.end, branch.id)
      ))
    })
  }

  const openRedeemDialog = (credit: WalletCredit) => {
    setSelectedCredit(credit)
    setExpandedDate(null)
    setPickedSlot(null)
    setError(null)
  }

  const closeDialog = () => {
    setSelectedCredit(null)
    setExpandedDate(null)
    setPickedSlot(null)
    setError(null)
  }

  const handleDayClick = (day: number) => {
    if (!isDateSelectable(day)) return
    const date = getDateStr(day)
    setExpandedDate(expandedDate === date ? null : date)
    setPickedSlot(null)
  }

  const handleSlotPick = (day: number, start: string, end: string, branch: BranchOption, templateId?: string) => {
    const date = getDateStr(day)
    if (!isFutureSlot(date, start)) return
    if (selectedCredit && isSlotAlreadyBooked(selectedCredit, date, start, end, branch.id)) return
    setPickedSlot({
      date,
      dayOfWeek: new Date(selectedMonthParts.year, selectedMonthParts.month, day).getDay(),
      start,
      end,
      branchId: branch.id,
      branchName: branch.name,
      templateId,
    })
  }

  const redeem = async () => {
    if (loading) return
    if (!selectedCredit || !pickedSlot) {
      setError('กรุณาเลือกวันและรอบเรียน')
      return
    }

    setLoading(true)
    setError(null)

    const response = await fetch('/api/lesson-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'redeem',
        creditId: selectedCredit.id,
        targetDate: pickedSlot.date,
        startTime: pickedSlot.start,
        endTime: pickedSlot.end,
        branchId: pickedSlot.branchId,
        scheduleTemplateId: pickedSlot.templateId || null,
      }),
    })
    const result = await response.json() as { success?: boolean; error?: string }

    if (!response.ok || !result.success) {
      setError(result.error || 'ใช้วันเรียนจากกระเป๋าไม่สำเร็จ กรุณาลองใหม่')
      setLoading(false)
      return
    }

    setLoading(false)
    toast.success('ใช้วันเรียนจากกระเป๋าสำเร็จ')
    closeDialog()
    router.refresh()
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">พร้อมใช้</p>
            <p className="mt-1 text-2xl font-bold text-[#2748bf]">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">ใช้แล้ว</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{stats.redeemed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">หมดอายุ</p>
            <p className="mt-1 text-2xl font-bold text-gray-500">{stats.expired}</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">กฎกระเป๋าวันเรียน</p>
            <p>เก็บได้เฉพาะรอบที่ชำระเงินแล้วและต้องเก็บก่อนเวลาเรียนอย่างน้อย 48 ชั่วโมง ใช้ได้เฉพาะเดือนเดิมเท่านั้น</p>
          </div>
        </div>
      </div>

      {activeCredits.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-gray-400">
            <WalletCards className="mx-auto mb-4 h-14 w-14 opacity-50" />
            <p className="text-lg font-medium">ยังไม่มีวันเรียนในกระเป๋า</p>
            <p className="mt-1 text-sm">กดเก็บจากหน้าตารางเรียนเมื่อจำเป็นต้องพักสิทธิ์ไว้ใช้ในเดือนเดียวกัน</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {activeCredits.map((credit) => {
            const courseType = getCourseType(credit)

            return (
            <Card key={credit.id} className="border-violet-200 bg-violet-50/30">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">พร้อมใช้</Badge>
                      <Badge variant="outline">{getLearnerName(credit)}</Badge>
                      {courseType ? (
                        <Badge variant="outline">{COURSE_LABELS[courseType]}</Badge>
                      ) : (
                        <Badge variant="destructive">ข้อมูลคอร์สไม่ครบ</Badge>
                      )}
                    </div>
                    <p className="font-semibold text-[#153c85]">{formatDateThai(credit.original_date)}</p>
                    <p className="text-sm text-gray-600">
                      <Clock className="mr-1 inline h-3.5 w-3.5" />
                      {fmtTime(credit.original_start_time)}-{fmtTime(credit.original_end_time)}
                      <span className="mx-2">·</span>
                      <MapPin className="mr-1 inline h-3.5 w-3.5" />
                      {credit.branches?.name || '-'}
                    </p>
                    <p className="text-xs text-gray-500">หมดอายุ {formatThaiDateWithWeekday(credit.expires_at)}</p>
                  </div>
                  <Button className="bg-[#2748bf] hover:bg-[#153c85]" disabled={loading || !courseType} onClick={() => openRedeemDialog(credit)}>
                    <ArrowRight className="mr-1 h-4 w-4" />
                    ใช้วันเรียน
                  </Button>
                </div>
              </CardContent>
            </Card>
            )
          })}
        </div>
      )}

      {usedCredits.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#153c85]">ประวัติในกระเป๋า</h2>
          <div className="space-y-2">
            {usedCredits.slice(0, 12).map((credit) => (
              <div key={credit.id} className="flex flex-col gap-2 rounded-lg border bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-gray-900">{getLearnerName(credit)} · {formatDateThai(credit.original_date)}</p>
                  <p className="text-gray-500">{fmtTime(credit.original_start_time)}-{fmtTime(credit.original_end_time)} · {credit.branches?.name || '-'}</p>
                </div>
                <Badge
                  variant="outline"
                  className={credit.status === 'redeemed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-500'}
                >
                  {credit.status === 'redeemed' ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                  {credit.status === 'redeemed' ? 'ใช้แล้ว' : 'หมดอายุ'}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog open={Boolean(selectedCredit)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">ใช้วันเรียนจากกระเป๋า</DialogTitle>
            <DialogDescription>
              เลือกรอบเรียนในเดือนเดียวกับสิทธิ์เดิม ระบบจะไม่คิดเงินซ้ำ และรอบใหม่จะรอ Head Coach จัดกลุ่ม/มอบหมายโค้ช
            </DialogDescription>
          </DialogHeader>

          {selectedCredit && (
            <div className="space-y-4">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="rounded-lg border bg-gray-50 p-3 text-sm">
                <p className="font-semibold text-[#153c85]">{getLearnerName(selectedCredit)}</p>
                <p>สิทธิ์จาก {formatDateThai(selectedCredit.original_date)} · {fmtTime(selectedCredit.original_start_time)}-{fmtTime(selectedCredit.original_end_time)}</p>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">เลือกวันในเดือนเดิม</p>
                  <span className="text-xs font-medium text-gray-500">
                    {MONTH_NAMES_TH[selectedMonthParts.month]} {selectedMonthParts.year + 543}
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
                    const date = getDateStr(day)
                    const isExpanded = expandedDate === date
                    const isPicked = pickedSlot?.date === date

                    return (
                      <button
                        key={date}
                        type="button"
                        disabled={!selectable}
                        onClick={() => handleDayClick(day)}
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

              {expandedDate && (() => {
                const day = Number(expandedDate.split('-')[2])
                const date = new Date(selectedMonthParts.year, selectedMonthParts.month, day)
                const dayIndex = date.getDay()
                const courseType = getCourseType(selectedCredit)

                if (!courseType) {
                  return (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                      ข้อมูลคอร์สของสิทธิ์นี้ไม่ครบ กรุณาติดต่อผู้ดูแลระบบ
                    </div>
                  )
                }

                return (
                  <div className="space-y-3 rounded-lg border bg-gray-50 p-3">
                    <p className="text-sm font-semibold text-gray-700">
                      <CalendarDays className="mr-1 inline h-4 w-4" />
                      {DAY_LABELS[dayIndex]} {day} {MONTH_NAMES_TH[selectedMonthParts.month]} · เลือกรอบเรียน
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
                              const alreadyBooked = isSlotAlreadyBooked(selectedCredit, expandedDate, slot.start, slot.end, branch.id)
                              return (
                                <Button
                                  key={`${branch.id}-${slot.start}-${slot.end}`}
                                  type="button"
                                  size="sm"
                                  disabled={alreadyBooked}
                                  variant={isSlotPicked ? 'default' : 'outline'}
                                  className={isSlotPicked ? 'bg-[#2748bf]' : alreadyBooked ? 'cursor-not-allowed border-orange-200 bg-orange-50 text-orange-700 opacity-70' : ''}
                                  onClick={() => handleSlotPick(day, slot.start, slot.end, branch, slot.templateId)}
                                >
                                  <Clock className="mr-1 h-3.5 w-3.5" />
                                  {fmtTime(slot.start)}-{fmtTime(slot.end)}
                                  {alreadyBooked && <span className="ml-1 text-[11px]">(จองแล้ว)</span>}
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
                  <p className="font-medium">รอบที่จะลงเรียน</p>
                  <p>{formatDateThai(pickedSlot.date)} · {fmtTime(pickedSlot.start)}-{fmtTime(pickedSlot.end)} · {pickedSlot.branchName}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={closeDialog} disabled={loading}>
                  ยกเลิก
                </Button>
                <Button className="flex-1 bg-[#2748bf] hover:bg-[#153c85]" disabled={loading || !pickedSlot} onClick={redeem}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      กำลังใช้สิทธิ์...
                    </>
                  ) : (
                    <>
                      <WalletCards className="mr-2 h-4 w-4" />
                      ยืนยันใช้วันเรียน
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
