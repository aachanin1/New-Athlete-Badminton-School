'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Building2,
  Calendar,
  CalendarDays,
  RotateCcw,
  Search,
  User,
  UserCog,
  Users,
} from 'lucide-react'
import { formatThaiDateWithWeekday } from '@/lib/date-format'
import { fmtTime } from '@/lib/utils'
import { getAdminScheduleRoundLearnerBuckets } from '@/lib/admin-schedule-assignment-state'
import { stripDynamicMemberCount } from '@/lib/coach-assignment-group-naming'
import {
  getAdminScheduleSummaryTotals,
  type AdminScheduleMonthSummary,
} from '@/lib/admin-schedules-model'

interface BranchOption {
  id: string
  name: string
  slug: string
}

interface ScheduleSession {
  id: string
  round_key: string
  schedule_slot_id: string | null
  date: string
  start_time: string
  end_time: string
  status: string
  is_makeup: boolean
  child_id: string | null
  student_id: string | null
  student_type: 'adult' | 'child' | null
  level: number
  level_name: string | null
  level_category: string | null
  learner_type: string
  has_missing_child_link: boolean
  branch_id: string
  branch_name: string
  course_type_id: string
  learner_name: string
  parent_name: string | null
  course_type: string
  booking_status: string
  coach_names: string[]
}

interface TeachingProgramSummary {
  id: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  program_content: string
  updated_at: string
}

interface ScheduleRoundGroup {
  id: string
  name: string
  coach_id: string | null
  coach_profile_id: string | null
  coach_name: string | null
  coach_role: string | null
  level_min: number | null
  level_max: number | null
  sort_order: number
  teaching_program: TeachingProgramSummary | null
  learners: ScheduleSession[]
}

interface ScheduleRound {
  key: string
  schedule_slot_id: string | null
  date: string
  start_time: string
  end_time: string
  branch_id: string
  branch_name: string
  course_type_id: string
  course_type: string
  learner_count: number
  groups: ScheduleRoundGroup[]
  unassigned_learners: ScheduleSession[]
}

interface SchedulesClientProps {
  summary: AdminScheduleMonthSummary
  initialPerformance: {
    durationMs: number
    externalCalls: number
    rows: Record<string, number>
    calls: Record<string, number>
  }
  branches: BranchOption[]
  initialYear: number
  initialMonth: number
}

