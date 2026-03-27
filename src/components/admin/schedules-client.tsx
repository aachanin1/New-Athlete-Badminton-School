'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, ArrowRight, Calendar, CalendarDays, Clock, Users, User, Building2, Search, UserCog } from 'lucide-react'
import { fmtTime } from '@/lib/utils'

interface BranchOption {
  id: string
  name: string
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

const COURSE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  kids_group: { label: 'เด็กกลุ่ม', color: 'bg-blue-100 text-blue-700' },
  adult_group: { label: 'ผู้ใหญ่กลุ่ม', color: 'bg-green-100 text-green-700' },
  private: { label: 'Private', color: 'bg-orange-100 text-orange-700' },
}

const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending_payment: 'รอชำระเงิน',
  paid: 'ชำระแล้ว',
  verified: 'ยืนยันแล้ว',
}

const SESSION_STATUS_LABELS: Record<string, string> = {
  scheduled: 'นัดหมาย',
  completed: 'เรียนแล้ว',
  absent: 'ขาดเรียน',
}

const MONTH_NAMES_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const DAY_HEADERS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

export function SchedulesClient({ sessions, branches }: SchedulesClientProps) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const monthSessions = useMemo(() => {
    return sessions.filter((session) => {
      const d = new Date(session.date + 'T00:00:00')
      return d.getMonth() === month && d.getFullYear() === year
    })
  }, [sessions, month, year])

  const filteredSessions = useMemo(() => {
    return monthSessions.filter((session) => {
      if (selectedBranch !== 'all' && session.branch_id !== selectedBranch) return false
      if (!search) return true
      const q = search.toLowerCase()
      return session.learner_name.toLowerCase().includes(q)
        || (session.parent_name || '').toLowerCase().includes(q)
        || session.branch_name.toLowerCase().includes(q)
        || session.course_type.toLowerCase().includes(q)
        || session.coach_names.some((name) => name.toLowerCase().includes(q))
    })
  }, [monthSessions, selectedBranch, search])

  const sessionsByDate = useMemo(() => {
    const map: Record<string, ScheduleSession[]> = {}
    filteredSessions.forEach((session) => {
      if (!map[session.date]) map[session.date] = []
      map[session.date].push(session)
    })
    return map
  }, [filteredSessions])

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
  const totalBranches = new Set(filteredSessions.map((session) => session.branch_id)).size
  const totalLearners = new Set(filteredSessions.map((session) => `${session.parent_name || ''}::${session.learner_name}`)).size

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">ตารางเรียน</h1>
        <p className="text-gray-500 text-sm mt-1">ดูตารางเรียนที่มีการจองจริง แยกตามวัน ผู้เรียน สาขา และโค้ช</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-[#2748bf]">{filteredSessions.length}</p><p className="text-xs text-gray-500">รายการในเดือนนี้</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{totalLearners}</p><p className="text-xs text-gray-500">ผู้เรียน</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{totalBranches}</p><p className="text-xs text-gray-500">สาขาที่มีตาราง</p>
        </CardContent></Card>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            if (month === 0) { setMonth(11); setYear(year - 1) } else setMonth(month - 1)
            setSelectedDate(null)
          }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="w-48 text-center text-lg font-bold text-[#153c85]">{MONTH_NAMES_TH[month]} {year + 543}</span>
          <Button variant="outline" size="sm" onClick={() => {
            if (month === 11) { setMonth(0); setYear(year + 1) } else setMonth(month + 1)
            setSelectedDate(null)
          }}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาผู้เรียน, ผู้ปกครอง, โค้ช..." className="pl-10" />
          </div>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="เลือกสาขา" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสาขา</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500 mb-2">
            {DAY_HEADERS.map((day, idx) => <div key={day} className={`py-1 ${idx === 0 ? 'text-red-500' : ''}`}>{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} />
              const dateStr = getDateStr(day)
              const daySessions = sessionsByDate[dateStr] || []
              const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear()
              const isSelected = selectedDate === dateStr
              const hasSessions = daySessions.length > 0

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`min-h-[4rem] rounded-lg p-1 text-sm transition-all ${isToday ? 'ring-2 ring-[#f57e3b]' : ''} ${isSelected ? 'bg-[#2748bf]/10 ring-2 ring-[#2748bf]' : ''} ${hasSessions ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'}`}
                >
                  <div className={`text-xs font-medium ${isToday ? 'text-[#f57e3b]' : i % 7 === 0 ? 'text-red-500' : hasSessions ? 'text-[#153c85]' : 'text-gray-400'}`}>{day}</div>
                  {hasSessions && (
                    <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                      {daySessions.slice(0, 6).map((session) => (
                        <span key={session.id} className={`h-2 w-2 rounded-full ${session.is_makeup ? 'bg-orange-500' : session.child_id ? 'bg-emerald-500' : 'bg-blue-500'}`} title={session.learner_name} />
                      ))}
                      {daySessions.length > 6 && <span className="text-[10px] text-gray-400">+{daySessions.length - 6}</span>}
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
            <p className="font-medium text-[#153c85]">
              <CalendarDays className="mr-1 inline h-4 w-4" />
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            {selectedSessions.map((session) => {
              const course = COURSE_TYPE_LABELS[session.course_type] || { label: session.course_type, color: 'bg-gray-100 text-gray-700' }
              return (
                <div key={session.id} className="rounded-lg border bg-gray-50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[#153c85]">{session.learner_name}</p>
                        <Badge className={`${course.color} text-[10px]`}>{course.label}</Badge>
                        <Badge variant="outline" className="text-[10px]">{BOOKING_STATUS_LABELS[session.booking_status] || session.booking_status}</Badge>
                        <Badge className={`text-[10px] ${session.status === 'completed' ? 'bg-green-100 text-green-700' : session.status === 'absent' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{SESSION_STATUS_LABELS[session.status] || session.status}</Badge>
                        {session.is_makeup && <Badge variant="outline" className="border-orange-200 text-[10px] text-orange-600">ชดเชย</Badge>}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtTime(session.start_time)} - {fmtTime(session.end_time)}</span>
                        <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{session.branch_name}</span>
                        {session.parent_name && <span className="flex items-center gap-1"><User className="h-3 w-3" />ผู้ปกครอง: {session.parent_name}</span>}
                        <span className="flex items-center gap-1"><UserCog className="h-3 w-3" />{session.coach_names.length > 0 ? session.coach_names.join(', ') : 'ยังไม่ได้ assign โค้ช'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {!selectedDate && filteredSessions.length > 0 && (
        <div className="space-y-2">
          {filteredSessions.slice(0, 20).map((session) => {
            const course = COURSE_TYPE_LABELS[session.course_type] || { label: session.course_type, color: 'bg-gray-100 text-gray-700' }
            return (
              <Card key={session.id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[#153c85]">{session.learner_name}</p>
                      <Badge className={`${course.color} text-[10px]`}>{course.label}</Badge>
                      <Badge variant="outline" className="text-[10px]">{session.branch_name}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span>{new Date(session.date + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                      <span>{fmtTime(session.start_time)} - {fmtTime(session.end_time)}</span>
                      {session.parent_name && <span>ผู้ปกครอง: {session.parent_name}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge className={`text-[10px] ${session.status === 'completed' ? 'bg-green-100 text-green-700' : session.status === 'absent' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{SESSION_STATUS_LABELS[session.status] || session.status}</Badge>
                    <Badge variant="outline" className="text-[10px]">{session.coach_names.length > 0 ? session.coach_names.join(', ') : 'ยังไม่ได้ assign โค้ช'}</Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {filteredSessions.length === 0 && (
        <Card><CardContent className="py-12 text-center text-gray-400">
          <Calendar className="mx-auto mb-3 h-12 w-12 opacity-40" />
          <p className="font-medium">ไม่พบตารางเรียนในเงื่อนไขที่เลือก</p>
        </CardContent></Card>
      )}
    </div>
  )
}
