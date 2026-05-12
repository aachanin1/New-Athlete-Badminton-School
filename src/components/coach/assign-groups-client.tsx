'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Building2, CalendarDays, Loader2, User, UserCog, Users } from 'lucide-react'
import { fmtTime } from '@/lib/utils'

interface CoachOption {
  id: string
  name: string
  role: string
  branches: string[]
}

interface AssignmentStudent {
  id: string
  name: string
  parentName: string | null
  isChild: boolean
}

interface AssignmentGroup {
  key: string
  scheduleSlotId: string | null
  branchId: string
  branchName: string
  courseTypeId: string
  courseType: string
  date: string
  startTime: string
  endTime: string
  students: AssignmentStudent[]
  assignedCoachId: string | null
  assignedCoachName: string | null
}

interface AssignGroupsClientProps {
  coaches: CoachOption[]
  groups: AssignmentGroup[]
  currentUserId?: string
}

const ROLE_LABELS: Record<string, string> = {
  coach: 'โค้ช',
  head_coach: 'หัวหน้าโค้ช',
  admin: 'Admin',
  super_admin: 'Super Admin',
}

const COURSE_LABELS: Record<string, string> = {
  kids_group: 'เด็กกลุ่ม',
  adult_group: 'ผู้ใหญ่กลุ่ม',
  private: 'Private',
}

export function AssignGroupsClient({ coaches, groups, currentUserId }: AssignGroupsClientProps) {
  const router = useRouter()
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedCoachByGroup, setSelectedCoachByGroup] = useState<Record<string, string>>(() => {
    return groups.reduce((map: Record<string, string>, group) => {
      map[group.key] = group.assignedCoachId || 'unassigned'
      return map
    }, {})
  })

  const groupedByDate = useMemo(() => {
    return Object.entries(groups.reduce((map: Record<string, AssignmentGroup[]>, group) => {
      if (!map[group.date]) map[group.date] = []
      map[group.date].push(group)
      return map
    }, {})).sort(([a], [b]) => a.localeCompare(b))
  }, [groups])

  const saveAssignment = async (group: AssignmentGroup) => {
    const coachId = selectedCoachByGroup[group.key]
    setSavingKey(group.key)
    setErrorKey(null)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/coach/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleSlotId: group.scheduleSlotId,
          branchId: group.branchId,
          courseTypeId: group.courseTypeId,
          date: group.date,
          startTime: group.startTime,
          endTime: group.endTime,
          coachId: coachId === 'unassigned' ? null : coachId,
        }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setErrorKey(group.key)
        setErrorMessage(json?.error || 'บันทึกการมอบหมายไม่สำเร็จ')
        setSavingKey(null)
        return
      }

      router.refresh()
    } catch {
      setErrorKey(group.key)
      setErrorMessage('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">แบ่งกลุ่มนักเรียน</h1>
        <p className="mt-1 text-sm text-gray-500">มอบหมายรอบสอนให้โค้ชแต่ละคน และหัวหน้าโค้ชสามารถมอบหมายให้ตัวเองได้</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-[#2748bf]">{coaches.length}</p>
          <p className="text-xs text-gray-500">โค้ชที่เลือกมอบหมายได้</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-[#f57e3b]">{groups.length}</p>
          <p className="text-xs text-gray-500">รอบที่ต้องจัดโค้ช</p>
        </CardContent></Card>
      </div>

      <div className="space-y-2">
        {coaches.map((coach) => (
          <Card key={coach.id}>
            <CardContent className="flex items-center gap-3 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2748bf]/10">
                <UserCog className="h-5 w-5 text-[#2748bf]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-sm">{coach.name}</p>
                  <Badge className="bg-blue-100 text-blue-700 text-[10px]">{ROLE_LABELS[coach.role] || coach.role}</Badge>
                </div>
                <p className="mt-1 text-xs text-gray-400">{coach.branches.join(', ')}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {groupedByDate.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">
          <Users className="mx-auto mb-3 h-12 w-12 opacity-40" />
          <p className="font-medium">ยังไม่มีรอบเรียนให้มอบหมาย</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map(([date, dateGroups]) => (
            <div key={date} className="space-y-3">
              <div className="flex items-center gap-2 text-[#153c85]">
                <CalendarDays className="h-4 w-4" />
                <p className="font-semibold">{new Date(date + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>

              {dateGroups.map((group) => (
                <Card key={group.key}>
                  <CardContent className="space-y-4 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-[#153c85]">{fmtTime(group.startTime)} - {fmtTime(group.endTime)}</p>
                          <Badge className="bg-blue-100 text-blue-700">{COURSE_LABELS[group.courseType] || group.courseType}</Badge>
                          <Badge variant="outline">{group.students.length} คน</Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{group.branchName}</span>
                          <span className="flex items-center gap-1"><UserCog className="h-3 w-3" />{group.assignedCoachName || 'ยังไม่ได้มอบหมาย'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 rounded-lg border bg-gray-50 p-3">
                      {group.students.map((student) => (
                        <div key={student.id} className="flex items-center gap-2 text-sm">
                          <User className={`h-3.5 w-3.5 shrink-0 ${student.isChild ? 'text-pink-500' : 'text-blue-500'}`} />
                          <span className="font-medium">{student.name}</span>
                          {student.parentName && <span className="text-xs text-gray-400">(ผู้ปกครอง: {student.parentName})</span>}
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <Select
                        value={selectedCoachByGroup[group.key] || 'unassigned'}
                        onValueChange={(value) => setSelectedCoachByGroup((prev) => ({ ...prev, [group.key]: value }))}
                      >
                        <SelectTrigger className="w-full lg:w-80"><SelectValue placeholder="เลือกโค้ช" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">ยังไม่มอบหมาย</SelectItem>
                          {coaches.map((coach) => {
                            const isSelf = coach.id === currentUserId
                            return (
                              <SelectItem key={coach.id} value={coach.id}>
                                {coach.name}{isSelf ? ' (ตนเอง)' : ''} • {ROLE_LABELS[coach.role] || coach.role}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>

                      <Button
                        onClick={() => saveAssignment(group)}
                        disabled={savingKey === group.key}
                        className="bg-[#2748bf] hover:bg-[#153c85] lg:w-auto"
                      >
                        {savingKey === group.key ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />กำลังบันทึก...</> : 'บันทึกการมอบหมาย'}
                      </Button>
                    </div>

                    {errorKey === group.key && errorMessage && (
                      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                        {errorMessage}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
