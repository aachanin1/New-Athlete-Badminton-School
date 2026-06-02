'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { AlertCircle, Baby, CalendarCheck, Camera, CheckCircle2, ChevronDown, ChevronRight, Layers3, Loader2, Lock, MapPin, User, UserCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { fmtTime } from '@/lib/utils'

interface StudentSession {
  bookingSessionId: string
  studentId: string
  studentType: 'adult' | 'child'
  studentName: string
  parentName: string | null
  isChild: boolean
  branchName: string
  startTime: string
  endTime: string
  courseType: string
  assignmentGroupName: string | null
  attendanceStatus: 'present' | 'absent' | 'late' | null
}

interface SlotGroup {
  key: string
  scheduleSlotId: string
  branchName: string
  startTime: string
  endTime: string
  courseType: string
  checkin: {
    id: string
    checkinTime: string
    photoUrl: string | null
  } | null
  canRetroactiveCheckin: boolean
  students: StudentSession[]
}

interface AttendanceClientProps {
  slots: SlotGroup[]
  selectedDate: string
  selectedDateLabel: string
  selectedSlotId: string | null
  today: string
  totalDaySlots: number
}

const STATUS_CONFIG = {
  present: { label: 'มา', color: 'bg-green-500 hover:bg-green-600' },
  late: { label: 'สาย', color: 'bg-yellow-500 hover:bg-yellow-600' },
  absent: { label: 'ขาด', color: 'bg-red-500 hover:bg-red-600' },
}

