'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AlertCircle, Baby, Camera, CheckCircle2, Clock, Layers3, Loader2, Lock, MapPin, User, UserCheck, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { fmtTime } from '@/lib/utils'

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
  assignmentGroupName: string | null
  attendanceStatus: 'present' | 'absent' | 'late' | null
}

interface SlotGroup {
  key: string
  scheduleSlotId: string
  branchName: string
  startTime: string
  endTime: string
  courseType: string
  checkin: {
    id: string
    checkinTime: string
    photoUrl: string | null
  } | null
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

export function AttendanceClient({ slots }: AttendanceClientProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    slots.forEach((slot) => slot.students.forEach((student) => {
      if (student.attendanceStatus) map[`${student.bookingSessionId}-${student.studentId}`] = student.attendanceStatus
    }))
    return map
  })

  const markAttendance = async (student: StudentSession, status: 'present' | 'absent' | 'late') => {
    const key = `${student.bookingSessionId}-${student.studentId}`
    setLoadingId(key)
    setError(null)

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

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error || 'เช็คชื่อไม่สำเร็จ')
        return
      }

      setStatuses((prev) => ({ ...prev, [key]: status }))
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoadingId(null)
    }
  }

  const totalStudents = slots.reduce((sum, slot) => sum + slot.students.length, 0)
  const checkedCount = Object.keys(statuses).length

  return (
    <div className="space-y-5">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-[#2748bf]">
          <UserCheck className="h-4 w-4" />
          Attendance
        </p>
        <h1 className="text-2xl font-bold text-[#153c85]">เช็คชื่อนักเรียน</h1>
        <p className="mt-1 text-sm text-gray-500">
          วันนี้ {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {totalStudents > 0 && ` - เช็คแล้ว ${checkedCount}/${totalStudents} คน`}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {slots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <UserCheck className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ไม่มีนักเรียนที่ต้องเช็คชื่อวันนี้</p>
            <p className="mt-1 text-sm">รายการจะแสดงเฉพาะผู้เรียนในกลุ่มที่คุณรับผิดชอบ</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {slots.map((slot) => {
            const isLocked = !slot.checkin

            return (
              <Card key={slot.key} className={`shadow-sm ${isLocked ? 'border-orange-200 bg-orange-50/40' : ''}`}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isLocked ? 'bg-orange-100' : 'bg-[#2748bf]/10'}`}>
                        {isLocked ? <Lock className="h-5 w-5 text-orange-500" /> : <Clock className="h-5 w-5 text-[#2748bf]" />}
                      </div>
                      <div>
                        <p className="font-bold text-[#153c85]">{fmtTime(slot.startTime)} - {fmtTime(slot.endTime)}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{slot.branchName}</span>
                          <Badge className="bg-blue-100 text-[10px] text-blue-700">{slot.courseType || 'คอร์ส'}</Badge>
                          <span>{slot.students.length} คน</span>
                        </div>
                      </div>
                    </div>

                    {isLocked ? (
                      <Button asChild size="sm" className="bg-orange-500 hover:bg-orange-600">
                        <Link href="/coach/checkin">
                          <Camera className="mr-1.5 h-4 w-4" />
                          ไปเช็คอินก่อน
                        </Link>
                      </Button>
                    ) : (
                      <Badge className="w-fit bg-green-100 text-green-700">
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        เช็คอินแล้ว
                      </Badge>
                    )}
                  </div>

                  {isLocked && (
                    <div className="rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm text-orange-700">
                      ต้องเช็คอินรอบนี้ก่อนจึงจะเช็คชื่อนักเรียนได้ เพื่อให้ชั่วโมงสอนและหลักฐานของโค้ชครบถ้วน
                    </div>
                  )}

                  <div className="space-y-2 border-t pt-2">
                    {slot.students.map((student) => {
                      const key = `${student.bookingSessionId}-${student.studentId}`
                      const currentStatus = statuses[key] || null
                      const isLoading = loadingId === key

                      return (
                        <div key={key} className="flex flex-col gap-3 rounded-lg bg-white p-3 sm:flex-row sm:items-center sm:gap-2">
                          {student.isChild ? <Baby className="h-4 w-4 shrink-0 text-pink-500" /> : <User className="h-4 w-4 shrink-0 text-blue-500" />}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-medium">{student.studentName}</p>
                              {student.assignmentGroupName && (
                                <Badge variant="outline" className="bg-white text-[10px] text-gray-600">
                                  <Layers3 className="mr-1 h-3 w-3" />
                                  {student.assignmentGroupName}
                                </Badge>
                              )}
                            </div>
                            {student.parentName && <p className="truncate text-[11px] text-gray-400">ผู้ปกครอง: {student.parentName}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {isLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                            ) : (
                              (['present', 'late', 'absent'] as const).map((status) => {
                                const config = STATUS_CONFIG[status]
                                const isActive = currentStatus === status

                                return (
                                  <Button
                                    key={status}
                                    size="sm"
                                    disabled={isLocked}
                                    className={`h-7 px-2 text-[11px] ${isActive ? `${config.color} text-white` : 'bg-gray-200 text-gray-500 hover:bg-gray-300'} disabled:cursor-not-allowed disabled:opacity-50`}
                                    onClick={() => markAttendance(student, status)}
                                  >
                                    {config.label}
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
            )
          })}
        </div>
      )}
    </div>
  )
}
