'use client'

import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  CalendarDays,
  Clock,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Trash2,
  User,
  UserCog,
  Users,
} from 'lucide-react'
import { fmtTime } from '@/lib/utils'
import type { CourseTypeName } from '@/types/database'

interface BranchOption {
  id: string
  name: string
  slug: string
}

interface CourseTypeOption {
  id: string
  name: CourseTypeName
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
  courseTypes: CourseTypeOption[]
  templates: ScheduleTemplateData[]
  canManageTemplates: boolean
}

interface ScheduleTemplateData {
  id: string
  branch_id: string
  branch_slug: string
  branch_name: string
  course_type_id: string
  course_type_name: CourseTypeName
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
  notes: string | null
}

const COURSE_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  kids_group: { label: 'เด็กกลุ่ม', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
  adult_group: { label: 'ผู้ใหญ่กลุ่ม', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  private: { label: 'Private', dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700' },
}

const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending_payment: 'รอชำระเงิน',
  paid: 'แนบสลิปแล้ว',
  verified: 'จองสำเร็จ',
  cancelled: 'ยกเลิก',
}

const SESSION_STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  scheduled: { label: 'นัดหมาย', badge: 'bg-blue-100 text-blue-700' },
  completed: { label: 'เรียนแล้ว', badge: 'bg-emerald-100 text-emerald-700' },
  absent: { label: 'ขาดเรียน', badge: 'bg-rose-100 text-rose-700' },
  cancelled: { label: 'ยกเลิก', badge: 'bg-gray-100 text-gray-600' },
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
const DAY_OPTIONS = [
  { value: 0, label: 'อาทิตย์' },
  { value: 1, label: 'จันทร์' },
  { value: 2, label: 'อังคาร' },
  { value: 3, label: 'พุธ' },
  { value: 4, label: 'พฤหัสบดี' },
  { value: 5, label: 'ศุกร์' },
  { value: 6, label: 'เสาร์' },
]

const COURSE_LABELS: Record<CourseTypeName, string> = {
  kids_group: 'เด็กกลุ่ม',
  adult_group: 'ผู้ใหญ่กลุ่ม',
  private: 'Private',
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

function formatShortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
}

export function SchedulesClient({ sessions, branches, courseTypes, templates, canManageTemplates }: SchedulesClientProps) {
  const router = useRouter()
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [selectedCourse, setSelectedCourse] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(today)
  const [templateForm, setTemplateForm] = useState({
    branchId: branches[0]?.id || '',
    courseTypeId: courseTypes[0]?.id || '',
    dayOfWeek: '1',
    startTime: '17:00',
    endTime: '19:00',
    notes: '',
  })
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [updatingTemplateId, setUpdatingTemplateId] = useState<string | null>(null)

  const filteredMonthSessions = useMemo(() => {
    const q = search.trim().toLowerCase()

    return sessions.filter((session) => {
      const date = new Date(`${session.date}T00:00:00`)
      if (date.getMonth() !== month || date.getFullYear() !== year) return false
      if (selectedBranch !== 'all' && session.branch_id !== selectedBranch) return false
      if (selectedCourse !== 'all' && session.course_type !== selectedCourse) return false

      if (!q) return true

      return [
        session.learner_name,
        session.parent_name || '',
        session.branch_name,
        session.course_type,
        session.booking_status,
        ...session.coach_names,
      ].some((value) => value.toLowerCase().includes(q))
    })
  }, [sessions, month, year, selectedBranch, selectedCourse, search])

  const sessionsByDate = useMemo(() => {
    const map: Record<string, ScheduleSession[]> = {}

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
  const totalLearners = new Set(filteredMonthSessions.map((session) => `${session.parent_name || ''}:${session.learner_name}`)).size
  const totalBranches = new Set(filteredMonthSessions.map((session) => session.branch_id)).size
  const totalSlots = new Set(filteredMonthSessions.map((session) => `${session.date}:${session.branch_id}:${session.start_time}:${session.end_time}:${session.course_type}`)).size
  const unassignedSessions = filteredMonthSessions.filter((session) => session.coach_names.length === 0).length
  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      if (selectedBranch !== 'all' && template.branch_id !== selectedBranch) return false
      if (selectedCourse !== 'all' && template.course_type_name !== selectedCourse) return false
      return true
    })
  }, [selectedBranch, selectedCourse, templates])

  const templateStats = useMemo(() => ({
    active: templates.filter((template) => template.is_active).length,
    inactive: templates.filter((template) => !template.is_active).length,
  }), [templates])

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

  const createTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canManageTemplates) return
    setSavingTemplate(true)
    setTemplateError(null)

    try {
      const response = await fetch('/api/admin/schedule-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: templateForm.branchId,
          courseTypeId: templateForm.courseTypeId,
          dayOfWeek: Number(templateForm.dayOfWeek),
          startTime: templateForm.startTime,
          endTime: templateForm.endTime,
          notes: templateForm.notes,
          isActive: true,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'สร้างรอบเรียนไม่สำเร็จ')

      setTemplateForm((current) => ({ ...current, notes: '' }))
      router.refresh()
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : 'สร้างรอบเรียนไม่สำเร็จ')
    } finally {
      setSavingTemplate(false)
    }
  }

  const updateTemplate = async (templateId: string, updates: { isActive?: boolean }) => {
    if (!canManageTemplates) return
    setUpdatingTemplateId(templateId)
    setTemplateError(null)

    try {
      const response = await fetch('/api/admin/schedule-templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: templateId, ...updates }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'อัปเดตรอบเรียนไม่สำเร็จ')
      router.refresh()
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : 'อัปเดตรอบเรียนไม่สำเร็จ')
    } finally {
      setUpdatingTemplateId(null)
    }
  }

  const deleteTemplate = async (templateId: string) => {
    if (!canManageTemplates || !confirm('ลบรอบเรียนนี้ใช่ไหม? การจองเดิมจะไม่ถูกลบ')) return
    setUpdatingTemplateId(templateId)
    setTemplateError(null)

    try {
      const response = await fetch(`/api/admin/schedule-templates?id=${templateId}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'ลบรอบเรียนไม่สำเร็จ')
      router.refresh()
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : 'ลบรอบเรียนไม่สำเร็จ')
    } finally {
      setUpdatingTemplateId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#2748bf]">
            <CalendarDays className="h-4 w-4" />
            Operation Calendar
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">ตารางเรียน</h1>
          <p className="mt-1 text-sm text-gray-500">
            ดูภาพรวมรอบเรียนรายเดือน เลือกวันเพื่อดูผู้เรียน สาขา คอร์ส และโค้ชที่รับผิดชอบ
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            วันนี้
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToPreviousMonth}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-48 text-center text-base font-bold text-[#153c85]">
            {MONTH_NAMES_TH[month]} {year + 543}
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToNextMonth}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">รอบเรียน</p>
              <p className="mt-1 text-xl font-bold text-[#2748bf] sm:text-2xl">{totalSlots}</p>
            </div>
            <Calendar className="h-5 w-5 text-[#2748bf]" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">รายการจอง</p>
              <p className="mt-1 text-xl font-bold text-emerald-600 sm:text-2xl">{filteredMonthSessions.length}</p>
            </div>
            <Users className="h-5 w-5 text-emerald-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">ผู้เรียน</p>
              <p className="mt-1 text-xl font-bold text-orange-500 sm:text-2xl">{totalLearners}</p>
            </div>
            <User className="h-5 w-5 text-orange-500" />
          </CardContent>
        </Card>
        <Card className={unassignedSessions > 0 ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200'}>
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">ยังไม่ assign โค้ช</p>
              <p className="mt-1 text-xl font-bold text-amber-600 sm:text-2xl">{unassignedSessions}</p>
            </div>
            <UserCog className="h-5 w-5 text-amber-500" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200">
        <CardContent className="p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_220px_180px_auto] xl:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ค้นหาผู้เรียน ผู้ปกครอง โค้ช สาขา..."
                className="pl-10"
              />
            </div>

            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger>
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
              <SelectTrigger>
                <SelectValue placeholder="ทุกคอร์ส" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกคอร์ส</SelectItem>
                <SelectItem value="kids_group">เด็กกลุ่ม</SelectItem>
                <SelectItem value="adult_group">ผู้ใหญ่กลุ่ม</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>

            <p className="text-sm text-gray-500 xl:text-right">
              {filteredMonthSessions.length} รายการ · {totalBranches} สาขา
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#2748bf]">
                  <Settings2 className="h-4 w-4" />
                  Schedule Templates
                </div>
                <h3 className="mt-1 font-bold text-[#153c85]">ตั้งค่ารอบเรียนประจำ</h3>
                <p className="mt-1 text-xs text-gray-500">รอบที่เพิ่มในนี้จะถูกใช้กับหน้าจองเรียนก่อนข้อมูล hardcoded เดิม</p>
              </div>
              <Badge variant="outline" className="shrink-0">
                เปิด {templateStats.active} / ปิด {templateStats.inactive}
              </Badge>
            </div>

            {!canManageTemplates ? (
              <div className="rounded-lg border border-dashed bg-gray-50 p-4 text-sm text-gray-500">
                เฉพาะ Super Admin เท่านั้นที่แก้รอบเรียนประจำได้
              </div>
            ) : (
              <form onSubmit={createTemplate} className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>สาขา</Label>
                    <Select value={templateForm.branchId} onValueChange={(value) => setTemplateForm((current) => ({ ...current, branchId: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>คอร์ส</Label>
                    <Select value={templateForm.courseTypeId} onValueChange={(value) => setTemplateForm((current) => ({ ...current, courseTypeId: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {courseTypes.map((course) => (
                          <SelectItem key={course.id} value={course.id}>{COURSE_LABELS[course.name]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>วัน</Label>
                    <Select value={templateForm.dayOfWeek} onValueChange={(value) => setTemplateForm((current) => ({ ...current, dayOfWeek: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAY_OPTIONS.map((day) => (
                          <SelectItem key={day.value} value={String(day.value)}>{day.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="template-start">เริ่ม</Label>
                    <Input
                      id="template-start"
                      type="time"
                      value={templateForm.startTime}
                      onChange={(event) => setTemplateForm((current) => ({ ...current, startTime: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="template-end">จบ</Label>
                    <Input
                      id="template-end"
                      type="time"
                      value={templateForm.endTime}
                      onChange={(event) => setTemplateForm((current) => ({ ...current, endTime: event.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="template-notes">หมายเหตุ</Label>
                  <Input
                    id="template-notes"
                    value={templateForm.notes}
                    onChange={(event) => setTemplateForm((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="เช่น รอบเด็กหลังเลิกเรียน"
                  />
                </div>

                {templateError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{templateError}</div>
                )}

                <Button type="submit" className="bg-[#2748bf] hover:bg-[#153c85]" disabled={savingTemplate || !templateForm.branchId || !templateForm.courseTypeId}>
                  {savingTemplate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  เพิ่มรอบเรียน
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-[#153c85]">รอบเรียนจากระบบ</h3>
                <p className="text-xs text-gray-500">กรองตามสาขา/คอร์สเดียวกับปฏิทินด้านบน</p>
              </div>
              <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{filteredTemplates.length} รอบ</Badge>
            </div>

            {filteredTemplates.length === 0 ? (
              <div className="rounded-lg border border-dashed py-10 text-center text-sm text-gray-400">
                ยังไม่มี template ใน DB สำหรับตัวกรองนี้ ระบบจะใช้ตารางเดิมเป็น fallback
              </div>
            ) : (
              <div className="max-h-[27rem] space-y-2 overflow-y-auto pr-1">
                {filteredTemplates.map((template) => (
                  <div key={template.id} className={template.is_active ? 'rounded-lg border bg-white p-3' : 'rounded-lg border bg-gray-50 p-3 opacity-70'}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={COURSE_CONFIG[template.course_type_name]?.badge || 'bg-gray-100 text-gray-700'}>
                            {COURSE_LABELS[template.course_type_name]}
                          </Badge>
                          <span className="text-sm font-semibold text-gray-950">{DAY_OPTIONS.find((day) => day.value === template.day_of_week)?.label}</span>
                          <span className="text-sm font-semibold text-[#2748bf]">{fmtTime(template.start_time)}-{fmtTime(template.end_time)}</span>
                          {!template.is_active && <Badge variant="outline">ปิดใช้งาน</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">{template.branch_name}{template.notes ? ` • ${template.notes}` : ''}</p>
                      </div>
                      {canManageTemplates && (
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => updateTemplate(template.id, { isActive: !template.is_active })}
                            disabled={updatingTemplateId === template.id}
                          >
                            {updatingTemplateId === template.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                            {template.is_active ? 'ปิด' : 'เปิด'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => deleteTemplate(template.id)}
                            disabled={updatingTemplateId === template.id}
                            aria-label="ลบรอบเรียน"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(560px,.95fr)_minmax(560px,1.05fr)]">
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="mb-3 grid grid-cols-7 text-center text-xs font-medium text-gray-500">
              {DAY_HEADERS.map((day, index) => (
                <div key={day} className={`py-1 ${index === 0 ? 'text-rose-500' : ''}`}>{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                if (day === null) return <div key={`empty-${index}`} className="min-h-[5.25rem]" />

                const date = getDateString(year, month, day)
                const daySessions = sessionsByDate[date] || []
                const isToday = date === today
                const isSelected = selectedDate === date
                const daySlots = new Set(daySessions.map((session) => `${session.branch_id}:${session.start_time}:${session.end_time}:${session.course_type}`)).size

                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelectedDate(isSelected ? null : date)}
                    className={`min-h-[5.25rem] rounded-md border p-2 text-left transition hover:border-[#2748bf]/50 hover:bg-blue-50/40 ${
                      isSelected ? 'border-[#2748bf] bg-blue-50 ring-1 ring-[#2748bf]' : 'border-gray-100'
                    } ${isToday ? 'shadow-[inset_0_0_0_1px_#f57e3b]' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-xs font-semibold ${isToday ? 'text-[#f57e3b]' : index % 7 === 0 ? 'text-rose-500' : 'text-gray-700'}`}>
                        {day}
                      </span>
                      {daySessions.length > 0 && (
                        <span className="rounded bg-gray-100 px-1 text-[10px] text-gray-500">{daySessions.length}</span>
                      )}
                    </div>

                    {daySessions.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="flex flex-wrap gap-1">
                          {daySessions.slice(0, 10).map((session) => {
                            const course = COURSE_CONFIG[session.course_type] || { dot: 'bg-gray-400' }
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
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-0">
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
              <div className="flex min-h-[28rem] items-center justify-center text-sm text-gray-400">
                ไม่พบตารางเรียนในเงื่อนไขที่เลือก
              </div>
            ) : (
              <div className="max-h-[44rem] overflow-y-auto p-3">
                <div className="space-y-2">
                  {listSessions.map((session) => {
                    const course = COURSE_CONFIG[session.course_type] || { label: session.course_type, badge: 'bg-gray-100 text-gray-700' }
                    const status = SESSION_STATUS_CONFIG[session.status] || { label: session.status, badge: 'bg-gray-100 text-gray-600' }

                    return (
                      <div key={session.id} className="rounded-lg border bg-white p-3 transition-colors hover:bg-gray-50">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-[#153c85]">{session.learner_name}</p>
                              <Badge className={`text-[10px] ${course.badge}`}>{course.label}</Badge>
                              <Badge className={`text-[10px] ${status.badge}`}>{status.label}</Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {BOOKING_STATUS_LABELS[session.booking_status] || session.booking_status || '-'}
                              </Badge>
                              {session.is_makeup && (
                                <Badge variant="outline" className="border-orange-200 text-[10px] text-orange-600">
                                  <RotateCcw className="mr-1 h-3 w-3" />
                                  ชดเชย
                                </Badge>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                {formatShortDate(session.date)}
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

                          <div className="flex shrink-0 items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-500">
                            <UserCog className="h-3 w-3" />
                            {session.coach_names.length > 0 ? session.coach_names.join(', ') : 'ยังไม่ได้ assign โค้ช'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
