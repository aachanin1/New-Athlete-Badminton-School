'use client'

import { useState, useMemo, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { formatThaiDateTimeWithWeekday, formatThaiDateWithWeekday } from '@/lib/date-format'
import { fmtTime } from '@/lib/utils'
import { hasPaymentTransferSettings, type PaymentTransferSettings } from '@/lib/payment-settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  CalendarDays,
  MapPin,
  CreditCard,
  Upload,
  Loader2,
  ImageIcon,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Ticket,
} from 'lucide-react'

interface BookingWithRelations {
  id: string
  user_id: string
  learner_type: string
  child_id: string | null
  branch_id: string
  course_type_id: string
  month: number
  year: number
  total_sessions: number
  total_price: number
  status: string
  created_at: string
  branches?: { name: string } | null
  children?: { full_name: string; nickname: string | null } | null
  course_types?: { name: string } | null
  profiles?: { full_name: string; email: string } | null
}

interface PaymentRow {
  id: string
  booking_id: string
  user_id: string
  amount: number
  method: string
  slip_image_url: string | null
  status: string
  verified_by: string | null
  verified_at: string | null
  notes: string | null
  created_at: string
}

interface SessionDetail {
  id: string
  booking_id: string
  rescheduled_from_id: string | null
  wallet_credit_status: string | null
  wallet_redeemed_session_id: string | null
  wallet_redeemed_at: string | null
  wallet_expired_at: string | null
  wallet_expires_at: string | null
  date: string
  start_time: string
  end_time: string
  branch_id: string
  child_id: string | null
  status: string
  display_status: string
  is_makeup: boolean
  children?: { full_name: string; nickname: string | null } | null
  branches?: { name: string } | null
}

interface SlipVerifyData {
  transRef?: string
  amount?: number
  sender?: string
}

type PaymentUploadStep = 'idle' | 'uploading' | 'verifying' | 'refreshing' | 'failed'

interface VerifySlipResult {
  verified: boolean
  slipData?: SlipVerifyData | null
  notes?: string | null
  reviewMessage?: string | null
  warningCode?: string | null
}

interface VerifySlipApiResponse extends VerifySlipResult {
  success?: boolean
  error?: string
  code?: string
  paymentRecorded?: boolean
  supportReviewRequired?: boolean
}

interface CouponUsageDetail {
  id: string
  coupon_id: string
  booking_id: string
  discount_amount: number
  used_at: string
  coupons?: {
    code: string
    discount_type: string
    discount_value: number
  } | null
}

interface HistoryClientProps {
  bookings: BookingWithRelations[]
  payments: PaymentRow[]
  userId: string
  isAdmin?: boolean
  sessionCountMap?: Record<string, number>
  bookingChildNamesMap?: Record<string, string[]>
  bookingSessionsMap?: Record<string, SessionDetail[]>
  couponUsageMap?: Record<string, CouponUsageDetail[]>
  paymentTransferSettings?: PaymentTransferSettings
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending_payment: { label: 'รอแนบสลิป', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  paid: { label: 'ส่งสลิปแล้ว', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  verified: { label: 'จองสำเร็จ', color: 'bg-green-100 text-green-700 border-green-200' },
  cancelled: { label: 'ยกเลิก', color: 'bg-red-100 text-red-700 border-red-200' },
}

const PAYMENT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'รอตรวจสอบเพิ่ม', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'ยืนยันแล้ว', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'ไม่ผ่าน', color: 'bg-red-100 text-red-700' },
}

const STATUS_HELP: Record<string, string> = {
  pending_payment: 'ยังไม่ส่งสลิป กรุณาโอนเงินและแนบสลิปเพื่อให้ระบบตรวจสอบ',
  paid: 'ระบบรับสลิปแล้ว แต่ SlipOK ยังไม่ยืนยันอัตโนมัติ แอดมินจะตรวจสอบต่อ',
  verified: 'ระบบยืนยันการชำระเงินแล้ว ตารางเรียนพร้อมใช้งาน',
  cancelled: 'รายการนี้ถูกยกเลิกแล้ว',
}

const SESSION_STATUS_MAP: Record<string, { label: string; className: string }> = {
  scheduled: { label: 'นัดหมาย', className: 'bg-blue-50 text-blue-700' },
  upcoming: { label: 'รอเรียน', className: 'bg-slate-50 text-slate-700' },
  in_progress: { label: 'กำลังเรียน', className: 'bg-blue-50 text-blue-700' },
  completed: { label: 'เรียนแล้ว', className: 'bg-green-50 text-green-700' },
  rescheduled: { label: 'เลื่อนแล้ว', className: 'bg-orange-50 text-orange-700' },
  absent: { label: 'ขาดเรียน', className: 'bg-red-50 text-red-700' },
  walleted: { label: 'อยู่ในกระเป๋า', className: 'bg-violet-50 text-violet-700' },
  attendance_gap_review: { label: 'รอตรวจสอบการเช็คชื่อ', className: 'bg-orange-50 text-orange-700' },
}

