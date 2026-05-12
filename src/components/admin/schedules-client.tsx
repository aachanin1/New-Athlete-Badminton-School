'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  CalendarDays,
  Clock,
  RotateCcw,
  Search,
  User,
  UserCog,
  Users,
} from 'lucide-react'
import { fmtTime } from '@/lib/utils'

interface BranchOption {
  id: string
  name: string
  slug: string
}

interface ScheduleSession {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  is_makeup: boolean
  child_id: string | null
  branch_id: string
  branch_name: string
  learner_name: string
  parent_name: string | null
  course_type: string
  booking_status: string
  coach_names: string[]
}

interface SchedulesClientProps {
  sessions: ScheduleSession[]
  branches: BranchOption[]
}

const COURSE_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  kids_group: { label: 'เน€เธ”เนเธเธเธฅเธธเนเธก', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
  adult_group: { label: 'เธเธนเนเนเธซเธเนเธเธฅเธธเนเธก', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  private: { label: 'Private', dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700' },
}

const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending_payment: 'เธฃเธญเธเธณเธฃเธฐเน€เธเธดเธ',
  paid: 'เนเธเธเธชเธฅเธดเธเนเธฅเนเธง',
  verified: 'เธเธญเธเธชเธณเน€เธฃเนเธ',
  cancelled: 'เธขเธเน€เธฅเธดเธ',
}

const SESSION_STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  scheduled: { label: 'เธเธฑเธ”เธซเธกเธฒเธข', badge: 'bg-blue-100 text-blue-700' },
  completed: { label: 'เน€เธฃเธตเธขเธเนเธฅเนเธง', badge: 'bg-emerald-100 text-emerald-700' },
  absent: { label: 'เธเธฒเธ”เน€เธฃเธตเธขเธ', badge: 'bg-rose-100 text-rose-700' },
  cancelled: { label: 'เธขเธเน€เธฅเธดเธ', badge: 'bg-gray-100 text-gray-600' },
}

const MONTH_NAMES_TH = [
  'เธกเธเธฃเธฒเธเธก',
  'เธเธธเธกเธ เธฒเธเธฑเธเธเน',
  'เธกเธตเธเธฒเธเธก',
  'เน€เธกเธฉเธฒเธขเธ',
  'เธเธคเธฉเธ เธฒเธเธก',
  'เธกเธดเธ–เธธเธเธฒเธขเธ',
  'เธเธฃเธเธเธฒเธเธก',
  'เธชเธดเธเธซเธฒเธเธก',
  'เธเธฑเธเธขเธฒเธขเธ',
  'เธ•เธธเธฅเธฒเธเธก',
  'เธเธคเธจเธเธดเธเธฒเธขเธ',
  'เธเธฑเธเธงเธฒเธเธก',
]

const DAY_HEADERS = ['เธญเธฒ', 'เธ', 'เธญ', 'เธ', 'เธเธค', 'เธจ', 'เธช']
function getDateString(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatDisplayDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatShortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
}

