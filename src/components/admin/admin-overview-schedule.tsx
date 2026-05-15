'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, ArrowRight, Building2, CalendarDays, Clock, Search, User, UserCog, Users } from 'lucide-react'
import { fmtTime } from '@/lib/utils'

interface BranchOption {
  id: string
  name: string
}

interface OverviewSession {
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
  parent_name: string
  course_type: string
  booking_status: string
  coach_names: string[]
}

interface AdminOverviewScheduleProps {
  sessions: OverviewSession[]
  branches: BranchOption[]
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

const COURSE_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  kids_group: { label: 'เด็กกลุ่ม', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
  adult_group: { label: 'ผู้ใหญ่กลุ่ม', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  private: { label: 'Private', dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700' },
}

const SESSION_STATUS: Record<string, { label: string; badge: string }> = {
  scheduled: { label: 'รอเรียน', badge: 'bg-blue-100 text-blue-700' },
  completed: { label: 'เรียนแล้ว', badge: 'bg-green-100 text-green-700' },
  absent: { label: 'ขาดเรียน', badge: 'bg-red-100 text-red-700' },
  cancelled: { label: 'ยกเลิก', badge: 'bg-gray-100 text-gray-600' },
}

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

export function AdminOverviewSchedule({ sessions, branches }: AdminOverviewScheduleProps) {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [selectedDate, setSelectedDate] = useState<string | null>(today)
  const [selectedBranch, setSelectedBranch] = useState('all')
  const [selectedCourse, setSelectedCourse] = useState('all')
  const [search, setSearch] = useState('')

  const filteredMonthSessions = useMemo(() => {
    return sessions.filter((session) => {
      const sessionDate = new Date(`${session.date}T00:00:00`)
      if (sessionDate.getMonth() !== month || sessionDate.getFullYear() !== year) return false
      if (selectedBranch !== 'all' && session.branch_id !== selectedBranch) return false
      if (selectedCourse !== 'all' && session.course_type !== selectedCourse) return false

      if (search.trim()) {
        const q = search.trim().toLowerCase()
        return session.learner_name.toLowerCase().includes(q)
          || session.parent_name.toLowerCase().includes(q)
          || session.branch_name.toLowerCase().includes(q)
          || session.coach_names.some((coachName) => coachName.toLowerCase().includes(q))
      }

      return true
    })
  }, [sessions, month, year, selectedBranch, selectedCourse, search])

  const sessionsByDate = useMemo(() => {
    const map: Record<string, OverviewSession[]> = {}
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
  const monthLearners = new Set(filteredMonthSessions.map((session) => `${session.parent_name}:${session.learner_name}`)).size
  const monthSlots = new Set(filteredMonthSessions.map((session) => `${session.date}:${session.branch_id}:${session.start_time}:${session.end_time}:${session.course_type}`)).size

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
    <Card>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle className="text-[#153c85]">ภาพรวมตารางเรียน</CardTitle>
            <p className="mt-1 text-sm text-gray-500">เลือกดูตามเดือน วัน สาขา คอร์ส ผู้เรียน หรือโค้ช</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-md border bg-gray-50 px-3 py-2">
              <p className="text-lg font-bold text-[#2748bf]">{monthSlots}</p>
              <p className="text-gray-500">รอบ</p>
            </div>
            <div className="rounded-md border bg-gray-50 px-3 py-2">
              <p className="text-lg font-bold text-emerald-600">{monthLearners}</p>
              <p className="text-gray-500">ผู้เรียน</p>
            </div>
            <div className="rounded-md border bg-gray-50 px-3 py-2">
              <p className="text-lg font-bold text-orange-500">{filteredMonthSessions.length}</p>
              <p className="text-gray-500">รายการ</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPreviousMonth}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="w-36 text-center text-sm font-bold text-[#153c85] sm:w-48 sm:text-base">
              {MONTH_NAMES_TH[month]} {year + 543}
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextMonth}>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={goToToday}>
              วันนี้
            </Button>
          </div>

          <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_180px_160px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ค้นหาผู้เรียน ผู้ปกครอง โค้ช"
                className="h-9 pl-10"
              />
            </div>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="h-9">
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
              <SelectTrigger className="h-9">
                <SelectValue placeholder="ทุกคอร์ส" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกคอร์ส</SelectItem>
                <SelectItem value="kids_group">เด็กกลุ่ม</SelectItem>
                <SelectItem value="adult_group">ผู้ใหญ่กลุ่ม</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4 2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-lg border p-3">
          <div className="mb-2 grid grid-cols-7 text-center text-xs font-medium text-gray-500">
            {DAY_HEADERS.map((day, index) => (
              <div key={day} className={`py-1 ${index === 0 ? 'text-red-500' : ''}`}>{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              if (day === null) return <div key={`empty-${index}`} className="min-h-14 sm:min-h-[4.5rem]" />

              const date = getDateString(year, month, day)
              const daySessions = sessionsByDate[date] || []
              const isToday = date === today
              const isSelected = selectedDate === date
              const daySlots = new Set(daySessions.map((session) => `${session.branch_id}:${session.start_time}:${session.end_time}:${session.course_type}`)).size

              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(isSelected ? null : date)}
                  className={`min-h-14 rounded-md border p-1 text-left transition hover:border-[#2748bf]/50 hover:bg-blue-50/40 sm:min-h-[4.5rem] ${isSelected ? 'border-[#2748bf] bg-blue-50 ring-1 ring-[#2748bf]' : 'border-gray-100'} ${isToday ? 'shadow-[inset_0_0_0_1px_#f57e3b]' : ''}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-xs font-semibold ${isToday ? 'text-[#f57e3b]' : 'text-gray-700'}`}>{day}</span>
                    {daySessions.length > 0 && <span className="rounded bg-gray-100 px-1 text-[10px] text-gray-500">{daySessions.length}</span>}
                  </div>
                  {daySessions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex flex-wrap gap-0.5">
                        {daySessions.slice(0, 8).map((session) => {
                          const course = COURSE_CONFIG[session.course_type] || COURSE_CONFIG.kids_group
                          return <span key={session.id} className={`h-1.5 w-1.5 rounded-full ${course.dot}`} />
                        })}
                      </div>
                      <p className="text-[10px] text-gray-500">{daySlots} รอบ</p>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="min-h-[28rem] rounded-lg border">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="font-semibold text-[#153c85]">
                {selectedDate ? formatDisplayDate(selectedDate) : `รายการทั้งหมดใน${MONTH_NAMES_TH[month]}`}
              </p>
              <p className="text-xs text-gray-500">{listSessions.length} รายการ</p>
            </div>
            {selectedDate && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>
                ดูทั้งเดือน
              </Button>
            )}
          </div>

          {listSessions.length === 0 ? (
            <div className="flex min-h-[22rem] items-center justify-center text-sm text-gray-400">
              ไม่มีตารางเรียนในช่วงที่เลือก
            </div>
          ) : (
            <div className="max-h-[38rem] overflow-y-auto p-3">
              <div className="space-y-2">
                {listSessions.map((session) => {
                  const course = COURSE_CONFIG[session.course_type] || { label: session.course_type, dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-700' }
                  const status = SESSION_STATUS[session.status] || { label: session.status, badge: 'bg-gray-100 text-gray-600' }

                  return (
                    <div key={session.id} className="rounded-lg border bg-white p-3">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-[#153c85]">{session.learner_name}</p>
                            <Badge className={`text-[10px] ${course.badge}`}>{course.label}</Badge>
                            <Badge className={`text-[10px] ${status.badge}`}>{status.label}</Badge>
                            {session.is_makeup && <Badge variant="outline" className="text-[10px] text-orange-600">ชดเชย</Badge>}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {new Date(`${session.date}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
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
                                ผู้ปกครอง: {session.parent_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-500">
                          {session.coach_names.length > 0 ? <UserCog className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                          {session.coach_names.length > 0 ? session.coach_names.join(', ') : 'ยังไม่ได้ assign โค้ช'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
