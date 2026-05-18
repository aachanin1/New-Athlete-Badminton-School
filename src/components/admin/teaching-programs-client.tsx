'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Loader2,
  MapPin,
  RotateCcw,
  Search,
  UserRound,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { ProgramStatus } from '@/types/database'

export interface TeachingProgramReviewItem {
  id: string
  coach_id: string
  coach_name: string
  coach_email: string
  coach_avatar_url: string | null
  schedule_slot_id: string
  branch_name: string
  course_type: string
  date: string
  start_time: string
  end_time: string
  program_content: string
  status: ProgramStatus
  reviewed_by_name: string | null
  reviewed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface TeachingProgramsClientProps {
  programs: TeachingProgramReviewItem[]
}

type ReviewAction = 'approved' | 'rejected'

const PAGE_SIZE = 18

const STATUS_CONFIG: Record<ProgramStatus, { label: string; tone: string; icon: LucideIcon }> = {
  draft: {
    label: 'ฉบับร่าง',
    tone: 'border-gray-200 bg-gray-50 text-gray-600',
    icon: FileText,
  },
  submitted: {
    label: 'รอตรวจ',
    tone: 'border-amber-200 bg-amber-50 text-amber-700',
    icon: Clock,
  },
  approved: {
    label: 'อนุมัติแล้ว',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'ส่งกลับแก้',
    tone: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: RotateCcw,
  },
}

const COURSE_LABELS: Record<string, string> = {
  kids_group: 'เด็กกลุ่ม',
  adult_group: 'ผู้ใหญ่กลุ่ม',
  private: 'Private',
}

function formatDate(value: string) {
  if (!value) return '-'
  return new Date(`${value}T00:00:00`).toLocaleDateString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'NA'
}

function getCourseLabel(courseType: string) {
  return COURSE_LABELS[courseType] || courseType || '-'
}

function StatusBadge({ status }: { status: ProgramStatus }) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <Badge className={cn('gap-1 border px-2 py-1 text-xs font-semibold', config.tone)}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </Badge>
  )
}

