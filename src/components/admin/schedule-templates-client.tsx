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
import { Building2, CalendarClock, CheckCircle2, Clock, Loader2, Plus, Power, Search, Trash2 } from 'lucide-react'
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

export interface ScheduleTemplateData {
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

interface ScheduleTemplatesClientProps {
  branches: BranchOption[]
  courseTypes: CourseTypeOption[]
  templates: ScheduleTemplateData[]
}

const DAY_OPTIONS = [
  { value: 0, label: 'อาทิตย์', short: 'อา.' },
  { value: 1, label: 'จันทร์', short: 'จ.' },
  { value: 2, label: 'อังคาร', short: 'อ.' },
  { value: 3, label: 'พุธ', short: 'พ.' },
  { value: 4, label: 'พฤหัสบดี', short: 'พฤ.' },
  { value: 5, label: 'ศุกร์', short: 'ศ.' },
  { value: 6, label: 'เสาร์', short: 'ส.' },
]

const COURSE_CONFIG: Record<CourseTypeName, { label: string; badge: string; text: string }> = {
  kids_group: { label: 'เด็กกลุ่ม', badge: 'bg-blue-100 text-blue-700 hover:bg-blue-100', text: 'text-blue-700' },
  adult_group: { label: 'ผู้ใหญ่กลุ่ม', badge: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100', text: 'text-emerald-700' },
  private: { label: 'Private', badge: 'bg-orange-100 text-orange-700 hover:bg-orange-100', text: 'text-orange-700' },
}

function getDayLabel(dayOfWeek: number) {
  return DAY_OPTIONS.find((day) => day.value === dayOfWeek)?.label || '-'
}

function getGroupKey(template: ScheduleTemplateData) {
  return `${template.branch_id}:${template.course_type_name}`
}

export function ScheduleTemplatesClient({ branches, courseTypes, templates }: ScheduleTemplatesClientProps) {
  const router = useRouter()
  const [filterBranch, setFilterBranch] = useState('all')
  const [filterCourse, setFilterCourse] = useState('all')
  const [filterStatus, setFilterStatus] = useState('active')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    branchId: branches[0]?.id || '',
    courseTypeId: courseTypes[0]?.id || '',
    dayOfWeek: '1',
    startTime: '17:00',
    endTime: '19:00',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase()

    return templates
      .filter((template) => {
        if (filterBranch !== 'all' && template.branch_id !== filterBranch) return false
        if (filterCourse !== 'all' && template.course_type_name !== filterCourse) return false
        if (filterStatus === 'active' && !template.is_active) return false
        if (filterStatus === 'inactive' && template.is_active) return false
        if (!query) return true

        return [
          template.branch_name,
          template.branch_slug,
          COURSE_CONFIG[template.course_type_name]?.label || template.course_type_name,
          getDayLabel(template.day_of_week),
          template.start_time,
          template.end_time,
          template.notes || '',
        ].some((value) => value.toLowerCase().includes(query))
      })
      .sort((a, b) => {
        const branchOrder = a.branch_name.localeCompare(b.branch_name, 'th')
        if (branchOrder !== 0) return branchOrder
        const courseOrder = a.course_type_name.localeCompare(b.course_type_name)
        if (courseOrder !== 0) return courseOrder
        if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week
        return a.start_time.localeCompare(b.start_time)
      })
  }, [filterBranch, filterCourse, filterStatus, search, templates])

