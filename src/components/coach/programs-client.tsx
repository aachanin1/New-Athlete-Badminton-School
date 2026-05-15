'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
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
import { Textarea } from '@/components/ui/textarea'
import type { ProgramStatus } from '@/types/database'

interface ProgramData {
  id: string
  programContent: string
  status: ProgramStatus
  reviewerName: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface ProgramsClientProps {
  programs: ProgramData[]
}

const STATUS_CONFIG: Record<ProgramStatus, { label: string; color: string; icon: LucideIcon }> = {
  draft: { label: 'แบบร่าง', color: 'bg-gray-100 text-gray-600', icon: FileText },
  submitted: { label: 'ส่งแล้ว', color: 'bg-blue-100 text-blue-700', icon: Clock },
  approved: { label: 'อนุมัติ', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  rejected: { label: 'ไม่อนุมัติ', color: 'bg-red-100 text-red-700', icon: XCircle },
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ProgramsClient({ programs }: ProgramsClientProps) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailProgram, setDetailProgram] = useState<ProgramData | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const resetForm = () => {
    setContent('')
    setError(null)
    setSuccess(null)
  }

  const handleSubmit = async (status: 'draft' | 'submitted') => {
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
        body: JSON.stringify({ programContent: content.trim(), status }),
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
          <p className="mt-1 text-sm text-gray-500">เขียนและส่งโปรแกรมสอนให้ผู้ดูแลตรวจสอบ</p>
        </div>
        <Button
          onClick={() => {
            resetForm()
            setAddOpen(true)
          }}
          className="bg-[#2748bf] hover:bg-[#153c85]"
        >
          <Plus className="mr-2 h-4 w-4" />
          เขียนโปรแกรมใหม่
        </Button>
      </div>

      {programs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <FileText className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ยังไม่มีโปรแกรมสอน</p>
            <p className="mt-1 text-sm">กดปุ่มด้านบนเพื่อเริ่มเขียนโปรแกรม</p>
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
                      <div className="mb-1 flex items-center gap-2">
                        <Badge className={`text-[10px] ${config.color}`}>
                          <StatusIcon className="mr-0.5 h-3 w-3" />
                          {config.label}
                        </Badge>
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
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">เขียนโปรแกรมสอน</DialogTitle>
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

            <Textarea
              placeholder={'รายละเอียดโปรแกรมสอนวันนี้...\nเช่น warm up 10 นาที, ฝึก footwork, rally 20 นาที'}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={8}
              className="resize-none"
            />

            <div className="flex gap-2">
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
              <div className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm">{detailProgram.programContent}</div>
              {detailProgram.reviewerName && <p className="text-xs text-gray-500">ตรวจโดย: {detailProgram.reviewerName}</p>}
              {detailProgram.notes && <p className="text-xs text-orange-500">หมายเหตุ: {detailProgram.notes}</p>}
              <p className="text-xs text-gray-400">สร้างเมื่อ: {formatDate(detailProgram.createdAt)}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
