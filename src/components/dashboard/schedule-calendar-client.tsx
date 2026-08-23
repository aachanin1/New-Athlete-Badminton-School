'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, AlertTriangle, BookOpenCheck, CalendarDays, CheckCircle2, CircleDot, Clock, ClipboardCheck, Loader2, MapPin, RotateCcw, ShieldCheck, UserRound, WalletCards } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { deriveSessionAttendanceStatus, type DerivedSessionStatus } from '@/lib/session-attendance-status'
import type { SafeScheduleProgram, SafeScheduleProgramResponse } from '@/lib/schedule-learning-details'
import { formatThaiDateTimeWithWeekday, formatThaiDateWithWeekday } from '@/lib/date-format'
import { cn, fmtTime } from '@/lib/utils'
import { SELF_LEARNER_COLOR, buildLearnerColorMap, getLearnerColor } from './learner-colors'

interface SessionData {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  is_makeup: boolean
  child_id: string | null
  rescheduled_from_id: string | null
  assignment_group_id?: string | null
  assignment_group_name?: string | null
  can_view_program?: boolean
  coach_id?: string | null
  coach_name?: string | null
  coach_role?: string | null
  coach_avatar_url?: string | null
  assignment_status?: 'assigned' | 'pending_assignment'
  attendance_status?: 'present' | 'absent' | 'late' | null
  attendance_checked_at?: string | null
  attendance_scope_count?: number
  level?: number
  level_name?: string | null
  level_label?: string
  rescheduled_from?: { date: string; start_time: string; end_time: string } | null
  wallet_credit_status?: 'active' | 'redeemed' | 'expired' | null
  wallet_redeemed_at?: string | null
  wallet_expired_at?: string | null
  wallet_redeemed_to?: { date: string; start_time: string; end_time: string } | null
  wallet_source_status?: 'active' | 'redeemed' | 'expired' | null
  children: { full_name: string; nickname: string | null } | null
  bookings: {
    course_types: { name: string | null } | null
  } | null
  branches: { name: string | null } | null
}

interface ChildData {
  id: string
  full_name: string
  nickname: string | null
}

interface ScheduleCalendarClientProps {
  sessions: SessionData[]
  learnerChildren: ChildData[]
  userName: string
}

const MONTH_NAMES_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const DAY_HEADERS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'นัดหมาย',
  completed: 'เรียนแล้ว',
  rescheduled: 'เลื่อน',
  absent: 'ขาดเรียน',
  walleted: 'เก็บในกระเป๋า',
}

const ATTENDANCE_BADGES: Record<DerivedSessionStatus, { label: string; className: string; dotClassName: string }> = {
  present: {
    label: 'มาเรียนแล้ว',
    className: 'border-green-200 bg-green-50 text-green-700',
    dotClassName: 'bg-green-500',
  },
  late: {
    label: 'มาสาย',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    dotClassName: 'bg-amber-500',
  },
  absent: {
    label: 'ขาดเรียน',
    className: 'border-red-200 bg-red-50 text-red-700',
    dotClassName: 'bg-red-500',
  },
  completed: {
    label: 'เรียนแล้ว',
    className: 'border-green-200 bg-green-50 text-green-700',
    dotClassName: 'bg-green-500',
  },
  in_progress: {
    label: 'กำลังเรียน',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
    dotClassName: 'bg-blue-500',
  },
  upcoming: {
    label: 'รอเรียน',
    className: 'border-slate-200 bg-slate-50 text-slate-700',
    dotClassName: 'bg-slate-400',
  },
  walleted: {
    label: 'อยู่ในกระเป๋า',
    className: 'border-violet-200 bg-violet-50 text-violet-700',
    dotClassName: 'bg-violet-500',
  },
  attendance_gap_review: {
    label: 'รอตรวจสอบการเช็คชื่อ',
    className: 'border-orange-200 bg-orange-50 text-orange-700',
    dotClassName: 'bg-orange-500',
  },
}

const WALLET_CREDIT_BADGES = {
  redeemed: {
    label: 'ใช้แล้วจากกระเป๋า',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
    dotClassName: 'bg-blue-500',
  },
  expired: {
    label: 'หมดอายุในกระเป๋า',
    className: 'border-gray-200 bg-gray-50 text-gray-600',
    dotClassName: 'bg-gray-400',
  },
}

const ROLE_LABELS: Record<string, string> = {
  coach: 'โค้ช',
  head_coach: 'หัวหน้าโค้ช',
  admin: 'Admin',
  super_admin: 'Super Admin',
}

