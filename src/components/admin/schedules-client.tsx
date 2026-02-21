'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar, Clock, Users, User, Building2 } from 'lucide-react'

interface SlotInfo {
  start: string
  end: string
}

interface DaySchedule {
  dayOfWeek: number
  dayLabel: string
  slots: SlotInfo[]
}

interface BranchScheduleData {
  id: string
  name: string
  slug: string
  is_active: boolean
  schedules: Record<string, DaySchedule[]>
}

interface SchedulesClientProps {
  branches: BranchScheduleData[]
}

const COURSE_TYPE_LABELS: Record<string, { label: string; color: string; icon: typeof Users }> = {
  kids_group: { label: 'เด็ก (กลุ่ม)', color: 'bg-blue-100 text-blue-700', icon: Users },
  adult_group: { label: 'ผู้ใหญ่ (กลุ่ม)', color: 'bg-green-100 text-green-700', icon: User },
  private: { label: 'Private', color: 'bg-orange-100 text-orange-700', icon: User },
}

export function SchedulesClient({ branches }: SchedulesClientProps) {
  const [selectedBranch, setSelectedBranch] = useState<string>('all')

  const filteredBranches = selectedBranch === 'all' ? branches : branches.filter((b) => b.id === selectedBranch)

  const totalSlots = branches.reduce((sum, b) => {
    return sum + Object.values(b.schedules).reduce((s2, days) => s2 + days.reduce((s3, d) => s3 + d.slots.length, 0), 0)
  }, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">ตารางรอบเรียน</h1>
        <p className="text-gray-500 text-sm mt-1">ดูรอบเรียนทั้งหมดของแต่ละสาขา (ปัจจุบันกำหนดใน Code)</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-[#2748bf]">{branches.length}</p><p className="text-xs text-gray-500">สาขา</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">3</p><p className="text-xs text-gray-500">ประเภทคอร์ส</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{totalSlots}</p><p className="text-xs text-gray-500">รอบเรียนทั้งหมด</p>
        </CardContent></Card>
      </div>

      {/* Filter */}
      <Select value={selectedBranch} onValueChange={setSelectedBranch}>
        <SelectTrigger className="w-64"><SelectValue placeholder="เลือกสาขา" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">ทุกสาขา</SelectItem>
          {branches.map((b) => (
            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Branch schedules */}
      {filteredBranches.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">ไม่พบข้อมูล</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {filteredBranches.map((branch) => (
            <Card key={branch.id}>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="h-5 w-5 text-[#2748bf]" />
                  <h2 className="font-bold text-lg text-[#153c85]">{branch.name}</h2>
                  {!branch.is_active && <Badge className="bg-gray-100 text-gray-500 text-[10px]">ปิดใช้งาน</Badge>}
                </div>

                {Object.keys(branch.schedules).length === 0 ? (
                  <p className="text-sm text-gray-400">ยังไม่มีรอบเรียน</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(branch.schedules).map(([courseType, days]) => {
                      const cfg = COURSE_TYPE_LABELS[courseType] || { label: courseType, color: 'bg-gray-100 text-gray-700', icon: Users }
                      return (
                        <div key={courseType}>
                          <Badge className={`${cfg.color} mb-2`}>{cfg.label}</Badge>
                          <div className="grid gap-2">
                            {days.map((day) => (
                              <div key={day.dayOfWeek} className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg">
                                <span className="text-sm font-medium text-gray-600 w-16 shrink-0">{day.dayLabel}</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {day.slots.map((slot, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border rounded text-xs text-gray-700">
                                      <Clock className="h-3 w-3 text-gray-400" />
                                      {slot.start} - {slot.end}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        ⚠️ ตารางรอบเรียนกำหนดใน Code (branch-schedules.ts) — อนาคตจะย้ายมาจัดการผ่าน CMS
      </p>
    </div>
  )
}
