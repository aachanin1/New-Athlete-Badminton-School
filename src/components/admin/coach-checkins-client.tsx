'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertCircle,
  Building2,
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

const STATUS_META: Record<AuditStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  checked: { label: 'เช็คอินแล้ว', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  late: { label: 'เช็คอินช้า', className: 'border-amber-200 bg-amber-50 text-amber-700', icon: AlertCircle },
  missing: { label: 'ยังไม่เช็คอิน', className: 'border-red-200 bg-red-50 text-red-700', icon: XCircle },
  upcoming: { label: 'ยังไม่ถึงรอบ', className: 'border-blue-200 bg-blue-50 text-blue-700', icon: Clock },
  no_photo: { label: 'ไม่มีรูป', className: 'border-orange-200 bg-orange-50 text-orange-700', icon: ImageIcon },
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
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDate, setFilterDate] = useState('')
  const [photoOpen, setPhotoOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<CheckinAuditRow | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return rows.filter((row) => {
      const status = getStatus(row)
      if (filterBranch !== 'all' && row.branch_id !== filterBranch) return false
      if (filterStatus !== 'all' && status !== filterStatus) return false
      if (filterDate && row.date !== filterDate) return false
      if (!q) return true

      return [
        row.coach_name,
        row.branch_name,
        row.course_type,
        row.date,
        row.schedule_slot_id,
      ].some((value) => value.toLowerCase().includes(q))
    })
  }, [filterBranch, filterDate, filterStatus, rows, search])

  const stats = useMemo(() => {
    const statuses = rows.map(getStatus)
    return {
      total: rows.length,
      checked: statuses.filter((status) => status === 'checked' || status === 'late').length,
      missing: statuses.filter((status) => status === 'missing').length,
      noPhoto: statuses.filter((status) => status === 'no_photo').length,
    }
  }, [rows])

  const openPhoto = (row: CheckinAuditRow) => {
    if (!row.photo_url) return
    setSelectedRow(row)
    setPhotoOpen(true)
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#2748bf]">
          <Camera className="h-4 w-4" />
          Coach Check-in Audit
        </div>
        <h1 className="mt-1 text-2xl font-bold text-[#153c85]">เช็คอินโค้ช</h1>
        <p className="mt-1 text-sm text-gray-500">ตรวจสอบการเช็คอินรายรอบสอน พร้อมรูปเซลฟี่/รูปตัวเองของโค้ช</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">รอบที่ต้องตรวจ</p>
              <p className="mt-1 text-xl font-bold text-[#2748bf] sm:text-2xl">{stats.total}</p>
            </div>
            <Clock className="h-5 w-5 text-[#2748bf]" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">เช็คอินแล้ว</p>
              <p className="mt-1 text-xl font-bold text-emerald-600 sm:text-2xl">{stats.checked}</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </CardContent>
        </Card>
        <Card className={stats.missing > 0 ? 'border-red-300 bg-red-50/40' : 'border-gray-200'}>
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">ขาดเช็คอิน</p>
              <p className="mt-1 text-xl font-bold text-red-600 sm:text-2xl">{stats.missing}</p>
            </div>
            <XCircle className="h-5 w-5 text-red-500" />
          </CardContent>
        </Card>
        <Card className={stats.noPhoto > 0 ? 'border-orange-300 bg-orange-50/40' : 'border-gray-200'}>
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">ไม่มีรูป</p>
              <p className="mt-1 text-xl font-bold text-orange-500 sm:text-2xl">{stats.noPhoto}</p>
            </div>
            <ImageIcon className="h-5 w-5 text-orange-500" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200">
        <CardContent className="grid gap-3 p-4 xl:grid-cols-[minmax(260px,1fr)_200px_180px_170px_auto] xl:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-10"
              placeholder="ค้นหาโค้ช, สาขา, คอร์ส, slot id..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
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
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue placeholder="ทุกสถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              <SelectItem value="checked">เช็คอินแล้ว</SelectItem>
              <SelectItem value="late">เช็คอินช้า</SelectItem>
              <SelectItem value="missing">ยังไม่เช็คอิน</SelectItem>
              <SelectItem value="upcoming">ยังไม่ถึงรอบ</SelectItem>
              <SelectItem value="no_photo">ไม่มีรูป</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} />
          <p className="whitespace-nowrap text-sm text-gray-500">แสดง {filtered.length} จาก {rows.length} รอบ</p>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center text-gray-400">
            <Camera className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border-gray-200">
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
                {filtered.map((row) => {
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
                        {row.photo_url ? (
                          <button type="button" className="flex items-center gap-2 text-left" onClick={() => openPhoto(row)}>
                            <Image src={row.photo_url} alt="check-in selfie" width={44} height={44} className="h-11 w-11 rounded-lg object-cover" />
                            <span className="text-xs font-medium text-emerald-700">มีรูปเซลฟี่</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-orange-600">
                            <ImageIcon className="h-4 w-4" />
                            ไม่มีรูป
                          </div>
                        )}
                        {row.location_lat && row.location_lng && (
                          <p className="mt-2 flex items-center gap-1 text-xs text-blue-600">
                            <MapPin className="h-3.5 w-3.5" />
                            GPS
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Button size="sm" variant="outline" disabled={!row.photo_url} onClick={() => openPhoto(row)}>
                          <Eye className="mr-2 h-4 w-4" />
                          ดูรูป
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">รูปเช็คอินรายรอบสอน</DialogTitle>
          </DialogHeader>
          {selectedRow && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                <User className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="font-medium text-sm">{selectedRow.coach_name}</p>
                  <p className="text-xs text-gray-500">{selectedRow.branch_name} • {formatDate(selectedRow.date)} {formatTime(selectedRow.start_time)}-{formatTime(selectedRow.end_time)}</p>
                </div>
              </div>

              {selectedRow.photo_url && (
                <Image src={selectedRow.photo_url} alt="check-in selfie" width={720} height={720} className="w-full rounded-lg object-cover" />
              )}

              {selectedRow.location_lat && selectedRow.location_lng && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm">
                  <MapPin className="h-4 w-4 shrink-0 text-blue-500" />
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
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
