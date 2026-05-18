'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Archive,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  Eye,
  FileText,
  Layers3,
  Library,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Trash2,
  type LucideIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ProgramStatus } from '@/types/database'

interface ProgramData {
  id: string
  scheduleSlotId: string | null
  slotLabel: string | null
  programContent: string
  status: ProgramStatus
  reviewerName: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface AssignedProgramSlot {
  id: string
  date: string
  startTime: string
  endTime: string
  branchName: string
  courseType: string
  groupNames: string[]
}

interface ProgramTemplate {
  id: string
  title: string
  content: string
  category: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface ProgramsClientProps {
  programs: ProgramData[]
  assignedSlots: AssignedProgramSlot[]
  templates: ProgramTemplate[]
}

type ConfirmAction =
  | { type: 'template'; template: ProgramTemplate }
  | { type: 'draft'; program: ProgramData }

const STATUS_CONFIG: Record<ProgramStatus, { label: string; color: string; icon: LucideIcon }> = {
  draft: { label: 'แบบร่าง', color: 'bg-gray-100 text-gray-600', icon: FileText },
  submitted: { label: 'ส่งแล้ว', color: 'bg-blue-100 text-blue-700', icon: Clock },
  approved: { label: 'อนุมัติ', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  rejected: { label: 'ไม่อนุมัติ', color: 'bg-red-100 text-red-700', icon: AlertCircle },
}

const PROGRAM_PRESETS = [
  {
    id: 'draf-phraram2-competition-technique',
    label: 'ดราฟ พระราม 2 - ชุด C แข่งขัน',
    content: `📌 โปรแกรมดราฟ พระราม 2 วันนี้
ชุด C แข่งขัน เป้าหมาย
🎯 โปรแกรมเพิ่มเทคนิค และแก้ไขจุดบกพร่องน้องๆ

🟢 เพิ่มเทคนิค
🔎 เทคนิคหลอกล้องตัดแก้โฟร์ หลอกหน้าไม้
🟢 เอาเทคนิคที่ฝึกไปข้างต้นไปใช้กับโปรแกรมการเคลื่อนตัว
🔎 เซฟตัดไม่มีตบ 2/1 50 ลูก ผลัดกัน 3 ชุด
🟢 เพิ่มลูกบุกให้น้องๆ จะได้มีโอกาสทำคะแนนได้มากขึ้น
🏀 ตบคมๆ 10 ลูกพัก ข้างละ 4 ชุด อีกข้าง
🟢 เอาเทคนิคที่ฝึกไปข้างต้นมาใช้กับการเคลื่อนตัวตบเร็ว
🏀 วิ่งตบคมๆ เร็วๆ 2 มุม 10/8
🏀 วิ่งตบแย็บ 10/8
🟢 เอาเทคนิคไปตีโปรแกรม
🔎 ตบหยอดงัด 10m
🟢 เพิ่มเทคนิคลูกปั่น
🏀 ปั่นอากาศ + ปั่นทีละมุม
🔎 ตบปั่นงัด 10m
🟢 เพิ่มรายละเอียดเล็กน้อยในการเริ่มคะแนน
🔎 ฝึกเสิร์ฟหน้าบล็อก เลือกจุด จุดละ 10 ลูก`,
  },
  {
    id: 'draf-phraram2-set-c-upper-lower',
    label: 'ดราฟ พระราม 2 - ชุด C บน/ล่าง',
    content: `📌 โปรแกรมดราฟ พระราม 2 วันนี้

ชุด C บน / 💥 ล่าง
- เลือกแก้หลัง เข้ามาวาง ทีละคน ทีละมุม 7m
💥 วิ่งเซฟแลนดอม ให้ชำนาญขึ้น คนละ 3 นาที
- เลือกหลังตีทุกเหลี่ยมทีละด้าน 15/5 วนกัน
💥 ขึ้นเลือก เซฟตรงกันตบเฉียง ทีละมุม 20/4
- ซ้ำ 4 มุมหน้า 14-2/4 / ซ้ำ 3 แบบ วิ่งคอร์ดก่อน
- เลือกบุก เลือกบุก เข้ามาแจก เลือกฆ่าเข้ามาซ้ำ วน 20/4 + บุกเร็วๆ 20/4
ตัด ตัด เข้ามาแจกหยอดงัด ตบเข้าแย็บ
- ฝึกเปิดเกม อีกคนฝึกแก้ โค้ชเปิดลูกให้ 15/3
💥 วิ่งแก้โฟร์เซฟ แล้วเข้ากลาง 20/3 + เอาไปใช้จริงเข้ามาแตะกรวย เปลี่ยน แบ็ค
- ตีเกม`,
  },
  {
    id: 'draf-afternoon-adult-scoring',
    label: 'รอบบ่าย 3 - ทีมผู้ใหญ่ ทำแต้ม',
    content: `📁 โปรแกรมดราฟรอบบ่าย 3 วันนี้

👨 ทีมผู้ใหญ่
🎯 สอนลูกทำแต้ม ตบ+ดาด+เลี้ยว และทบทวนของเดิม
✅
ตีพู่ แบบเซฟ 15/2
ยืนเซฟกัน 5m
ตีพู่แบบตบ 15/2 สอนหน้าไม้ สอนตำแหน่งตีหัวลูก
ตีลมตบ 15/2
ยืนตบ 20/3
ตบให้ดราฟรับ 30 ลูก
วิ่งตบทีละมุม 20/3
วิ่งคอร์ดหยอด 2 มุม
ยืนหยอด 20/1
พลิกเลี้ยวไป ลูก 20/3
วิ่งเลี้ยว 2 มุม
วิ่งคอร์ด 3 จังหวะ หลังหน้า เซฟลมเข้ามาเลี้ยว
ดาด
ตบเข้ามาดาด`,
  },
]

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatSlotDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
}

function formatSlot(slot: AssignedProgramSlot) {
  return `${formatSlotDate(slot.date)} ${slot.startTime.slice(0, 5)}-${slot.endTime.slice(0, 5)} • ${slot.branchName} • ${slot.courseType}`
}

function sortTemplates(items: ProgramTemplate[]) {
  return [...items].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
    return b.updatedAt.localeCompare(a.updatedAt)
  })
}