const COURSE_LABELS: Record<string, string> = {
  kids_group: 'เด็ก (กลุ่ม)',
  adult_group: 'ผู้ใหญ่ (กลุ่ม)',
  private: 'Private',
}

const MONTH_NAMES = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const BOOKINGS_PREVIEW_PER_MONTH = 4
const ACTIVE_SESSION_STATUSES = new Set(['scheduled', 'completed', 'absent'])

const PAYMENT_UPLOAD_STEP_TEXT: Record<PaymentUploadStep, { title: string; description: string }> = {
  idle: {
    title: '',
    description: '',
  },
  uploading: {
    title: 'กำลังอัปโหลดสลิป',
    description: 'ระบบกำลังส่งไฟล์สลิป กรุณาอย่าปิดหน้านี้',
  },
  verifying: {
    title: 'กำลังตรวจสอบสลิป',
    description: 'SlipOK อาจใช้เวลาหลายวินาที ระบบยังทำงานอยู่',
  },
  refreshing: {
    title: 'บันทึกสลิปสำเร็จ',
    description: 'กำลังอัปเดตสถานะล่าสุดของรายการจอง',
  },
  failed: {
    title: 'ส่งสลิปไม่สำเร็จ',
    description: 'กรุณาอ่านข้อความด้านบนก่อนลองส่งซ้ำ หากระบบแจ้งว่ารับสลิปแล้ว ให้ติดต่อเจ้าหน้าที่พร้อม Booking ID',
  },
}

function isActiveSession(session: SessionDetail) {
  return ACTIVE_SESSION_STATUSES.has(session.status)
}

function getLearnerName(session: SessionDetail) {
  return session.children?.nickname || session.children?.full_name || 'ตัวเอง'
}

function getSessionDateLabel(session: SessionDetail) {
  return formatThaiDateWithWeekday(session.date)
}

function getSessionStatusConfig(session: SessionDetail) {
  return SESSION_STATUS_MAP[session.display_status] || SESSION_STATUS_MAP[session.status]
}

function getWalletCreditStatusConfig(session: SessionDetail) {
  if (session.wallet_credit_status === 'redeemed') {
    return {
      label: 'ใช้สิทธิ์แล้ว',
      description: 'เลือกวันใหม่แล้ว',
      className: 'bg-emerald-50 text-emerald-700',
    }
  }

  if (session.wallet_credit_status === 'expired') {
    return {
      label: 'หมดอายุ',
      description: 'สิทธิ์ในกระเป๋าหมดอายุแล้ว',
      className: 'bg-gray-50 text-gray-600',
    }
  }

  if (session.wallet_credit_status === 'cancelled') {
    return {
      label: 'ยกเลิกแล้ว',
      description: 'สิทธิ์ในกระเป๋าถูกยกเลิกแล้ว',
      className: 'bg-red-50 text-red-700',
    }
  }

  return {
    label: 'รอเลือกวันใหม่',
    description: 'ยังไม่ใช้สิทธิ์ อยู่ในกระเป๋าเรียน',
    className: 'bg-violet-50 text-violet-700',
  }
}

function getLearnerSessionCounts(sessions: SessionDetail[], fallbackNames: string[], fallbackTotal: number) {
  const activeSessions = sessions.filter(isActiveSession)

  if (activeSessions.length > 0) {
    const childCounts: Record<string, number> = {}
    activeSessions.forEach((session) => {
      const name = getLearnerName(session)
      childCounts[name] = (childCounts[name] || 0) + 1
    })
    return Object.entries(childCounts).map(([name, count]) => ({ name, count }))
  }

  if (sessions.length > 0) {
    return []
  }

  return fallbackNames.map((name) => ({ name, count: fallbackTotal }))
}