export function SchedulesClient({ sessions, branches }: SchedulesClientProps) {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [selectedCourse, setSelectedCourse] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(today)

  const filteredMonthSessions = useMemo(() => {
    const q = search.trim().toLowerCase()

    return sessions.filter((session) => {
      const date = new Date(`${session.date}T00:00:00`)
      if (date.getMonth() !== month || date.getFullYear() !== year) return false
      if (selectedBranch !== 'all' && session.branch_id !== selectedBranch) return false
      if (selectedCourse !== 'all' && session.course_type !== selectedCourse) return false

      if (!q) return true

      return [
        session.learner_name,
        session.parent_name || '',
        session.branch_name,
        session.course_type,
        session.booking_status,
        ...session.coach_names,
      ].some((value) => value.toLowerCase().includes(q))
    })
  }, [sessions, month, year, selectedBranch, selectedCourse, search])

  const sessionsByDate = useMemo(() => {
    const map: Record<string, ScheduleSession[]> = {}

    filteredMonthSessions.forEach((session) => {
      if (!map[session.date]) map[session.date] = []
      map[session.date].push(session)
    })

    Object.values(map).forEach((items) => {
      items.sort((a, b) => a.start_time.localeCompare(b.start_time))
    })

    return map
  }, [filteredMonthSessions])

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

  const selectedSessions = selectedDate ? sessionsByDate[selectedDate] || [] : []
  const listSessions = selectedDate ? selectedSessions : filteredMonthSessions
  const totalLearners = new Set(filteredMonthSessions.map((session) => `${session.parent_name || ''}:${session.learner_name}`)).size
  const totalBranches = new Set(filteredMonthSessions.map((session) => session.branch_id)).size
  const totalSlots = new Set(filteredMonthSessions.map((session) => `${session.date}:${session.branch_id}:${session.start_time}:${session.end_time}:${session.course_type}`)).size
  const unassignedSessions = filteredMonthSessions.filter((session) => session.coach_names.length === 0).length
  const goToPreviousMonth = () => {
    if (month === 0) {
      setMonth(11)
      setYear(year - 1)
    } else {
      setMonth(month - 1)
    }
    setSelectedDate(null)
  }

  const goToNextMonth = () => {
    if (month === 11) {
      setMonth(0)
      setYear(year + 1)
    } else {
      setMonth(month + 1)
    }
    setSelectedDate(null)
  }

  const goToToday = () => {
    setMonth(now.getMonth())
    setYear(now.getFullYear())
    setSelectedDate(today)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#2748bf]">
            <CalendarDays className="h-4 w-4" />
            Operation Calendar
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">เธ•เธฒเธฃเธฒเธเน€เธฃเธตเธขเธ</h1>
          <p className="mt-1 text-sm text-gray-500">
            เธ”เธนเธ เธฒเธเธฃเธงเธกเธฃเธญเธเน€เธฃเธตเธขเธเธฃเธฒเธขเน€เธ”เธทเธญเธ เน€เธฅเธทเธญเธเธงเธฑเธเน€เธเธทเนเธญเธ”เธนเธเธนเนเน€เธฃเธตเธขเธ เธชเธฒเธเธฒ เธเธญเธฃเนเธช เนเธฅเธฐเนเธเนเธเธ—เธตเนเธฃเธฑเธเธเธดเธ”เธเธญเธ
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            เธงเธฑเธเธเธตเน
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToPreviousMonth}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-48 text-center text-base font-bold text-[#153c85]">
            {MONTH_NAMES_TH[month]} {year + 543}
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToNextMonth}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">เธฃเธญเธเน€เธฃเธตเธขเธ</p>
              <p className="mt-1 text-xl font-bold text-[#2748bf] sm:text-2xl">{totalSlots}</p>
            </div>
            <Calendar className="h-5 w-5 text-[#2748bf]" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">เธฃเธฒเธขเธเธฒเธฃเธเธญเธ</p>
              <p className="mt-1 text-xl font-bold text-emerald-600 sm:text-2xl">{filteredMonthSessions.length}</p>
            </div>
            <Users className="h-5 w-5 text-emerald-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">เธเธนเนเน€เธฃเธตเธขเธ</p>
              <p className="mt-1 text-xl font-bold text-orange-500 sm:text-2xl">{totalLearners}</p>
            </div>
            <User className="h-5 w-5 text-orange-500" />
          </CardContent>
        </Card>
        <Card className={unassignedSessions > 0 ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200'}>
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">เธขเธฑเธเนเธกเน assign เนเธเนเธ</p>
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
                placeholder="เธเนเธเธซเธฒเธเธนเนเน€เธฃเธตเธขเธ เธเธนเนเธเธเธเธฃเธญเธ เนเธเนเธ เธชเธฒเธเธฒ..."
                className="pl-10"
              />
            </div>

            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger>
                <SelectValue placeholder="เธ—เธธเธเธชเธฒเธเธฒ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">เธ—เธธเธเธชเธฒเธเธฒ</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger>
                <SelectValue placeholder="เธ—เธธเธเธเธญเธฃเนเธช" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">เธ—เธธเธเธเธญเธฃเนเธช</SelectItem>
                <SelectItem value="kids_group">เน€เธ”เนเธเธเธฅเธธเนเธก</SelectItem>
                <SelectItem value="adult_group">เธเธนเนเนเธซเธเนเธเธฅเธธเนเธก</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>

            <p className="text-sm text-gray-500 xl:text-right">
              {filteredMonthSessions.length} เธฃเธฒเธขเธเธฒเธฃ ยท {totalBranches} เธชเธฒเธเธฒ
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
                if (day === null) return <div key={`empty-${index}`} className="min-h-[5.25rem]" />

                const date = getDateString(year, month, day)
                const daySessions = sessionsByDate[date] || []
                const isToday = date === today
                const isSelected = selectedDate === date
                const daySlots = new Set(daySessions.map((session) => `${session.branch_id}:${session.start_time}:${session.end_time}:${session.course_type}`)).size

                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelectedDate(isSelected ? null : date)}
                    className={`min-h-[5.25rem] rounded-md border p-2 text-left transition hover:border-[#2748bf]/50 hover:bg-blue-50/40 ${
                      isSelected ? 'border-[#2748bf] bg-blue-50 ring-1 ring-[#2748bf]' : 'border-gray-100'
                    } ${isToday ? 'shadow-[inset_0_0_0_1px_#f57e3b]' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-xs font-semibold ${isToday ? 'text-[#f57e3b]' : index % 7 === 0 ? 'text-rose-500' : 'text-gray-700'}`}>
                        {day}
                      </span>
                      {daySessions.length > 0 && (
                        <span className="rounded bg-gray-100 px-1 text-[10px] text-gray-500">{daySessions.length}</span>
                      )}
                    </div>

                    {daySessions.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="flex flex-wrap gap-1">
                          {daySessions.slice(0, 10).map((session) => {
                            const course = COURSE_CONFIG[session.course_type] || { dot: 'bg-gray-400' }
                            return <span key={session.id} className={`h-1.5 w-1.5 rounded-full ${course.dot}`} />
                          })}
                        </div>
                        <p className="text-[10px] text-gray-500">{daySlots} เธฃเธญเธ</p>
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
                  {selectedDate ? formatDisplayDate(selectedDate) : `เธฃเธฒเธขเธเธฒเธฃเธ—เธฑเนเธเธซเธกเธ”เนเธ${MONTH_NAMES_TH[month]}`}
                </p>
                <p className="text-xs text-gray-500">{listSessions.length} เธฃเธฒเธขเธเธฒเธฃ</p>
              </div>
              {selectedDate && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>
                  เธ”เธนเธ—เธฑเนเธเน€เธ”เธทเธญเธ
                </Button>
              )}
            </div>

            {listSessions.length === 0 ? (
              <div className="flex min-h-[28rem] items-center justify-center text-sm text-gray-400">
                เนเธกเนเธเธเธ•เธฒเธฃเธฒเธเน€เธฃเธตเธขเธเนเธเน€เธเธทเนเธญเธเนเธเธ—เธตเนเน€เธฅเธทเธญเธ
              </div>
            ) : (
              <div className="max-h-[44rem] overflow-y-auto p-3">
                <div className="space-y-2">
                  {listSessions.map((session) => {
                    const course = COURSE_CONFIG[session.course_type] || { label: session.course_type, badge: 'bg-gray-100 text-gray-700' }
                    const status = SESSION_STATUS_CONFIG[session.status] || { label: session.status, badge: 'bg-gray-100 text-gray-600' }

                    return (
                      <div key={session.id} className="rounded-lg border bg-white p-3 transition-colors hover:bg-gray-50">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-[#153c85]">{session.learner_name}</p>
                              <Badge className={`text-[10px] ${course.badge}`}>{course.label}</Badge>
                              <Badge className={`text-[10px] ${status.badge}`}>{status.label}</Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {BOOKING_STATUS_LABELS[session.booking_status] || session.booking_status || '-'}
                              </Badge>
                              {session.is_makeup && (
                                <Badge variant="outline" className="border-orange-200 text-[10px] text-orange-600">
                                  <RotateCcw className="mr-1 h-3 w-3" />
                                  เธเธ”เน€เธเธข
                                </Badge>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                {formatShortDate(session.date)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {fmtTime(session.start_time)} - {fmtTime(session.end_time)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {session.branch_name}
                              </span>
                              {session.parent_name && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  เธเธนเนเธเธเธเธฃเธญเธ: {session.parent_name}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-500">
                            <UserCog className="h-3 w-3" />
                            {session.coach_names.length > 0 ? session.coach_names.join(', ') : 'เธขเธฑเธเนเธกเนเนเธ”เน assign เนเธเนเธ'}
                          </div>
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