export function AttendanceClient({
  slots,
  selectedDate,
  selectedDateLabel,
  selectedSlotId,
  today,
  totalDaySlots,
}: AttendanceClientProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    slots.forEach((slot) => slot.students.forEach((student) => {
      if (student.attendanceStatus) map[`${student.bookingSessionId}-${student.studentId}`] = student.attendanceStatus
    }))
    return map
  })
  const [expandedSlots, setExpandedSlots] = useState<Set<string>>(() => {
    if (selectedSlotId) return new Set([selectedSlotId])
    const firstOpenSlot = slots.find((slot) => {
      const checked = slot.students.filter((student) => student.attendanceStatus).length
      return checked < slot.students.length
    })
    return new Set(firstOpenSlot ? [firstOpenSlot.scheduleSlotId] : slots.slice(0, 1).map((slot) => slot.scheduleSlotId))
  })

  const markAttendance = async (student: StudentSession, status: 'present' | 'absent' | 'late') => {
    const key = `${student.bookingSessionId}-${student.studentId}`
    setLoadingId(key)
    setError(null)

    try {
      const res = await fetch('/api/coach/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingSessionId: student.bookingSessionId,
          studentId: student.studentId,
          studentType: student.studentType,
          status,
        }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error || 'เช็คชื่อไม่สำเร็จ')
        return
      }

      setStatuses((prev) => ({ ...prev, [key]: status }))
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoadingId(null)
    }
  }

  const totalStudents = slots.reduce((sum, slot) => sum + slot.students.length, 0)
  const checkedCount = Object.keys(statuses).length
  const isToday = selectedDate === today
  const slotSummaries = useMemo(() => slots.map((slot) => {
    const checked = slot.students.filter((student) => statuses[`${student.bookingSessionId}-${student.studentId}`]).length
    const isComplete = slot.students.length > 0 && checked === slot.students.length
    const hasAttendance = checked > 0
    const needsCheckin = !slot.checkin && !hasAttendance
    const label = isComplete ? 'บันทึกผลครบแล้ว' : needsCheckin ? 'รอเช็คอิน' : checked > 0 ? 'กำลังบันทึกผล' : 'รอบันทึกผล'
    const color = isComplete
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : needsCheckin
          ? 'border-orange-200 bg-orange-50 text-orange-700'
          : 'border-blue-200 bg-blue-50 text-blue-700'

    return { slotId: slot.scheduleSlotId, checked, isLocked: needsCheckin, isComplete, label, color }
  }), [slots, statuses])
  const completedSlots = slotSummaries.filter((summary) => summary.isComplete).length
  const lockedSlots = slotSummaries.filter((summary) => summary.isLocked).length
  const missingAttendanceSlots = slotSummaries.filter((summary) => !summary.isLocked && !summary.isComplete).length
  const retroReviewSlots = useMemo(() => slots.filter((slot) => slot.canRetroactiveCheckin), [slots])
  const retroReviewStudentCount = retroReviewSlots.reduce((sum, slot) => sum + slot.students.length, 0)

  const expandSlot = (slotId: string) => {
    setExpandedSlots((prev) => {
      const next = new Set(prev)
      next.add(slotId)
      return next
    })
  }

  const toggleSlot = (slotId: string) => {
    setExpandedSlots((prev) => {
      const next = new Set(prev)
      if (next.has(slotId)) next.delete(slotId)
      else next.add(slotId)
      return next
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-[#2748bf]">
            <UserCheck className="h-4 w-4" />
            Attendance
          </p>
          <h1 className="text-2xl font-bold text-[#153c85]">เช็คชื่อนักเรียน</h1>
          <p className="mt-1 text-sm text-gray-500">
            {selectedDateLabel}
            {totalStudents > 0 && ` - เช็คแล้ว ${checkedCount}/${totalStudents} คน`}
          </p>
          {selectedSlotId && (
            <p className="mt-1 text-xs text-gray-400">
              แสดงเฉพาะรอบที่เลือกจากตารางสอน
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedSlotId && totalDaySlots > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/coach/attendance?date=${selectedDate}`}>ดูทั้งวัน</Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={`/coach/today?date=${selectedDate}`}>
              <CalendarCheck className="mr-1.5 h-4 w-4" />
              กลับตารางสอน
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {retroReviewSlots.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/40">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-orange-700">
                  <AlertCircle className="h-4 w-4" />
                  รอตรวจสอบย้อนหลัง
                </div>
                <p className="mt-1 text-sm text-orange-700/80">
                  Admin ส่งรอบเหล่านี้กลับให้ตรวจสอบย้อนหลัง โค้ชต้องมีหลักฐานเช็คอินด้วยเซลฟี่และ GPS ก่อน แล้วค่อยเช็คชื่อรายคน
                </p>
              </div>
              <Badge variant="outline" className="w-fit border-orange-200 bg-white text-orange-700">
                {retroReviewSlots.length} รอบ / {retroReviewStudentCount} คน
              </Badge>
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
              {retroReviewSlots.map((slot) => {
                const summary = slotSummaries.find((item) => item.slotId === slot.scheduleSlotId)
                const needsCheckin = !slot.checkin

                return (
                  <div key={slot.key} className="rounded-lg border border-orange-100 bg-white p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[#153c85]">{fmtTime(slot.startTime)} - {fmtTime(slot.endTime)}</span>
                          <Badge className="bg-blue-100 text-[10px] text-blue-700">{slot.courseType || 'คอร์ส'}</Badge>
                          {summary && (
                            <Badge variant="outline" className={summary.color}>
                              {summary.label} {summary.checked}/{slot.students.length}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="h-3.5 w-3.5" />
                          {slot.branchName} · {slot.students.length} คน
                        </p>
                      </div>
                      {needsCheckin ? (
                        <Button asChild size="sm" className="bg-orange-500 hover:bg-orange-600">
                          <Link href={`/coach/checkin?date=${selectedDate}&slot=${slot.scheduleSlotId}`}>
                            <Camera className="mr-1.5 h-4 w-4" />
                            เช็คอินย้อนหลัง
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-orange-200 bg-white text-orange-700 hover:bg-orange-50"
                          onClick={() => expandSlot(slot.scheduleSlotId)}
                        >
                          ตรวจรายคน
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {slots.length > 0 && (
        <div className="sticky top-0 z-10 grid grid-cols-2 gap-2 rounded-xl border bg-white/95 p-2 shadow-sm backdrop-blur lg:grid-cols-4">
          <div className="rounded-lg bg-blue-50 px-3 py-2">
            <p className="text-[11px] text-blue-600">รอบทั้งหมด</p>
            <p className="text-lg font-bold text-[#153c85]">{slots.length}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 px-3 py-2">
            <p className="text-[11px] text-emerald-600">บันทึกผลครบแล้ว</p>
            <p className="text-lg font-bold text-emerald-700">{completedSlots}</p>
          </div>
          <div className="rounded-lg bg-orange-50 px-3 py-2">
            <p className="text-[11px] text-orange-600">ยังล็อก/รอเช็คอิน</p>
            <p className="text-lg font-bold text-orange-700">{lockedSlots}</p>
          </div>
          <div className="rounded-lg bg-red-50 px-3 py-2">
            <p className="text-[11px] text-red-600">ยังเช็คไม่ครบ</p>
            <p className="text-lg font-bold text-red-700">{missingAttendanceSlots}</p>
          </div>
        </div>
      )}

      {slots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <UserCheck className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ไม่มีนักเรียนที่ต้องเช็คชื่อในวันที่เลือก</p>
            <p className="mt-1 text-sm">รายการจะแสดงเฉพาะผู้เรียนในกลุ่มที่คุณรับผิดชอบและถูกบันทึก assignment แล้ว</p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href={`/coach/today?date=${selectedDate}`}>กลับไปดูตารางสอน</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {slots.map((slot) => {
            const isLocked = !slot.checkin
            const slotSummary = slotSummaries.find((summary) => summary.slotId === slot.scheduleSlotId)
            const isExpanded = expandedSlots.has(slot.scheduleSlotId)
            const studentsByGroup = Object.entries(slot.students.reduce((map, student) => {
              const groupName = student.assignmentGroupName || 'กลุ่มหลัก'
              if (!map[groupName]) map[groupName] = []
              map[groupName].push(student)
              return map
            }, {} as Record<string, StudentSession[]>))

            return (
              <Card id={`attendance-slot-${slot.scheduleSlotId}`} key={slot.key} className={`shadow-sm ${isLocked ? 'border-orange-200 bg-orange-50/40' : ''}`}>
                <CardContent className="space-y-3 p-4">
                  <button
                    type="button"
                    onClick={() => toggleSlot(slot.scheduleSlotId)}
                    className="flex w-full flex-col gap-3 text-left sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isLocked ? 'bg-orange-100' : 'bg-[#2748bf]/10'}`}>
                        {isExpanded ? <ChevronDown className="h-5 w-5 text-[#2748bf]" /> : isLocked ? <Lock className="h-5 w-5 text-orange-500" /> : <ChevronRight className="h-5 w-5 text-[#2748bf]" />}
                      </div>
                      <div>
                        <p className="font-bold text-[#153c85]">{fmtTime(slot.startTime)} - {fmtTime(slot.endTime)}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{slot.branchName}</span>
                          <Badge className="bg-blue-100 text-[10px] text-blue-700">{slot.courseType || 'คอร์ส'}</Badge>
                          <span>{slot.students.length} คน</span>
                          {slotSummary && (
                            <Badge variant="outline" className={slotSummary.color}>
                              {slotSummary.label} {slotSummary.checked}/{slot.students.length}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {isLocked && (isToday || slot.canRetroactiveCheckin) ? (
                      <Button asChild size="sm" className="bg-orange-500 hover:bg-orange-600">
                        <Link href={`/coach/checkin?date=${selectedDate}&slot=${slot.scheduleSlotId}`}>
                          <Camera className="mr-1.5 h-4 w-4" />
                          {slot.canRetroactiveCheckin && !isToday ? 'เช็คอินย้อนหลัง' : 'ไปเช็คอินก่อน'}
                        </Link>
                      </Button>
                    ) : isLocked ? (
                      <Badge variant="outline" className="w-fit border-orange-200 bg-orange-50 text-orange-700">
                        <Lock className="mr-1 h-3.5 w-3.5" />
                        รอหลักฐานเช็คอิน
                      </Badge>
                    ) : (
                      <Badge className="w-fit bg-green-100 text-green-700">
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        เช็คอินแล้ว
                      </Badge>
                    )}
                  </button>

                  {isLocked && (
                    <div className="rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm text-orange-700">
                      {slot.canRetroactiveCheckin
                        ? 'Admin ส่งรอบนี้กลับให้ตรวจสอบ โค้ชสามารถเช็คอินย้อนหลังด้วยเซลฟี่และพิกัดก่อนเช็คชื่อได้'
                        : isToday
                        ? 'ต้องเช็คอินรอบนี้ก่อนจึงจะเช็คชื่อนักเรียนได้ เพื่อให้ชั่วโมงสอนและหลักฐานของโค้ชครบถ้วน'
                        : 'รอบนี้ยังไม่มีหลักฐานเช็คอิน จึงยังเช็คชื่อย้อนหลังไม่ได้'}
                    </div>
                  )}

                  {isExpanded && (
                    <div className="space-y-3 border-t pt-2">
                      {studentsByGroup.map(([groupName, groupStudents]) => (
                        <div key={groupName} className="space-y-2 rounded-lg border bg-gray-50 p-2">
                          <div className="flex items-center justify-between gap-2 px-1">
                            <p className="text-xs font-semibold text-[#153c85]">{groupName}</p>
                            <Badge variant="outline" className="bg-white text-[10px]">{groupStudents.length} คน</Badge>
                          </div>
                          {groupStudents.map((student) => {
                      const key = `${student.bookingSessionId}-${student.studentId}`
                      const currentStatus = statuses[key] || null
                      const isLoading = loadingId === key

                      return (
                        <div key={key} className="flex flex-col gap-3 rounded-lg bg-white p-3 sm:flex-row sm:items-center sm:gap-2">
                          {student.isChild ? <Baby className="h-4 w-4 shrink-0 text-pink-500" /> : <User className="h-4 w-4 shrink-0 text-blue-500" />}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-medium">{student.studentName}</p>
                              {student.assignmentGroupName && (
                                <Badge variant="outline" className="bg-white text-[10px] text-gray-600">
                                  <Layers3 className="mr-1 h-3 w-3" />
                                  {student.assignmentGroupName}
                                </Badge>
                              )}
                            </div>
                            {student.parentName && <p className="truncate text-[11px] text-gray-400">ผู้ปกครอง: {student.parentName}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {isLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                            ) : (
                              (['present', 'late', 'absent'] as const).map((status) => {
                                const config = STATUS_CONFIG[status]
                                const isActive = currentStatus === status

                                return (
                                  <Button
                                    key={status}
                                    size="sm"
                                    disabled={isLocked}
                                    className={`h-7 px-2 text-[11px] ${isActive ? `${config.color} text-white` : 'bg-gray-200 text-gray-500 hover:bg-gray-300'} disabled:cursor-not-allowed disabled:opacity-50`}
                                    onClick={() => markAttendance(student, status)}
                                  >
                                    {config.label}
                                  </Button>
                                )
                              })
                            )}
                          </div>
                        </div>
                      )
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
