'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MessageSquareWarning,
  Plus,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
} from 'lucide-react'

interface ComplaintRow {
  id: string
  user_id: string
  branch_id: string
  subject: string
  message: string
  status: string
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  branches?: { name: string } | null
}

interface BranchOption {
  id: string
  name: string
}

interface ComplaintClientProps {
  complaints: ComplaintRow[]
  branches: BranchOption[]
  userId: string
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: 'เปิด', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  in_progress: { label: 'กำลังดำเนินการ', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  resolved: { label: 'แก้ไขแล้ว', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
}

export function ComplaintClient({ complaints, branches, userId }: ComplaintClientProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [branchId, setBranchId] = useState('')

  const resetForm = () => {
    setSubject('')
    setMessage('')
    setBranchId('')
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim() || !branchId) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน')
      return
    }

    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { error: err } = await (supabase.from('complaints') as any).insert({
      user_id: userId,
      branch_id: branchId,
      subject: subject.trim(),
      message: message.trim(),
      status: 'open',
    })

    if (err) {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
      setLoading(false)
      return
    }

    setDialogOpen(false)
    resetForm()
    setLoading(false)
    router.refresh()
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setDialogOpen(true) }} className="bg-[#2748bf] hover:bg-[#153c85]">
          <Plus className="h-4 w-4 mr-2" />
          แจ้งร้องเรียน
        </Button>
      </div>

      {complaints.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="text-center text-gray-400">
              <MessageSquareWarning className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">ยังไม่มีข้อร้องเรียน</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => {
            const status = STATUS_MAP[c.status] || STATUS_MAP.open
            const StatusIcon = status.icon
            return (
              <Card key={c.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={status.color}>{status.label}</Badge>
                        <span className="text-xs text-gray-400">
                          {new Date(c.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-900">{c.subject}</h3>
                      <p className="text-sm text-gray-600 mt-1">{c.message}</p>
                      {c.branches && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                          <MapPin className="h-3 w-3" />
                          <span>{c.branches.name}</span>
                        </div>
                      )}
                    </div>
                    <StatusIcon className={`h-5 w-5 shrink-0 ${
                      c.status === 'resolved' ? 'text-green-500' : c.status === 'in_progress' ? 'text-yellow-500' : 'text-red-500'
                    }`} />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) resetForm(); setDialogOpen(v) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">แจ้งร้องเรียน</DialogTitle>
            <DialogDescription>กรุณากรอกรายละเอียดปัญหาของคุณ</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-200">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label>สาขา *</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกสาขา" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="complaint-subject">หัวข้อ *</Label>
              <Input
                id="complaint-subject"
                placeholder="หัวข้อปัญหา"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="complaint-message">รายละเอียด *</Label>
              <Textarea
                id="complaint-message"
                placeholder="อธิบายปัญหาของคุณ..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => { resetForm(); setDialogOpen(false) }}
                disabled={loading}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[#2748bf] hover:bg-[#153c85]"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังส่ง...
                  </>
                ) : 'ส่งร้องเรียน'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
