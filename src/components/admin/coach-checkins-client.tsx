'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import type { LucideIcon } from 'lucide-react'
import {
  AlertCircle,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock,
  Eye,
  Image as ImageIcon,
  MapPin,
  Search,
  User,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ListPagination } from '@/components/admin/list-pagination'

interface CheckinAuditRow {
  assignment_id: string
  coach_id: string
  coach_name: string
  schedule_slot_id: string
  branch_id: string
  branch_name: string
  course_type: string
  date: string
  start_time: string
  end_time: string
  checkin_id: string | null
  checkin_time: string | null
  photo_url: string | null
  location_lat: number | null
  location_lng: number | null
}

interface CoachCheckinsClientProps {
  rows: CheckinAuditRow[]
  branches: { id: string; name: string }[]
}

type AuditStatus = 'checked' | 'late' | 'missing' | 'upcoming' | 'no_photo'
type DateScope = 'today' | 'week' | 'month' | 'all' | 'custom'

const STATUS_META: Record<AuditStatus, { label: string; className: string; icon: LucideIcon; priority: number }> = {
  missing: { label: 'ขาดเช็คอิน', className: 'border-red-200 bg-red-50 text-red-700', icon: XCircle, priority: 1 },
  no_photo: { label: 'ไม่มีรูป', className: 'border-orange-200 bg-orange-50 text-orange-700', icon: ImageIcon, priority: 2 },
  late: { label: 'เช็คอินช้า', className: 'border-amber-200 bg-amber-50 text-amber-700', icon: AlertCircle, priority: 3 },
  checked: { label: 'เช็คอินแล้ว', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: CheckCircle2, priority: 4 },
  upcoming: { label: 'ยังไม่ถึงรอบ', className: 'border-blue-200 bg-blue-50 text-blue-700', icon: Clock, priority: 5 },
}

const DATE_SCOPE_LABELS: Record<DateScope, string> = {
  today: 'วันนี้',
  week: 'สัปดาห์นี้',
  month: 'เดือนนี้',
  all: 'ทั้งหมด',
  custom: 'เลือกวัน',
}

function toInputDate(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDateRange(scope: DateScope) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (scope === 'today') {
    const date = toInputDate(today)
    return { start: date, end: date }
  }

  if (scope === 'week') {
    const day = today.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const start = new Date(today)
    start.setDate(today.getDate() + mondayOffset)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start: toInputDate(start), end: toInputDate(end) }
  }

  if (scope === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    return { start: toInputDate(start), end: toInputDate(end) }
  }

  return null
}

function getSlotStart(row: CheckinAuditRow) {
  return new Date(`${row.date}T${row.start_time}`)
}

function getSlotEnd(row: CheckinAuditRow) {
  return new Date(`${row.date}T${row.end_time}`)
}

function getStatus(row: CheckinAuditRow): AuditStatus {
  if (row.checkin_time && !row.photo_url) return 'no_photo'
  if (row.checkin_time && new Date(row.checkin_time).getTime() > getSlotStart(row).getTime()) return 'late'
  if (row.checkin_time) return 'checked'
  if (Date.now() > getSlotEnd(row).getTime()) return 'missing'
  return 'upcoming'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }).format(new Date(`${value}T00:00:00`))
}

function formatTime(value: string) {
  return value.slice(0, 5)
}

