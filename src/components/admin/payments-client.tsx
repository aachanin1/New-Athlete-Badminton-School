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
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Eye,
  FileText,
  ImageIcon,
  Receipt,
  Search,
  ShieldCheck,
  User,
  XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface PaymentData {
  id: string
  booking_id: string
  user_id: string
  amount: number
  method: string
  slip_image_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  verified_by: string | null
  verified_at: string | null
  notes: string | null
  created_at: string
  user_name: string
  user_email: string
  booking_month: number
  booking_year: number
  booking_status: string
  branch_name: string
  course_type: string
  total_sessions: number
  verified_by_name: string | null
}

interface PaymentsClientProps {
  payments: PaymentData[]
}

const STATUS_CONFIG: Record<PaymentData['status'], { label: string; tone: string; icon: LucideIcon; help: string }> = {
  pending: {
    label: 'รอตรวจสอบ',
    tone: 'border-amber-200 bg-amber-50 text-amber-700',
    icon: Clock,
    help: 'SlipOK ยังไม่ยืนยันรายการนี้ หรือพบข้อมูลที่ต้องตรวจสอบเพิ่ม',
  },
  approved: {
    label: 'ยืนยันแล้ว',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: CheckCircle2,
    help: 'ระบบยืนยันสลิปแล้ว และ booking ควรอยู่ในสถานะ verified',
  },
  rejected: {
    label: 'ไม่ผ่าน',
    tone: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: XCircle,
    help: 'รายการนี้ถูกปฏิเสธหรือไม่ผ่านการตรวจสอบ',
  },
}

const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending_payment: 'รอชำระเงิน',
  paid: 'แนบสลิปแล้ว',
  verified: 'จองสำเร็จ',
  cancelled: 'ยกเลิก',
}

const MONTH_NAMES = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

const COURSE_LABELS: Record<string, string> = {
  kids_group: 'เด็กกลุ่ม',
  adult_group: 'ผู้ใหญ่กลุ่ม',
  private: 'ส่วนตัว',
}

