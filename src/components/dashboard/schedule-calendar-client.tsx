'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, CalendarDays, Clock, MapPin, RotateCcw } from 'lucide-react'
import { fmtTime } from '@/lib/utils'

interface SessionData {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  is_makeup: boolean
  child_id: string | null
  rescheduled_from_id: string | null
  rescheduled_from?: { date: string; start_time: string; end_time: string } | null
  children: { full_name: string; nickname: string | null } | null
  bookings: {
    course_types: { name: string } | null
  }
  branches: { name: string } | null
}

interface ChildData {
  id: string
  full_name: string
  nickname: string | null
}

interface ScheduleCalendarClientProps {
  sessions: SessionData[]
  children: ChildData[]
  userName: string
}

const MONTH_NAMES_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const DAY_HEADERS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-500',
  completed: 'bg-green-500',
  rescheduled: 'bg-yellow-500',
  absent: 'bg-red-500',
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'นัดหมาย',
  completed: 'เรียนแล้ว',
  rescheduled: 'เลื่อน',
  absent: 'ขาดเรียน',
}

// Generate distinct colors for children (badges + dots)
const CHILD_COLORS = [
  'bg-green-100 text-green-700 border-green-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-orange-100 text-orange-700 border-orange-200',
]

// Matching dot colors for calendar day markers
const CHILD_DOT_COLORS = [
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-orange-500',
]
const SELF_DOT_COLOR = 'bg-gray-500'

export function ScheduleCalendarClient({ sessions, children, userName }: ScheduleCalendarClientProps) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Build child color map (for badges) and dot color map (for calendar dots)
  const childColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    children.forEach((c, i) => { map[c.id] = CHILD_COLORS[i % CHILD_COLORS.length] })
    return map
  }, [children])

  const childDotColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    children.forEach((c, i) => { map[c.id] = CHILD_DOT_COLORS[i % CHILD_DOT_COLORS.length] })
    return map
  }, [children])

  // Group sessions by date
  const sessionsByDate = useMemo(() => {
    const map: Record<string, SessionData[]> = {}
    sessions.forEach((s) => {
      if (!map[s.date]) map[s.date] = []
      map[s.date].push(s)
    })
    return map
  }, [sessions])

  // Calendar days
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDow = firstDay.getDay()
    const totalDays = lastDay.getDate()
    const days: (number | null)[] = []
    for (let i = 0; i < startDow; i++) days.push(null)
    for (let d = 1; d <= totalDays; d++) days.push(d)
    return days
  }, [month, year])

  const getDateStr = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const getDateSessions = (day: number) => sessionsByDate[getDateStr(day)] || []

  const selectedSessions = selectedDate ? (sessionsByDate[selectedDate] || []) : []

  const getLearnerName = (session: SessionData) => {
    if (session.children) {
      return session.children.nickname || session.children.full_name
    }
    return userName
  }

  const totalThisMonth = useMemo(() => {
    return sessions.filter((s) => {
      const d = new Date(s.date)
      return d.getMonth() === month && d.getFullYear() === year
    }).length
  }, [sessions, month, year])

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            if (month === 0) { setMonth(11); setYear(year - 1) } else setMonth(month - 1)
            setSelectedDate(null)
          }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-bold text-[#153c85] w-48 text-center">{MONTH_NAMES_TH[month]} {year + 543}</span>
          <Button variant="outline" size="sm" onClick={() => {
            if (month === 11) { setMonth(0); setYear(year + 1) } else setMonth(month + 1)
            setSelectedDate(null)
          }}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <Badge variant="outline" className="text-sm">รวม {totalThisMonth} ครั้งเดือนนี้</Badge>
      </div>

      {/* Legend */}
      {children.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {children.map((c) => (
            <Badge key={c.id} className={childColorMap[c.id]} variant="outline">
              {c.nickname || c.full_name}
            </Badge>
          ))}
          <Badge className="bg-gray-100 text-gray-700 border-gray-200" variant="outline">{userName} (ตัวเอง)</Badge>
        </div>
      )}

      {/* Calendar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500 mb-2">
            {DAY_HEADERS.map((d, idx) => <div key={d} className={`py-1 ${idx === 0 ? 'text-red-500' : ''}`}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} />
              const dateStr = getDateStr(day)
              const daySessions = getDateSessions(day)
              const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear()
              const isSelected = selectedDate === dateStr
              const hasSessions = daySessions.length > 0

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`min-h-[3.5rem] rounded-lg text-sm transition-all p-1 flex flex-col items-center
                    ${isToday ? 'ring-2 ring-[#f57e3b]' : ''}
                    ${isSelected ? 'bg-[#2748bf]/10 ring-2 ring-[#2748bf]' : ''}
                    ${hasSessions ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'}
                  `}
                >
                  <span className={`text-xs font-medium ${isToday ? 'text-[#f57e3b]' : i % 7 === 0 ? 'text-red-500' : hasSessions ? 'text-[#153c85]' : 'text-gray-400'}`}>{day}</span>
                  {hasSessions && (
                    <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center">
                      {daySessions.map((s) => {
                        const childId = s.child_id
                        const dotColor = childId ? (childDotColorMap[childId] || SELF_DOT_COLOR) : SELF_DOT_COLOR
                        return (
                          <span key={s.id} className={`w-2 h-2 rounded-full ${dotColor}`} title={`${getLearnerName(s)} ${fmtTime(s.start_time)}`} />
                        )
                      })}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected date detail */}
      {selectedDate && selectedSessions.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="font-medium text-[#153c85]">
              <CalendarDays className="inline h-4 w-4 mr-1" />
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            {selectedSessions.map((s) => {
              const childId = s.child_id
              const colorClass = childId ? (childColorMap[childId] || '') : 'bg-gray-100 text-gray-700'
              return (
                <div key={s.id} className="space-y-1">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center">
                        <Clock className="h-4 w-4 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{fmtTime(s.start_time)} - {fmtTime(s.end_time)}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-gray-500">{s.branches?.name}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={colorClass} variant="outline">{getLearnerName(s)}</Badge>
                      <Badge className={`text-xs ${STATUS_COLORS[s.status] === 'bg-green-500' ? 'bg-green-100 text-green-700' : STATUS_COLORS[s.status] === 'bg-red-500' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        {STATUS_LABELS[s.status] || s.status}
                      </Badge>
                      {s.is_makeup && <Badge variant="outline" className="text-orange-600 border-orange-200 text-xs">ชดเชย</Badge>}
                    </div>
                  </div>
                  {s.rescheduled_from && (
                    <div className="flex items-center gap-1.5 px-3 text-xs text-orange-600">
                      <RotateCcw className="h-3 w-3" />
                      <span>ย้ายมาจากวันที่ {new Date(s.rescheduled_from.date + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} {fmtTime(s.rescheduled_from.start_time)}-{fmtTime(s.rescheduled_from.end_time)}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {totalThisMonth === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">ยังไม่มีตารางเรียนในเดือนนี้</p>
            <p className="text-sm mt-1">ตารางจะแสดงหลังจากจองคอร์สเรียน</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