function getInitial(name: string | null | undefined) {
  return (name || 'Coach').trim().charAt(0).toUpperCase()
}

function getDerivedStatus(session: SessionData, now: Date) {
  return deriveSessionAttendanceStatus({
    status: session.status,
    date: session.date,
    startTime: session.start_time,
    endTime: session.end_time,
    isMakeup: session.is_makeup,
    attendanceStatus: session.attendance_status || null,
    scopeAttendanceCount: session.attendance_scope_count || 0,
    now,
  })
}

function getDisplayStatus(session: SessionData, now: Date) {
  if (session.status === 'walleted' && session.wallet_credit_status === 'redeemed') {
    return { key: 'wallet_redeemed', ...WALLET_CREDIT_BADGES.redeemed }
  }
  if (session.status === 'walleted' && session.wallet_credit_status === 'expired') {
    return { key: 'wallet_expired', ...WALLET_CREDIT_BADGES.expired }
  }

  const status = getDerivedStatus(session, now)
  return { key: status, ...ATTENDANCE_BADGES[status] }
}

function getSessionStatusLabel(session: SessionData) {
  if (session.status === 'walleted' && session.wallet_credit_status === 'redeemed') return 'ใช้สิทธิ์แล้ว'
  if (session.status === 'walleted' && session.wallet_credit_status === 'expired') return 'หมดอายุ'
  return STATUS_LABELS[session.status] || session.status
}

function formatSlotText(slot: { date: string; start_time: string; end_time: string }) {
  return `${formatThaiDateWithWeekday(slot.date)} ${fmtTime(slot.start_time)}-${fmtTime(slot.end_time)}`
}

function isAtLeast48HoursAhead(date: string, time: string) {
  const start = new Date(`${date}T${time.slice(0, 5)}:00+07:00`)
  return start.getTime() - Date.now() >= 48 * 60 * 60 * 1000
}

function getCalendarStatusMarkerClass(session: SessionData) {
  const hasWalletSignal =
    session.status === 'walleted' ||
    session.wallet_credit_status === 'active' ||
    session.wallet_credit_status === 'redeemed' ||
    session.wallet_credit_status === 'expired' ||
    session.wallet_source_status === 'redeemed'

  if (hasWalletSignal) return 'ring-2 ring-violet-500 ring-offset-1 ring-offset-white'
  return 'ring-1 ring-white'
}