function formatCheckinTime(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function CoachCheckinsClient({ rows, branches }: CoachCheckinsClientProps) {
  const [search, setSearch] = useState('')
  const [filterBranch, setFilterBranch] = useState('all')
  const [filterCoach, setFilterCoach] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [dateScope, setDateScope] = useState<DateScope>('week')
  const [filterDate, setFilterDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [selectedRow, setSelectedRow] = useState<CheckinAuditRow | null>(null)

  const coaches = useMemo(() => {
    const coachMap = new Map<string, string>()
    rows.forEach((row) => coachMap.set(row.coach_id, row.coach_name))
    return Array.from(coachMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'th'))
  }, [rows])

  const scopedRows = useMemo(() => {
    if (dateScope === 'all') return rows
    if (dateScope === 'custom') {
      if (!filterDate) return rows
      return rows.filter((row) => row.date === filterDate)
    }

    const range = getDateRange(dateScope)
    if (!range) return rows
    return rows.filter((row) => row.date >= range.start && row.date <= range.end)
  }, [dateScope, filterDate, rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return scopedRows
      .filter((row) => {
        const status = getStatus(row)
        if (filterBranch !== 'all' && row.branch_id !== filterBranch) return false
        if (filterCoach !== 'all' && row.coach_id !== filterCoach) return false
        if (filterStatus !== 'all' && status !== filterStatus) return false
        if (!q) return true

        return [
          row.coach_name,
          row.branch_name,
          row.course_type,
          row.date,
          row.schedule_slot_id,
        ].some((value) => value.toLowerCase().includes(q))
      })
      .sort((a, b) => {
        const statusDiff = STATUS_META[getStatus(a)].priority - STATUS_META[getStatus(b)].priority
        if (statusDiff !== 0) return statusDiff
        return `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`)
      })
  }, [filterBranch, filterCoach, filterStatus, scopedRows, search])

  const stats = useMemo(() => {
    const statuses = scopedRows.map(getStatus)
    return {
      total: scopedRows.length,
      checked: statuses.filter((status) => status === 'checked' || status === 'late').length,
      missing: statuses.filter((status) => status === 'missing').length,
      noPhoto: statuses.filter((status) => status === 'no_photo').length,
      upcoming: statuses.filter((status) => status === 'upcoming').length,
    }
  }, [scopedRows])

  const coachSummaries = useMemo(() => {
    const summaryMap = new Map<string, { coachId: string; coachName: string; total: number; checked: number; late: number; missing: number; noPhoto: number; upcoming: number }>()
    filtered.forEach((row) => {
      const current = summaryMap.get(row.coach_id) || {
        coachId: row.coach_id,
        coachName: row.coach_name,
        total: 0,
        checked: 0,
        late: 0,
        missing: 0,
        noPhoto: 0,
        upcoming: 0,
      }
      const status = getStatus(row)
      current.total += 1
      if (status === 'checked') current.checked += 1
      if (status === 'late') current.late += 1
      if (status === 'missing') current.missing += 1
      if (status === 'no_photo') current.noPhoto += 1
      if (status === 'upcoming') current.upcoming += 1
      summaryMap.set(row.coach_id, current)
    })
    return Array.from(summaryMap.values()).sort((a, b) => b.missing - a.missing || b.noPhoto - a.noPhoto || b.late - a.late || a.coachName.localeCompare(b.coachName, 'th'))
  }, [filtered])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const openDetail = (row: CheckinAuditRow) => {
    setSelectedRow(row)
  }

  const handleFilterChange = (callback: () => void) => {
    callback()
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#2748bf]">
          <Camera className="h-4 w-4" />
          Coach Check-in Audit
        </div>
        <h1 className="mt-1 text-2xl font-bold text-[#153c85]">เช็คอินโค้ช</h1>
        <p className="mt-1 text-sm text-gray-500">
          ตรวจเช็คอินรายรอบสอนแบบ compact ดูปัญหาก่อน แล้วค่อยเปิดรายละเอียดรูปเซลฟี่และตำแหน่ง
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-5">
        <StatCard label="รอบในช่วงที่เลือก" value={stats.total} icon={Clock} tone="blue" />
        <StatCard label="เช็คอินแล้ว" value={stats.checked} icon={CheckCircle2} tone="green" />
        <StatCard label="ขาดเช็คอิน" value={stats.missing} icon={XCircle} tone="red" />
        <StatCard label="ไม่มีรูป" value={stats.noPhoto} icon={ImageIcon} tone="orange" />
        <StatCard label="ยังไม่ถึงรอบ" value={stats.upcoming} icon={CalendarDays} tone="slate" wideOnMobile />
      </div>

      <Card className="border-gray-200">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(DATE_SCOPE_LABELS) as DateScope[]).map((scope) => (
              <Button
                key={scope}
                type="button"
                size="sm"
                variant={dateScope === scope ? 'default' : 'outline'}
                className={dateScope === scope ? 'bg-[#2748bf] hover:bg-[#153c85]' : ''}
                onClick={() => handleFilterChange(() => setDateScope(scope))}
              >
                {DATE_SCOPE_LABELS[scope]}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_190px_190px_180px_170px] xl:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-10"
                placeholder="ค้นหาโค้ช, สาขา, คอร์ส, slot id..."
                value={search}
                onChange={(event) => handleFilterChange(() => setSearch(event.target.value))}
              />
            </div>
            <Select value={filterCoach} onValueChange={(value) => handleFilterChange(() => setFilterCoach(value))}>
              <SelectTrigger>
                <SelectValue placeholder="โค้ชทั้งหมด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">โค้ชทั้งหมด</SelectItem>
                {coaches.map((coach) => (
                  <SelectItem key={coach.id} value={coach.id}>{coach.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterBranch} onValueChange={(value) => handleFilterChange(() => setFilterBranch(value))}>
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
            <Select value={filterStatus} onValueChange={(value) => handleFilterChange(() => setFilterStatus(value))}>
              <SelectTrigger>
                <SelectValue placeholder="ทุกสถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                {Object.entries(STATUS_META).map(([key, meta]) => (
                  <SelectItem key={key} value={key}>{meta.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filterDate}
              onChange={(event) => handleFilterChange(() => {
                setFilterDate(event.target.value)
                setDateScope('custom')
              })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200">
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <p className="font-semibold text-[#153c85]">สรุปตามโค้ช</p>
              <p className="text-xs text-gray-500">ใช้ดูภาพรวมก่อนเปิดรายละเอียดรายรอบ</p>
            </div>
            <Badge variant="outline">{coachSummaries.length} โค้ช</Badge>
          </div>
          {coachSummaries.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">ไม่มีข้อมูลโค้ชตามตัวกรอง</div>
          ) : (
            <div className="max-h-[18rem] overflow-y-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="sticky top-0 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                  <tr>
                    <th className="px-4 py-2">โค้ช</th>
                    <th className="px-4 py-2 text-right">รอบ</th>
                    <th className="px-4 py-2 text-right">เช็คแล้ว</th>
                    <th className="px-4 py-2 text-right">สาย</th>
                    <th className="px-4 py-2 text-right">ขาด</th>
                    <th className="px-4 py-2 text-right">ไม่มีรูป</th>
                    <th className="px-4 py-2 text-right">ยังไม่ถึง</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {coachSummaries.map((coach) => (
                    <tr key={coach.coachId} className={coach.missing > 0 || coach.noPhoto > 0 ? 'bg-red-50/25' : 'bg-white'}>
                      <td className="px-4 py-3 font-semibold text-gray-900">{coach.coachName}</td>
                      <td className="px-4 py-3 text-right font-semibold">{coach.total}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{coach.checked}</td>
                      <td className="px-4 py-3 text-right text-amber-700">{coach.late}</td>
                      <td className="px-4 py-3 text-right text-red-700">{coach.missing}</td>
                      <td className="px-4 py-3 text-right text-orange-700">{coach.noPhoto}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{coach.upcoming}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-gray-200">
        {filtered.length === 0 ? (
          <CardContent className="py-14 text-center text-gray-400">
            <Camera className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</p>
          </CardContent>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500">
                  <tr>
                    <th className="px-4 py-3">รอบสอน</th>
                    <th className="px-4 py-3">โค้ช</th>
                    <th className="px-4 py-3">สาขา/คอร์ส</th>
                    <th className="px-4 py-3">สถานะ</th>
                    <th className="px-4 py-3">หลักฐาน</th>
                    <th className="px-4 py-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedRows.map((row) => {
                    const status = getStatus(row)
                    const meta = STATUS_META[status]
                    const StatusIcon = meta.icon
                    return (
                      <tr key={row.assignment_id} className="align-top hover:bg-gray-50/70">
                        <td className="px-4 py-4">
                          <p className="font-semibold text-gray-950">{formatDate(row.date)}</p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="h-3.5 w-3.5" />
                            {formatTime(row.start_time)}-{formatTime(row.end_time)}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-sm font-bold text-[#2748bf]">
                              {row.coach_name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-950">{row.coach_name}</p>
                              <p className="text-xs text-gray-400">รายรอบสอน</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="flex items-center gap-1 font-medium text-gray-900">
                            <Building2 className="h-3.5 w-3.5 text-gray-400" />
                            {row.branch_name}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">{row.course_type || '-'}</p>
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant="outline" className={meta.className}>
                            <StatusIcon className="mr-1 h-3.5 w-3.5" />
                            {meta.label}
                          </Badge>
                          {row.checkin_time && (
                            <p className="mt-2 text-xs text-gray-500">เช็คอิน {formatCheckinTime(row.checkin_time)}</p>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className={row.photo_url ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-orange-200 bg-orange-50 text-orange-700'}>
                              <ImageIcon className="mr-1 h-3.5 w-3.5" />
                              {row.photo_url ? 'มีรูป' : 'ไม่มีรูป'}
                            </Badge>
                            <Badge variant="outline" className={row.location_lat && row.location_lng ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-500'}>
                              <MapPin className="mr-1 h-3.5 w-3.5" />
                              {row.location_lat && row.location_lng ? 'มี GPS' : 'ไม่มี GPS'}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Button size="sm" variant="outline" onClick={() => openDetail(row)}>
                            <Eye className="mr-2 h-4 w-4" />
                            รายละเอียด
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <ListPagination
              page={safePage}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </Card>

      <Dialog open={Boolean(selectedRow)} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">รายละเอียดเช็คอินรายรอบสอน</DialogTitle>
          </DialogHeader>
          {selectedRow && (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-lg bg-gray-50 p-3 text-sm sm:grid-cols-2">
                <InfoLine icon={User} label="โค้ช" value={selectedRow.coach_name} />
                <InfoLine icon={Building2} label="สาขา" value={selectedRow.branch_name} />
                <InfoLine icon={CalendarDays} label="วันที่" value={formatDate(selectedRow.date)} />
                <InfoLine icon={Clock} label="เวลา" value={`${formatTime(selectedRow.start_time)}-${formatTime(selectedRow.end_time)}`} />
              </div>

              {selectedRow.checkin_time && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  เช็คอินเมื่อ {formatCheckinTime(selectedRow.checkin_time)}
                </div>
              )}

              {selectedRow.photo_url ? (
                <Image src={selectedRow.photo_url} alt="check-in selfie" width={900} height={900} className="max-h-[55vh] w-full rounded-lg object-contain bg-gray-100" />
              ) : (
                <div className="rounded-lg border border-dashed border-orange-200 bg-orange-50 py-10 text-center text-sm text-orange-700">
                  ไม่มีรูปเซลฟี่สำหรับรอบนี้
                </div>
              )}

              {selectedRow.location_lat && selectedRow.location_lng ? (
                <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                  <div>
                    <p className="font-medium text-blue-700">ตำแหน่ง GPS</p>
                    <p className="text-xs text-blue-600">{selectedRow.location_lat.toFixed(6)}, {selectedRow.location_lng.toFixed(6)}</p>
                    <a
                      href={`https://www.google.com/maps?q=${selectedRow.location_lat},${selectedRow.location_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 underline"
                    >
                      เปิดใน Google Maps
                    </a>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-6 text-center text-sm text-gray-500">
                  ไม่มีข้อมูลตำแหน่ง GPS
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  wideOnMobile = false,
}: {
  label: string
  value: number
  icon: LucideIcon
  tone: 'blue' | 'green' | 'red' | 'orange' | 'slate'
  wideOnMobile?: boolean
}) {
  const toneClasses = {
    blue: 'text-[#2748bf]',
    green: 'text-emerald-600',
    red: 'text-red-600',
    orange: 'text-orange-500',
    slate: 'text-slate-500',
  }

  return (
    <Card className={`border-gray-200 ${wideOnMobile ? 'max-xl:col-span-2' : ''}`}>
      <CardContent className="flex items-center justify-between p-3 sm:p-4">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className={`mt-1 text-xl font-bold sm:text-2xl ${toneClasses[tone]}`}>{value}</p>
        </div>
        <Icon className={`h-5 w-5 ${toneClasses[tone]}`} />
      </CardContent>
    </Card>
  )
}

function InfoLine({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-gray-400" />
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  )
}