export function ProgramsClient({ programs, assignedSlots, templates }: ProgramsClientProps) {
  const router = useRouter()
  const [templateList, setTemplateList] = useState(() => sortTemplates(templates))
  const [addOpen, setAddOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [detailProgram, setDetailProgram] = useState<ProgramData | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null)
  const [templateTitle, setTemplateTitle] = useState('')
  const [templateCategory, setTemplateCategory] = useState('')
  const [templateContent, setTemplateContent] = useState('')
  const [content, setContent] = useState('')
  const [scheduleSlotId, setScheduleSlotId] = useState('')
  const [loading, setLoading] = useState(false)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null)
  const [deletingProgramId, setDeletingProgramId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [templateSuccess, setTemplateSuccess] = useState<string | null>(null)

  const activeTemplates = useMemo(() => templateList.filter((template) => template.isActive), [templateList])
  const reusablePrograms = useMemo(() => {
    return programs.filter((program) => program.programContent.trim().length > 0).slice(0, 12)
  }, [programs])
  const programBySlotId = useMemo(() => {
    const map = new Map<string, ProgramData>()
    programs.forEach((program) => {
      if (program.scheduleSlotId) map.set(program.scheduleSlotId, program)
    })
    return map
  }, [programs])
  const availableSlotsForNewProgram = useMemo(() => {
    return assignedSlots.filter((slot) => !programBySlotId.has(slot.id))
  }, [assignedSlots, programBySlotId])
  const selectableProgramSlots = editingProgramId ? assignedSlots : availableSlotsForNewProgram
  const selectedProgramForSlot = scheduleSlotId ? programBySlotId.get(scheduleSlotId) : null
  const blockingProgram = selectedProgramForSlot && selectedProgramForSlot.id !== editingProgramId ? selectedProgramForSlot : null
  const cannotSubmitProgram = loading || selectableProgramSlots.length === 0 || Boolean(blockingProgram)
  const confirmBusy = deletingTemplateId !== null || deletingProgramId !== null

  const resetProgramForm = () => {
    setEditingProgramId(null)
    setContent('')
    setScheduleSlotId(availableSlotsForNewProgram[0]?.id || '')
    setError(null)
    setSuccess(null)
  }

  const resetTemplateForm = () => {
    setEditingTemplateId(null)
    setTemplateTitle('')
    setTemplateCategory('')
    setTemplateContent('')
    setTemplateError(null)
    setTemplateSuccess(null)
  }

  const openCreateTemplate = () => {
    resetTemplateForm()
    setTemplateOpen(true)
  }

  const openEditTemplate = (template: ProgramTemplate) => {
    setEditingTemplateId(template.id)
    setTemplateTitle(template.title)
    setTemplateCategory(template.category || '')
    setTemplateContent(template.content)
    setTemplateError(null)
    setTemplateSuccess(null)
    setTemplateOpen(true)
  }

  const openProgramFromTemplate = (template: ProgramTemplate) => {
    resetProgramForm()
    setContent(template.content)
    setAddOpen(true)
  }

  const openEditProgram = (program: ProgramData) => {
    setEditingProgramId(program.id)
    setContent(program.programContent)
    setScheduleSlotId(program.scheduleSlotId || availableSlotsForNewProgram[0]?.id || '')
    setError(null)
    setSuccess(null)
    setAddOpen(true)
  }

  const applyTemplate = (value: string) => {
    const [source, id] = value.split(':')

    if (source === 'template') {
      const template = activeTemplates.find((item) => item.id === id)
      if (template) setContent(template.content)
      return
    }

    if (source === 'preset') {
      const preset = PROGRAM_PRESETS.find((item) => item.id === id)
      if (preset) setContent(preset.content)
      return
    }

    if (source === 'program') {
      const previousProgram = reusablePrograms.find((program) => program.id === id)
      if (previousProgram) setContent(previousProgram.programContent)
    }
  }

  const handleTemplateSave = async () => {
    if (!templateTitle.trim()) {
      setTemplateError('กรุณากรอกชื่อ template')
      return
    }

    if (!templateContent.trim()) {
      setTemplateError('กรุณากรอกเนื้อหาโปรแกรมสอน')
      return
    }

    setTemplateLoading(true)
    setTemplateError(null)
    setTemplateSuccess(null)

    try {
      const response = await fetch('/api/coach/program-templates', {
        method: editingTemplateId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: editingTemplateId || undefined,
          title: templateTitle,
          category: templateCategory,
          content: templateContent,
        }),
      })
      const result = await response.json().catch(() => null)

      if (!response.ok || !result?.template) {
        setTemplateError(result?.error || 'บันทึก template ไม่สำเร็จ')
        return
      }

      const savedTemplate = result.template as ProgramTemplate
      setTemplateList((current) => {
        const next = editingTemplateId
          ? current.map((item) => (item.id === savedTemplate.id ? savedTemplate : item))
          : [savedTemplate, ...current]
        return sortTemplates(next)
      })
      setTemplateSuccess(editingTemplateId ? 'แก้ไข template แล้ว' : 'สร้าง template แล้ว')
      window.setTimeout(() => {
        setTemplateOpen(false)
        resetTemplateForm()
        router.refresh()
      }, 500)
    } catch {
      setTemplateError('เกิดข้อผิดพลาด')
    } finally {
      setTemplateLoading(false)
    }
  }

  const toggleTemplateActive = async (template: ProgramTemplate) => {
    setTemplateLoading(true)
    setTemplateError(null)

    try {
      const response = await fetch('/api/coach/program-templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: template.id, isActive: !template.isActive }),
      })
      const result = await response.json().catch(() => null)

      if (!response.ok || !result?.template) {
        setTemplateError(result?.error || 'เปลี่ยนสถานะ template ไม่สำเร็จ')
        return
      }

      const updatedTemplate = result.template as ProgramTemplate
      setTemplateList((current) => sortTemplates(current.map((item) => (item.id === updatedTemplate.id ? updatedTemplate : item))))
      router.refresh()
    } catch {
      setTemplateError('เกิดข้อผิดพลาด')
    } finally {
      setTemplateLoading(false)
    }
  }

  const handleDeleteTemplate = async (template: ProgramTemplate) => {
    if (deletingTemplateId || templateLoading) return
    setConfirmAction({ type: 'template', template })
  }

  const deleteTemplate = async (template: ProgramTemplate) => {
    setDeletingTemplateId(template.id)
    setTemplateError(null)
    setTemplateSuccess(null)

    try {
      const response = await fetch(`/api/coach/program-templates?id=${template.id}`, { method: 'DELETE' })
      const result = await response.json().catch(() => null)

      if (!response.ok) {
        setTemplateError(result?.error || 'ลบ Template ไม่สำเร็จ')
        return
      }

      setTemplateList((current) => current.filter((item) => item.id !== template.id))
      setTemplateSuccess('ลบ Template แล้ว')
      setConfirmAction(null)
      router.refresh()
    } catch {
      setTemplateError('เกิดข้อผิดพลาด')
    } finally {
      setDeletingTemplateId(null)
    }
  }

  const handleSubmit = async (status: 'draft' | 'submitted') => {
    if (!scheduleSlotId) {
      setError('กรุณาเลือกรอบสอนก่อนบันทึกโปรแกรม')
      return
    }

    if (!content.trim()) {
      setError('กรุณากรอกเนื้อหาโปรแกรม')
      return
    }

    if (blockingProgram) {
      setError('รอบนี้มีโปรแกรมสอนแล้ว กรุณาแก้ไขรายการเดิมแทน')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/coach/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId: editingProgramId || undefined, scheduleSlotId, programContent: content.trim(), status }),
      })
      const result = await response.json().catch(() => null)

      if (!response.ok) {
        setError(result?.error || 'บันทึกโปรแกรมไม่สำเร็จ')
        return
      }

      setSuccess(status === 'submitted' ? 'ส่งโปรแกรมสำเร็จ' : 'บันทึกแบบร่างสำเร็จ')
      window.setTimeout(() => {
        setAddOpen(false)
        resetProgramForm()
        router.refresh()
      }, 800)
    } catch {
      setError('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteDraft = async (program: ProgramData) => {
    if (program.status !== 'draft' || deletingProgramId) return
    setConfirmAction({ type: 'draft', program })
  }

  const deleteDraft = async (program: ProgramData) => {
    setDeletingProgramId(program.id)
    setError(null)

    try {
      const response = await fetch(`/api/coach/programs?id=${program.id}`, { method: 'DELETE' })
      const result = await response.json().catch(() => null)

      if (!response.ok) {
        setError(result?.error || 'ลบฉบับร่างไม่สำเร็จ')
        return
      }

      setConfirmAction(null)
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด')
    } finally {
      setDeletingProgramId(null)
    }
  }

  const executeConfirmAction = async () => {
    if (!confirmAction) return

    if (confirmAction.type === 'template') {
      await deleteTemplate(confirmAction.template)
      return
    }

    await deleteDraft(confirmAction.program)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-[#2748bf]">
            <BookOpen className="h-4 w-4" />
            Teaching Programs
          </p>
          <h1 className="text-2xl font-bold text-[#153c85]">โปรแกรมสอน</h1>
          <p className="mt-1 text-sm text-gray-500">
            สร้างคลัง template ของตัวเอง แล้วเลือกใช้กับรอบสอนจริงเพื่อส่งให้ Super Admin/Admin ตรวจ
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={openCreateTemplate}>
            <Library className="mr-2 h-4 w-4" />
            สร้าง Template
          </Button>
          <Button
            onClick={() => {
              resetProgramForm()
              setAddOpen(true)
            }}
            className="bg-[#2748bf] hover:bg-[#153c85]"
          >
            <Plus className="mr-2 h-4 w-4" />
            ส่งโปรแกรมรอบสอน
          </Button>
        </div>
      </div>

      {templateError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {templateError}
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-[#153c85]">
                <Library className="h-5 w-5 text-[#2748bf]" />
                คลัง Template ของฉัน
              </h2>
              <p className="text-sm text-gray-500">เก็บชุดโปรแกรมที่ใช้บ่อย แก้ได้ และนำไปใช้กับรอบสอนจริงได้ทันที</p>
            </div>
            <Badge variant="outline">{activeTemplates.length} ใช้งานอยู่</Badge>
          </div>

          {templateList.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-gray-400">
              <Library className="mx-auto mb-3 h-10 w-10 opacity-40" />
              <p className="font-medium">ยังไม่มี template ส่วนตัว</p>
              <p className="mt-1 text-sm">เริ่มจากสร้าง template หรือใช้ตัวอย่างโปรแกรมตอนส่งโปรแกรมรอบสอนก่อนก็ได้</p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {templateList.map((template) => (
                <div
                  key={template.id}
                  className={`rounded-lg border p-4 ${template.isActive ? 'bg-white' : 'bg-gray-50 opacity-75'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-[#153c85]">{template.title}</h3>
                        <Badge className={template.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                          {template.isActive ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
                        </Badge>
                        {template.category && <Badge variant="outline">{template.category}</Badge>}
                      </div>
                      <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-gray-600">{template.content}</p>
                      <p className="mt-2 text-xs text-gray-400">อัปเดต {formatDate(template.updatedAt)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => openProgramFromTemplate(template)} disabled={!template.isActive || assignedSlots.length === 0}>
                      <Send className="mr-1 h-4 w-4" />
                      ใช้กับรอบสอน
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEditTemplate(template)}>
                      <Edit3 className="mr-1 h-4 w-4" />
                      แก้ไข
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleTemplateActive(template)} disabled={templateLoading}>
                      <Archive className="mr-1 h-4 w-4" />
                      {template.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => handleDeleteTemplate(template)}
                      disabled={deletingTemplateId === template.id || templateLoading}
                    >
                      {deletingTemplateId === template.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
                      ลบ
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {assignedSlots.length === 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-orange-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            ยังไม่มีรอบสอนที่มอบหมายให้คุณ จึงยังเลือกโปรแกรมเข้ารอบสอนจริงไม่ได้
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-lg font-bold text-[#153c85]">โปรแกรมรอบสอนของฉัน</h2>
        {programs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-400">
              <FileText className="mx-auto mb-3 h-12 w-12 opacity-40" />
              <p className="font-medium">ยังไม่มีโปรแกรมสอนที่ส่งเข้ารอบจริง</p>
              <p className="mt-1 text-sm">เลือก template หรือตัวอย่างโปรแกรม แล้วผูกกับรอบสอนที่ได้รับมอบหมาย</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {programs.map((program) => {
              const config = STATUS_CONFIG[program.status]
              const StatusIcon = config.icon

              return (
                <Card key={program.id} className="transition-shadow hover:shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Badge className={`text-[10px] ${config.color}`}>
                            <StatusIcon className="mr-0.5 h-3 w-3" />
                            {config.label}
                          </Badge>
                          {program.slotLabel && (
                            <Badge variant="outline" className="bg-white text-[10px] text-gray-600">
                              <CalendarCheck className="mr-1 h-3 w-3" />
                              {program.slotLabel}
                            </Badge>
                          )}
                          <span className="text-[11px] text-gray-400">{formatDate(program.createdAt)}</span>
                        </div>
                        <p className="line-clamp-2 whitespace-pre-wrap text-sm text-gray-700">{program.programContent}</p>
                        {program.notes && <p className="mt-1 text-xs text-orange-500">หมายเหตุ: {program.notes}</p>}
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        {program.status === 'draft' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => openEditProgram(program)}>
                              <Edit3 className="mr-1 h-4 w-4" />
                              แก้ไข
                            </Button>
                            <Button size="sm" className="bg-[#2748bf] hover:bg-[#153c85]" onClick={() => openEditProgram(program)}>
                              <Send className="mr-1 h-4 w-4" />
                              ตรวจแล้วส่ง
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => handleDeleteDraft(program)}
                              disabled={deletingProgramId === program.id}
                            >
                              {deletingProgramId === program.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
                              ลบ
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setDetailProgram(program)
                            setDetailOpen(true)
                          }}
                        >
                          <Eye className="h-4 w-4 text-gray-400" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={templateOpen} onOpenChange={(open) => { if (!templateLoading) setTemplateOpen(open) }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">{editingTemplateId ? 'แก้ไข Template' : 'สร้าง Template โปรแกรมสอน'}</DialogTitle>
            <DialogDescription>Template จะถูกเก็บไว้ใช้ซ้ำในบัญชีโค้ชของคุณ ไม่ใช่การส่งโปรแกรมเข้ารอบสอนทันที</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {templateError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {templateError}
              </div>
            )}
            {templateSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {templateSuccess}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <div className="space-y-2">
                <Label>ชื่อ Template</Label>
                <Input value={templateTitle} onChange={(event) => setTemplateTitle(event.target.value)} placeholder="เช่น Beginner footwork / Private smash correction" maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label>หมวดหมู่</Label>
                <Input value={templateCategory} onChange={(event) => setTemplateCategory(event.target.value)} placeholder="เช่น Footwork" maxLength={60} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>รายละเอียดโปรแกรม</Label>
              <Textarea
                value={templateContent}
                onChange={(event) => setTemplateContent(event.target.value)}
                placeholder={'เช่น\nWarm up 10 นาที\nฝึก footwork 20 นาที\nRally 20 นาที\nสรุป feedback 10 นาที'}
                rows={10}
                className="resize-none"
              />
            </div>

            <Button className="w-full bg-[#2748bf] hover:bg-[#153c85]" onClick={handleTemplateSave} disabled={templateLoading}>
              {templateLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
              {editingTemplateId ? 'บันทึกการแก้ไข' : 'สร้าง Template'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={(open) => {
        if (loading) return
        setAddOpen(open)
        if (!open) resetProgramForm()
      }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">{editingProgramId ? 'แก้ไขฉบับร่างโปรแกรมสอน' : 'ส่งโปรแกรมรอบสอนจริง'}</DialogTitle>
            <DialogDescription>เลือก template หรือตัวอย่างโปรแกรม แล้วปรับรายละเอียดให้ตรงกับรอบสอนที่ได้รับมอบหมาย</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {success}
              </div>
            )}

            <div className="space-y-2">
              <Label>เลือกรอบสอนของฉัน</Label>
              <Select value={scheduleSlotId} onValueChange={setScheduleSlotId} disabled={selectableProgramSlots.length === 0}>
                <SelectTrigger><SelectValue placeholder="เลือกรอบที่ต้องการส่งโปรแกรม" /></SelectTrigger>
                <SelectContent>
                  {selectableProgramSlots.map((slot) => (
                    <SelectItem key={slot.id} value={slot.id}>{formatSlot(slot)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!editingProgramId && availableSlotsForNewProgram.length === 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  ทุกรอบที่ได้รับมอบหมายมีโปรแกรมสอนแล้ว ถ้าต้องการปรับแก้ให้กดแก้ไขรายการเดิมด้านล่าง
                </div>
              )}
              {blockingProgram && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  รอบนี้มีโปรแกรมสอนแล้ว ไม่สามารถส่งซ้ำได้
                </div>
              )}
              {scheduleSlotId && (
                <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  <Layers3 className="mr-1 inline h-3.5 w-3.5" />
                  {(assignedSlots.find((slot) => slot.id === scheduleSlotId)?.groupNames || []).join(', ') || 'กลุ่มที่รับผิดชอบ'}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>เลือก Template / ตัวอย่างโปรแกรม / โปรแกรมเดิม</Label>
              <Select onValueChange={applyTemplate}>
                <SelectTrigger><SelectValue placeholder="เลือกเพื่อเติมรายละเอียดอัตโนมัติ" /></SelectTrigger>
                <SelectContent>
                  {activeTemplates.map((template) => (
                    <SelectItem key={template.id} value={`template:${template.id}`}>
                      Template: {template.title}
                    </SelectItem>
                  ))}
                  {PROGRAM_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={`preset:${preset.id}`}>
                      ตัวอย่างโปรแกรม: {preset.label}
                    </SelectItem>
                  ))}
                  {reusablePrograms.map((program) => (
                    <SelectItem key={program.id} value={`program:${program.id}`}>
                      ใช้ของเดิม: {program.slotLabel || formatDate(program.createdAt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Textarea
              placeholder={'รายละเอียดโปรแกรมสอน...\nเช่น warm up 10 นาที, ฝึก footwork, rally 20 นาที'}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={9}
              className="resize-none"
            />

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="flex-1" onClick={() => handleSubmit('draft')} disabled={cannotSubmitProgram}>
                <FileText className="mr-1 h-4 w-4" />
                บันทึกแบบร่าง
              </Button>
              <Button className="flex-1 bg-[#2748bf] hover:bg-[#153c85]" onClick={() => handleSubmit('submitted')} disabled={cannotSubmitProgram}>
                {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
                ส่งโปรแกรม
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">รายละเอียดโปรแกรม</DialogTitle>
            <DialogDescription>สถานะและเนื้อหาโปรแกรมที่เคยส่งเข้ารอบสอนจริง</DialogDescription>
          </DialogHeader>
          {detailProgram && (
            <div className="space-y-3">
              <Badge className={STATUS_CONFIG[detailProgram.status].color}>{STATUS_CONFIG[detailProgram.status].label}</Badge>
              {detailProgram.slotLabel && (
                <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">{detailProgram.slotLabel}</div>
              )}
              <div className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm">{detailProgram.programContent}</div>
              {detailProgram.reviewerName && <p className="text-xs text-gray-500">ตรวจโดย: {detailProgram.reviewerName}</p>}
              {detailProgram.notes && <p className="text-xs text-orange-500">หมายเหตุ: {detailProgram.notes}</p>}
              <p className="text-xs text-gray-400">สร้างเมื่อ: {formatDate(detailProgram.createdAt)}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  resetProgramForm()
                  setContent(detailProgram.programContent)
                  setScheduleSlotId(availableSlotsForNewProgram[0]?.id || '')
                  setDetailOpen(false)
                  setAddOpen(true)
                }}>
                  <Copy className="mr-1 h-4 w-4" />
                  ใช้กับรอบใหม่
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  resetTemplateForm()
                  setTemplateTitle(detailProgram.slotLabel ? `จากรอบ ${detailProgram.slotLabel}` : 'Template จากโปรแกรมเดิม')
                  setTemplateContent(detailProgram.programContent)
                  setDetailOpen(false)
                  setTemplateOpen(true)
                }}>
                  <Sparkles className="mr-1 h-4 w-4" />
                  เก็บเป็น Template
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(confirmAction)} onOpenChange={(open) => {
        if (!open && !confirmBusy) setConfirmAction(null)
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#153c85]">
              {confirmAction?.type === 'template' ? 'ลบ Template นี้?' : 'ลบฉบับร่างนี้?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'template'
                ? `Template "${confirmAction.template.title}" จะถูกลบออกจากคลังของคุณ แต่จะไม่กระทบโปรแกรมรอบสอนที่เคยส่งไปแล้ว`
                : 'ฉบับร่างนี้จะถูกลบออกจากรายการโปรแกรมรอบสอนของคุณ และไม่สามารถย้อนกลับได้'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmBusy}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={confirmBusy}
              onClick={(event) => {
                event.preventDefault()
                void executeConfirmAction()
              }}
            >
              {confirmBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
