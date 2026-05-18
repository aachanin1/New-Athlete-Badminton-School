'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  MessageSquareWarning,
  Search,
  User,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ListPagination } from '@/components/admin/list-pagination'

type ComplaintStatus = 'open' | 'in_progress' | 'resolved'

interface ComplaintData {
  id: string
  user_id: string
  branch_id: string
  subject: string
  message: string
  status: ComplaintStatus
  resolved_by: string | null
  resolved_at: string | null
  admin_note: string | null
  last_updated_by: string | null
  updated_at: string
  created_at: string
  user_name: string
  user_email: string
  branch_name: string
  resolved_by_name: string | null
  last_updated_by_name: string | null
}

interface ComplaintsClientProps {
  complaints: ComplaintData[]
}

const STATUS_CONFIG: Record<ComplaintStatus, { label: string; badge: string; icon: LucideIcon; tone: string }> = {
  open: {
    label: 'เปิดเคส',
    badge: 'bg-red-100 text-red-700 hover:bg-red-100',
    icon: AlertCircle,
    tone: 'border-red-200 bg-red-50/30',
  },
  in_progress: {
    label: 'กำลังดำเนินการ',
    badge: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
    icon: Clock,
    tone: 'border-amber-200 bg-amber-50/30',
  },
  resolved: {
    label: 'ปิดเคสแล้ว',
    badge: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
    icon: CheckCircle2,
    tone: 'border-emerald-200 bg-emerald-50/30',
  },
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ComplaintsClient({ complaints }: ComplaintsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [detailComplaint, setDetailComplaint] = useState<ComplaintData | null>(null)
  const [formStatus, setFormStatus] = useState<ComplaintStatus>('open')
  const [adminNote, setAdminNote] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()

    return complaints.filter((complaint) => {
      if (filterStatus !== 'all' && complaint.status !== filterStatus) return false
      if (!query) return true

      return [
        complaint.subject,
        complaint.message,
        complaint.user_name,
        complaint.user_email,
        complaint.branch_name,
        complaint.admin_note || '',
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [complaints, filterStatus, search])

  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)))
  const pagedComplaints = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const stats = useMemo(() => ({
    total: complaints.length,
    open: complaints.filter((complaint) => complaint.status === 'open').length,
    inProgress: complaints.filter((complaint) => complaint.status === 'in_progress').length,
    resolved: complaints.filter((complaint) => complaint.status === 'resolved').length,
  }), [complaints])

  const openDetail = (complaint: ComplaintData) => {
    setDetailComplaint(complaint)
    setFormStatus(complaint.status)
    setAdminNote(complaint.admin_note || '')
    setError(null)
  }

  const updateComplaint = async (
    complaint: ComplaintData,
    status: ComplaintStatus,
    note = complaint.admin_note || ''
  ) => {
    setSavingId(complaint.id)
    setError(null)

    try {
      const response = await fetch('/api/admin/complaints', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complaintId: complaint.id,
          status,
          adminNote: note,
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'อัปเดตเรื่องร้องเรียนไม่สำเร็จ')

      setDetailComplaint(null)
      router.refresh()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'อัปเดตเรื่องร้องเรียนไม่สำเร็จ')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#2748bf]">
            <MessageSquareWarning className="h-4 w-4" />
            Complaint Desk
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">ร้องเรียน</h1>
          <p className="mt-1 text-sm text-gray-500">
            ติดตามเรื่องร้องเรียนจากผู้ปกครองและผู้เรียน พร้อมบันทึกผลการดำเนินการของแอดมิน
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <Card className="border-gray-200">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs text-gray-500">ทั้งหมด</p>
            <p className="mt-1 text-xl font-bold text-[#2748bf] sm:text-2xl">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className={stats.open > 0 ? 'border-red-300 bg-red-50/30' : 'border-gray-200'}>
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs text-gray-500">เปิดเคส</p>
            <p className="mt-1 text-xl font-bold text-red-600 sm:text-2xl">{stats.open}</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs text-gray-500">กำลังดำเนินการ</p>
            <p className="mt-1 text-xl font-bold text-amber-600 sm:text-2xl">{stats.inProgress}</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs text-gray-500">ปิดเคสแล้ว</p>
            <p className="mt-1 text-xl font-bold text-emerald-600 sm:text-2xl">{stats.resolved}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200">
        <CardContent className="p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_auto] lg:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="ค้นหาหัวข้อ รายละเอียด ผู้แจ้ง สาขา หรือบันทึกแอดมิน..."
                className="pl-10"
              />
            </div>
            <Select
              value={filterStatus}
              onValueChange={(value) => {
                setFilterStatus(value)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="ทุกสถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                <SelectItem value="open">เปิดเคส</SelectItem>
                <SelectItem value="in_progress">กำลังดำเนินการ</SelectItem>
                <SelectItem value="resolved">ปิดเคสแล้ว</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500 lg:text-right">{filtered.length} รายการ</p>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card className="border-gray-200">
          <CardContent className="flex min-h-[22rem] flex-col items-center justify-center text-center text-sm text-gray-400">
            <MessageSquareWarning className="mb-3 h-10 w-10 opacity-40" />
            <p className="font-medium">ไม่พบเรื่องร้องเรียน</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border-gray-200">
          <CardContent className="p-0">
            <div className="hidden grid-cols-[minmax(260px,1.3fr)_180px_160px_170px] border-b bg-gray-50 px-4 py-3 text-xs font-medium text-gray-500 2xl:grid">
              <span>เรื่องร้องเรียน</span>
              <span>ผู้แจ้ง/สาขา</span>
              <span>สถานะ</span>
              <span className="text-right">จัดการ</span>
            </div>

            <div className="divide-y">
              {pagedComplaints.map((complaint) => {
                const status = STATUS_CONFIG[complaint.status]
                const StatusIcon = status.icon

                return (
                  <div key={complaint.id} className={`grid gap-3 px-4 py-4 2xl:grid-cols-[minmax(260px,1.3fr)_180px_160px_170px] 2xl:items-center ${complaint.status === 'open' ? 'bg-red-50/20' : 'bg-white'}`}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#153c85]">{complaint.subject}</p>
                        <Badge className={status.badge}>{status.label}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-gray-500">{complaint.message}</p>
                      {complaint.admin_note && (
                        <p className="mt-2 line-clamp-1 text-xs text-amber-700">
                          บันทึกแอดมิน: {complaint.admin_note}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1 text-xs text-gray-500">
                      <p className="flex items-center gap-1 font-medium text-gray-700">
                        <User className="h-3.5 w-3.5" />
                        {complaint.user_name}
                      </p>
                      <p className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {complaint.branch_name}
                      </p>
                      <p>{formatDate(complaint.created_at)}</p>
                    </div>

                    <div className={`flex items-center gap-2 rounded-md border px-2 py-2 text-xs ${status.tone}`}>
                      <StatusIcon className="h-4 w-4" />
                      <span className="font-medium">{status.label}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      {complaint.status === 'open' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-amber-200 text-amber-700 hover:bg-amber-50"
                          onClick={() => updateComplaint(complaint, 'in_progress')}
                          disabled={savingId === complaint.id}
                        >
                          {savingId === complaint.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                          รับเรื่อง
                        </Button>
                      )}
                      {complaint.status === 'in_progress' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => updateComplaint(complaint, 'resolved')}
                          disabled={savingId === complaint.id}
                        >
                          {savingId === complaint.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                          ปิดเคส
                        </Button>
                      )}
                      <Button type="button" size="sm" variant="outline" onClick={() => openDetail(complaint)}>
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        รายละเอียด
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
            <ListPagination
              page={safePage}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize)
                setPage(1)
              }}
            />
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(detailComplaint)} onOpenChange={(open) => !open && setDetailComplaint(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">รายละเอียดเรื่องร้องเรียน</DialogTitle>
          </DialogHeader>

          {detailComplaint && (
            <div className="space-y-4">
              <div className={`rounded-lg border p-3 ${STATUS_CONFIG[detailComplaint.status].tone}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={STATUS_CONFIG[detailComplaint.status].badge}>
                    {STATUS_CONFIG[detailComplaint.status].label}
                  </Badge>
                  <span className="text-xs text-gray-500">แจ้งเมื่อ {formatDate(detailComplaint.created_at)}</span>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-bold text-[#153c85]">{detailComplaint.subject}</h2>
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                  {detailComplaint.message}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-gray-50 p-3 text-sm">
                  <p className="text-xs text-gray-400">ผู้แจ้ง</p>
                  <p className="mt-1 font-semibold text-gray-900">{detailComplaint.user_name}</p>
                  <p className="text-gray-500">{detailComplaint.user_email || '-'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 text-sm">
                  <p className="text-xs text-gray-400">สาขา</p>
                  <p className="mt-1 font-semibold text-gray-900">{detailComplaint.branch_name}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>สถานะ</Label>
                  <Select value={formStatus} onValueChange={(value) => setFormStatus(value as ComplaintStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">เปิดเคส</SelectItem>
                      <SelectItem value="in_progress">กำลังดำเนินการ</SelectItem>
                      <SelectItem value="resolved">ปิดเคสแล้ว</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
                  <p>อัปเดตล่าสุด: {formatDate(detailComplaint.updated_at || detailComplaint.created_at)}</p>
                  <p>โดย: {detailComplaint.last_updated_by_name || '-'}</p>
                  {detailComplaint.resolved_by_name && (
                    <p>ปิดเคสโดย: {detailComplaint.resolved_by_name} {detailComplaint.resolved_at ? `• ${formatDate(detailComplaint.resolved_at)}` : ''}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-note">บันทึกผลการติดตาม</Label>
                <Textarea
                  id="admin-note"
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                  placeholder="เช่น โทรกลับผู้ปกครองแล้ว / แจ้งหัวหน้าโค้ชตรวจสอบ / แก้ไขเรียบร้อย"
                  className="min-h-28"
                />
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setDetailComplaint(null)}>
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  className="bg-[#2748bf] hover:bg-[#153c85]"
                  onClick={() => updateComplaint(detailComplaint, formStatus, adminNote)}
                  disabled={savingId === detailComplaint.id}
                >
                  {savingId === detailComplaint.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  บันทึก
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
