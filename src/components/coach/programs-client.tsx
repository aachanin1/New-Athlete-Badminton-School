'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  FileText, Plus, Clock, CheckCircle2, XCircle, AlertCircle, Loader2, Eye, Send,
} from 'lucide-react'

interface ProgramData {
  id: string
  programContent: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  reviewerName: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface ProgramsClientProps {
  programs: ProgramData[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: 'แบบร่าง', color: 'bg-gray-100 text-gray-600', icon: FileText },
  submitted: { label: 'ส่งแล้ว', color: 'bg-blue-100 text-blue-700', icon: Clock },
  approved: { label: 'อนุมัติ', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  rejected: { label: 'ไม่อนุมัติ', color: 'bg-red-100 text-red-700', icon: XCircle },
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

  const handleSubmit = async (status: 'draft' | 'submitted') => {
    if (!content.trim()) { setError('กรุณากรอกเนื้อหาโปรแกรม'); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/coach/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programContent: content.trim(), status }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error); setLoading(false); return }

      setSuccess(status === 'submitted' ? 'ส่งโปรแกรมสำเร็จ!' : 'บันทึกแบบร่างสำเร็จ!')
      setLoading(false)
      setTimeout(() => { setAddOpen(false); setContent(''); setError(null); setSuccess(null); router.refresh() }, 1200)
    } catch {
      setError('เกิดข้อผิดพลาด')
      setLoading(false)
    }
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#153c85]">โปรแกรมสอน</h1>
          <p className="text-gray-500 text-sm mt-1">เขียนและส่งโปรแกรมสอนรายวัน</p>
        </div>
        <Button onClick={() => { setContent(''); setError(null); setSuccess(null); setAddOpen(true) }} className="bg-[#2748bf] hover:bg-[#153c85]">
          <Plus className="h-4 w-4 mr-2" />เขียนโปรแกรมใหม่
        </Button>
      </div>

      {programs.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">ยังไม่มีโปรแกรมสอน</p>
          <p className="text-sm mt-1">กดปุ่มด้านบนเพื่อเริ่มเขียนโปรแกรม</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {programs.map((prog) => {
            const cfg = STATUS_CONFIG[prog.status]
            const StatusIcon = cfg.icon
            return (
              <Card key={prog.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`text-[10px] ${cfg.color}`}><StatusIcon className="h-3 w-3 mr-0.5" />{cfg.label}</Badge>
                        <span className="text-[11px] text-gray-400">{formatDate(prog.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2 whitespace-pre-wrap">{prog.programContent}</p>
                      {prog.notes && <p className="text-xs text-orange-500 mt-1">หมายเหตุ: {prog.notes}</p>}
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => { setDetailProgram(prog); setDetailOpen(true) }}>
                      <Eye className="h-4 w-4 text-gray-400" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add Program Dialog */}
      <Dialog open={addOpen} onOpenChange={(v) => { if (!loading) setAddOpen(v) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">เขียนโปรแกรมสอน</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
            {success && <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" />{success}</div>}

            <Textarea
              placeholder="รายละเอียดโปรแกรมสอนวันนี้...&#10;เช่น: warm up 10 นาที, ฝึก footwork, rally 20 นาที"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="resize-none"
            />

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => handleSubmit('draft')} disabled={loading}>
                <FileText className="h-4 w-4 mr-1" />บันทึกแบบร่าง
              </Button>
              <Button className="flex-1 bg-[#2748bf] hover:bg-[#153c85]" onClick={() => handleSubmit('submitted')} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                ส่งโปรแกรม
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">รายละเอียดโปรแกรม</DialogTitle>
          </DialogHeader>
          {detailProgram && (
            <div className="space-y-3">
              <Badge className={`${STATUS_CONFIG[detailProgram.status].color}`}>{STATUS_CONFIG[detailProgram.status].label}</Badge>
              <div className="p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap">{detailProgram.programContent}</div>
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