export function HistoryClient({ bookings, payments, userId: _userId, isAdmin = false, sessionCountMap = {}, bookingChildNamesMap = {}, bookingSessionsMap = {}, couponUsageMap = {}, paymentTransferSettings }: HistoryClientProps) {
  const router = useRouter()
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<BookingWithRelations | null>(null)
  const [payBookingIds, setPayBookingIds] = useState<string[]>([])
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipPreview, setSlipPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadStep, setUploadStep] = useState<PaymentUploadStep>('idle')
  const [error, setError] = useState<string | null>(null)
  const [expandedMonthKeys, setExpandedMonthKeys] = useState<Set<string>>(new Set())

  // Alert dialog state (replaces browser confirm)
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertTitle, setAlertTitle] = useState('')
  const [alertDesc, setAlertDesc] = useState('')
  const [alertAction, setAlertAction] = useState<(() => void) | null>(null)
  const [alertVariant, setAlertVariant] = useState<'danger' | 'warning'>('danger')
  const showPaymentTransferSettings = paymentTransferSettings && hasPaymentTransferSettings(paymentTransferSettings)

  const showConfirm = useCallback((title: string, desc: string, action: () => void, variant: 'danger' | 'warning' = 'danger') => {
    setAlertTitle(title)
    setAlertDesc(desc)
    setAlertAction(() => action)
    setAlertVariant(variant)
    setAlertOpen(true)
  }, [])

  // Group pending bookings for combined payment
  const pendingBookings = bookings.filter((b) => b.status === 'pending_payment')
  const pendingTotal = pendingBookings.reduce((sum, b) => sum + b.total_price, 0)
  const paymentsByBookingId = useMemo(() => {
    const map = new Map<string, PaymentRow[]>()
    payments.forEach((payment) => {
      const bookingPayments = map.get(payment.booking_id) || []
      bookingPayments.push(payment)
      map.set(payment.booking_id, bookingPayments)
    })
    return map
  }, [payments])
  const latestRejectedPaymentByBookingId = useMemo(() => {
    const map = new Map<string, PaymentRow>()
    payments.forEach((payment) => {
      if (payment.status !== 'rejected') return

      const existing = map.get(payment.booking_id)
      const paymentTime = new Date(payment.verified_at || payment.created_at).getTime()
      const existingTime = existing ? new Date(existing.verified_at || existing.created_at).getTime() : -1
      if (!existing || paymentTime > existingTime) {
        map.set(payment.booking_id, payment)
      }
    })
    return map
  }, [payments])

  const openDetailDialog = (booking: BookingWithRelations) => {
    setSelectedBooking(booking)
    setError(null)
    setDetailDialogOpen(true)
  }

  const handleCancelBooking = (bookingId: string) => {
    showConfirm(
      'ยืนยันยกเลิกการจอง',
      'การจองที่ยกเลิกแล้วจะไม่สามารถกู้คืนได้ คุณต้องการยกเลิกหรือไม่?',
      async () => {
        setLoading(true)
        setError(null)
        const response = await fetch('/api/bookings', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cancel_pending_booking', bookingId }),
        })
        const result = await response.json()

        if (!response.ok) {
          setError(result.error || 'ยกเลิกไม่สำเร็จ กรุณาลองใหม่')
          setLoading(false)
          return
        }

        setLoading(false)
        setDetailDialogOpen(false)
        router.refresh()
      },
      'danger'
    )
  }

  const openPayDialog = (booking: BookingWithRelations) => {
    setSelectedBooking(booking)
    setPayBookingIds([booking.id])
    setSlipFile(null)
    setSlipPreview(null)
    setError(null)
    setUploadStep('idle')
    setVerifyResult(null)
    setPayDialogOpen(true)
  }

  const openGroupPayDialog = () => {
    setSelectedBooking(pendingBookings[0] || null)
    setPayBookingIds(pendingBookings.map((b) => b.id))
    setSlipFile(null)
    setSlipPreview(null)
    setError(null)
    setUploadStep('idle')
    setVerifyResult(null)
    setPayDialogOpen(true)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('กรุณาเลือกไฟล์รูปภาพเท่านั้น')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('ไฟล์ต้องมีขนาดไม่เกิน 5MB')
      return
    }

    setSlipFile(file)
    setError(null)
    setUploadStep('idle')
    setVerifyResult(null)

    const reader = new FileReader()
    reader.onload = (ev) => setSlipPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const [verifyResult, setVerifyResult] = useState<VerifySlipResult | null>(null)

  const handleSubmitPayment = async () => {
    if (loading || payBookingIds.length === 0 || !slipFile) return
    setLoading(true)
    setUploadStep('uploading')
    setError(null)
    setVerifyResult(null)

    const verifyingTimer = window.setTimeout(() => {
      setUploadStep('verifying')
    }, 1200)

    try {
      const expectedAmount = payBookingIds.reduce((sum, id) => {
        const b = bookings.find((bk) => bk.id === id)
        return sum + (b?.total_price || 0)
      }, 0)

      const formData = new FormData()
      formData.append('file', slipFile)
      formData.append('bookingIds', JSON.stringify(payBookingIds))
      formData.append('expectedAmount', String(expectedAmount))

      const res = await fetch('/api/verify-slip', { method: 'POST', body: formData })
      const json = await res.json().catch(() => ({})) as VerifySlipApiResponse
      window.clearTimeout(verifyingTimer)

      if (!res.ok) {
        setError(json.error || 'เกิดข้อผิดพลาดในการตรวจสอบสลิป กรุณาลองใหม่อีกครั้ง')
        setLoading(false)
        setUploadStep('failed')
        if (json.paymentRecorded || json.supportReviewRequired) {
          router.refresh()
        }
        return
      }

      setVerifyResult({
        verified: json.verified,
        slipData: json.slipData,
        notes: json.notes,
        reviewMessage: json.reviewMessage,
        warningCode: json.warningCode,
      })
      setUploadStep('refreshing')

      if (json.verified) {
        window.setTimeout(() => {
          setPayDialogOpen(false)
          setLoading(false)
          setUploadStep('idle')
          router.refresh()
        }, 1400)
      } else {
        setLoading(false)
        window.setTimeout(() => {
          setPayDialogOpen(false)
          setUploadStep('idle')
          router.refresh()
        }, 2200)
      }
    } catch {
      window.clearTimeout(verifyingTimer)
      setError('เชื่อมต่อระบบตรวจสอบสลิปไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่')
      setLoading(false)
      setUploadStep('failed')
    }
  }

  const getBookingPayments = (bookingId: string) => {
    return paymentsByBookingId.get(bookingId) || []
  }

  const getLatestRejectedPayment = (bookingId: string) => {
    return latestRejectedPaymentByBookingId.get(bookingId)
  }

  // Group bookings by month/year for display
  const groupedBookings = useMemo(() => {
    const groups: { key: string; label: string; year: number; month: number; bookings: BookingWithRelations[]; total: number }[] = []
    const map = new Map<string, BookingWithRelations[]>()

    bookings.forEach((b) => {
      const key = `${b.year}-${String(b.month).padStart(2, '0')}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(b)
    })

    // Sort by key descending (newest first)
    const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a))

    sortedKeys.forEach((key) => {
      const items = map.get(key)!
      const first = items[0]
      const total = items
        .filter((b) => b.status !== 'cancelled')
        .reduce((sum, b) => sum + b.total_price, 0)
      groups.push({
        key,
        label: `${MONTH_NAMES[first.month]} ${first.year}`,
        year: first.year,
        month: first.month,
        bookings: items,
        total,
      })
    })

    return groups
  }, [bookings])

  const toggleMonthExpanded = (monthKey: string) => {
    setExpandedMonthKeys((prev) => {
      const next = new Set(prev)
      if (next.has(monthKey)) {
        next.delete(monthKey)
      } else {
        next.add(monthKey)
      }
      return next
    })
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="text-center text-gray-400">
            <CalendarDays className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">ยังไม่มีประวัติการจอง</p>
            <p className="text-sm mt-1">จองคอร์สเรียนเพื่อเริ่มต้น</p>
            <Button
              className="mt-4 bg-[#2748bf] hover:bg-[#153c85]"
              onClick={() => router.push('/dashboard/booking')}
            >
              จองคอร์สเรียน
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Compute grouped payment total for dialog
  const payDialogTotal = payBookingIds.reduce((sum, id) => {
    const b = bookings.find((bk) => bk.id === id)
    return sum + (b?.total_price || 0)
  }, 0)
  const selectedBookingSessions = selectedBooking ? bookingSessionsMap[selectedBooking.id] || [] : []
  const selectedActiveSessions = selectedBookingSessions.filter(isActiveSession)
  const selectedRescheduledSessions = selectedBookingSessions.filter((session) => session.status === 'rescheduled')
  const selectedWalletedSessions = selectedBookingSessions.filter((session) => session.status === 'walleted')
  const selectedActiveWalletedSessions = selectedWalletedSessions.filter((session) => !session.wallet_credit_status || session.wallet_credit_status === 'active')
  const selectedRescheduleTargetsBySourceId = new Map(
    selectedBookingSessions
      .filter((session) => session.rescheduled_from_id)
      .map((session) => [session.rescheduled_from_id!, session])
  )
  const selectedFallbackNames = selectedBooking
    ? bookingChildNamesMap[selectedBooking.id] || [selectedBooking.children?.full_name || 'ตัวเอง']
    : []
  const selectedLearnerCounts = selectedBooking
    ? getLearnerSessionCounts(selectedBookingSessions, selectedFallbackNames, selectedBooking.total_sessions)
    : []

  return (
    <>
      {/* Grouped payment banner */}
      {!isAdmin && pendingBookings.length > 1 && (
        <Card className="mb-4 border-[#f57e3b]/30 bg-[#f57e3b]/5">
          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <p className="font-medium text-[#153c85]">รอชำระเงิน {pendingBookings.length} รายการ</p>
              <p className="text-sm text-gray-600">
                {(() => {
                  const nameCountMap: Record<string, number> = {}
                  pendingBookings.forEach((b) => {
                    const sessions = bookingSessionsMap[b.id] || []
                    const counts = getLearnerSessionCounts(
                      sessions,
                      bookingChildNamesMap[b.id] || [b.children?.full_name || 'ตัวเอง'],
                      b.total_sessions
                    )
                    counts.forEach(({ name, count }) => {
                      nameCountMap[name] = (nameCountMap[name] || 0) + count
                    })
                  })
                  return Object.entries(nameCountMap).map(([name, count]) => `${name} = ${count} ครั้ง`).join(', ')
                })()} — รวม ฿{pendingTotal.toLocaleString()}
              </p>
            </div>
            <Button className="bg-[#f57e3b] hover:bg-[#e06a2a] whitespace-nowrap" onClick={openGroupPayDialog}>
              <Upload className="h-4 w-4 mr-1" />ชำระเงินรวม ฿{pendingTotal.toLocaleString()}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-8">
        {groupedBookings.map((group) => {
          const isExpanded = expandedMonthKeys.has(group.key)
          const visibleBookings = isExpanded ? group.bookings : group.bookings.slice(0, BOOKINGS_PREVIEW_PER_MONTH)
          const hiddenCount = group.bookings.length - visibleBookings.length

          return (
          <div key={group.key}>
            {/* Month header with summary */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 bg-[#2748bf] rounded-full" />
                <h2 className="text-lg font-bold text-[#153c85]">{group.label}</h2>
                <Badge variant="outline" className="text-xs">{group.bookings.length} รายการ</Badge>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">ยอดรวมเดือนนี้</p>
                <p className="text-lg font-bold text-[#2748bf]">฿{group.total.toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-3">
              {visibleBookings.map((booking) => {
                const status = STATUS_MAP[booking.status] || STATUS_MAP.pending_payment
                const bookingPayments = getBookingPayments(booking.id)
                const latestRejectedPayment = getLatestRejectedPayment(booking.id)
                const couponUsages = couponUsageMap[booking.id] || []
                const couponDiscount = couponUsages.reduce((sum, usage) => sum + Number(usage.discount_amount || 0), 0)
                const bookingSessionCounts = getLearnerSessionCounts(
                  bookingSessionsMap[booking.id] || [],
                  bookingChildNamesMap[booking.id] || [booking.children?.full_name || 'ตัวเอง'],
                  booking.total_sessions
                )

                return (
                  <Card key={booking.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={status.color}>{status.label}</Badge>
                            <Badge variant="outline">{booking.course_types ? COURSE_LABELS[booking.course_types.name] || booking.course_types.name : '-'}</Badge>
                          </div>
                          <p className="text-xs text-gray-500">{STATUS_HELP[booking.status] || STATUS_HELP.pending_payment}</p>
                          {!isAdmin && booking.status === 'pending_payment' && latestRejectedPayment?.notes && (
                            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                              <p className="font-medium">สลิปก่อนหน้าไม่ผ่าน กรุณาแนบสลิปใหม่</p>
                              <p className="mt-1 whitespace-pre-wrap">{latestRejectedPayment.notes}</p>
                            </div>
                          )}

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                            <div className="flex items-center gap-1.5 text-gray-600">
                              <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                              <span>{MONTH_NAMES[booking.month]} {booking.year}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-gray-600">
                              <MapPin className="h-3.5 w-3.5 text-gray-400" />
                              <span>{booking.branches?.name || '-'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-gray-600">
                              <Clock className="h-3.5 w-3.5 text-gray-400" />
                              <span>{booking.total_sessions} ครั้ง</span>
                            </div>
                            {(bookingChildNamesMap[booking.id]?.length > 0 || booking.children) && (
                              <div className="flex items-center gap-1.5 text-gray-600 col-span-2 md:col-span-4">
                                <span>👦 {bookingSessionCounts.length > 0
                                  ? bookingSessionCounts.map(({ name, count }) => `${name} (${count} ครั้ง)`).join(', ')
                                  : bookingChildNamesMap[booking.id]?.join(', ') || booking.children?.full_name || '-'}</span>
                              </div>
                            )}
                          </div>
                          {isAdmin && booking.profiles && (
                            <p className="text-xs text-gray-400 mt-1">ผู้จอง: {booking.profiles.full_name} ({booking.profiles.email})</p>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-3">
                          <p className="text-xl font-bold text-[#2748bf]">฿{booking.total_price.toLocaleString()}</p>
                          {couponUsages.length > 0 && (
                            <div className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-orange-200">
                              <Ticket className="h-3 w-3" />
                              {couponUsages[0].coupons?.code || 'COUPON'} ลด ฿{couponDiscount.toLocaleString()}
                            </div>
                          )}
                          <div className="flex flex-wrap justify-end gap-2">
                            {booking.status !== 'cancelled' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[#153c85] border-[#153c85]/30 hover:bg-[#153c85]/5"
                                onClick={() => openDetailDialog(booking)}
                              >
                                <CalendarDays className="h-3.5 w-3.5 mr-1" />
                                ดูรายละเอียด
                              </Button>
                            )}
                            {!isAdmin && booking.status === 'pending_payment' && pendingBookings.length <= 1 && (
                              <Button
                                size="sm"
                                className="bg-[#f57e3b] hover:bg-[#e06a2a]"
                                onClick={() => openPayDialog(booking)}
                              >
                                <Upload className="h-3.5 w-3.5 mr-1" />
                                แนบสลิป
                              </Button>
                            )}
                            {!isAdmin && booking.status === 'verified' && (sessionCountMap[booking.id] || 0) < booking.total_sessions && (
                              <div className="max-w-[260px] rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                รายการเก่ายังเลือกวันไม่ครบ กรุณาจองรอบใหม่จากหน้าจองคอร์สหรือแจ้งแอดมินให้ช่วยตรวจสอบ
                              </div>
                            )}
                          </div>
                          {!isAdmin && booking.status === 'verified' && (sessionCountMap[booking.id] || 0) >= booking.total_sessions && (
                            <p className="text-xs text-green-600">เลือกวันเรียนครบแล้ว</p>
                          )}
                        </div>
                      </div>

                      {/* Payment info */}
                      {bookingPayments.length > 0 && (
                        <div className="mt-3 border-t pt-3">
                          {bookingPayments.map((payment) => {
                            const pStatus = PAYMENT_STATUS_MAP[payment.status] || PAYMENT_STATUS_MAP.pending
                            return (
                              <div key={payment.id} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  {payment.status === 'approved' ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  ) : payment.status === 'rejected' ? (
                                    <XCircle className="h-4 w-4 text-red-500" />
                                  ) : (
                                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                                  )}
                                  <span className="text-gray-600">สลิปโอนเงิน</span>
                                  <Badge className={pStatus.color} variant="outline">{pStatus.label}</Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  {payment.slip_image_url && (
                                    <a
                                      href={payment.slip_image_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[#2748bf] hover:underline flex items-center gap-1"
                                    >
                                      <ImageIcon className="h-3.5 w-3.5" />
                                      ดูสลิป
                                    </a>
                                  )}
                                  {isAdmin && payment.status === 'pending' && (
                                    <span className="text-xs text-gray-500">ตรวจต่อที่เมนูตรวจสอบการชำระเงิน</span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
              {group.bookings.length > BOOKINGS_PREVIEW_PER_MONTH && (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleMonthExpanded(group.key)}
                  >
                    {isExpanded ? 'ย่อรายการ' : `ดูเพิ่มอีก ${hiddenCount} รายการ`}
                  </Button>
                </div>
              )}
            </div>
          </div>
          )
        })}
      </div>

      {/* Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">แนบสลิปโอนเงิน</DialogTitle>
            <DialogDescription>
              {payBookingIds.length > 1
                ? `ชำระรวม ${payBookingIds.length} รายการ — ยอด ฿${payDialogTotal.toLocaleString()}`
                : `ยอดชำระ: ฿${selectedBooking?.total_price.toLocaleString()}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-200">
                {error}
              </div>
            )}

            {uploadStep !== 'idle' && (
              <div
                className={`rounded-lg border p-3 text-sm ${
                  uploadStep === 'failed'
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-blue-200 bg-blue-50 text-blue-700'
                }`}
                aria-live="polite"
              >
                <div className="flex items-start gap-2">
                  {uploadStep === 'failed' ? (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                  )}
                  <div>
                    <p className="font-medium">{PAYMENT_UPLOAD_STEP_TEXT[uploadStep].title}</p>
                    <p className="mt-0.5 text-xs">{PAYMENT_UPLOAD_STEP_TEXT[uploadStep].description}</p>
                  </div>
                </div>
              </div>
            )}

            {showPaymentTransferSettings && paymentTransferSettings ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
                <p className="mb-2 font-medium text-blue-700">ข้อมูลการโอนเงิน</p>
                {paymentTransferSettings.bankName && <p className="text-blue-600">ธนาคาร: {paymentTransferSettings.bankName}</p>}
                {paymentTransferSettings.accountNumber && <p className="text-blue-600">เลขบัญชี: {paymentTransferSettings.accountNumber}</p>}
                {paymentTransferSettings.accountName && <p className="text-blue-600">ชื่อบัญชี: {paymentTransferSettings.accountName}</p>}
                {paymentTransferSettings.branchName && <p className="text-blue-600">สาขาบัญชี: {paymentTransferSettings.branchName}</p>}
                {paymentTransferSettings.promptPay && <p className="text-blue-600">PromptPay: {paymentTransferSettings.promptPay}</p>}
                {paymentTransferSettings.instructions && <p className="mt-2 text-blue-700">{paymentTransferSettings.instructions}</p>}
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
                  กรุณาโอนเข้าบัญชีที่แสดงเท่านั้น เลขบัญชีนี้ต้องตรงกับบัญชีที่ระบบ SlipOK ใช้ตรวจสอบ
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                ยังไม่ได้ตั้งค่าข้อมูลบัญชีรับโอน กรุณาติดต่อเจ้าหน้าที่ก่อนแนบสลิป
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="slip-upload">อัปโหลดสลิป</Label>
              <Input
                id="slip-upload"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="cursor-pointer"
                disabled={loading}
              />
            </div>

            {slipPreview && (
              <div className="relative h-64 overflow-hidden rounded-lg border bg-gray-50">
                <Image src={slipPreview} alt="สลิป" fill sizes="(max-width: 640px) 100vw, 448px" className="object-contain" />
              </div>
            )}

            {verifyResult && (
              <div className={`p-3 rounded-lg text-sm ${verifyResult.verified ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                {verifyResult.verified ? (
                  <div className="flex items-start gap-2 text-green-700">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">ยืนยันสลิปสำเร็จ!</p>
                      {verifyResult.slipData && (
                        <p className="text-xs mt-1">Ref: {verifyResult.slipData.transRef} • ฿{verifyResult.slipData.amount?.toLocaleString()} • {verifyResult.slipData.sender || '-'}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-yellow-700">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">อัปโหลดสลิปแล้ว — รอตรวจสอบเพิ่มเติม</p>
                      <p className="text-xs mt-1">{verifyResult.reviewMessage || verifyResult.notes}</p>
                      {verifyResult.warningCode && (
                        <p className="mt-1 text-[11px] text-yellow-600">รหัสตรวจสอบ: {verifyResult.warningCode}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!verifyResult && (
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setPayDialogOpen(false)}
                  disabled={loading}
                >
                  ยกเลิก
                </Button>
                <Button
                  className="flex-1 bg-[#2748bf] hover:bg-[#153c85]"
                  onClick={handleSubmitPayment}
                  disabled={!slipFile || loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {uploadStep === 'uploading' ? 'กำลังอัปโหลดสลิป...' : 'กำลังตรวจสอบสลิป...'}
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      ส่งสลิปชำระเงิน
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Booking Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">รายละเอียดการจอง</DialogTitle>
            <DialogDescription>
              {selectedBooking && (
                <>
                  {selectedBooking.course_types ? COURSE_LABELS[selectedBooking.course_types.name] || selectedBooking.course_types.name : '-'}
                  {' — '}{MONTH_NAMES[selectedBooking.month]} {selectedBooking.year}
                  {' — '}{selectedBooking.branches?.name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-4 mt-2">
              {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-200">
                  {error}
                </div>
              )}

              {/* Summary */}
              <div className="flex flex-col gap-3 p-3 bg-gray-50 rounded-lg sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-600">
                  <p>จำนวนที่ชำระ: <strong>{selectedBooking.total_sessions} ครั้ง</strong></p>
                  <p className="mt-0.5">
                    รอบเรียนที่มีวันเรียนแล้ว: <strong>{selectedActiveSessions.length}/{selectedBooking.total_sessions} ครั้ง</strong>
                  </p>
                  {selectedActiveWalletedSessions.length > 0 && (
                    <p className="mt-0.5">
                      อยู่ในกระเป๋า รอเลือกวันใหม่: <strong>{selectedActiveWalletedSessions.length} ครั้ง</strong>
                    </p>
                  )}
                  {selectedLearnerCounts.length > 0 && (
                    <p className="mt-0.5">
                      ผู้เรียน: {selectedLearnerCounts.map(({ name, count }) => `${name} (${count} ครั้ง)`).join(', ')}
                    </p>
                  )}
                  {selectedRescheduledSessions.length > 0 && (
                    <p className="mt-1 text-xs text-orange-700">
                      มีประวัติการเลื่อน {selectedRescheduledSessions.length} รายการ ไม่นับซ้ำในจำนวนครั้งที่ชำระแล้ว
                    </p>
                  )}
                </div>
                <p className="text-lg font-bold text-[#2748bf]">฿{selectedBooking.total_price.toLocaleString()}</p>
              </div>

              {/* Session list */}
              {(couponUsageMap[selectedBooking.id] || []).length > 0 && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm">
                  <div className="mb-2 flex items-center gap-2 font-semibold text-orange-700">
                    <Ticket className="h-4 w-4" />
                    ประวัติการใช้คูปอง
                  </div>
                  <div className="space-y-1.5">
                    {(couponUsageMap[selectedBooking.id] || []).map((usage) => (
                      <div key={usage.id} className="flex items-center justify-between gap-3 rounded-md bg-white/70 px-3 py-2">
                        <div>
                          <p className="font-mono font-semibold text-[#153c85]">{usage.coupons?.code || 'COUPON'}</p>
                          <p className="text-xs text-gray-500">{formatThaiDateTimeWithWeekday(usage.used_at)}</p>
                        </div>
                        <p className="font-bold text-orange-700">-฿{Number(usage.discount_amount || 0).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isAdmin && selectedBooking.status === 'pending_payment' && getLatestRejectedPayment(selectedBooking.id)?.notes && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  <p className="font-semibold">สลิปก่อนหน้าไม่ผ่าน กรุณาแนบสลิปใหม่</p>
                  <p className="mt-1 whitespace-pre-wrap">{getLatestRejectedPayment(selectedBooking.id)?.notes}</p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">รอบเรียนที่มีวันเรียนแล้ว:</p>
                {selectedActiveSessions.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีวันเรียน</p>
                ) : (
                  selectedActiveSessions.map((session) => {
                    const dayLabel = getSessionDateLabel(session)
                    const isPending = selectedBooking.status === 'pending_payment'
                    const sessionStatus = getSessionStatusConfig(session)

                    return (
                      <div key={session.id} className="flex flex-col gap-2 p-2.5 bg-white border rounded-lg sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3 text-sm">
                          <CalendarDays className="h-4 w-4 text-gray-400 shrink-0" />
                          <div>
                            <span className="font-medium">{dayLabel}</span>
                            <span className="text-gray-500 ml-2">{fmtTime(session.start_time)} - {fmtTime(session.end_time)}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <MapPin className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-gray-500">{session.branches?.name || '-'}</span>
                              {session.children && (
                                <span className="text-xs text-gray-500">• 👦 {session.children.nickname || session.children.full_name}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {isPending ? (
                          <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                            แก้ไขผ่านปฏิทิน
                          </span>
                        ) : sessionStatus && (
                          <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${sessionStatus.className}`}>
                            {sessionStatus.label}
                          </span>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {selectedWalletedSessions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">อยู่ในกระเป๋า / รอเลือกวันใหม่:</p>
                  <div className="space-y-2">
                    {selectedWalletedSessions.map((session) => {
                      const dayLabel = getSessionDateLabel(session)
                      const walletStatus = getWalletCreditStatusConfig(session)

                      return (
                        <div key={session.id} className="rounded-lg border border-violet-200 bg-violet-50/60 p-2.5 text-sm">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-medium text-violet-800">
                                {dayLabel} {fmtTime(session.start_time)} - {fmtTime(session.end_time)}
                              </p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                                <span>{session.branches?.name || '-'}</span>
                                <span>• {getLearnerName(session)}</span>
                              </div>
                              <p className="mt-1 text-xs text-violet-700">{walletStatus.description}</p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${walletStatus.className}`}>
                              {walletStatus.label}
                            </span>
                          </div>
                          {session.wallet_redeemed_session_id && (
                            <div className="mt-2 rounded-md border border-white/80 bg-white/70 px-3 py-2 text-xs text-gray-600">
                              มีรอบใหม่ในระบบแล้ว
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {selectedRescheduledSessions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">ประวัติการเลื่อนรอบ:</p>
                  <div className="space-y-2">
                    {selectedRescheduledSessions.map((session) => {
                      const dayLabel = getSessionDateLabel(session)
                      const targetSession = selectedRescheduleTargetsBySourceId.get(session.id)
                      const targetStatus = targetSession ? getSessionStatusConfig(targetSession) : null

                      return (
                        <div key={session.id} className="rounded-lg border border-orange-200 bg-orange-50/60 p-2.5 text-sm">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-medium text-orange-800">
                                {dayLabel} {fmtTime(session.start_time)} - {fmtTime(session.end_time)}
                              </p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                                <span>{session.branches?.name || '-'}</span>
                                <span>• {getLearnerName(session)}</span>
                              </div>
                            </div>
                            <span className="shrink-0 rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">
                              ถูกเลื่อนออกแล้ว
                            </span>
                          </div>
                          {targetSession && (
                            <div className="mt-2 rounded-md border border-white/80 bg-white/70 px-3 py-2 text-xs text-gray-600">
                              ไปเป็น {getSessionDateLabel(targetSession)} {fmtTime(targetSession.start_time)} - {fmtTime(targetSession.end_time)}
                              {targetStatus && (
                                <span className={`ml-2 rounded-full px-2 py-0.5 font-medium ${targetStatus.className}`}>
                                  {targetStatus.label}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2 border-t">
                {!isAdmin && selectedBooking.status === 'pending_payment' && (
                  <Button
                    className="w-full bg-[#2748bf] hover:bg-[#153c85]"
                    onClick={() => router.push(`/dashboard/booking?editBookingId=${selectedBooking.id}`)}
                  >
                    <CalendarDays className="h-4 w-4 mr-1" />
                    แก้ไขวันจอง (เลือกจากปฏิทิน)
                  </Button>
                )}
                <div className="flex gap-2">
                  {!isAdmin && selectedBooking.status === 'pending_payment' && (
                    <Button
                      variant="outline"
                      className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => handleCancelBooking(selectedBooking.id)}
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                      ยกเลิกจอง
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setDetailDialogOpen(false)}
                  >
                    ปิด
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Alert Dialog */}
      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertTitle}</AlertDialogTitle>
            <AlertDialogDescription>{alertDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className={alertVariant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#f57e3b] hover:bg-[#e06a2a]'}
              onClick={() => alertAction?.()}
            >
              ยืนยัน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
