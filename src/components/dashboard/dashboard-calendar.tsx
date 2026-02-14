'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, Clock, MapPin } from 'lucide-react'
import { fmtTime } from '@/lib/utils'

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
  children: ChildData[]
  userName: string
}

const DAY_HEADERS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const MONTH_NAMES_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

const CHILD_COLORS = [
  { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  { badge: 'bg-purple-100 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  { badge: 'bg-pink-100 text-pink-700 border-pink-200', dot: 'bg-pink-500' },
  { badge: 'bg-teal-100 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
  { badge: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
]
const SELF_COLOR = { badge: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' }

export function DashboardCalendar({ sessions, children, userName }: DashboardCalendarProps) {
  const now = new Date()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const childColorMap = useMemo(() => {
    const map: Record<string, typeof CHILD_COLORS[0]> = {}
    children.forEach((c, i) => { map[c.id] = CHILD_COLORS[i % CHILD_COLORS.length] })
    return map
  }, [children])

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

  const getColor = (session: SessionData) => {
    if (session.child_id && childColorMap[session.child_id]) return childColorMap[session.child_id]
    return SELF_COLOR
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      {children.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {children.map((c) => {
            const color = childColorMap[c.id]
            return (
              <Badge key={c.id} className={color?.badge} variant="outline">
                <span className={`w-2 h-2 rounded-full ${color?.dot} mr-1.5`} />
                {c.nickname || c.full_name}
              </Badge>
            )
          })}
          <Badge className={SELF_COLOR.badge} variant="outline">
            <span className={`w-2 h-2 rounded-full ${SELF_COLOR.dot} mr-1.5`} />
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
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
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
            const d = new Date(s.date + 'T00:00:00')
            return (
              <div key={s.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#2748bf]/10 rounded-lg flex flex-col items-center justify-center">
                    <span className="text-[9px] text-[#2748bf] font-medium">{d.toLocaleDateString('th-TH', { weekday: 'short' })}</span>
                    <span className="text-sm font-bold text-[#2748bf] leading-none">{d.getDate()}</span>
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
