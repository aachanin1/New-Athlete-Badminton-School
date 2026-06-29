'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, Clock, MapPin } from 'lucide-react'
import { formatThaiCompactDateWithWeekday, formatThaiDateWithWeekday } from '@/lib/date-format'
import { fmtTime } from '@/lib/utils'
import { SELF_LEARNER_COLOR, buildLearnerColorMap, getLearnerColor } from './learner-colors'

interface SessionData {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  child_id: string | null
  children: { full_name: string; nickname: string | null } | null
  branches: { name: string } | null
}

interface ChildData {
  id: string
  full_name: string
  nickname: string | null
}

interface DashboardCalendarProps {
  sessions: SessionData[]
  learnerChildren: ChildData[]
  userName: string
}

const DAY_HEADERS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const MONTH_NAMES_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

export function DashboardCalendar({ sessions, learnerChildren, userName }: DashboardCalendarProps) {
  const now = new Date()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const childColorMap = useMemo(() => buildLearnerColorMap(learnerChildren), [learnerChildren])

  const sessionsByDate = useMemo(() => {
    const map: Record<string, SessionData[]> = {}
    sessions.forEach((s) => {
      if (!map[s.date]) map[s.date] = []
      map[s.date].push(s)
    })
    return map
  }, [sessions])

  // Build calendar for current month
  const month = now.getMonth()
  const year = now.getFullYear()
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

  const selectedSessions = selectedDate ? (sessionsByDate[selectedDate] || []) : []

  const getLearnerName = (session: SessionData) => {
    if (session.children) return session.children.nickname || session.children.full_name
    return userName
  }

  const getColor = (session: SessionData) => getLearnerColor(session.child_id, childColorMap)

  return (
    <div className="space-y-4">
      {/* Legend */}
      {learnerChildren.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {learnerChildren.map((c) => {
            const color = childColorMap[c.id]
            return (
              <Badge key={c.id} className={color?.badge} variant="outline">
                <span className={`w-2 h-2 rounded-full ${color?.dot} mr-1.5`} />
                {c.nickname || c.full_name}
              </Badge>
            )
          })}
          <Badge className={SELF_LEARNER_COLOR.badge} variant="outline">
            <span className={`w-2 h-2 rounded-full ${SELF_LEARNER_COLOR.dot} mr-1.5`} />
            {userName} (ตัวเอง)
          </Badge>
        </div>
      )}

      {/* Mini calendar */}
      <div className="border rounded-lg p-3">
        <p className="text-sm font-bold text-[#153c85] text-center mb-2">
          {MONTH_NAMES_TH[month]} {year + 543}
        </p>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500 mb-1">
          {DAY_HEADERS.map((d, idx) => <div key={d} className={`py-0.5 ${idx === 0 ? 'text-red-500' : ''}`}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, i) => {
            if (day === null) return <div key={`e-${i}`} />
            const dateStr = getDateStr(day)
            const daySessions = sessionsByDate[dateStr] || []
            const isToday = day === now.getDate()
            const isSelected = selectedDate === dateStr
            const hasSessions = daySessions.length > 0

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`min-h-[3rem] rounded-lg text-sm transition-all p-1 flex flex-col items-center
                  ${isToday ? 'ring-2 ring-[#f57e3b]' : ''}
                  ${isSelected ? 'bg-[#2748bf]/10 ring-2 ring-[#2748bf]' : ''}
                  ${hasSessions && !isSelected ? 'cursor-pointer hover:bg-gray-50' : !hasSessions ? 'cursor-default' : 'cursor-pointer'}
                `}
              >
                <span className={`text-xs font-medium ${isToday ? 'text-[#f57e3b] font-bold' : i % 7 === 0 ? 'text-red-500' : hasSessions ? 'text-[#153c85]' : 'text-gray-400'}`}>{day}</span>
                {hasSessions && (
                  <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center">
                    {daySessions.map((s) => (
                      <span key={s.id} className={`w-2 h-2 rounded-full ${getColor(s).dot}`} title={getLearnerName(s)} />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected date detail */}
      {selectedDate && selectedSessions.length > 0 && (
        <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
          <p className="font-medium text-[#153c85] text-sm">
            <CalendarDays className="inline h-4 w-4 mr-1" />
            {formatThaiDateWithWeekday(selectedDate)}
          </p>
          {selectedSessions.map((s) => {
            const color = getColor(s)
            return (
              <div key={s.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <Clock className="h-4 w-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{fmtTime(s.start_time)} - {fmtTime(s.end_time)}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <MapPin className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-500">{s.branches?.name || '-'}</span>
                    </div>
                  </div>
                </div>
                <Badge className={color.badge} variant="outline">{getLearnerName(s)}</Badge>
              </div>
            )
          })}
        </div>
      )}

      {/* Next sessions list (non-calendar view for quick glance) */}
      {!selectedDate && sessions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">รายการเรียนที่กำลังจะถึง</p>
          {sessions.slice(0, 5).map((s) => {
            const color = getColor(s)
            return (
              <div key={s.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#2748bf]/10 rounded-lg flex flex-col items-center justify-center">
                    <span className="text-[9px] text-[#2748bf] font-medium">{formatThaiCompactDateWithWeekday(s.date).split(' ')[0]}</span>
                    <span className="text-sm font-bold text-[#2748bf] leading-none">{Number(s.date.slice(8, 10))}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <Clock className="h-3 w-3 text-gray-400" />
                      {fmtTime(s.start_time)} - {fmtTime(s.end_time)}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                      <MapPin className="h-3 w-3" />
                      {s.branches?.name || '-'}
                    </div>
                  </div>
                </div>
                <Badge className={color.badge} variant="outline">{getLearnerName(s)}</Badge>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
