'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  UserCheck, Clock, MapPin, Baby, User, CheckCircle2, XCircle, AlertCircle, Loader2,
} from 'lucide-react'

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
  attendanceStatus: 'present' | 'absent' | 'late' | null
}

interface SlotGroup {
  key: string
  branchName: string
  startTime: string
  endTime: string
  courseType: string
  students: StudentSession[]
}

interface AttendanceClientProps {
  slots: SlotGroup[]
}

const STATUS_CONFIG = {
  present: { label: 'มา', color: 'bg-green-500 hover:bg-green-600', icon: CheckCircle2 },
  late: { label: 'สาย', color: 'bg-yellow-500 hover:bg-yellow-600', icon: AlertCircle },
  absent: { label: 'ขาด', color: 'bg-red-500 hover:bg-red-600', icon: XCircle },
}

const COURSE_LABELS: Record<string, string> = { kids_group: 'เด็กกลุ่ม', adult_group: 'ผู้ใหญ่กลุ่ม', private: 'Private' }

export function AttendanceClient({ slots }: AttendanceClientProps) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {}
    slots.forEach((slot) => slot.students.forEach((s) => {
      if (s.attendanceStatus) m[s.bookingSessionId + '-' + s.studentId] = s.attendanceStatus
    }))
    return m
  })

  const markAttendance = async (student: StudentSession, status: 'present' | 'absent' | 'late') => {
    const key = student.bookingSessionId + '-' + student.studentId
    setLoadingId(key)
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
      if (res.ok) {
        setStatuses((prev) => ({ ...prev, [key]: status }))
      }
    } catch { /* ignore */ }
    setLoadingId(null)
  }

  const fmtTime = (t: string) => t?.slice(0, 5) || ''

  const totalStudents = slots.reduce((s, slot) => s + slot.students.length, 0)
  const checkedCount = Object.keys(statuses).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">เช็คชื่อนักเรียน</h1>
        <p className="text-gray-500 text-sm mt-1">
          วันนี้ {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {totalStudents > 0 && ` • เช็คแล้ว ${checkedCount}/${totalStudents} คน`}
        </p>
      </div>

      {slots.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">
          <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">ไม่มีนักเรียนที่ต้องเช็คชื่อวันนี้</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {slots.map((slot) => (
            <Card key={slot.key}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#2748bf]/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-[#2748bf]" />
                  </div>
                  <div>
                    <p className="font-bold text-[#153c85]">{fmtTime(slot.startTime)} - {fmtTime(slot.endTime)}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{slot.branchName}</span>
                      <Badge className="text-[10px] bg-blue-100 text-blue-700">{COURSE_LABELS[slot.courseType] || slot.courseType}</Badge>
                      <span>{slot.students.length} คน</span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-2 space-y-2">
                  {slot.students.map((student) => {
                    const key = student.bookingSessionId + '-' + student.studentId
                    const currentStatus = statuses[key] || null
                    const isLoading = loadingId === key
                    return (
                      <div key={key} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                        {student.isChild ? <Baby className="h-4 w-4 text-pink-500 shrink-0" /> : <User className="h-4 w-4 text-blue-500 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{student.studentName}</p>
                          {student.parentName && <p className="text-[11px] text-gray-400 truncate">ผู้ปกครอง: {student.parentName}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                          ) : (
                            (['present', 'late', 'absent'] as const).map((status) => {
                              const cfg = STATUS_CONFIG[status]
                              const isActive = currentStatus === status
                              return (
                                <Button key={status} size="sm"
                                  className={`h-7 px-2 text-[11px] ${isActive ? cfg.color + ' text-white' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}
                                  onClick={() => markAttendance(student, status)}>
                                  {cfg.label}
                                </Button>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