export function ScheduleCalendarClient({ sessions, learnerChildren, userName }: ScheduleCalendarClientProps) {
  const router = useRouter()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [walletSession, setWalletSession] = useState<SessionData | null>(null)
  const [walletLoadingId, setWalletLoadingId] = useState<string | null>(null)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [programSession, setProgramSession] = useState<SessionData | null>(null)
  const [programState, setProgramState] = useState<
    { status: 'idle' | 'loading' | 'ready' | 'error'; program: SafeScheduleProgram | null }
  >({ status: 'idle', program: null })
  const programCache = useRef(new Map<string, SafeScheduleProgram | null>())
  const programRequestGeneration = useRef(0)
  const programAbortController = useRef<AbortController | null>(null)

  useEffect(() => () => programAbortController.current?.abort(), [])

  const childColorMap = useMemo(() => buildLearnerColorMap(learnerChildren), [learnerChildren])

  const sessionsByDate = useMemo(() => {
    const map: Record<string, SessionData[]> = {}
    sessions.forEach((session) => {
      if (!map[session.date]) map[session.date] = []
      map[session.date].push(session)
    })
    Object.values(map).forEach((items) => items.sort((a, b) => a.start_time.localeCompare(b.start_time)))
    return map
  }, [sessions])

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: (number | null)[] = []
    for (let index = 0; index < firstDay.getDay(); index++) days.push(null)
    for (let day = 1; day <= lastDay.getDate(); day++) days.push(day)
    return days
  }, [month, year])

  const getDateStr = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const getDateSessions = (day: number) => sessionsByDate[getDateStr(day)] || []
  const selectedSessions = selectedDate ? sessionsByDate[selectedDate] || [] : []

  const getLearnerName = (session: SessionData) => {
    if (session.children) return session.children.nickname || session.children.full_name
    return userName || 'ตัวเอง'
  }

  const loadProgram = async (session: SessionData, force = false) => {
    setProgramSession(session)
    if (!force && programCache.current.has(session.id)) {
      setProgramState({ status: 'ready', program: programCache.current.get(session.id) || null })
      return
    }

    programAbortController.current?.abort()
    const controller = new AbortController()
    programAbortController.current = controller
    const generation = programRequestGeneration.current + 1
    programRequestGeneration.current = generation
    setProgramState({ status: 'loading', program: null })

    try {
      const response = await fetch(`/api/schedule/program?sessionId=${encodeURIComponent(session.id)}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('program request failed')
      const payload = await response.json() as SafeScheduleProgramResponse
      if (generation !== programRequestGeneration.current) return
      const program = payload.program || null
      programCache.current.set(session.id, program)
      setProgramState({ status: 'ready', program })
    } catch (error) {
      if (controller.signal.aborted || generation !== programRequestGeneration.current) return
      console.error('Schedule program load failed:', error)
      setProgramState({ status: 'error', program: null })
    }
  }

  const closeProgramDialog = () => {
    programAbortController.current?.abort()
    programAbortController.current = null
    programRequestGeneration.current += 1
    setProgramSession(null)
    setProgramState({ status: 'idle', program: null })
  }

  const canStoreInWallet = (session: SessionData) => {
    return (
      session.status === 'scheduled' &&
      !session.is_makeup &&
      !session.attendance_status &&
      isAtLeast48HoursAhead(session.date, session.start_time)
    )
  }

  const storeInWallet = async () => {
    if (!walletSession) return
    setWalletLoadingId(walletSession.id)
    setWalletError(null)

    const response = await fetch('/api/lesson-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'store', sessionId: walletSession.id }),
    })
    const result = await response.json() as { success?: boolean; error?: string }

    if (!response.ok || !result.success) {
      setWalletError(result.error || 'เก็บเข้ากระเป๋าไม่สำเร็จ กรุณาลองใหม่')
      setWalletLoadingId(null)
      return
    }

    setWalletLoadingId(null)
    setWalletSession(null)
    router.refresh()
  }

  const totalThisMonth = useMemo(() => {
    return sessions.filter((session) => {
      const date = new Date(`${session.date}T00:00:00+07:00`)
      return date.getMonth() === month && date.getFullYear() === year
    }).length
  }, [sessions, month, year])

  const perLearnerCount = useMemo(() => {
    const map: Record<string, { name: string; count: number }> = {}
    sessions.forEach((session) => {
      const date = new Date(`${session.date}T00:00:00+07:00`)
      if (date.getMonth() !== month || date.getFullYear() !== year) return
      const key = session.child_id || 'self'
      const name = session.children ? session.children.nickname || session.children.full_name : userName || 'ตัวเอง'
      if (!map[key]) map[key] = { name, count: 0 }
      map[key].count += 1
    })
    return Object.values(map)
  }, [sessions, month, year, userName])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label="เดือนก่อนหน้า"
            onClick={() => {
              if (month === 0) {
                setMonth(11)
                setYear(year - 1)
              } else {
                setMonth(month - 1)
              }
              setSelectedDate(null)
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="w-44 text-center text-lg font-bold text-[#153c85]">{MONTH_NAMES_TH[month]} {year + 543}</span>
          <Button
            variant="outline"
            size="sm"
            aria-label="เดือนถัดไป"
            onClick={() => {
              if (month === 11) {
                setMonth(0)
                setYear(year + 1)
              } else {
                setMonth(month + 1)
              }
              setSelectedDate(null)
            }}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <Badge variant="outline" className="w-fit text-sm">รวม {totalThisMonth} ครั้ง</Badge>
      </div>

      {perLearnerCount.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          {perLearnerCount.map((item) => (
            <span key={item.name} className="rounded-lg bg-gray-100 px-2.5 py-1 text-gray-700">
              {item.name} = <strong>{item.count} ครั้ง</strong>
            </span>
          ))}
        </div>
      )}

      {learnerChildren.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {learnerChildren.map((child) => (
            <Badge key={child.id} className={getLearnerColor(child.id, childColorMap).badge} variant="outline">
              {child.nickname || child.full_name}
            </Badge>
          ))}
          <Badge className={SELF_LEARNER_COLOR.badge} variant="outline">{userName || 'ตัวเอง'} (ตัวเอง)</Badge>
        </div>
      )}

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500">
            {DAY_HEADERS.map((day, index) => (
              <div key={`${day}-${index}`} className={cn('py-1', index === 0 && 'text-red-500')}>{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              if (day === null) return <div key={`empty-${index}`} />

              const dateStr = getDateStr(day)
              const daySessions = getDateSessions(day)
              const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear()
              const isSelected = selectedDate === dateStr
              const hasSessions = daySessions.length > 0
              const visibleSessions = daySessions.slice(0, 4)
              const extraCount = daySessions.length - visibleSessions.length

              return (
                <button
                  key={dateStr}
                  type="button"
                  aria-label={`ดูตารางวันที่ ${dateStr}`}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={cn(
                    'flex min-h-[4rem] flex-col items-center rounded-lg p-1 text-sm transition-all sm:min-h-[4.5rem]',
                    isToday && 'ring-2 ring-[#f57e3b]',
                    isSelected && 'bg-[#2748bf]/10 ring-2 ring-[#2748bf]',
                    hasSessions ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default',
                  )}
                >
                  <span className={cn('text-xs font-medium', isToday ? 'text-[#f57e3b]' : index % 7 === 0 ? 'text-red-500' : hasSessions ? 'text-[#153c85]' : 'text-gray-400')}>
                    {day}
                  </span>
                  {hasSessions && (
                    <div className="mt-1 flex w-full flex-wrap justify-center gap-0.5">
                      {visibleSessions.map((session) => {
                        const learnerDot = getLearnerColor(session.child_id, childColorMap).dot
                        const status = getDisplayStatus(session, now)
                        return (
                          <span
                            key={session.id}
                            className={cn('h-2 w-2 rounded-full', learnerDot, getCalendarStatusMarkerClass(session))}
                            title={`${getLearnerName(session)} ${fmtTime(session.start_time)} ${status.label}`}
                          />
                        )
                      })}
                      {extraCount > 0 && (
                        <span className="rounded-full bg-gray-100 px-1 text-[10px] font-medium text-gray-500">+{extraCount}</span>
                      )}
                      <span className="mt-0.5 w-full truncate text-[10px] font-medium text-[#153c85]">{daySessions.length} รอบ</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {selectedDate && selectedSessions.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-medium text-[#153c85]">
                <CalendarDays className="mr-1 inline h-4 w-4" />
                {formatThaiDateWithWeekday(selectedDate)}
              </p>
              <span className="text-sm text-gray-500">{selectedSessions.length} รอบ</span>
            </div>

            <div className="max-h-[30rem] space-y-3 overflow-y-auto pr-1">
              {selectedSessions.map((session) => {
                const colorClass = getLearnerColor(session.child_id, childColorMap).badge
                const displayStatus = getDisplayStatus(session, now)
                const derivedStatus = getDerivedStatus(session, now)
                const coachRoleLabel = session.coach_role ? ROLE_LABELS[session.coach_role] || session.coach_role : 'โค้ช'
                const needsAttendanceReview = derivedStatus === 'attendance_gap_review'
                const derivedAbsentFromPartialAttendance = derivedStatus === 'absent' && !session.attendance_status && (session.attendance_scope_count || 0) > 0
                const isWalletSession = session.status === 'walleted'
                const isWalletRedeemed = isWalletSession && session.wallet_credit_status === 'redeemed'
                const isWalletExpired = isWalletSession && session.wallet_credit_status === 'expired'
                const isRedeemedFromWallet = session.wallet_source_status === 'redeemed'

                return (
                  <div key={session.id} className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={cn('border text-xs', displayStatus.className)} variant="outline">
                            <CircleDot className="mr-1 h-3 w-3" />
                            {displayStatus.label}
                          </Badge>
                          <Badge className={colorClass} variant="outline">{getLearnerName(session)}</Badge>
                          <Badge variant="outline" className="border-indigo-100 bg-indigo-50 text-xs text-indigo-700">
                            {session.level_label || 'LV 0 / ยังไม่ประเมิน'}
                          </Badge>
                          <Badge className="border-blue-100 bg-blue-50 text-xs text-blue-700" variant="outline">
                            {session.bookings?.course_types?.name || 'คอร์สเรียน'}
                          </Badge>
                          {session.is_makeup && (
                            <Badge variant="outline" className="border-orange-200 bg-orange-50 text-xs text-orange-700">
                              <RotateCcw className="mr-1 h-3 w-3" />
                              รอบชดเชย
                            </Badge>
                          )}
                        </div>

                        <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                          <span className="inline-flex items-center gap-2 font-medium text-gray-900">
                            <Clock className="h-4 w-4 text-gray-400" />
                            {fmtTime(session.start_time)} - {fmtTime(session.end_time)}
                          </span>
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
                            <span className="truncate">{session.branches?.name || 'ไม่ระบุสาขา'}</span>
                          </span>
                        </div>
                      </div>

                      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 lg:w-80">
                        {session.coach_id ? (
                          <div>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border border-white shadow-sm">
                                <AvatarImage src={session.coach_avatar_url || undefined} alt={session.coach_name || 'Coach'} />
                                <AvatarFallback className="bg-[#2748bf]/10 text-sm font-semibold text-[#153c85]">
                                  {getInitial(session.coach_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-gray-900">{session.coach_name || 'โค้ชผู้สอน'}</p>
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                                  {session.coach_role === 'head_coach' ? <ShieldCheck className="h-3 w-3 text-[#2748bf]" /> : <UserRound className="h-3 w-3" />}
                                  {coachRoleLabel}
                                  {session.assignment_group_name ? ` · ${session.assignment_group_name}` : ''}
                                </p>
                              </div>
                            </div>
                            {session.can_view_program && session.assignment_group_id && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="mt-3 w-full border-[#2748bf]/20 bg-white text-[#153c85] hover:bg-blue-50"
                                onClick={() => void loadProgram(session)}
                              >
                                <BookOpenCheck className="mr-1.5 h-3.5 w-3.5" />
                                ดูโปรแกรมสอนรอบนี้
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-start gap-2 text-sm text-amber-700">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <div>
                              <p className="font-semibold">
                                {isWalletRedeemed
                                  ? 'ใช้สิทธิ์จากกระเป๋าแล้ว'
                                  : isWalletExpired
                                    ? 'สิทธิ์ในกระเป๋าหมดอายุแล้ว'
                                    : isWalletSession
                                      ? 'เก็บไว้ในกระเป๋าวันเรียน'
                                      : 'ยังไม่ได้มอบหมายโค้ช'}
                              </p>
                              <p className="text-xs text-amber-600">
                                {isWalletRedeemed && session.wallet_redeemed_to
                                  ? `ถูกนำไปใช้กับรอบ ${formatSlotText(session.wallet_redeemed_to)} แล้ว`
                                  : isWalletExpired
                                    ? 'สิทธิ์นี้เลยกำหนดใช้ภายในเดือนเดิมแล้ว'
                                    : isWalletSession
                                      ? 'ใช้สิทธิ์นี้ได้จากเมนูกระเป๋าวันเรียนภายในเดือนเดิม'
                                  : 'จะแสดงชื่อโค้ชเมื่อหัวหน้าโค้ชจัดกลุ่มเรียบร้อย'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <Badge variant="outline" className="bg-white text-xs">
                        <ClipboardCheck className="mr-1 h-3 w-3" />
                        {getSessionStatusLabel(session)}
                      </Badge>
                      {session.attendance_checked_at && (
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <CheckCircle2 className="h-3 w-3" />
                          เช็คชื่อ {formatThaiDateTimeWithWeekday(session.attendance_checked_at)}
                        </span>
                      )}
                      {derivedAbsentFromPartialAttendance && (
                        <span className="inline-flex items-center gap-1 text-red-700">
                          <AlertTriangle className="h-3 w-3" />
                          เลยเวลาเรียนแล้ว ระบบนับเป็นขาดเรียนเพื่อส่งต่อกฎวันชดเชย
                        </span>
                      )}
                      {needsAttendanceReview && (
                        <span className="inline-flex items-center gap-1 text-orange-700">
                          <AlertTriangle className="h-3 w-3" />
                          เลยเวลาเรียนแล้ว แต่ยังไม่มีการเช็คชื่อทั้งรอบ ต้องรอ Admin/Coach ตรวจสอบก่อนสรุปสถานะ
                        </span>
                      )}
                      {isWalletSession && isWalletRedeemed && (
                        <span className="inline-flex items-center gap-1 text-blue-700">
                          <WalletCards className="h-3 w-3" />
                          ใช้สิทธิ์แล้ว{session.wallet_redeemed_to ? ` ไปวันที่ ${formatSlotText(session.wallet_redeemed_to)}` : ''}
                        </span>
                      )}
                      {isWalletSession && !isWalletRedeemed && !isWalletExpired && (
                        <span className="inline-flex items-center gap-1 text-violet-700">
                          <WalletCards className="h-3 w-3" />
                          รอบนี้ถูกเก็บเข้ากระเป๋าแล้ว ไม่ถูกนับเป็นขาดเรียนหรือรอบชดเชย
                        </span>
                      )}
                      {isWalletExpired && (
                        <span className="inline-flex items-center gap-1 text-gray-600">
                          <WalletCards className="h-3 w-3" />
                          สิทธิ์ในกระเป๋าหมดอายุแล้ว
                        </span>
                      )}
                      {canStoreInWallet(session) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="ml-auto border-violet-200 text-violet-700 hover:bg-violet-50"
                          onClick={() => {
                            setWalletError(null)
                            setWalletSession(session)
                          }}
                        >
                          <WalletCards className="mr-1 h-3.5 w-3.5" />
                          เก็บเข้ากระเป๋า
                        </Button>
                      )}
                    </div>

                    {session.rescheduled_from && (
                      <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-700">
                        <RotateCcw className="h-3 w-3" />
                        <span>
                          {isRedeemedFromWallet ? 'ใช้สิทธิ์จากกระเป๋าวันที่ ' : 'ย้ายมาจากวันที่ '}
                          {formatSlotText(session.rescheduled_from)}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {totalThisMonth === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <CalendarDays className="mx-auto mb-3 h-12 w-12 opacity-50" />
            <p className="font-medium">ยังไม่มีตารางเรียนในเดือนนี้</p>
            <p className="mt-1 text-sm">ตารางจะแสดงหลังจากจองคอร์สเรียนและชำระเงินเรียบร้อย</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(programSession)} onOpenChange={(open) => !open && closeProgramDialog()}>
        <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl overflow-hidden sm:w-full">
          <DialogHeader>
            <DialogTitle>โปรแกรมสอนรอบนี้</DialogTitle>
            <DialogDescription>
              {programSession
                ? `${getLearnerName(programSession)} · ${formatThaiDateWithWeekday(programSession.date)} · ${fmtTime(programSession.start_time)}-${fmtTime(programSession.end_time)}`
                : 'รายละเอียดโปรแกรมสอนที่ได้รับอนุมัติ'}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border bg-gray-50 p-4 text-sm text-gray-700">
            {programState.status === 'loading' && (
              <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังโหลดโปรแกรมสอน...
              </div>
            )}
            {programState.status === 'ready' && programState.program && (
              <p className="whitespace-pre-wrap break-words leading-6">{programState.program.programContent}</p>
            )}
            {programState.status === 'ready' && !programState.program && (
              <p className="py-8 text-center text-gray-500">ยังไม่มีโปรแกรมสอนที่อนุมัติสำหรับรอบนี้</p>
            )}
            {programState.status === 'error' && (
              <div className="space-y-3 py-6 text-center">
                <p className="text-red-600">ไม่สามารถโหลดโปรแกรมสอนรอบนี้ได้ กรุณาลองอีกครั้ง</p>
                {programSession && (
                  <Button type="button" size="sm" variant="outline" onClick={() => void loadProgram(programSession, true)}>
                    ลองใหม่
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(walletSession)} onOpenChange={(open) => !open && setWalletSession(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>เก็บรอบเรียนเข้ากระเป๋า?</AlertDialogTitle>
            <AlertDialogDescription>
              ระบบจะตรวจสิทธิ์จาก Payment และแพ็กเกจอีกครั้ง: Adult Group/Family Private แพ็กเกจมากกว่า 1 ครั้งหรือชั่วโมงใช้ได้ถึงวันหมดอายุ ส่วน Kids และแบบรายครั้ง/รายชั่วโมงใช้ได้เฉพาะเดือนเดิม ไม่คิดเงินซ้ำ และถ้าเป็น Family Private การเก็บครั้งนี้จะย้ายผู้เรียนทุกคนในรอบเดียวกันพร้อมกัน
            </AlertDialogDescription>
          </AlertDialogHeader>
          {walletSession && (
            <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-700">
              <p className="font-semibold text-[#153c85]">{getLearnerName(walletSession)}</p>
              <p>{formatThaiDateWithWeekday(walletSession.date)} · {fmtTime(walletSession.start_time)}-{fmtTime(walletSession.end_time)}</p>
              <p className="text-xs text-gray-500">{walletSession.branches?.name || '-'}</p>
            </div>
          )}
          {walletError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {walletError}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(walletLoadingId)}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#2748bf] hover:bg-[#153c85]"
              disabled={Boolean(walletLoadingId)}
              onClick={(event) => {
                event.preventDefault()
                storeInWallet()
              }}
            >
              {walletLoadingId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังเก็บ...
                </>
              ) : (
                <>
                  <WalletCards className="mr-2 h-4 w-4" />
                  ยืนยันเก็บเข้ากระเป๋า
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
