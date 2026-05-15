import { Baby, CalendarCheck, Camera, CheckCircle2, Clock, Layers3, MapPin, User, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getCoachAssignedTeachingDay } from '@/lib/coach-assigned-schedule'
import { createClient } from '@/lib/supabase/server'
import { fmtTime, getBangkokDateString } from '@/lib/utils'

function formatDateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function CoachTodayPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = getBangkokDateString()
  const teachingDay = await getCoachAssignedTeachingDay(supabase, user.id, today)

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-[#2748bf]">
          <CalendarCheck className="h-4 w-4" />
          Coach Schedule
        </div>
        <h1 className="mt-1 text-2xl font-bold text-[#153c85]">รอบสอนวันนี้</h1>
        <p className="mt-1 text-sm text-gray-500">
          {formatDateLabel(today)} แสดงเฉพาะรอบและผู้เรียนในกลุ่มที่คุณรับผิดชอบ
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">รอบที่ได้รับมอบหมาย</p>
            <p className="mt-2 text-2xl font-bold text-[#153c85]">{teachingDay.slots.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">ผู้เรียนในกลุ่มของคุณ</p>
            <p className="mt-2 text-2xl font-bold text-[#153c85]">{teachingDay.totalStudents}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">เช็คอินแล้ว</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">{teachingDay.checkedSlotCount}/{teachingDay.slots.length}</p>
          </CardContent>
        </Card>
      </div>

      {teachingDay.slots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <CalendarCheck className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ยังไม่มีรอบสอนที่ได้รับมอบหมายวันนี้</p>
            <p className="mt-1 text-sm">ถ้ามีผู้เรียนในรอบแล้ว ให้หัวหน้าโค้ชจัดกลุ่มและมอบหมายโค้ชก่อน</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {teachingDay.slots.map((slot) => (
            <Card key={slot.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2748bf]/10">
                      <Clock className="h-5 w-5 text-[#2748bf]" />
                    </div>
                    <div>
                      <p className="font-bold text-[#153c85]">{fmtTime(slot.startTime)} - {fmtTime(slot.endTime)}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{slot.branchName}</span>
                        <Badge className="bg-blue-100 text-[10px] text-blue-700">{slot.courseType || 'คอร์ส'}</Badge>
                        <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{slot.students.length} คน</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className={slot.checkin ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-orange-200 bg-orange-50 text-orange-700'}>
                    {slot.checkin ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <Camera className="mr-1 h-3.5 w-3.5" />}
                    {slot.checkin ? 'เช็คอินแล้ว' : 'รอเช็คอิน'}
                  </Badge>
                </div>

                {slot.students.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-gray-400">
                    รอบนี้ยังไม่มีผู้เรียนที่อยู่ในกลุ่มของคุณ
                  </div>
                ) : (
                  <div className="space-y-2 border-t pt-3">
                    {slot.students.map((student) => (
                      <div key={student.bookingSessionId} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                        {student.isChild ? <Baby className="h-4 w-4 shrink-0 text-pink-500" /> : <User className="h-4 w-4 shrink-0 text-blue-500" />}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium text-gray-900">{student.studentName}</p>
                            {student.assignmentGroupName && (
                              <Badge variant="outline" className="bg-white text-[10px] text-gray-600">
                                <Layers3 className="mr-1 h-3 w-3" />
                                {student.assignmentGroupName}
                              </Badge>
                            )}
                          </div>
                          {student.parentName && <p className="truncate text-xs text-gray-400">ผู้ปกครอง: {student.parentName}</p>}
                        </div>
                        <Badge className={`text-[10px] ${student.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {student.status === 'completed' ? 'เรียนแล้ว' : 'รอสอน'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
