'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Search, MessageSquareWarning, AlertCircle, CheckCircle2, Clock, Loader2, User, Building2, Eye,
} from 'lucide-react'

interface ComplaintData {
  id: string
  user_id: string
  branch_id: string
  subject: string
  message: string
  status: 'open' | 'in_progress' | 'resolved'
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  user_name: string
  user_email: string
  branch_name: string
  resolved_by_name: string | null
}

interface ComplaintsClientProps {
  complaints: ComplaintData[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: 'เปิด', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  in_progress: { label: 'กำลังดำเนินการ', color: 'bg-yellow-100 text-yellow-700', icon: Loader2 },
  resolved: { label: 'แก้ไขแล้ว', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
}

export function ComplaintsClient({ complaints }: ComplaintsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailComplaint, setDetailComplaint] = useState<ComplaintData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return complaints.filter((c) => {
      if (filterStatus !== 'all' && c.status !== filterStatus) return false
      if (!search) return true
      const q = search.toLowerCase()
      return c.subject.toLowerCase().includes(q) || c.user_name.toLowerCase().includes(q) || c.branch_name.toLowerCase().includes(q)
    })
  }, [complaints, search, filterStatus])

  const stats = useMemo(() => ({
    total: complaints.length,
    open: complaints.filter((c) => c.status === 'open').length,
    inProgress: complaints.filter((c) => c.status === 'in_progress').length,
    resolved: complaints.filter((c) => c.status === 'resolved').length,
  }), [complaints])

  const formatDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })

  const updateStatus = async (complaint: ComplaintData, newStatus: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/complaints', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complaintId: complaint.id, status: newStatus }),
      })

      const result = await res.json().catch(() => null)
      if (!res.ok) {
        setError(result?.error || 'อัปเดตสถานะไม่สำเร็จ')
        setLoading(false)
        return
      }

      setLoading(false)
      setDetailOpen(false)
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">เรื่องร้องเรียน</h1>
        <p className="text-gray-500 text-sm mt-1">ดูและจัดการเรื่องร้องเรียนจากผู้ใช้</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-[#2748bf]">{stats.total}</p><p className="text-xs text-gray-500">ทั้งหมด</p>
        </CardContent></Card>
        <Card className={stats.open > 0 ? 'ring-2 ring-red-400' : ''}><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.open}</p><p className="text-xs text-gray-500">เปิด</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p><p className="text-xs text-gray-500">กำลังดำเนินการ</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.resolved}</p><p className="text-xs text-gray-500">แก้ไขแล้ว</p>
        </CardContent></Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="ค้นหาหัวข้อ, ชื่อผู้ใช้, สาขา..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสถานะ</SelectItem>
            <SelectItem value="open">เปิด</SelectItem>
            <SelectItem value="in_progress">กำลังดำเนินการ</SelectItem>
            <SelectItem value="resolved">แก้ไขแล้ว</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Complaint list */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">
          <MessageSquareWarning className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">{search || filterStatus !== 'all' ? 'ไม่พบเรื่องร้องเรียน' : 'ยังไม่มีเรื่องร้องเรียน'}</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((complaint) => {
            const statusCfg = STATUS_CONFIG[complaint.status]
            const StatusIcon = statusCfg.icon
            return (
              <Card key={complaint.id} className={`overflow-hidden ${complaint.status === 'open' ? 'border-red-200' : ''}`}>
                <CardContent className="p-0">
                  <div className="flex items-start gap-3 p-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${complaint.status === 'open' ? 'bg-red-100' : complaint.status === 'in_progress' ? 'bg-yellow-100' : 'bg-green-100'}`}>
                      <StatusIcon className={`h-5 w-5 ${complaint.status === 'open' ? 'text-red-600' : complaint.status === 'in_progress' ? 'text-yellow-600' : 'text-green-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{complaint.subject}</p>
                        <Badge className={`text-[10px] ${statusCfg.color}`}>{statusCfg.label}</Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{complaint.message}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400 flex-wrap">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{complaint.user_name}</span>
                        <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{complaint.branch_name}</span>
                        <span>{formatDate(complaint.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {complaint.status === 'open' && (
                        <Button size="sm" variant="outline" className="h-8 text-yellow-600 border-yellow-200" onClick={() => updateStatus(complaint, 'in_progress')} disabled={loading}>
                          รับเรื่อง
                        </Button>
                      )}
                      {complaint.status === 'in_progress' && (
                        <Button size="sm" variant="outline" className="h-8 text-green-600 border-green-200" onClick={() => updateStatus(complaint, 'resolved')} disabled={loading}>
                          แก้ไขแล้ว
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setDetailComplaint(complaint); setDetailOpen(true) }}>
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

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">รายละเอียดเรื่องร้องเรียน</DialogTitle>
          </DialogHeader>
          {detailComplaint && (
            <div className="space-y-4">
              {(() => {
                const cfg = STATUS_CONFIG[detailComplaint.status]
                const Icon = cfg.icon
                return (
                  <div className={`p-3 rounded-lg flex items-center gap-2 ${cfg.color}`}>
                    <Icon className="h-5 w-5" /><span className="font-medium">{cfg.label}</span>
                  </div>
                )
              })()}

              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2"><User className="h-4 w-4 text-gray-400" /><span className="font-medium">{detailComplaint.user_name}</span></div>
                <p className="text-sm text-gray-500 ml-6">{detailComplaint.user_email}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <p className="text-gray-400 text-xs">สาขา</p>
                  <p className="font-medium">{detailComplaint.branch_name}</p>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <p className="text-gray-400 text-xs">วันที่แจ้ง</p>
                  <p className="font-medium">{formatDate(detailComplaint.created_at)}</p>
                </div>
              </div>

              <div>
                <p className="font-bold text-sm mb-1">{detailComplaint.subject}</p>
                <div className="p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap">{detailComplaint.message}</div>
              </div>

              {detailComplaint.resolved_by_name && (
                <p className="text-xs text-gray-400">
                  แก้ไขโดย: {detailComplaint.resolved_by_name} • {detailComplaint.resolved_at ? formatDate(detailComplaint.resolved_at) : ''}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                {detailComplaint.status === 'open' && (
                  <Button className="flex-1 bg-yellow-500 hover:bg-yellow-600" onClick={() => updateStatus(detailComplaint, 'in_progress')} disabled={loading}>
                    รับเรื่อง (กำลังดำเนินการ)
                  </Button>
                )}
                {detailComplaint.status === 'in_progress' && (
                  <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => updateStatus(detailComplaint, 'resolved')} disabled={loading}>
                    แก้ไขเสร็จแล้ว
                  </Button>
                )}
                {detailComplaint.status === 'resolved' && (
                  <Button variant="outline" className="flex-1" onClick={() => updateStatus(detailComplaint, 'open')} disabled={loading}>
                    เปิดใหม่
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
