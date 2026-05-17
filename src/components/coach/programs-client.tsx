'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  FileText,
  Layers3,
  Loader2,
  Plus,
  Send,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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

interface ProgramsClientProps {
  programs: ProgramData[]
  assignedSlots: AssignedProgramSlot[]
}

const STATUS_CONFIG: Record<ProgramStatus, { label: string; color: string; icon: LucideIcon }> = {
  draft: { label: 'แบบร่าง', color: 'bg-gray-100 text-gray-600', icon: FileText },
  submitted: { label: 'ส่งแล้ว', color: 'bg-blue-100 text-blue-700', icon: Clock },
  approved: { label: 'อนุมัติ', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  rejected: { label: 'ไม่อนุมัติ', color: 'bg-red-100 text-red-700', icon: XCircle },
}

const PROGRAM_PRESETS = [
  {
    id: 'beginner-footwork',
    label: 'พื้นฐาน footwork',
    content: 'Warm up 10 นาที\nFootwork หน้า-หลัง 20 นาที\nจับไม้/ท่ายืน/จังหวะตี 20 นาที\nRally เบา 30 นาที\nสรุปและการบ้าน 10 นาที',
  },
  {
    id: 'group-rally',
    label: 'กลุ่ม rally + เกม',
    content: 'Warm up 10 นาที\nRally คุมจังหวะ 30 นาที\nDrill รับ-ส่งลูกตาม Level 30 นาที\nเกมจำลองสถานการณ์ 30 นาที\nCool down และ feedback 10 นาที',
  },
  {
    id: 'private-technique',
    label: 'Private แก้เทคนิค',
    content: 'ประเมินท่าตี 10 นาที\nแก้จุดอ่อนหลัก 30 นาที\nDrill เฉพาะบุคคล 40 นาที\nเล่นแต้มพร้อม feedback 30 นาที\nสรุปเป้าหมายครั้งต่อไป 10 นาที',
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
  return `${formatSlotDate(slot.date)} ${slot.startTime.slice(0, 5)}-${slot.endTime.slice(0, 5)} · ${slot.branchName} · ${slot.courseType}`
}

export function ProgramsClient({ programs, assignedSlots }: ProgramsClientProps) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailProgram, setDetailProgram] = useState<ProgramData | null>(null)
  const [content, setContent] = useState('')
  const [scheduleSlotId, setScheduleSlotId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const reusablePrograms = useMemo(() => {
    return programs
      .filter((program) => program.programContent.trim().length > 0)
      .slice(0, 12)
  }, [programs])

  const resetForm = () => {
    setContent('')
    setScheduleSlotId(assignedSlots[0]?.id || '')
    setError(null)
    setSuccess(null)
  }

  const applyTemplate = (value: string) => {
    const preset = PROGRAM_PRESETS.find((item) => item.id === value)
    if (preset) {
      setContent(preset.content)
      return
    }

    const previousProgram = reusablePrograms.find((program) => program.id === value)
    if (previousProgram) setContent(previousProgram.programContent)
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

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/coach/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleSlotId, programContent: content.trim(), status }),
      })
      const result = await response.json().catch(() => null)

      if (!response.ok) {
        setError(result?.error || 'บันทึกโปรแกรมไม่สำเร็จ')
        return
      }

      setSuccess(status === 'submitted' ? 'ส่งโปรแกรมสำเร็จ' : 'บันทึกแบบร่างสำเร็จ')
      window.setTimeout(() => {
        setAddOpen(false)
        resetForm()
        router.refresh()
      }, 800)
    } catch {
      setError('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#153c85]">โปรแกรมสอน</h1>
          <p className="mt-1 text-sm text-gray-500">เลือกโปรแกรมสำหรับรอบสอนจริง แล้วส่งให้ Super Admin/Admin ตรวจ</p>
        </div>
        <Button
          onClick={() => {
            resetForm()
            setAddOpen(true)
          }}
          className="bg-[#2748bf] hover:bg-[#153c85]"
        >
          <Plus className="mr-2 h-4 w-4" />
          เพิ่มโปรแกรมสอน
        </Button>
      </div>

      {assignedSlots.length === 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-orange-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            ยังไม่มีรอบสอนที่มอบหมายให้คุณ จึงยังเลือกโปรแกรมเข้ารอบสอนไม่ได้
          </CardContent>
        </Card>
      )}

      {programs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <FileText className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ยังไม่มีโปรแกรมสอน</p>
            <p className="mt-1 text-sm">กดปุ่มด้านบนเพื่อเลือก template และผูกกับรอบสอนจริง</p>
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
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 p-0"
                      onClick={() => {
                        setDetailProgram(program)
                        setDetailOpen(true)
                      }}
                    >
                      <Eye className="h-4 w-4 text-gray-400" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={(open) => { if (!loading) setAddOpen(open) }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">เพิ่มโปรแกรมสอน</DialogTitle>
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
              <Select value={scheduleSlotId} onValueChange={setScheduleSlotId}>
                <SelectTrigger><SelectValue placeholder="เลือกรอบที่ต้องการส่งโปรแกรม" /></SelectTrigger>
                <SelectContent>
                  {assignedSlots.map((slot) => (
                    <SelectItem key={slot.id} value={slot.id}>{formatSlot(slot)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {scheduleSlotId && (
                <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  <Layers3 className="mr-1 inline h-3.5 w-3.5" />
                  {(assignedSlots.find((slot) => slot.id === scheduleSlotId)?.groupNames || []).join(', ') || 'กลุ่มที่รับผิดชอบ'}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>เลือก template หรือใช้โปรแกรมเดิม</Label>
              <Select onValueChange={applyTemplate}>
                <SelectTrigger><SelectValue placeholder="เลือกเพื่อเติมรายละเอียดอัตโนมัติ" /></SelectTrigger>
                <SelectContent>
                  {PROGRAM_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>
                  ))}
                  {reusablePrograms.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
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
              <Button variant="outline" className="flex-1" onClick={() => handleSubmit('draft')} disabled={loading}>
                <FileText className="mr-1 h-4 w-4" />
                บันทึกแบบร่าง
              </Button>
              <Button className="flex-1 bg-[#2748bf] hover:bg-[#153c85]" onClick={() => handleSubmit('submitted')} disabled={loading}>
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
              <Button variant="outline" size="sm" onClick={() => {
                setContent(detailProgram.programContent)
                setScheduleSlotId(detailProgram.scheduleSlotId || assignedSlots[0]?.id || '')
                setDetailOpen(false)
                setAddOpen(true)
              }}>
                <Copy className="mr-1 h-4 w-4" />
                ใช้เป็นต้นแบบ
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