export function TeachingProgramsClient({ programs }: TeachingProgramsClientProps) {
  const [items, setItems] = useState(programs)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>(() => programs.some((item) => item.status === 'submitted') ? 'submitted' : 'all')
  const [coachId, setCoachId] = useState<string>('all')
  const [branch, setBranch] = useState<string>('all')
  const [course, setCourse] = useState<string>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reviewItem, setReviewItem] = useState<TeachingProgramReviewItem | null>(null)
  const [reviewAction, setReviewAction] = useState<ReviewAction>('approved')
  const [reviewNotes, setReviewNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const branchOptions = useMemo(() => Array.from(new Set(items.map((item) => item.branch_name).filter(Boolean))).sort(), [items])
  const courseOptions = useMemo(() => Array.from(new Set(items.map((item) => item.course_type).filter(Boolean))).sort(), [items])
  const coachOptions = useMemo(() => {
    const map = new Map<string, string>()
    items.forEach((item) => map.set(item.coach_id, item.coach_name))
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [items])

  const stats = useMemo(() => ({
    total: items.length,
    submitted: items.filter((item) => item.status === 'submitted').length,
    approved: items.filter((item) => item.status === 'approved').length,
    rejected: items.filter((item) => item.status === 'rejected').length,
    draft: items.filter((item) => item.status === 'draft').length,
  }), [items])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return items.filter((item) => {
      if (status !== 'all' && item.status !== status) return false
      if (coachId !== 'all' && item.coach_id !== coachId) return false
      if (branch !== 'all' && item.branch_name !== branch) return false
      if (course !== 'all' && item.course_type !== course) return false
      if (fromDate && item.date < fromDate) return false
      if (toDate && item.date > toDate) return false
      if (!q) return true

      return [
        item.coach_name,
        item.coach_email,
        item.branch_name,
        getCourseLabel(item.course_type),
        item.program_content,
        item.notes || '',
        item.date,
        item.start_time,
        item.end_time,
      ].some((value) => value.toLowerCase().includes(q))
    })
  }, [branch, coachId, course, fromDate, items, search, status, toDate])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pagedItems = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])
  const selectedItem = useMemo(() => {
    return filtered.find((item) => item.id === selectedId) || pagedItems[0] || null
  }, [filtered, pagedItems, selectedId])

  useEffect(() => {
    setPage(1)
  }, [branch, coachId, course, fromDate, search, status, toDate])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  useEffect(() => {
    if (!selectedItem && filtered[0]) setSelectedId(filtered[0].id)
  }, [filtered, selectedItem])

  const openReview = (item: TeachingProgramReviewItem, action: ReviewAction) => {
    setReviewItem(item)
    setReviewAction(action)
    setReviewNotes(action === 'rejected' ? item.notes || '' : '')
    setMessage(null)
  }

  const submitReview = async () => {
    if (!reviewItem) return
    const notes = reviewNotes.trim()

    if (reviewAction === 'rejected' && !notes) {
      setMessage({ type: 'error', text: 'กรุณาระบุเหตุผลหรือสิ่งที่ต้องแก้ก่อนส่งกลับให้โค้ช' })
      return
    }

    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/teaching-programs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programId: reviewItem.id,
          status: reviewAction,
          notes,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'บันทึกผลตรวจไม่สำเร็จ')
      }

      setItems((current) => current.map((item) => (
        item.id === reviewItem.id
          ? {
              ...item,
              status: result.program.status,
              notes: result.program.notes,
              reviewed_at: result.program.reviewed_at,
              reviewed_by_name: result.program.reviewed_by_name,
              updated_at: result.program.updated_at,
            }
          : item
      )))
      setSelectedId(reviewItem.id)
      setMessage({
        type: 'success',
        text: reviewAction === 'approved' ? 'อนุมัติโปรแกรมสอนแล้ว' : 'ส่งกลับให้โค้ชแก้ไขแล้ว',
      })
      setReviewItem(null)
      setReviewNotes('')
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'บันทึกผลตรวจไม่สำเร็จ' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#2748bf]">
            <BookOpenCheck className="h-4 w-4" />
            Teaching Program Review
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">ตรวจโปรแกรมสอน</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Queue สำหรับตรวจโปรแกรมที่โค้ชส่งมาจากรอบสอนจริง เลือกรายการทางซ้ายแล้วตรวจรายละเอียดทางขวา โดยไม่ต้องไล่ scroll card ยาวทั้งเดือน
          </p>
        </div>
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          ค่าเริ่มต้นจะแสดงเฉพาะรายการรอตรวจก่อน รายการอนุมัติแล้วดูย้อนหลังได้จากตัวกรอง
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <StatCard label="ทั้งหมด" value={stats.total} icon={FileText} />
        <StatCard label="รอตรวจ" value={stats.submitted} icon={Clock} tone={stats.submitted > 0 ? 'amber' : 'default'} />
        <StatCard label="อนุมัติแล้ว" value={stats.approved} icon={CheckCircle2} tone="green" />
        <StatCard label="ส่งกลับแก้" value={stats.rejected} icon={RotateCcw} tone="red" />
        <StatCard label="ฉบับร่าง" value={stats.draft} icon={FileText} />
      </div>

      {message && (
        <div className={cn(
          'rounded-lg border px-4 py-3 text-sm',
          message.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-red-200 bg-red-50 text-red-700'
        )}>
          {message.text}
        </div>
      )}

      <div className="rounded-xl border bg-white p-3 shadow-sm">
        <div className="grid gap-2 xl:grid-cols-[minmax(260px,1fr)_170px_180px_180px_150px_150px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              placeholder="ค้นหาโค้ช โปรแกรม สาขา รอบสอน..."
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="สถานะ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="submitted">รอตรวจ</SelectItem>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              <SelectItem value="approved">อนุมัติแล้ว</SelectItem>
              <SelectItem value="rejected">ส่งกลับแก้</SelectItem>
              <SelectItem value="draft">ฉบับร่าง</SelectItem>
            </SelectContent>
          </Select>
          <Select value={coachId} onValueChange={setCoachId}>
            <SelectTrigger><SelectValue placeholder="โค้ช" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">โค้ชทั้งหมด</SelectItem>
              {coachOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={branch} onValueChange={setBranch}>
            <SelectTrigger><SelectValue placeholder="สาขา" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสาขา</SelectItem>
              {branchOptions.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="วันที่เริ่ม" />
          <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="วันที่สิ้นสุด" />
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Select value={course} onValueChange={setCourse}>
            <SelectTrigger className="sm:w-[220px]"><SelectValue placeholder="ประเภทคอร์ส" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกประเภทคอร์ส</SelectItem>
              {courseOptions.map((name) => <SelectItem key={name} value={name}>{getCourseLabel(name)}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">แสดง {filtered.length} จาก {items.length} รายการ · หน้า {page}/{totalPages}</p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-gray-500">
          <BookOpenCheck className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          ไม่พบโปรแกรมสอนตามเงื่อนไขที่เลือก
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(420px,0.92fr)_minmax(420px,1.08fr)]">
          <div className="rounded-xl border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-sm font-bold text-[#153c85]">รายการโปรแกรมสอน</p>
                <p className="text-xs text-gray-500">กดเลือกรายการเพื่อดูและตรวจด้านขวา</p>
              </div>
              <Badge variant="outline">{pagedItems.length} รายการ</Badge>
            </div>

            <div className="divide-y">
              {pagedItems.map((item) => (
                <ProgramQueueRow
                  key={item.id}
                  item={item}
                  selected={selectedItem?.id === item.id}
                  onSelect={() => setSelectedId(item.id)}
                />
              ))}
            </div>

            <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500">
                {((page - 1) * PAGE_SIZE) + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} จาก {filtered.length}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                  ก่อนหน้า
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                  ถัดไป
                </Button>
              </div>
            </div>
          </div>

          <ProgramDetailPanel
            item={selectedItem}
            onApprove={(item) => openReview(item, 'approved')}
            onReturn={(item) => openReview(item, 'rejected')}
          />
        </div>
      )}

      <Dialog open={Boolean(reviewItem)} onOpenChange={(open) => !open && !isSubmitting && setReviewItem(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">
              {reviewAction === 'approved' ? 'อนุมัติโปรแกรมสอน' : 'ส่งกลับให้โค้ชแก้ไข'}
            </DialogTitle>
          </DialogHeader>
          {reviewItem && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-gray-50 p-3 text-sm">
                <p className="font-bold text-[#153c85]">{reviewItem.coach_name}</p>
                <p className="mt-1 text-gray-500">
                  {formatDate(reviewItem.date)} {reviewItem.start_time} - {reviewItem.end_time} · {reviewItem.branch_name}
                </p>
              </div>
              {reviewAction === 'rejected' ? (
                <div>
                  <p className="mb-2 text-sm font-semibold text-gray-700">หมายเหตุสำหรับโค้ช</p>
                  <Textarea
                    value={reviewNotes}
                    onChange={(event) => setReviewNotes(event.target.value)}
                    className="min-h-28"
                    placeholder="เช่น เพิ่มรายละเอียด drill, ปรับเวลาให้ตรงกับระดับผู้เรียน, ระบุเป้าหมายของรอบสอน..."
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">
                  ระบบจะบันทึกว่าโปรแกรมนี้ผ่านการตรวจแล้ว และแจ้งเตือนโค้ชให้ทราบ
                </div>
              )}
              {message?.type === 'error' && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{message.text}</span>
                </div>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setReviewItem(null)} disabled={isSubmitting}>ยกเลิก</Button>
                <Button
                  onClick={submitReview}
                  disabled={isSubmitting}
                  className={cn('gap-2', reviewAction === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700')}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : reviewAction === 'approved' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {reviewAction === 'approved' ? 'ยืนยันอนุมัติ' : 'ส่งกลับแก้ไข'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ProgramQueueRow({
  item,
  selected,
  onSelect,
}: {
  item: TeachingProgramReviewItem
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'block w-full px-4 py-3 text-left transition hover:bg-blue-50/60',
        selected && 'bg-blue-50 ring-1 ring-inset ring-[#2748bf]'
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Avatar className="h-9 w-9 shrink-0">
          {item.coach_avatar_url && <AvatarImage src={item.coach_avatar_url} alt={item.coach_name} className="object-cover" />}
          <AvatarFallback className="bg-[#2748bf]/10 text-xs font-bold text-[#153c85]">{getInitials(item.coach_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold text-[#153c85]">{item.coach_name}</p>
            <StatusBadge status={item.status} />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(item.date)}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{item.start_time} - {item.end_time}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{item.branch_name}</span>
            <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{getCourseLabel(item.course_type)}</span>
          </div>
          <p className="mt-2 line-clamp-1 text-sm text-gray-700">{item.program_content}</p>
        </div>
      </div>
    </button>
  )
}

function ProgramDetailPanel({
  item,
  onApprove,
  onReturn,
}: {
  item: TeachingProgramReviewItem | null
  onApprove: (item: TeachingProgramReviewItem) => void
  onReturn: (item: TeachingProgramReviewItem) => void
}) {
  if (!item) {
    return (
      <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-gray-500">
        <Eye className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        เลือกรายการทางซ้ายเพื่อดูรายละเอียด
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={item.status} />
              <Badge variant="outline">{formatDateTime(item.created_at)}</Badge>
            </div>
            <h2 className="mt-2 truncate text-lg font-bold text-[#153c85]">{item.coach_name}</h2>
            <p className="truncate text-xs text-gray-500">{item.coach_email}</p>
          </div>
          {item.status === 'submitted' && (
            <div className="grid grid-cols-2 gap-2 sm:w-[240px]">
              <Button onClick={() => onApprove(item)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                อนุมัติ
              </Button>
              <Button variant="outline" onClick={() => onReturn(item)} className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50">
                <RotateCcw className="h-4 w-4" />
                ส่งกลับ
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <InfoTile icon={CalendarDays} label="วัน/เวลา" value={`${formatDate(item.date)} ${item.start_time} - ${item.end_time}`} />
          <InfoTile icon={MapPin} label="สาขา" value={item.branch_name} />
          <InfoTile icon={UserRound} label="ประเภทคอร์ส" value={getCourseLabel(item.course_type)} />
        </div>

        <div className="rounded-lg border bg-gray-50 p-4">
          <p className="mb-2 text-xs font-semibold text-gray-500">เนื้อหาโปรแกรม</p>
          <p className="max-h-[420px] overflow-y-auto whitespace-pre-line pr-2 text-sm leading-7 text-gray-800">{item.program_content}</p>
        </div>

        {item.notes && (
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700">
            หมายเหตุ: {item.notes}
          </div>
        )}

        <div className="rounded-lg border bg-white p-3 text-xs text-gray-500">
          {item.reviewed_at
            ? `ตรวจโดย ${item.reviewed_by_name || '-'} · ${formatDateTime(item.reviewed_at)}`
            : 'ยังไม่ได้ตรวจรายการนี้'}
        </div>
      </div>
    </div>
  )
}

function InfoTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white px-3 py-2">
      <p className="flex items-center gap-1 text-xs text-gray-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: number
  icon: LucideIcon
  tone?: 'default' | 'amber' | 'green' | 'red'
}) {
  const styles = {
    default: 'border-gray-200 text-[#2748bf]',
    amber: 'border-amber-300 bg-amber-50/40 text-amber-600',
    green: 'border-emerald-200 text-emerald-600',
    red: 'border-rose-200 text-rose-600',
  }

  return (
    <Card className={cn('shadow-sm', styles[tone])}>
      <CardContent className="flex items-center justify-between p-3 sm:p-4">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="mt-1 text-xl font-bold sm:text-2xl">{value}</p>
        </div>
        <Icon className="h-5 w-5" />
      </CardContent>
    </Card>
  )
}
