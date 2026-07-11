'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ListPagination } from '@/components/admin/list-pagination'
import { PaymentSettingsClient } from '@/components/admin/payment-settings-client'
import { formatThaiDateTimeWithWeekday } from '@/lib/date-format'
import type { PaymentTransferSettings } from '@/lib/payment-settings'
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
  Settings,
  ShieldCheck,
  User,
  XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface PaymentData {
  source_kind: 'legacy' | 'progressive'
  id: string
  booking_id: string
  user_id: string
  amount?: number
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
  learner_name: string
  verified_by_name: string | null
}

interface IncompleteBookingData {
  id: string
  user_id: string
  user_name: string
  user_email: string
  user_phone: string
  learner_name: string
  branch_name: string
  course_type: string
  month: number
  year: number
  total_sessions: number
  total_price?: number
  status: string
  created_at: string
  latest_payment_id: string | null
  latest_payment_status: string | null
  has_slip: boolean
}

interface PaymentsClientProps {
  payments: PaymentData[]
  incompleteBookings: IncompleteBookingData[]
  paymentTransferSettings: PaymentTransferSettings
  slipOkMode: 'live' | 'test'
  canViewFinancialAmounts: boolean
}

type PaymentReviewAction = 'approve' | 'send_back' | 'cancel'

const PAYMENT_REVIEW_COPY: Record<PaymentReviewAction, { title: string; description: string; button: string; buttonClass: string }> = {
  approve: {
    title: 'อนุมัติด้วยตนเอง',
    description: 'ใช้เฉพาะเคสที่ตรวจสลิปแล้วมั่นใจว่ายอดและบัญชีถูกต้อง ระบบจะยืนยัน booking ทันที',
    button: 'อนุมัติและยืนยัน booking',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-700',
  },
  send_back: {
    title: 'ตีกลับให้แนบสลิปใหม่',
    description: 'ใช้เมื่อสลิปผิด บัญชีไม่ตรง ยอดไม่ตรง หรือ SlipOK ตรวจไม่ผ่าน แต่ยังเปิดโอกาสให้ลูกค้าแนบใหม่',
    button: 'ตีกลับให้ลูกค้าแนบใหม่',
    buttonClass: 'bg-amber-600 hover:bg-amber-700',
  },
  cancel: {
    title: 'ปฏิเสธและยกเลิกการจอง',
    description: 'ใช้เมื่อรายการนี้ไม่ควรดำเนินต่อ ระบบจะยกเลิก booking และไม่ส่งต่อเข้า flow โค้ช',
    button: 'ยกเลิก booking นี้',
    buttonClass: 'bg-rose-600 hover:bg-rose-700',
  },
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
  return formatThaiDateTimeWithWeekday(dateStr)
}