const COURSE_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  kids_group: { label: 'เด็กกลุ่ม', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
  adult_group: { label: 'ผู้ใหญ่กลุ่ม', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  private: { label: 'Private', dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700' },
}

const SESSION_STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  scheduled: { label: 'นัดหมาย', badge: 'bg-blue-100 text-blue-700' },
  upcoming: { label: 'รอเรียน', badge: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'กำลังเรียน', badge: 'bg-amber-100 text-amber-700' },
  completed: { label: 'เรียนแล้ว', badge: 'bg-emerald-100 text-emerald-700' },
  absent: { label: 'ขาดเรียน', badge: 'bg-rose-100 text-rose-700' },
  attendance_gap_review: { label: 'รอตรวจเช็คชื่อ', badge: 'bg-orange-100 text-orange-700' },
  walleted: { label: 'เข้ากระเป๋า', badge: 'bg-violet-100 text-violet-700' },
  cancelled: { label: 'ยกเลิก', badge: 'bg-gray-100 text-gray-600' },
}

const PROGRAM_STATUS_CONFIG: Record<TeachingProgramSummary['status'], { label: string; badge: string }> = {
  draft: { label: 'ร่างโปรแกรม', badge: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'รอตรวจโปรแกรม', badge: 'bg-blue-100 text-blue-700' },
  approved: { label: 'อนุมัติแล้ว', badge: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'ขอแก้ไข', badge: 'bg-orange-100 text-orange-700' },
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

const DAY_HEADERS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

type RoundTimePhase = 'future' | 'active' | 'past'

function getDateString(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getBangkokDateString(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function getBangkokTimeString(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.hour}:${values.minute}:${values.second}`
}

function normalizeTimeString(time: string) {
  const [hour = '00', minute = '00', second = '00'] = time.split(':')
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`
}

function formatDisplayDate(date: string) {
  return formatThaiDateWithWeekday(date)
}

function formatShortDate(date: string) {
  return formatThaiDateWithWeekday(date)
}

function formatLevel(session: ScheduleSession) {
  if (session.level <= 0) return 'LV 0 / ยังไม่ประเมิน'
  return `LV ${session.level}${session.level_name ? ` · ${session.level_name}` : ''}`
}

function formatActualGroupLevelRange(learners: ScheduleSession[]) {
  if (learners.length === 0) return null

  const assessedLevels = learners
    .map((learner) => learner.level)
    .filter((level) => level > 0)
  const unassessedCount = learners.length - assessedLevels.length

  if (assessedLevels.length === 0) return 'เด็กในกลุ่ม: ยังไม่ประเมิน'

  const minLevel = Math.min(...assessedLevels)
  const maxLevel = Math.max(...assessedLevels)
  const levelLabel = minLevel === maxLevel ? `LV ${minLevel}` : `LV ${minLevel}-${maxLevel}`

  if (unassessedCount > 0) return `เด็กในกลุ่ม ${levelLabel} + ยังไม่ประเมิน ${unassessedCount} คน`
  return `เด็กในกลุ่ม ${levelLabel}`
}

type RoundLearnerBuckets = ReturnType<
  typeof getAdminScheduleRoundLearnerBuckets<ScheduleSession, ScheduleRoundGroup>
>

function getRoundTimePhase(round: ScheduleRound, now: Date): RoundTimePhase {
  const bangkokDate = getBangkokDateString(now)
  if (round.date < bangkokDate) return 'past'
  if (round.date > bangkokDate) return 'future'

  const bangkokTime = getBangkokTimeString(now)
  const startTime = normalizeTimeString(round.start_time)
  const endTime = normalizeTimeString(round.end_time)

  if (bangkokTime < startTime) return 'future'
  if (bangkokTime <= endTime) return 'active'
  return 'past'
}

function getDailyBoardLearnerStatus(session: ScheduleSession, roundTimePhase: RoundTimePhase) {
  if (session.status === 'walleted') {
    return { label: 'อยู่ในกระเป๋า', badge: 'bg-violet-100 text-violet-700' }
  }
  if (session.status === 'cancelled') {
    return SESSION_STATUS_CONFIG.cancelled
  }
  if (roundTimePhase === 'future') {
    return { label: 'รอเริ่มเรียน', badge: 'bg-blue-100 text-blue-700' }
  }
  if (roundTimePhase === 'active') {
    if (session.status === 'completed') {
      return { label: 'เช็คชื่อแล้ว', badge: 'bg-emerald-100 text-emerald-700' }
    }
    if (session.status === 'absent') {
      return SESSION_STATUS_CONFIG.absent
    }
    return { label: 'รอเช็คชื่อ', badge: 'bg-amber-100 text-amber-700' }
  }
  if (session.status === 'completed') {
    return SESSION_STATUS_CONFIG.completed
  }
  if (session.status === 'absent') {
    return SESSION_STATUS_CONFIG.absent
  }
  return { label: 'รอตรวจเช็คชื่อ', badge: 'bg-orange-100 text-orange-700' }
}

function getRoundStatusFromBuckets(buckets: RoundLearnerBuckets, roundTimePhase: RoundTimePhase) {
  const { coachedLearnerCount, waitingCoachCount, walletedLearners } = buckets
  if (coachedLearnerCount === 0 && walletedLearners.length > 0) {
    return { label: 'อยู่ในกระเป๋า', badge: 'bg-violet-100 text-violet-700' }
  }
  if (roundTimePhase === 'active') {
    return { label: 'กำลังเรียน', badge: 'bg-amber-100 text-amber-700' }
  }
  if (roundTimePhase === 'future') {
    return { label: 'รอเริ่มเรียน', badge: 'bg-blue-100 text-blue-700' }
  }
  if (waitingCoachCount > 0) {
    return { label: `รอจัดโค้ช ${waitingCoachCount} คน`, badge: 'bg-red-100 text-red-700' }
  }
  return { label: 'ครบทุกคนแล้ว', badge: 'bg-emerald-100 text-emerald-700' }
}

function getProgramPreview(program: TeachingProgramSummary) {
  return program.program_content.replace(/\s+/g, ' ').trim()
}

interface ScheduleSearchResult {
  roundKeys: string[]
  dates: string[]
  matchCount: number
  learnerCount: number
  truncated: boolean
  limit: number
}

interface ScheduleDayDetail {
  sessions: ScheduleSession[]
  rounds: ScheduleRound[]
}

export function SchedulesClient({ summary, initialPerformance, branches, initialYear, initialMonth }: SchedulesClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const pendingNavigationRef = useRef(false)
  const [now, setNow] = useState(() => new Date())
  const today = getBangkokDateString(now)
  const month = initialMonth - 1
  const year = initialYear
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [selectedCourse, setSelectedCourse] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dayDetail, setDayDetail] = useState<ScheduleDayDetail | null>(null)
  const [dayDetailStatus, setDayDetailStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [searchResult, setSearchResult] = useState<ScheduleSearchResult | null>(null)
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const dayRequestGeneration = useRef(0)
  const searchRequestGeneration = useRef(0)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    pendingNavigationRef.current = false
  }, [month, year])

  useEffect(() => {
    if (!selectedDate) {
      dayRequestGeneration.current += 1
      setDayDetail(null)
      setDayDetailStatus('idle')
      return
    }

    const controller = new AbortController()
    const generation = dayRequestGeneration.current + 1
    dayRequestGeneration.current = generation
    setDayDetail(null)
    setDayDetailStatus('loading')

    const params = new URLSearchParams({ date: selectedDate, year: String(year), month: String(month + 1) })
    fetch(`/api/admin/schedules/day?${params}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'โหลดรายละเอียดไม่สำเร็จ')
        return payload as ScheduleDayDetail
      })
      .then((payload) => {
        if (generation !== dayRequestGeneration.current) return
        setDayDetail({ sessions: payload.sessions, rounds: payload.rounds })
        setDayDetailStatus('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || generation !== dayRequestGeneration.current) return
        void error
        setDayDetailStatus('error')
      })

    return () => controller.abort()
  }, [selectedDate, year, month])

  useEffect(() => {
    const query = search.normalize('NFC').trim()
    if (!query) {
      searchRequestGeneration.current += 1
      setSearchResult(null)
      setSearchStatus('idle')
      return
    }

    const controller = new AbortController()
    const generation = searchRequestGeneration.current + 1
    searchRequestGeneration.current = generation
    setSearchResult(null)
    setSearchStatus('loading')
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        q: query,
        year: String(year),
        month: String(month + 1),
        branch: selectedBranch,
        course: selectedCourse,
      })
      fetch(`/api/admin/schedules/search?${params}`, { signal: controller.signal, cache: 'no-store' })
        .then(async (response) => {
          const payload = await response.json()
          if (!response.ok) throw new Error(payload.error || 'ค้นหาไม่สำเร็จ')
          return payload as ScheduleSearchResult
        })
        .then((payload) => {
          if (generation !== searchRequestGeneration.current) return
          setSearchResult(payload)
          setSearchStatus('ready')
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || generation !== searchRequestGeneration.current) return
          void error
          setSearchResult(null)
          setSearchStatus('error')
        })
    }, 300)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [search, selectedBranch, selectedCourse, year, month])

  const searchIsApplied = Boolean(search.trim() && searchStatus === 'ready' && searchResult)
  const matchingRoundKeys = useMemo(() => (
    searchIsApplied && searchResult ? new Set(searchResult.roundKeys) : null
  ), [searchIsApplied, searchResult])

  const filteredSummaryRounds = useMemo(() => summary.rounds.filter((round) => (
    (selectedBranch === 'all' || round.branch_id === selectedBranch)
    && (selectedCourse === 'all' || round.course_type === selectedCourse)
    && (!searchIsApplied || Boolean(matchingRoundKeys?.has(round.key)))
  )), [summary.rounds, selectedBranch, selectedCourse, searchIsApplied, matchingRoundKeys])

  const summaryRoundsByDate = useMemo(() => {
    const map: Record<string, typeof filteredSummaryRounds> = {}
    filteredSummaryRounds.forEach((round) => {
      if (!map[round.date]) map[round.date] = []
      map[round.date].push(round)
    })
    return map
  }, [filteredSummaryRounds])

  const roundsByDate = useMemo(() => {
    const map: Record<string, ScheduleRound[]> = {}

    ;(dayDetail?.rounds || []).filter((round) => (
      (selectedBranch === 'all' || round.branch_id === selectedBranch)
      && (selectedCourse === 'all' || round.course_type === selectedCourse)
      && (!searchIsApplied || Boolean(matchingRoundKeys?.has(round.key)))
    )).forEach((round) => {
      if (!map[round.date]) map[round.date] = []
      map[round.date].push(round)
    })

    Object.values(map).forEach((items) => {
      items.sort((a, b) => a.start_time.localeCompare(b.start_time) || a.branch_name.localeCompare(b.branch_name, 'th'))
    })

    return map
  }, [dayDetail, selectedBranch, selectedCourse, searchIsApplied, matchingRoundKeys])

  const roundSummaryByKey = useMemo(() => {
    const map = new Map<string, RoundLearnerBuckets>()

    ;(dayDetail?.rounds || []).forEach((round) => {
      map.set(round.key, getAdminScheduleRoundLearnerBuckets(round))
    })

    return map
  }, [dayDetail])

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: (number | null)[] = []

    for (let index = 0; index < firstDay.getDay(); index++) {
      days.push(null)
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(day)
    }

    return days
  }, [month, year])

  const selectedRounds = useMemo(() => (
    selectedDate ? roundsByDate[selectedDate] || [] : []
  ), [roundsByDate, selectedDate])
  const selectedRoundItems = useMemo(() => selectedRounds.map((round) => ({
    round,
    buckets: roundSummaryByKey.get(round.key) || getAdminScheduleRoundLearnerBuckets(round),
  })), [roundSummaryByKey, selectedRounds])
  const daySummaries = useMemo(() => Object.entries(summaryRoundsByDate)
    .map(([date, dayRounds]) => {
      const learnerCount = dayRounds.reduce((sum, round) => sum + round.learner_count, 0)
      const waitingCoachCount = dayRounds.reduce((sum, round) => sum + round.waiting_coach_count, 0)
      const walletedCount = dayRounds.reduce((sum, round) => sum + round.walleted_count, 0)

      return {
        date,
        learnerCount,
        waitingCoachCount,
        walletedCount,
        roundCount: dayRounds.length,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date)), [summaryRoundsByDate])
  const baseTotals = getAdminScheduleSummaryTotals(summary, selectedBranch, selectedCourse)
  const totalLearners = searchIsApplied ? (searchResult?.learnerCount || 0) : baseTotals.learnerCount
  const totalBranches = new Set(filteredSummaryRounds.map((round) => round.branch_id)).size
  const totalSlots = filteredSummaryRounds.length
  const filteredSessionCount = searchIsApplied
    ? (searchResult?.matchCount || 0)
    : baseTotals.sessionCount
  const unassignedSessions = filteredSummaryRounds.reduce((sum, round) => sum + round.waiting_coach_count, 0)
  const navigateToMonth = (targetYear: number, targetMonth: number) => {
    if (isPending || pendingNavigationRef.current) return
    pendingNavigationRef.current = true
    startTransition(() => {
      router.push(`/admin/schedules?year=${targetYear}&month=${targetMonth}`)
    })
  }

  const goToPreviousMonth = () => {
    if (month === 0) {
      navigateToMonth(year - 1, 12)
    } else {
      navigateToMonth(year, month)
    }
  }

  const goToNextMonth = () => {
    if (month === 11) {
      navigateToMonth(year + 1, 1)
    } else {
      navigateToMonth(year, month + 2)
    }
  }

  const goToToday = () => {
    navigateToMonth(now.getFullYear(), now.getMonth() + 1)
  }

  return (
    <div
      className="relative space-y-5"
      aria-busy={isPending || dayDetailStatus === 'loading' || searchStatus === 'loading'}
      data-testid="admin-schedules-root"
      data-summary-duration-ms={initialPerformance.durationMs}
      data-summary-external-calls={initialPerformance.externalCalls}
      data-summary-row-counts={JSON.stringify(initialPerformance.rows)}
      data-summary-call-counts={JSON.stringify(initialPerformance.calls)}
    >
      {isPending && (
        <div className="fixed inset-x-0 top-0 z-50 border-b border-blue-100 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3 text-sm font-medium text-[#153c85]">
            <CalendarDays className="h-4 w-4 animate-pulse text-[#2748bf]" />
            กำลังโหลดตารางเดือน...
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#2748bf]">
            <CalendarDays className="h-4 w-4" />
            Operation Calendar
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">ตารางเรียน</h1>
          <p className="mt-1 text-sm text-gray-500">
            ดูภาพรวมรอบเรียนรายเดือน เลือกวันเพื่อดูผู้เรียน สาขา คอร์ส และโค้ชที่รับผิดชอบ
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday} disabled={isPending}>
            วันนี้
          </Button>
          <Button data-testid="admin-schedule-previous-month" variant="outline" size="icon" className="h-9 w-9" onClick={goToPreviousMonth} disabled={isPending}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-36 text-center text-sm font-bold text-[#153c85] sm:w-48 sm:text-base">
            {MONTH_NAMES_TH[month]} {year + 543}
          </div>
          <Button data-testid="admin-schedule-next-month" variant="outline" size="icon" className="h-9 w-9" onClick={goToNextMonth} disabled={isPending}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">รอบเรียน</p>
              <p className="mt-1 text-xl font-bold text-[#2748bf] sm:text-2xl">{totalSlots}</p>
            </div>
            <Calendar className="h-5 w-5 text-[#2748bf]" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">รายการจอง</p>
              <p className="mt-1 text-xl font-bold text-emerald-600 sm:text-2xl">{filteredSessionCount}</p>
            </div>
            <Users className="h-5 w-5 text-emerald-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">ผู้เรียน</p>
              <p className="mt-1 text-xl font-bold text-orange-500 sm:text-2xl">{totalLearners}</p>
            </div>
            <User className="h-5 w-5 text-orange-500" />
          </CardContent>
        </Card>
        <Card className={unassignedSessions > 0 ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200'}>
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">รอจัดโค้ช</p>
              <p className="mt-1 text-xl font-bold text-amber-600 sm:text-2xl">{unassignedSessions}</p>
            </div>
            <UserCog className="h-5 w-5 text-amber-500" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200">
        <CardContent className="p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_220px_180px_auto] xl:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ค้นหาผู้เรียน ผู้ปกครอง โค้ช สาขา..."
                className="pl-10"
              />
              {searchStatus === 'loading' && <p className="mt-1 text-xs text-gray-400">กำลังค้นหาทั้งเดือน...</p>}
              {searchStatus === 'error' && <p className="mt-1 text-xs text-red-600">ค้นหาไม่สำเร็จ กรุณาลองใหม่</p>}
              {searchStatus === 'ready' && searchResult?.truncated && (
                <p className="mt-1 text-xs text-amber-600">แสดงผลลัพธ์ไม่เกิน {searchResult.limit} รอบแรก</p>
              )}
            </div>

            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
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

            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger>
                <SelectValue placeholder="ทุกคอร์ส" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกคอร์ส</SelectItem>
                <SelectItem value="kids_group">เด็กกลุ่ม</SelectItem>
                <SelectItem value="adult_group">ผู้ใหญ่กลุ่ม</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>

            <p className="text-sm text-gray-500 xl:text-right">
              {filteredSessionCount} รายการ • {totalBranches} สาขา
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 2xl:grid-cols-[minmax(560px,.95fr)_minmax(560px,1.05fr)]">
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="mb-3 grid grid-cols-7 text-center text-xs font-medium text-gray-500">
              {DAY_HEADERS.map((day, index) => (
                <div key={day} className={`py-1 ${index === 0 ? 'text-rose-500' : ''}`}>{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                if (day === null) return <div key={`empty-${index}`} className="min-h-14 sm:min-h-[5.25rem]" />

                const date = getDateString(year, month, day)
                const dayRounds = summaryRoundsByDate[date] || []
                const isToday = date === today
                const isSelected = selectedDate === date
                const daySessionCount = dayRounds.reduce((sum, round) => sum + round.session_count, 0)
                const dayMarkers = dayRounds.flatMap((round) => Array.from(
                  { length: Math.min(round.session_count, 10) },
                  (_, markerIndex) => ({ key: `${round.key}:${markerIndex}`, courseType: round.course_type }),
                )).slice(0, 10)

                return (
                  <button
                    key={date}
                    type="button"
                    data-testid={`admin-schedule-calendar-day-${date}`}
                    onClick={() => setSelectedDate(isSelected ? null : date)}
                    className={`min-h-14 rounded-md border p-1 text-left transition hover:border-[#2748bf]/50 hover:bg-blue-50/40 sm:min-h-[5.25rem] sm:p-2 ${
                      isSelected ? 'border-[#2748bf] bg-blue-50 ring-1 ring-[#2748bf]' : 'border-gray-100'
                    } ${isToday ? 'shadow-[inset_0_0_0_1px_#f57e3b]' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-xs font-semibold ${isToday ? 'text-[#f57e3b]' : index % 7 === 0 ? 'text-rose-500' : 'text-gray-700'}`}>
                        {day}
                      </span>
                      {daySessionCount > 0 && (
                        <span className="rounded bg-gray-100 px-1 text-[10px] text-gray-500">{daySessionCount}</span>
                      )}
                    </div>

                    {daySessionCount > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="flex flex-wrap gap-1">
                          {dayMarkers.map((marker) => {
                            const course = COURSE_CONFIG[marker.courseType] || { dot: 'bg-gray-400' }
                            return <span key={marker.key} className={`h-1.5 w-1.5 rounded-full ${course.dot}`} />
                          })}
                        </div>
                        <p className="text-[10px] text-gray-500">{dayRounds.length} รอบ</p>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="font-semibold text-[#153c85]">
                  {selectedDate ? formatDisplayDate(selectedDate) : `ภาพรวมเดือน${MONTH_NAMES_TH[month]}`}
                </p>
                <p className="text-xs text-gray-500">
                  {selectedDate ? `${selectedRoundItems.length} รอบเรียน` : `${totalSlots} รอบเรียน`}
                </p>
              </div>
              {selectedDate && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>
                  กลับภาพรวมเดือน
                </Button>
              )}
            </div>

            {!selectedDate ? (
              <div className="min-h-[28rem] p-4" data-testid="admin-schedule-month-summary">
                <div className="flex min-h-64 flex-col items-center justify-center rounded-md border border-dashed border-blue-100 bg-blue-50/30 px-4 py-8 text-center">
                  <CalendarDays className="mb-3 h-8 w-8 text-[#2748bf]" />
                  <p className="font-semibold text-[#153c85]">เลือกวันที่ในปฏิทินเพื่อดูรายละเอียดรอบเรียน</p>
                  <p className="mt-1 max-w-md text-sm text-gray-500">
                    หน้านี้แสดงสรุปรายเดือนแบบเบา ๆ ก่อน และจะแสดงกลุ่มโค้ช ผู้เรียน LV โปรแกรมสอน และสถานะรายคนเมื่อเลือกวันที่ต้องการ
                  </p>
                </div>

                {daySummaries.length > 0 && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {daySummaries.map((summary) => (
                      <button
                        key={summary.date}
                        type="button"
                        onClick={() => setSelectedDate(summary.date)}
                        className="rounded-md border border-gray-100 bg-white px-3 py-2 text-left transition hover:border-[#2748bf]/40 hover:bg-blue-50/40"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#153c85]">{formatShortDate(summary.date)}</p>
                          <Badge variant="outline" className="text-[10px]">{summary.roundCount} รอบ</Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                          <span>ผู้เรียน {summary.learnerCount} คน</span>
                          {summary.waitingCoachCount > 0 && <span className="text-red-600">รอจัดโค้ช {summary.waitingCoachCount} คน</span>}
                          {summary.walletedCount > 0 && <span className="text-violet-700">อยู่ในกระเป๋า {summary.walletedCount} คน</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : dayDetailStatus === 'loading' ? (
              <div className="flex min-h-[28rem] items-center justify-center text-sm text-[#2748bf]" data-testid="admin-schedule-day-loading">
                กำลังโหลดรายละเอียดของวันที่เลือก...
              </div>
            ) : dayDetailStatus === 'error' ? (
              <div className="flex min-h-[28rem] flex-col items-center justify-center gap-3 px-4 text-center text-sm text-red-600" data-testid="admin-schedule-day-error">
                <p>โหลดรายละเอียดตารางเรียนไม่สำเร็จ</p>
                <Button variant="outline" size="sm" onClick={() => {
                  const date = selectedDate
                  setSelectedDate(null)
                  window.setTimeout(() => setSelectedDate(date), 0)
                }}>
                  ลองใหม่
                </Button>
              </div>
            ) : selectedRoundItems.length === 0 ? (
              <div className="flex min-h-[28rem] items-center justify-center text-sm text-gray-400">
                ไม่พบตารางเรียนในเงื่อนไขที่เลือก
              </div>
            ) : (
              <div className="max-h-[44rem] overflow-y-auto p-3">
                <div className="space-y-3">
                  {selectedRoundItems.map(({ round, buckets }) => {
                    const course = COURSE_CONFIG[round.course_type] || { label: round.course_type, badge: 'bg-gray-100 text-gray-700' }
                    const roundTimePhase = getRoundTimePhase(round, now)
                    const roundStatus = getRoundStatusFromBuckets(buckets, roundTimePhase)
                    const {
                      assignedGroups,
                      unassignedGroups,
                      unassignedLearners,
                      walletedLearners,
                      coachedLearnerCount,
                      waitingCoachCount,
                    } = buckets
                    const groupCount = assignedGroups.length + unassignedGroups.length

                    return (
                      <div key={round.key} className="rounded-lg border bg-white p-4 transition-colors hover:bg-gray-50">
                        <div className="flex flex-col gap-3 border-b pb-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-[#153c85]">
                                {fmtTime(round.start_time)} - {fmtTime(round.end_time)}
                              </p>
                              <Badge className={`text-[10px] ${course.badge}`}>{course.label}</Badge>
                              <Badge className={`text-[10px] ${roundStatus.badge}`}>{roundStatus.label}</Badge>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                {formatShortDate(round.date)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {round.branch_name}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                ผู้เรียน {round.learner_count} คน
                              </span>
                              <span className="flex items-center gap-1">
                                <UserCog className="h-3 w-3" />
                                มีโค้ชแล้ว {coachedLearnerCount} คน
                              </span>
                              {waitingCoachCount > 0 && (
                                <span className="flex items-center gap-1 text-red-600">
                                  <UserCog className="h-3 w-3" />
                                  รอจัดโค้ช {waitingCoachCount} คน
                                </span>
                              )}
                              {walletedLearners.length > 0 && (
                                <span className="flex items-center gap-1 text-violet-700">
                                  <RotateCcw className="h-3 w-3" />
                                  อยู่ในกระเป๋า {walletedLearners.length} คน
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                {groupCount > 0
                                  ? `${groupCount} กลุ่มผู้เรียน`
                                  : walletedLearners.length > 0 && waitingCoachCount === 0
                                    ? 'ไม่ต้องจัดโค้ช'
                                    : 'ยังไม่มีกลุ่มโค้ช'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 space-y-3">
                          {assignedGroups.map((group) => {
                            const program = group.teaching_program
                            const programStatus = program ? PROGRAM_STATUS_CONFIG[program.status] : null
                            const actualLevelRangeLabel = formatActualGroupLevelRange(group.learners)
                            return (
                              <div key={group.id} className="rounded-md border border-emerald-100 bg-emerald-50/30 p-3">
                                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-semibold text-emerald-800">{stripDynamicMemberCount(group.name) || 'กลุ่มโค้ช'}</p>
                                      <Badge variant="outline" className="border-emerald-200 bg-white text-[10px] text-emerald-700">
                                        <UserCog className="mr-1 h-3 w-3" />
                                        โค้ช: {group.coach_name || 'ยังไม่ระบุโค้ช'}
                                      </Badge>
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                      <span>ผู้เรียนในกลุ่มนี้ {group.learners.length} คน</span>
                                      {actualLevelRangeLabel && (
                                        <Badge variant="outline" className="border-emerald-200 bg-white text-[10px] text-emerald-700">
                                          {actualLevelRangeLabel}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  <div className="min-w-0 rounded-md bg-white/80 px-3 py-2 text-xs ring-1 ring-emerald-100 lg:max-w-[18rem]">
                                    <div className="mb-1 flex items-center gap-2 text-gray-500">
                                      <BookOpenCheck className="h-3.5 w-3.5" />
                                      <span>โปรแกรมสอนรอบนี้</span>
                                      {programStatus && <Badge className={`text-[10px] ${programStatus.badge}`}>{programStatus.label}</Badge>}
                                    </div>
                                    {program ? (
                                      <p className="line-clamp-2 text-gray-700">โปรแกรมสอนรอบนี้: {getProgramPreview(program)}</p>
                                    ) : (
                                      <p className="text-gray-400">ยังไม่พบโปรแกรมสอนของรอบนี้</p>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-3 grid gap-2">
                                  {group.learners.map((learner) => {
                                    const learnerStatus = getDailyBoardLearnerStatus(learner, roundTimePhase)
                                    return (
                                      <div key={learner.id} className="rounded-md bg-white px-3 py-2">
                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-medium text-[#153c85]">{learner.learner_name}</p>
                                            <Badge variant="outline" className="text-[10px]">{formatLevel(learner)}</Badge>
                                            <Badge className={`text-[10px] ${learnerStatus.badge}`}>{learnerStatus.label}</Badge>
                                            {learner.is_makeup && (
                                              <Badge variant="outline" className="border-orange-200 text-[10px] text-orange-600">
                                                <RotateCcw className="mr-1 h-3 w-3" />
                                                ชดเชย
                                              </Badge>
                                            )}
                                            {learner.has_missing_child_link && (
                                              <Badge variant="outline" className="border-red-200 bg-red-50 text-[10px] text-red-700">
                                                <AlertTriangle className="mr-1 h-3 w-3" />
                                                ข้อมูลเด็กไม่ครบ
                                              </Badge>
                                            )}
                                          </div>
                                          {learner.parent_name && <p className="mt-0.5 text-xs text-gray-500">ผู้ปกครอง: {learner.parent_name}</p>}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}

                          {unassignedGroups.map((group) => {
                            const actualLevelRangeLabel = formatActualGroupLevelRange(group.learners)
                            return (
                              <div key={group.id} className="rounded-md border border-red-200 bg-red-50/50 p-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-semibold text-red-800">{stripDynamicMemberCount(group.name) || 'กลุ่มผู้เรียน'}</p>
                                    <Badge className="bg-red-100 text-[10px] text-red-700">
                                      <AlertTriangle className="mr-1 h-3 w-3" />
                                      ยังไม่ได้มอบหมายโค้ช
                                    </Badge>
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-red-700">
                                    <span>ผู้เรียนในกลุ่มนี้ {group.learners.length} คน</span>
                                    {actualLevelRangeLabel && (
                                      <Badge variant="outline" className="border-red-200 bg-white text-[10px] text-red-700">
                                        {actualLevelRangeLabel}
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-3 grid gap-2">
                                  {group.learners.map((learner) => {
                                    const learnerStatus = getDailyBoardLearnerStatus(learner, roundTimePhase)
                                    return (
                                      <div key={learner.id} className="rounded-md bg-white px-3 py-2">
                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-medium text-[#153c85]">{learner.learner_name}</p>
                                            <Badge variant="outline" className="text-[10px]">{formatLevel(learner)}</Badge>
                                            <Badge className={`text-[10px] ${learnerStatus.badge}`}>{learnerStatus.label}</Badge>
                                            {learner.is_makeup && (
                                              <Badge variant="outline" className="border-orange-200 text-[10px] text-orange-600">
                                                <RotateCcw className="mr-1 h-3 w-3" />
                                                ชดเชย
                                              </Badge>
                                            )}
                                            {learner.has_missing_child_link && (
                                              <Badge variant="outline" className="border-red-200 bg-red-50 text-[10px] text-red-700">
                                                <AlertTriangle className="mr-1 h-3 w-3" />
                                                ข้อมูลเด็กไม่ครบ
                                              </Badge>
                                            )}
                                          </div>
                                          {learner.parent_name && <p className="mt-0.5 text-xs text-gray-500">ผู้ปกครอง: {learner.parent_name}</p>}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}

                          {unassignedLearners.length > 0 && (
                            <div className="rounded-md border border-red-100 bg-red-50/40 p-3">
                              <div className="mb-2 flex items-center gap-2">
                                <UserCog className="h-4 w-4 text-red-600" />
                                <p className="font-semibold text-red-700">รอจัดโค้ช {unassignedLearners.length} คน</p>
                              </div>
                              <div className="grid gap-2">
                                {unassignedLearners.map((learner) => {
                                  const learnerStatus = getDailyBoardLearnerStatus(learner, roundTimePhase)
                                  return (
                                    <div key={learner.id} className="rounded-md bg-white px-3 py-2">
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="font-medium text-[#153c85]">{learner.learner_name}</p>
                                          <Badge variant="outline" className="text-[10px]">{formatLevel(learner)}</Badge>
                                          <Badge className={`text-[10px] ${learnerStatus.badge}`}>{learnerStatus.label}</Badge>
                                        </div>
                                        {learner.parent_name && <p className="mt-0.5 text-xs text-gray-500">ผู้ปกครอง: {learner.parent_name}</p>}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {walletedLearners.length > 0 && (
                            <div className="rounded-md border border-violet-100 bg-violet-50/50 p-3">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <RotateCcw className="h-4 w-4 text-violet-700" />
                                <p className="font-semibold text-violet-800">อยู่ในกระเป๋า {walletedLearners.length} คน</p>
                                <Badge className="bg-violet-100 text-[10px] text-violet-700">รอเลือกวันใหม่</Badge>
                              </div>
                              <p className="mb-2 text-xs text-violet-700">
                                รอบนี้ถูกเก็บเป็นสิทธิ์แล้ว รอผู้ปกครองเลือกวันเรียนใหม่
                              </p>
                              <div className="grid gap-2">
                                {walletedLearners.map((learner) => (
                                  <div key={learner.id} className="rounded-md bg-white px-3 py-2">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-medium text-[#153c85]">{learner.learner_name}</p>
                                        <Badge variant="outline" className="text-[10px]">{formatLevel(learner)}</Badge>
                                        <Badge className="bg-violet-100 text-[10px] text-violet-700">อยู่ในกระเป๋า</Badge>
                                      </div>
                                      {learner.parent_name && <p className="mt-0.5 text-xs text-gray-500">ผู้ปกครอง: {learner.parent_name}</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