  const groupedTemplates = useMemo(() => {
    const groups = new Map<string, ScheduleTemplateData[]>()
    filteredTemplates.forEach((template) => {
      const key = getGroupKey(template)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)?.push(template)
    })
    return Array.from(groups.entries()).map(([key, items]) => ({ key, items }))
  }, [filteredTemplates])

  const stats = useMemo(() => ({
    total: templates.length,
    active: templates.filter((template) => template.is_active).length,
    inactive: templates.filter((template) => !template.is_active).length,
    branches: new Set(templates.map((template) => template.branch_id)).size,
    private: templates.filter((template) => template.course_type_name === 'private').length,
  }), [templates])

  const createTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/schedule-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: form.branchId,
          courseTypeId: form.courseTypeId,
          dayOfWeek: Number(form.dayOfWeek),
          startTime: form.startTime,
          endTime: form.endTime,
          notes: form.notes,
          isActive: true,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'สร้างรอบเรียนไม่สำเร็จ')

      setForm((current) => ({ ...current, notes: '' }))
      router.refresh()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'สร้างรอบเรียนไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const updateTemplate = async (templateId: string, updates: { isActive?: boolean }) => {
    setUpdatingId(templateId)
    setError(null)

    try {
      const response = await fetch('/api/admin/schedule-templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: templateId, ...updates }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'อัปเดตรอบเรียนไม่สำเร็จ')
      router.refresh()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'อัปเดตรอบเรียนไม่สำเร็จ')
    } finally {
      setUpdatingId(null)
    }
  }

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('ลบรอบเรียนนี้ใช่ไหม? การจองเดิมจะไม่ถูกลบ')) return
    setUpdatingId(templateId)
    setError(null)

    try {
      const response = await fetch(`/api/admin/schedule-templates?id=${templateId}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'ลบรอบเรียนไม่สำเร็จ')
      router.refresh()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'ลบรอบเรียนไม่สำเร็จ')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#2748bf]">
            <CalendarClock className="h-4 w-4" />
            Schedule Master
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">รอบเรียนประจำ</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            จัดการรอบเรียนมาตรฐานของทุกสาขาและทุกประเภทคอร์ส ข้อมูลนี้เป็นแหล่งหลักที่หน้า booking และวันชดเชยนำไปใช้
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-5">
        <Card className="border-gray-200">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs text-gray-500">รอบทั้งหมด</p>
            <p className="mt-1 text-xl font-bold text-[#2748bf] sm:text-2xl">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs text-gray-500">เปิดใช้งาน</p>
            <p className="mt-1 text-xl font-bold text-emerald-600 sm:text-2xl">{stats.active}</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs text-gray-500">ปิดใช้งาน</p>
            <p className="mt-1 text-xl font-bold text-gray-600 sm:text-2xl">{stats.inactive}</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs text-gray-500">สาขา</p>
            <p className="mt-1 text-xl font-bold text-orange-500 sm:text-2xl">{stats.branches}</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs text-gray-500">Private</p>
            <p className="mt-1 text-xl font-bold text-violet-600 sm:text-2xl">{stats.private}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="mb-4">
              <h2 className="font-bold text-[#153c85]">เพิ่มรอบเรียน</h2>
              <p className="mt-1 text-xs text-gray-500">เพิ่มเฉพาะรอบที่เป็นมาตรฐานประจำ ไม่ใช่การจองรายคน</p>
            </div>

            <form onSubmit={createTemplate} className="grid gap-3">
              <div className="space-y-1.5">
                <Label>สาขา</Label>
                <Select value={form.branchId} onValueChange={(value) => setForm((current) => ({ ...current, branchId: value }))}>
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
                <Label>ประเภทคอร์ส</Label>
                <Select value={form.courseTypeId} onValueChange={(value) => setForm((current) => ({ ...current, courseTypeId: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {courseTypes.map((course) => (
                      <SelectItem key={course.id} value={course.id}>{COURSE_CONFIG[course.name].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>วัน</Label>
                  <Select value={form.dayOfWeek} onValueChange={(value) => setForm((current) => ({ ...current, dayOfWeek: value }))}>
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
                    value={form.startTime}
                    onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="template-end">จบ</Label>
                  <Input
                    id="template-end"
                    type="time"
                    value={form.endTime}
                    onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="template-notes">หมายเหตุ</Label>
                <Input
                  id="template-notes"
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="เช่น รอบหลังเลิกเรียน / รอบพิเศษ"
                />
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}

              <Button type="submit" className="bg-[#2748bf] hover:bg-[#153c85]" disabled={saving || !form.branchId || !form.courseTypeId}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                เพิ่มรอบเรียน
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-0">
            <div className="border-b p-4">
              <div className="grid gap-3 xl:grid-cols-[minmax(240px,1fr)_190px_170px_150px_auto] xl:items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="ค้นหาสาขา คอร์ส วัน เวลา..."
                    className="pl-10"
                  />
                </div>

                <Select value={filterBranch} onValueChange={setFilterBranch}>
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

                <Select value={filterCourse} onValueChange={setFilterCourse}>
                  <SelectTrigger>
                    <SelectValue placeholder="ทุกคอร์ส" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกคอร์ส</SelectItem>
                    {courseTypes.map((course) => (
                      <SelectItem key={course.id} value={course.name}>{COURSE_CONFIG[course.name].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="สถานะ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">เปิดใช้งาน</SelectItem>
                    <SelectItem value="inactive">ปิดใช้งาน</SelectItem>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                  </SelectContent>
                </Select>

                <p className="text-sm text-gray-500 xl:text-right">{filteredTemplates.length} รอบ</p>
              </div>
            </div>

            {groupedTemplates.length === 0 ? (
              <div className="flex min-h-[26rem] items-center justify-center p-6 text-center text-sm text-gray-400">
                ไม่พบรอบเรียนตามตัวกรองที่เลือก
              </div>
            ) : (
              <div className="max-h-[48rem] overflow-y-auto p-4">
                <div className="space-y-4">
                  {groupedTemplates.map(({ key, items }) => {
                    const first = items[0]
                    const course = COURSE_CONFIG[first.course_type_name]

                    return (
                      <section key={key} className="rounded-lg border bg-white">
                        <div className="flex flex-col gap-2 border-b bg-gray-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Building2 className="h-4 w-4 text-[#2748bf]" />
                              <h3 className="font-semibold text-[#153c85]">{first.branch_name}</h3>
                              <Badge className={course.badge}>{course.label}</Badge>
                            </div>
                            <p className="mt-1 text-xs text-gray-500">{items.length} รอบในกลุ่มนี้</p>
                          </div>
                        </div>

                        <div className="divide-y">
                          {items.map((template) => (
                            <div key={template.id} className={template.is_active ? 'p-3' : 'bg-gray-50 p-3 opacity-75'}>
                              <div className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_minmax(160px,220px)_auto] md:items-center">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="border-blue-200 text-[#2748bf]">
                                      {getDayLabel(template.day_of_week)}
                                    </Badge>
                                    <span className={`font-semibold ${course.text}`}>
                                      {fmtTime(template.start_time)} - {fmtTime(template.end_time)}
                                    </span>
                                    {template.is_active ? (
                                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                        <CheckCircle2 className="mr-1 h-3 w-3" />
                                        เปิดใช้งาน
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline">ปิดใช้งาน</Badge>
                                    )}
                                  </div>
                                  {template.notes && <p className="mt-1 text-xs text-gray-500">{template.notes}</p>}
                                </div>

                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <Clock className="h-4 w-4" />
                                  ใช้กับหน้า booking / วันชดเชย
                                </div>

                                <div className="flex items-center gap-2 md:justify-end">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateTemplate(template.id, { isActive: !template.is_active })}
                                    disabled={updatingId === template.id}
                                  >
                                    {updatingId === template.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Power className="mr-1 h-3.5 w-3.5" />}
                                    {template.is_active ? 'ปิด' : 'เปิด'}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    onClick={() => deleteTemplate(template.id)}
                                    disabled={updatingId === template.id}
                                    aria-label="ลบรอบเรียน"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
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