function getVerificationSource(payment: PaymentData) {
  if (payment.source_kind === 'progressive') return { label: 'Progressive Batch', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
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

export function PaymentsClient({
  payments,
  incompleteBookings,
  paymentTransferSettings,
  slipOkMode,
  canViewFinancialAmounts,
}: PaymentsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [detailPayment, setDetailPayment] = useState<PaymentData | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [slipOpen, setSlipOpen] = useState(false)
  const [paymentSettingsOpen, setPaymentSettingsOpen] = useState(false)
  const [reviewPayment, setReviewPayment] = useState<PaymentData | null>(null)
  const [reviewAction, setReviewAction] = useState<PaymentReviewAction>('send_back')
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewRequestKey, setReviewRequestKey] = useState('')
  const [slipUrl, setSlipUrl] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [incompletePage, setIncompletePage] = useState(1)
  const [incompletePageSize, setIncompletePageSize] = useState(10)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return payments.filter((payment) => {
      if (filterStatus !== 'all' && payment.status !== filterStatus) return false
      if (!q) return true

      return [
        payment.user_name,
        payment.user_email,
        payment.learner_name,
        payment.branch_name,
        payment.id,
        payment.booking_id,
        payment.notes || '',
      ].some((value) => value.toLowerCase().includes(q))
    })
  }, [payments, search, filterStatus])

  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)))
  const pagedPayments = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const filteredIncompleteBookings = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return incompleteBookings

    return incompleteBookings.filter((booking) => [
      booking.user_name,
      booking.user_email,
      booking.user_phone,
      booking.learner_name,
      booking.branch_name,
      booking.course_type,
      booking.id,
      booking.latest_payment_id || '',
    ].some((value) => String(value).toLowerCase().includes(q)))
  }, [incompleteBookings, search])

  const safeIncompletePage = Math.min(
    incompletePage,
    Math.max(1, Math.ceil(filteredIncompleteBookings.length / incompletePageSize)),
  )
  const pagedIncompleteBookings = filteredIncompleteBookings.slice(
    (safeIncompletePage - 1) * incompletePageSize,
    safeIncompletePage * incompletePageSize,
  )

  const stats = useMemo(() => {
    const approved = payments.filter((payment) => payment.status === 'approved')
    const pending = payments.filter((payment) => payment.status === 'pending')
    const rejected = payments.filter((payment) => payment.status === 'rejected')

    return {
      total: payments.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      approvedAmount: canViewFinancialAmounts ? approved.reduce((sum, payment) => sum + (payment.amount || 0), 0) : null,
      incomplete: incompleteBookings.length,
      waitingSlip: incompleteBookings.filter((booking) => booking.status === 'pending_payment').length,
      waitingVerify: incompleteBookings.filter((booking) => booking.status === 'paid').length,
      incompleteAmount: canViewFinancialAmounts ? incompleteBookings.reduce((sum, booking) => sum + (booking.total_price || 0), 0) : null,
    }
  }, [payments, incompleteBookings, canViewFinancialAmounts])

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

  const openReviewDialog = (payment: PaymentData, action: PaymentReviewAction) => {
    setReviewPayment(payment)
    setReviewAction(action)
    setReviewNotes('')
    setReviewError(null)
    setReviewRequestKey(crypto.randomUUID())
    setDetailOpen(false)
  }

  const submitReviewAction = async () => {
    if (!reviewPayment) return
    if (reviewAction !== 'approve' && !reviewNotes.trim()) {
      setReviewError('กรุณาระบุเหตุผลเพื่อให้ลูกค้าและทีมงานตรวจสอบย้อนหลังได้')
      return
    }

    setReviewSubmitting(true)
    setReviewError(null)
    try {
      const response = await fetch('/api/admin/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: reviewPayment.id,
          sourceKind: reviewPayment.source_kind,
          requestKey: reviewRequestKey,
          action: reviewAction,
          notes: reviewNotes.trim(),
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        setReviewError(result.error || 'ดำเนินการไม่สำเร็จ')
        return
      }

      setReviewPayment(null)
      router.refresh()
    } catch {
      setReviewError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setReviewSubmitting(false)
    }
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

        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            slipOkMode === 'live'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}
        >
          {slipOkMode === 'live'
            ? 'SlipOK ใช้งานจริง: รายการที่ตรวจผ่านจะยืนยัน booking อัตโนมัติ'
            : 'SlipOK TEST MODE: ใช้ทดสอบเท่านั้น รายการจริงต้องตั้งค่า env แล้ว redeploy'}
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setPaymentSettingsOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            ตั้งค่าการชำระเงิน
        </Button>
      </div>

      <div className={`grid grid-cols-2 gap-2 sm:gap-3 ${canViewFinancialAmounts ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
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
        {canViewFinancialAmounts && (
          <Card className="border-gray-200 max-xl:col-span-2">
            <CardContent className="flex items-center justify-between p-3 sm:p-4">
              <div className="min-w-0">
                <p className="text-xs text-gray-500">ยอดยืนยันแล้ว</p>
                <p className="mt-1 truncate text-xl font-bold text-[#153c85] sm:text-2xl">{formatMoney(stats.approvedAmount || 0)}</p>
              </div>
              <Banknote className="h-5 w-5 text-[#f57e3b]" />
            </CardContent>
          </Card>
        )}
      </div>

      {stats.incomplete > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-amber-950">รายการจองที่ยังไม่สมบูรณ์</p>
                  <p className="mt-1 text-sm text-amber-800">
                    รายการกลุ่มนี้ยังไม่ถูกส่งเข้า flow สอน/มอบหมายโค้ช จนกว่า booking จะเป็น `verified`
                  </p>
                </div>
              </div>
              <div className={`grid gap-2 text-center text-xs ${canViewFinancialAmounts ? 'grid-cols-3 lg:min-w-[320px]' : 'grid-cols-2 lg:min-w-[220px]'}`}>
                <div className="rounded-lg border border-amber-200 bg-white px-2 py-2">
                  <p className="text-amber-700">รอแนบสลิป</p>
                  <p className="mt-1 text-lg font-bold text-amber-900">{stats.waitingSlip}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-white px-2 py-2">
                  <p className="text-amber-700">รอตรวจ</p>
                  <p className="mt-1 text-lg font-bold text-amber-900">{stats.waitingVerify}</p>
                </div>
                {canViewFinancialAmounts && (
                  <div className="rounded-lg border border-amber-200 bg-white px-2 py-2">
                    <p className="text-amber-700">ยอดรวม</p>
                    <p className="mt-1 text-lg font-bold text-amber-900">{formatMoney(stats.incompleteAmount || 0)}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {pagedIncompleteBookings.map((booking) => {
                const isWaitingSlip = booking.status === 'pending_payment'
                const statusLabel = BOOKING_STATUS_LABELS[booking.status] || booking.status || 'ยังไม่สมบูรณ์'

                return (
                  <div
                    key={booking.id}
                    className="grid gap-3 rounded-lg border border-amber-200 bg-white p-3 lg:grid-cols-[minmax(220px,1fr)_minmax(180px,.8fr)_minmax(150px,.7fr)_auto] lg:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-gray-900">{booking.user_name}</p>
                        <Badge variant="outline" className={isWaitingSlip ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-blue-200 bg-blue-50 text-blue-700'}>
                          {statusLabel}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-gray-500">{booking.user_email || '-'}</p>
                      <p className="mt-1 truncate text-xs text-gray-400">{booking.user_phone || 'ไม่มีเบอร์โทร'}</p>
                    </div>

                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-gray-900">{booking.learner_name}</p>
                      <p className="mt-1 text-gray-500">{COURSE_LABELS[booking.course_type] || booking.course_type || '-'}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                        <Building2 className="h-3.5 w-3.5" />
                        {booking.branch_name}
                      </p>
                    </div>

                    <div className="text-sm">
                      {canViewFinancialAmounts && (
                        <p className="font-semibold text-gray-900">{formatMoney(booking.total_price || 0)}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        {MONTH_NAMES[booking.month]} {booking.year} · {booking.total_sessions} ครั้ง
                      </p>
                      <p className="mt-1 text-xs text-gray-400">สร้าง {formatDate(booking.created_at)}</p>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button variant="outline" size="sm" onClick={() => copyText(booking.id)}>
                        <Copy className="mr-1.5 h-4 w-4" />
                        {copiedId === booking.id ? 'คัดลอกแล้ว' : 'Booking ID'}
                      </Button>
                      {booking.latest_payment_id && (
                        <Button variant="outline" size="sm" onClick={() => copyText(booking.latest_payment_id!)}>
                          <Receipt className="mr-1.5 h-4 w-4" />
                          {copiedId === booking.latest_payment_id ? 'คัดลอกแล้ว' : booking.has_slip ? 'มีสลิป' : 'Payment'}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}

              {filteredIncompleteBookings.length === 0 && (
                <div className="rounded-lg border border-dashed border-amber-200 bg-white/70 p-6 text-center text-sm text-amber-700">
                  ไม่พบรายการจองที่ยังไม่สมบูรณ์ตามคำค้นหานี้
                </div>
              )}
            </div>

            {filteredIncompleteBookings.length > 0 && (
              <ListPagination
                page={safeIncompletePage}
                pageSize={incompletePageSize}
                total={filteredIncompleteBookings.length}
                onPageChange={setIncompletePage}
                onPageSizeChange={(nextPageSize) => {
                  setIncompletePageSize(nextPageSize)
                  setIncompletePage(1)
                }}
              />
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-gray-200">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="ค้นหาชื่อ, อีเมล, สาขา, payment id, booking id..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                  setIncompletePage(1)
                }}
                className="pl-10"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                value={filterStatus}
                onValueChange={(value) => {
                  setFilterStatus(value)
                  setPage(1)
                }}
              >
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
          <div className="hidden grid-cols-[72px_minmax(220px,1.2fr)_minmax(180px,.95fr)_minmax(130px,.7fr)_minmax(220px,.85fr)_minmax(178px,auto)] gap-4 border-b bg-gray-50 px-4 py-3 text-xs font-medium text-gray-500 2xl:grid">
            <span>สลิป</span>
            <span>ผู้ชำระเงิน</span>
            <span>คอร์ส/สาขา</span>
            <span>สถานะ</span>
            <span>เวลา</span>
            <span className="text-right">จัดการ</span>
          </div>

          <div className="divide-y">
            {pagedPayments.map((payment) => {
              const statusCfg = STATUS_CONFIG[payment.status]
              const StatusIcon = statusCfg.icon
              const source = getVerificationSource(payment)

              return (
                <div
                  key={payment.id}
                  className="grid gap-3 px-4 py-4 transition-colors hover:bg-gray-50 2xl:grid-cols-[72px_minmax(220px,1.2fr)_minmax(180px,.95fr)_minmax(130px,.7fr)_minmax(220px,.85fr)_minmax(178px,auto)] 2xl:items-center 2xl:gap-4"
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
                    <p className="mt-1 truncate text-gray-500">{payment.learner_name}</p>
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
                    {canViewFinancialAmounts && (
                      <p className="text-lg font-bold text-gray-900">{formatMoney(payment.amount || 0)}</p>
                    )}
                  </div>

                  <div className="min-w-0 pr-2 text-sm text-gray-500">
                    <p className="whitespace-nowrap">{formatDate(payment.created_at)}</p>
                    {payment.verified_at && (
                      <p className="mt-1 whitespace-nowrap text-xs text-emerald-600">ยืนยัน {formatDate(payment.verified_at)}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 2xl:min-w-[178px] 2xl:justify-end">
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
        </div>
      )}

      <Dialog open={paymentSettingsOpen} onOpenChange={setPaymentSettingsOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">ตั้งค่าการชำระเงิน</DialogTitle>
            <DialogDescription className="sr-only">ตั้งค่าข้อมูลบัญชีที่แสดงให้ผู้ใช้เห็นในขั้นตอนแนบสลิป</DialogDescription>
          </DialogHeader>
          <PaymentSettingsClient settings={paymentTransferSettings} compact />
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">รายละเอียดการชำระเงิน</DialogTitle>
            <DialogDescription className="sr-only">ตรวจข้อมูลการชำระเงิน สถานะ SlipOK และหลักฐานสลิปของรายการนี้</DialogDescription>
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
                  {canViewFinancialAmounts ? (
                    <>
                      <p className="text-xs text-gray-400">ยอดชำระ</p>
                      <p className="mt-2 text-2xl font-bold text-[#153c85]">{formatMoney(detailPayment.amount || 0)}</p>
                      <p className="text-xs text-gray-500">วิธีชำระเงิน: {detailPayment.method || '-'}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-gray-400">วิธีชำระเงิน</p>
                      <p className="mt-2 font-medium text-gray-900">{detailPayment.method || '-'}</p>
                      <p className="mt-1 text-xs text-gray-500">ซ่อนยอดเงินตามสิทธิ์ผู้ใช้</p>
                    </>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg border p-3 sm:col-span-2">
                  <p className="text-xs text-gray-400">ผู้เรียน</p>
                  <p className="mt-1 font-medium">{detailPayment.learner_name}</p>
                </div>
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

              {detailPayment.status === 'pending' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-amber-900">การตอบกลับรายการนี้</p>
                  <p className="mt-1 text-xs text-amber-700">
                    ถ้า SlipOK ไม่ผ่าน ให้เลือกตีกลับเพื่อให้ User เห็นเหตุผลและแนบสลิปใหม่ได้ หรือยกเลิกเมื่อรายการไม่ควรไปต่อ
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => openReviewDialog(detailPayment, 'approve')}>
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      อนุมัติด้วยตนเอง
                    </Button>
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => openReviewDialog(detailPayment, 'send_back')}>
                      <AlertTriangle className="mr-1.5 h-4 w-4" />
                      ตีกลับให้แนบใหม่
                    </Button>
                    {detailPayment.source_kind === 'legacy' ? (
                      <Button size="sm" variant="destructive" onClick={() => openReviewDialog(detailPayment, 'cancel')}>
                        <XCircle className="mr-1.5 h-4 w-4" />
                        ปฏิเสธและยกเลิก
                      </Button>
                    ) : null}
                  </div>
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

      <Dialog open={!!reviewPayment} onOpenChange={(open) => {
        if (!open && !reviewSubmitting) setReviewPayment(null)
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">{PAYMENT_REVIEW_COPY[reviewAction].title}</DialogTitle>
            <DialogDescription>{PAYMENT_REVIEW_COPY[reviewAction].description}</DialogDescription>
          </DialogHeader>
          {reviewPayment && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-gray-50 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">{reviewPayment.user_name}</p>
                    <p className="truncate text-xs text-gray-500">{reviewPayment.user_email || '-'}</p>
                  </div>
                  {canViewFinancialAmounts && (
                    <p className="shrink-0 text-lg font-bold text-[#153c85]">{formatMoney(reviewPayment.amount || 0)}</p>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-500">Booking {getShortId(reviewPayment.booking_id)} · Payment {getShortId(reviewPayment.id)}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  เหตุผล/หมายเหตุ {reviewAction === 'approve' ? '(ไม่บังคับ)' : '(บังคับ)'}
                </label>
                <Textarea
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  placeholder={reviewAction === 'approve' ? 'เช่น ตรวจสลิปกับบัญชีแล้วถูกต้อง' : 'เช่น บัญชีปลายทางไม่ตรง / ยอดไม่ตรง / แพ็กเกจ SlipOK หมดอายุ'}
                  className="min-h-28"
                />
              </div>

              {reviewError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {reviewError}
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setReviewPayment(null)} disabled={reviewSubmitting}>
                  ยกเลิก
                </Button>
                <Button className={PAYMENT_REVIEW_COPY[reviewAction].buttonClass} onClick={submitReviewAction} disabled={reviewSubmitting}>
                  {reviewSubmitting ? <Clock className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {PAYMENT_REVIEW_COPY[reviewAction].button}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={slipOpen} onOpenChange={setSlipOpen}>
        <DialogContent className="max-h-[95vh] max-w-3xl p-3">
          <DialogHeader>
            <DialogTitle className="text-sm text-[#153c85]">สลิปการโอนเงิน</DialogTitle>
            <DialogDescription className="sr-only">แสดงรูปสลิปการโอนเงินแบบเต็มสำหรับตรวจสอบ</DialogDescription>
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