function formatMoney(amount: number) {
  return `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 0 })}`
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getVerificationSource(payment: PaymentData) {
  const notes = payment.notes || ''
  if (notes.includes('[TEST MODE]')) return { label: 'TEST MODE', className: 'bg-sky-50 text-sky-700 border-sky-200' }
  if (notes.includes('SlipOK verified')) return { label: 'SlipOK', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  if (notes.includes('SlipOK')) return { label: 'SlipOK ต้องตรวจสอบ', className: 'bg-amber-50 text-amber-700 border-amber-200' }
  if (payment.verified_by_name) return { label: 'Admin override', className: 'bg-violet-50 text-violet-700 border-violet-200' }
  return { label: 'ระบบ', className: 'bg-gray-50 text-gray-600 border-gray-200' }
}

function getShortId(id: string) {
  return id.length > 10 ? `${id.slice(0, 8)}...` : id
}

export function PaymentsClient({ payments }: PaymentsClientProps) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [detailPayment, setDetailPayment] = useState<PaymentData | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [slipOpen, setSlipOpen] = useState(false)
  const [slipUrl, setSlipUrl] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return payments.filter((payment) => {
      if (filterStatus !== 'all' && payment.status !== filterStatus) return false
      if (!q) return true

      return [
        payment.user_name,
        payment.user_email,
        payment.branch_name,
        payment.id,
        payment.booking_id,
        payment.notes || '',
      ].some((value) => value.toLowerCase().includes(q))
    })
  }, [payments, search, filterStatus])

  const stats = useMemo(() => {
    const approved = payments.filter((payment) => payment.status === 'approved')
    const pending = payments.filter((payment) => payment.status === 'pending')
    const rejected = payments.filter((payment) => payment.status === 'rejected')

    return {
      total: payments.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      approvedAmount: approved.reduce((sum, payment) => sum + payment.amount, 0),
    }
  }, [payments])

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(text)
    window.setTimeout(() => setCopiedId(null), 1400)
  }

  const openDetail = (payment: PaymentData) => {
    setDetailPayment(payment)
    setDetailOpen(true)
  }

  const openSlipImage = (url: string) => {
    setSlipUrl(url)
    setSlipOpen(true)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#2748bf]">
            <ShieldCheck className="h-4 w-4" />
            Payment Audit
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">ตรวจสอบการชำระเงิน</h1>
          <p className="mt-1 text-sm text-gray-500">
            ใช้สำหรับดูผลตรวจ SlipOK, หลักฐานการโอน และสถานะ booking โดยไม่ต้องอนุมัติซ้ำ
          </p>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          รายการที่ SlipOK ผ่านจะยืนยัน booking อัตโนมัติ
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-5">
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">ทั้งหมด</p>
              <p className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">{stats.total}</p>
            </div>
            <CreditCard className="h-5 w-5 text-[#2748bf]" />
          </CardContent>
        </Card>
        <Card className={stats.pending > 0 ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200'}>
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">ต้องดูเพิ่ม</p>
              <p className="mt-1 text-xl font-bold text-amber-600 sm:text-2xl">{stats.pending}</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">ยืนยันแล้ว</p>
              <p className="mt-1 text-xl font-bold text-emerald-600 sm:text-2xl">{stats.approved}</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">ไม่ผ่าน</p>
              <p className="mt-1 text-xl font-bold text-rose-600 sm:text-2xl">{stats.rejected}</p>
            </div>
            <XCircle className="h-5 w-5 text-rose-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200 max-xl:col-span-2">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div className="min-w-0">
              <p className="text-xs text-gray-500">ยอดยืนยันแล้ว</p>
              <p className="mt-1 truncate text-xl font-bold text-[#153c85] sm:text-2xl">{formatMoney(stats.approvedAmount)}</p>
            </div>
            <Banknote className="h-5 w-5 text-[#f57e3b]" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="ค้นหาชื่อ, อีเมล, สาขา, payment id, booking id..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="ทุกสถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  <SelectItem value="pending">รอตรวจสอบ</SelectItem>
                  <SelectItem value="approved">ยืนยันแล้ว</SelectItem>
                  <SelectItem value="rejected">ไม่ผ่าน</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 sm:min-w-32 sm:text-right">
                แสดง {filtered.length} จาก {payments.length} รายการ
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center text-gray-400">
            <CreditCard className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">{search || filterStatus !== 'all' ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีรายการชำระเงิน'}</p>
            <p className="mt-1 text-sm">ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <div className="hidden grid-cols-[72px_minmax(220px,1.2fr)_minmax(180px,.95fr)_minmax(130px,.7fr)_minmax(220px,.85fr)_minmax(178px,auto)] gap-4 border-b bg-gray-50 px-4 py-3 text-xs font-medium text-gray-500 xl:grid">
            <span>สลิป</span>
            <span>ผู้ชำระเงิน</span>
            <span>คอร์ส/สาขา</span>
            <span>สถานะ</span>
            <span>เวลา</span>
            <span className="text-right">จัดการ</span>
          </div>

          <div className="divide-y">
            {filtered.map((payment) => {
              const statusCfg = STATUS_CONFIG[payment.status]
              const StatusIcon = statusCfg.icon
              const source = getVerificationSource(payment)

              return (
                <div
                  key={payment.id}
                  className="grid gap-3 px-4 py-4 transition-colors hover:bg-gray-50 xl:grid-cols-[72px_minmax(220px,1.2fr)_minmax(180px,.95fr)_minmax(130px,.7fr)_minmax(220px,.85fr)_minmax(178px,auto)] xl:items-center xl:gap-4"
                >
                  <button
                    type="button"
                    className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border bg-gray-100"
                    onClick={() => payment.slip_image_url && openSlipImage(payment.slip_image_url)}
                    disabled={!payment.slip_image_url}
                    title={payment.slip_image_url ? 'ดูสลิปเต็ม' : 'ไม่มีสลิป'}
                  >
                    {payment.slip_image_url ? (
                      <Image src={payment.slip_image_url} alt="Payment slip" width={64} height={64} className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-gray-300" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-gray-900">{payment.user_name}</p>
                      <Badge variant="outline" className={source.className}>{source.label}</Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-gray-500">{payment.user_email || '-'}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
                      <button type="button" className="inline-flex items-center gap-1 hover:text-[#2748bf]" onClick={() => copyText(payment.id)}>
                        <Copy className="h-3 w-3" />
                        Pay {copiedId === payment.id ? 'คัดลอกแล้ว' : getShortId(payment.id)}
                      </button>
                      <button type="button" className="inline-flex items-center gap-1 hover:text-[#2748bf]" onClick={() => copyText(payment.booking_id)}>
                        <Receipt className="h-3 w-3" />
                        Booking {copiedId === payment.booking_id ? 'คัดลอกแล้ว' : getShortId(payment.booking_id)}
                      </button>
                    </div>
                  </div>

                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-gray-900">{COURSE_LABELS[payment.course_type] || payment.course_type || '-'}</p>
                    <p className="mt-1 flex items-center gap-1 text-gray-500">
                      <Building2 className="h-3.5 w-3.5" />
                      {payment.branch_name}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {MONTH_NAMES[payment.booking_month]} {payment.booking_year} · {payment.total_sessions} ครั้ง · {BOOKING_STATUS_LABELS[payment.booking_status] || payment.booking_status || '-'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Badge variant="outline" className={statusCfg.tone}>
                      <StatusIcon className="mr-1 h-3.5 w-3.5" />
                      {statusCfg.label}
                    </Badge>
                    <p className="text-lg font-bold text-gray-900">{formatMoney(payment.amount)}</p>
                  </div>

                  <div className="min-w-0 pr-2 text-sm text-gray-500">
                    <p className="whitespace-nowrap">{formatDate(payment.created_at)}</p>
                    {payment.verified_at && (
                      <p className="mt-1 whitespace-nowrap text-xs text-emerald-600">ยืนยัน {formatDate(payment.verified_at)}</p>
                    )}
                  </div>

                  <div className="flex min-w-[178px] gap-2 xl:justify-end">
                    {payment.slip_image_url && (
                      <Button variant="outline" size="sm" onClick={() => openSlipImage(payment.slip_image_url!)}>
                        สลิป
                      </Button>
                    )}
                    <Button size="sm" className="bg-[#2748bf] hover:bg-[#153c85]" onClick={() => openDetail(payment)}>
                      <Eye className="mr-1.5 h-4 w-4" />
                      รายละเอียด
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">รายละเอียดการชำระเงิน</DialogTitle>
          </DialogHeader>

          {detailPayment && (
            <div className="space-y-4">
              {(() => {
                const cfg = STATUS_CONFIG[detailPayment.status]
                const Icon = cfg.icon
                const source = getVerificationSource(detailPayment)

                return (
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className={`rounded-lg border px-4 py-3 ${cfg.tone}`}>
                      <div className="flex items-center gap-2 font-medium">
                        <Icon className="h-5 w-5" />
                        {cfg.label}
                      </div>
                      <p className="mt-1 text-xs opacity-80">{cfg.help}</p>
                    </div>
                    <Badge variant="outline" className={`${source.className} justify-center px-3 py-2`}>
                      {source.label}
                    </Badge>
                  </div>
                )
              })()}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-400">ผู้ชำระเงิน</p>
                  <div className="mt-2 flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{detailPayment.user_name}</p>
                      <p className="truncate text-xs text-gray-500">{detailPayment.user_email || '-'}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-400">ยอดชำระ</p>
                  <p className="mt-2 text-2xl font-bold text-[#153c85]">{formatMoney(detailPayment.amount)}</p>
                  <p className="text-xs text-gray-500">วิธีชำระเงิน: {detailPayment.method || '-'}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg border p-3 sm:col-span-2">
                  <p className="text-xs text-gray-400">คอร์ส</p>
                  <p className="mt-1 font-medium">{COURSE_LABELS[detailPayment.course_type] || detailPayment.course_type || '-'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-400">สาขา</p>
                  <p className="mt-1 font-medium">{detailPayment.branch_name}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-400">รอบเรียน</p>
                  <p className="mt-1 font-medium">{detailPayment.total_sessions} ครั้ง</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className="rounded-lg border bg-white p-3 text-left transition-colors hover:border-[#2748bf]"
                  onClick={() => copyText(detailPayment.id)}
                >
                  <p className="flex items-center gap-2 text-xs text-gray-400">
                    <Copy className="h-3.5 w-3.5" />
                    Payment ID
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-gray-700">{detailPayment.id}</p>
                </button>
                <button
                  type="button"
                  className="rounded-lg border bg-white p-3 text-left transition-colors hover:border-[#2748bf]"
                  onClick={() => copyText(detailPayment.booking_id)}
                >
                  <p className="flex items-center gap-2 text-xs text-gray-400">
                    <Receipt className="h-3.5 w-3.5" />
                    Booking ID
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-gray-700">{detailPayment.booking_id}</p>
                </button>
              </div>

              {detailPayment.notes && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                  <p className="mb-1 flex items-center gap-2 text-xs font-medium text-blue-500">
                    <FileText className="h-3.5 w-3.5" />
                    ผลตรวจ/หมายเหตุ
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-blue-800">{detailPayment.notes}</p>
                </div>
              )}

              {detailPayment.slip_image_url ? (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-500">สลิปการโอนเงิน</p>
                    <Button variant="outline" size="sm" onClick={() => openSlipImage(detailPayment.slip_image_url!)}>
                      ดูสลิปเต็ม
                    </Button>
                  </div>
                  <button
                    type="button"
                    className="flex w-full items-center justify-center overflow-hidden rounded-lg border bg-gray-50"
                    onClick={() => openSlipImage(detailPayment.slip_image_url!)}
                  >
                    <Image src={detailPayment.slip_image_url} alt="Payment slip" width={560} height={360} className="max-h-80 w-full object-contain" />
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-gray-400">
                  ไม่มีไฟล์สลิปในรายการนี้
                </div>
              )}

              <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
                <p>สร้างรายการ: {formatDate(detailPayment.created_at)}</p>
                <p>ยืนยันโดย: {detailPayment.verified_by_name || 'SlipOK / ระบบอัตโนมัติ'}</p>
                <p>เวลายืนยัน: {formatDate(detailPayment.verified_at)}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={slipOpen} onOpenChange={setSlipOpen}>
        <DialogContent className="max-h-[95vh] max-w-3xl p-3">
          <DialogHeader>
            <DialogTitle className="text-sm text-[#153c85]">สลิปการโอนเงิน</DialogTitle>
          </DialogHeader>
          {slipUrl && (
            <div className="flex items-center justify-center overflow-hidden rounded-lg bg-gray-50">
              <Image src={slipUrl} alt="Payment slip" width={760} height={980} className="max-h-[82vh] w-auto object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
