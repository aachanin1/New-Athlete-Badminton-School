'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  CalendarDays,
  MapPin,
  Clock,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { hasAvailableSlots, getAvailableSlots, type TimeSlot } from '@/lib/branch-schedules'
import { fmtTime } from '@/lib/utils'

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
  children?: { full_name: string } | null
  bookings?: { user_id: string; course_type_id: string; course_types?: { name: string } | null }
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
}

interface PickedSlot {
  date: string
  dayOfWeek: number
  start: string
  end: string
  branchId: string
  branchName: string
}

const MONTH_NAMES_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const DAY_LABELS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

function canReschedule(sessionDate: string, sessionTime: string): boolean {
  const sessionDateTime = new Date(`${sessionDate}T${sessionTime}`)
  const now = new Date()
  const diffMs = sessionDateTime.getTime() - now.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  return diffHours >= 24
}

function formatDateThai(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function RescheduleClient({ sessions, branches }: RescheduleClientProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null)
  const [pickedSlot, setPickedSlot] = useState<PickedSlot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Calendar state inside dialog
  const now = new Date()
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [expandedDate, setExpandedDate] = useState<string | null>(null)

  // Build branch slug map
  const branchSlugMap = useMemo(() => {
    const m: Record<string, string> = {}
    branches.forEach((b) => { m[b.id] = b.slug })
    return m
  }, [branches])
  const branchNameMap = useMemo(() => {
    const m: Record<string, string> = {}
    branches.forEach((b) => { m[b.id] = b.name })
    return m
  }, [branches])

  // Derive course type from session
  const getCourseType = (session: SessionRow | null): 'kids_group' | 'adult_group' | 'private' => {
    const name = session?.bookings?.course_types?.name
    if (name === 'kids_group' || name === 'adult_group' || name === 'private') return name
    return 'kids_group'
  }

  // Calendar days for the dialog
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1)
    const lastDay = new Date(calYear, calMonth + 1, 0)
    const startDow = firstDay.getDay()
    const totalDays = lastDay.getDate()
    const days: (number | null)[] = []
    for (let i = 0; i < startDow; i++) days.push(null)
    for (let d = 1; d <= totalDays; d++) days.push(d)
    return days
  }, [calMonth, calYear])

  const isDateSelectable = (day: number) => {
    if (!selectedSession) return false
    const courseType = getCourseType(selectedSession)
    const date = new Date(calYear, calMonth, day)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
    if (date < tomorrow) return false
    // Check if any branch has slots for this day
    return branches.some((b) => hasAvailableSlots(b.slug, courseType, date))
  }

  const openDialog = (session: SessionRow) => {
    setSelectedSession(session)
    setPickedSlot(null)
    setExpandedDate(null)
    setError(null)
    setSuccess(false)
    // Start calendar at the session's month
    const d = new Date(session.date)
    setCalMonth(d.getMonth())
    setCalYear(d.getFullYear())
    setDialogOpen(true)
  }

  const handleDayClick = (day: number) => {
    if (!isDateSelectable(day)) return
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setExpandedDate(expandedDate === dateStr ? null : dateStr)
    setPickedSlot(null)
  }

  const handleSlotPick = (day: number, start: string, end: string, branch: BranchOption) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const date = new Date(calYear, calMonth, day)
    setPickedSlot({ date: dateStr, dayOfWeek: date.getDay(), start, end, branchId: branch.id, branchName: branch.name })
  }

  const handleSubmit = async () => {
    if (!selectedSession || !pickedSlot) {
      setError('กรุณาเลือกวันและรอบเรียนใหม่')
      return
    }

    // Validate 24-hour rule
    if (!canReschedule(selectedSession.date, selectedSession.start_time)) {
      setError('ไม่สามารถเปลี่ยนได้ — ต้องเปลี่ยนล่วงหน้าอย่างน้อย 24 ชั่วโมง')
      return
    }

    setLoading(true)
    setError(null)

    const supabase = createClient()

    // Create new session (rescheduled) — preserve child_id
    const newSessionData: Record<string, any> = {
      booking_id: selectedSession.booking_id,
      date: pickedSlot.date,
      start_time: pickedSlot.start,
      end_time: pickedSlot.end,
      branch_id: pickedSlot.branchId,
      child_id: selectedSession.child_id || null,
      status: 'scheduled',
      rescheduled_from_id: selectedSession.id,
      is_makeup: false,
    }

    // Mark old session as rescheduled
    const { error: updateErr } = await (supabase
      .from('booking_sessions') as any)
      .update({ status: 'rescheduled' })
      .eq('id', selectedSession.id)

    if (updateErr) {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
      setLoading(false)
      return
    }

    // Insert new rescheduled session
    const { error: insertErr } = await (supabase
      .from('booking_sessions') as any)
      .insert(newSessionData)

    if (insertErr) {
      // Rollback: restore old session
      await (supabase.from('booking_sessions') as any)
        .update({ status: 'scheduled' })
        .eq('id', selectedSession.id)
      setError('เกิดข้อผิดพลาดในการสร้างรอบใหม่ กรุณาลองใหม่')
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => {
      setDialogOpen(false)
      router.refresh()
    }, 1500)
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="text-center text-gray-400">
            <ArrowLeftRight className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">ไม่มีรอบเรียนที่สามารถเปลี่ยนได้</p>
            <p className="text-sm mt-1">ตารางจะแสดงเฉพาะรอบที่ได้รับการยืนยันจาก Admin แล้ว</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-700 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">กฎการเปลี่ยนวัน/สาขา</p>
          <p>• ต้องเปลี่ยนล่วงหน้าอย่างน้อย <strong>24 ชั่วโมง</strong> ก่อนเวลาเรียน</p>
          <p>• เลือกวันใหม่จากปฏิทิน แล้วเลือกรอบเรียนที่ต้องการ</p>
        </div>
      </div>

      <div className="space-y-3">
        {sessions.map((session) => {
          const canChange = canReschedule(session.date, session.start_time)
          return (
            <Card key={session.id} className={!canChange ? 'opacity-60' : ''}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-[#2748bf]/10 rounded-xl flex flex-col items-center justify-center">
                    <span className="text-xs text-[#2748bf] font-medium">
                      {new Date(session.date).toLocaleDateString('th-TH', { weekday: 'short' })}
                    </span>
                    <span className="text-lg font-bold text-[#2748bf]">
                      {new Date(session.date).getDate()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{formatDateThai(session.date)}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {fmtTime(session.start_time)} - {fmtTime(session.end_time)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {session.branches?.name || '-'}
                      </span>
                    </div>
                    {session.children && (
                      <p className="text-xs text-gray-400 mt-0.5">👦 {session.children.full_name}</p>
                    )}
                  </div>
                </div>

                <div>
                  {canChange ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[#2748bf] border-[#2748bf]/30 hover:bg-[#2748bf]/5"
                      onClick={() => openDialog(session)}
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />
                      เปลี่ยน
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-gray-400 border-gray-200">
                      เปลี่ยนไม่ได้
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Reschedule Dialog — Calendar + Slot Picker */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <DialogTitle className="text-xl font-bold text-green-700 mb-2">
                เปลี่ยนสำเร็จ!
              </DialogTitle>
              <DialogDescription>
                รอบเรียนถูกเปลี่ยนเรียบร้อยแล้ว
              </DialogDescription>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-[#153c85]">เปลี่ยนวัน/สาขา</DialogTitle>
                <DialogDescription>
                  รอบเดิม: {selectedSession && formatDateThai(selectedSession.date)} • {fmtTime(selectedSession?.start_time)} - {fmtTime(selectedSession?.end_time)}
                  {selectedSession?.branches?.name && ` • ${selectedSession.branches.name}`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {error && (
                  <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-200">
                    {error}
                  </div>
                )}

                {/* Mini Calendar */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">เลือกวันใหม่</p>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                        if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1) } else setCalMonth(calMonth - 1)
                        setExpandedDate(null); setPickedSlot(null)
                      }} disabled={calMonth === now.getMonth() && calYear === now.getFullYear()}>
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </Button>
                      <span className="text-xs font-medium w-28 text-center">{MONTH_NAMES_TH[calMonth]} {calYear + 543}</span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                        if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1) } else setCalMonth(calMonth + 1)
                        setExpandedDate(null); setPickedSlot(null)
                      }}>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-gray-400 mb-0.5">
                    {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((d, idx) => <div key={d} className={idx === 0 ? 'text-red-500' : ''}>{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {calendarDays.map((day, i) => {
                      if (day === null) return <div key={`e-${i}`} />
                      const selectable = isDateSelectable(day)
                      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      const isExpanded = expandedDate === dateStr
                      const isPicked = pickedSlot?.date === dateStr
                      return (
                        <button key={day} onClick={() => handleDayClick(day)} disabled={!selectable}
                          className={`h-8 rounded text-xs font-medium transition-all
                            ${!selectable ? 'text-gray-300 cursor-not-allowed' : i % 7 === 0 && !isPicked ? 'text-red-500 cursor-pointer hover:bg-[#2748bf]/10' : 'cursor-pointer hover:bg-[#2748bf]/10'}
                            ${isPicked ? 'bg-[#2748bf] text-white' : ''}
                            ${isExpanded && !isPicked ? 'ring-2 ring-[#f57e3b] bg-[#f57e3b]/5' : ''}`}>
                          {day}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Slot picker for expanded date */}
                {expandedDate && selectedSession && (() => {
                  const day = parseInt(expandedDate.split('-')[2])
                  const date = new Date(calYear, calMonth, day)
                  const dow = date.getDay()
                  const courseType = getCourseType(selectedSession)
                  return (
                    <div className="p-3 bg-gray-50 rounded-lg border space-y-2">
                      <p className="text-xs font-medium text-gray-600">
                        <CalendarDays className="inline h-3.5 w-3.5 mr-1" />
                        {DAY_LABELS[dow]} {day} {MONTH_NAMES_TH[calMonth]} — เลือกรอบเรียน:
                      </p>
                      {branches.map((branch) => {
                        const slots = getAvailableSlots(branch.slug, courseType, dow)
                        if (slots.length === 0) return null
                        return (
                          <div key={branch.id}>
                            <p className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{branch.name}</p>
                            <div className="flex flex-wrap gap-1">
                              {slots.map((slot) => {
                                const isSlotPicked = pickedSlot?.date === expandedDate && pickedSlot?.start === slot.start && pickedSlot?.branchId === branch.id
                                return (
                                  <Button key={`${branch.id}-${slot.start}`} size="sm"
                                    variant={isSlotPicked ? 'default' : 'outline'}
                                    className={`h-7 text-xs ${isSlotPicked ? 'bg-[#2748bf]' : ''}`}
                                    onClick={() => handleSlotPick(day, slot.start, slot.end, branch)}>
                                    <Clock className="h-3 w-3 mr-1" />{fmtTime(slot.start)}-{fmtTime(slot.end)}
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

                {/* Picked slot summary */}
                {pickedSlot && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                    <p className="font-medium text-green-700 mb-1">รอบใหม่ที่เลือก:</p>
                    <p className="text-green-600">
                      {DAY_LABELS[pickedSlot.dayOfWeek]} {formatDateThai(pickedSlot.date)} • {fmtTime(pickedSlot.start)} - {fmtTime(pickedSlot.end)} • {pickedSlot.branchName}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setDialogOpen(false)}
                    disabled={loading}
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    className="flex-1 bg-[#2748bf] hover:bg-[#153c85]"
                    disabled={loading || !pickedSlot}
                    onClick={handleSubmit}
                  >
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
