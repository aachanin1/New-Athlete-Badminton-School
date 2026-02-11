'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmtTime } from '@/lib/utils'
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
  Plus,
  Trash2,
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

interface BranchRow {
  id: string
  name: string
}

interface SessionDetail {
  id: string
  booking_id: string
  date: string
  start_time: string
  end_time: string
  branch_id: string
  child_id: string | null
  status: string
  is_makeup: boolean
  children?: { full_name: string; nickname: string | null } | null
  branches?: { name: string } | null
}

interface HistoryClientProps {
  bookings: BookingWithRelations[]
  payments: PaymentRow[]
  userId: string
  isAdmin?: boolean
  sessionCountMap?: Record<string, number>
  bookingChildNamesMap?: Record<string, string[]>
  bookingSessionsMap?: Record<string, SessionDetail[]>
  branches?: BranchRow[]
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending_payment: { label: 'รอชำระเงิน', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  paid: { label: 'ชำระแล้ว รอตรวจสอบ', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  verified: { label: 'ยืนยันแล้ว', color: 'bg-green-100 text-green-700 border-green-200' },
  cancelled: { label: 'ยกเลิก', color: 'bg-red-100 text-red-700 border-red-200' },
}

const PAYMENT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'รอตรวจสอบ', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'อนุมัติ', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'ปฏิเสธ', color: 'bg-red-100 text-red-700' },
}

const COURSE_LABELS: Record<string, string> = {
  kids_group: 'เด็ก (กลุ่ม)',
  adult_group: 'ผู้ใหญ่ (กลุ่ม)',
  private: 'Private',
}

const MONTH_NAMES = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

export function HistoryClient({ bookings, payments, userId, isAdmin = false, sessionCountMap = {}, bookingChildNamesMap = {}, bookingSessionsMap = {}, branches = [] }: HistoryClientProps) {
  const router = useRouter()
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [pickDatesOpen, setPickDatesOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<BookingWithRelations | null>(null)
  const [payBookingIds, setPayBookingIds] = useState<string[]>([])
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipPreview, setSlipPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDates, setSelectedDates] = useState<{ date: string; startTime: string; endTime: string }[]>([])

  // Group pending bookings for combined payment
  const pendingBookings = bookings.filter((b) => b.status === 'pending_payment')
  const pendingTotal = pendingBookings.reduce((sum, b) => sum + b.total_price, 0)

  const handleApprovePayment = async (paymentId: string, bookingId: string, action: 'approved' | 'rejected') => {
    setLoading(true)
    const supabase = createClient()

    // Update payment status
    await (supabase.from('payments') as any)
      .update({ status: action, verified_by: userId, verified_at: new Date().toISOString() })
      .eq('id', paymentId)

    // Update booking status
    if (action === 'approved') {
      await (supabase.from('bookings') as any)
        .update({ status: 'verified' })
        .eq('id', bookingId)
    }

    setLoading(false)
    router.refresh()
  }

  const openPickDatesDialog = (booking: BookingWithRelations) => {
    setSelectedBooking(booking)
    setSelectedDates([])
    setError(null)
    setPickDatesOpen(true)
  }

  const addDateRow = () => {
    if (!selectedBooking) return
    const existingSessions = sessionCountMap[selectedBooking.id] || 0
    const maxNew = selectedBooking.total_sessions - existingSessions - selectedDates.length
    if (maxNew <= 0) return
    setSelectedDates([...selectedDates, { date: '', startTime: '17:00', endTime: '19:00' }])
  }

  const removeDateRow = (index: number) => {
    setSelectedDates(selectedDates.filter((_, i) => i !== index))
  }

  const updateDateRow = (index: number, field: string, value: string) => {
    const updated = [...selectedDates]
    updated[index] = { ...updated[index], [field]: value }
    setSelectedDates(updated)
  }

  const handleSubmitDates = async () => {
    if (!selectedBooking || selectedDates.length === 0) return

    // Validate all dates are filled
    const hasEmpty = selectedDates.some((d) => !d.date)
    if (hasEmpty) {
      setError('กรุณาเลือกวันเรียนให้ครบทุกรายการ')
      return
    }

    // Validate dates are in the future
    const today = new Date().toISOString().split('T')[0]
    const hasPast = selectedDates.some((d) => d.date <= today)
    if (hasPast) {
      setError('กรุณาเลือกวันที่ในอนาคตเท่านั้น')
      return
    }

    setLoading(true)
    setError(null)
    const supabase = createClient()

    const sessionsToCreate = selectedDates.map((d) => ({
      booking_id: selectedBooking.id,
      date: d.date,
      start_time: d.startTime,
      end_time: d.endTime,
      branch_id: selectedBooking.branch_id,
      status: 'scheduled',
      is_makeup: false,
    }))

    const { error: insertErr } = await (supabase.from('booking_sessions') as any).insert(sessionsToCreate)

    if (insertErr) {
      console.error('Insert sessions error:', insertErr)
      setError(`สร้างตารางเรียนไม่สำเร็จ: ${insertErr.message}`)
      setLoading(false)
      return
    }

    setPickDatesOpen(false)
    setLoading(false)
    router.refresh()
  }

  const openDetailDialog = (booking: BookingWithRelations) => {
    setSelectedBooking(booking)
    setError(null)
    setDetailDialogOpen(true)
  }

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('ยืนยันยกเลิกการจองนี้? การจองที่ยกเลิกแล้วจะไม่สามารถกู้คืนได้')) return
    setLoading(true)
    setError(null)
    const supabase = createClient()

    // Delete associated sessions
    await (supabase.from('booking_sessions') as any).delete().eq('booking_id', bookingId)

    // Update booking status to cancelled
    const { error: updateErr } = await (supabase.from('bookings') as any)
      .update({ status: 'cancelled' })
      .eq('id', bookingId)

    if (updateErr) {
      setError('ยกเลิกไม่สำเร็จ กรุณาลองใหม่')
    }

    setLoading(false)
    setDetailDialogOpen(false)
    router.refresh()
  }

  const handleDeleteSession = async (sessionId: string, bookingId: string) => {
    if (!confirm('ยืนยันลบวันเรียนนี้?')) return
    setLoading(true)
    const supabase = createClient()

    const { error: delErr } = await (supabase.from('booking_sessions') as any).delete().eq('id', sessionId)

    if (delErr) {
      setError('ลบไม่สำเร็จ กรุณาลองใหม่')
      setLoading(false)
      return
    }

    // Update booking total_sessions count
    const remaining = (bookingSessionsMap[bookingId] || []).filter((s) => s.id !== sessionId)
    await (supabase.from('bookings') as any)
      .update({ total_sessions: remaining.length })
      .eq('id', bookingId)

    setLoading(false)
    setDetailDialogOpen(false)
    router.refresh()
  }

  const openPayDialog = (booking: BookingWithRelations) => {
    setSelectedBooking(booking)
    setPayBookingIds([booking.id])
    setSlipFile(null)
    setSlipPreview(null)
    setError(null)
    setPayDialogOpen(true)
  }

  const openGroupPayDialog = () => {
    setSelectedBooking(pendingBookings[0] || null)
    setPayBookingIds(pendingBookings.map((b) => b.id))
    setSlipFile(null)
    setSlipPreview(null)
    setError(null)
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

    const reader = new FileReader()
    reader.onload = (ev) => setSlipPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmitPayment = async () => {
    if (payBookingIds.length === 0 || !slipFile) return
    setLoading(true)
    setError(null)

    const supabase = createClient()

    try {
      // Upload slip to Supabase Storage
      const fileExt = slipFile.name.split('.').pop()
      const fileName = `${userId}/${payBookingIds[0]}-${Date.now()}.${fileExt}`

      const { data: uploadData, error: uploadErr } = await supabase
        .storage
        .from('payment-slips')
        .upload(fileName, slipFile)

      if (uploadErr) {
        console.error('Upload error:', uploadErr)
        setError(`อัปโหลดสลิปไม่สำเร็จ: ${uploadErr.message}`)
        setLoading(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage.from('payment-slips').getPublicUrl(fileName)

      // Create payment record for each booking in the group
      for (const bookingId of payBookingIds) {
        const booking = bookings.find((b) => b.id === bookingId)
        await (supabase.from('payments') as any).insert({
          booking_id: bookingId,
          user_id: userId,
          amount: booking?.total_price || 0,
          method: 'transfer',
          slip_image_url: publicUrl,
          status: 'pending',
        })
      }

      // Update all booking statuses to 'paid'
      await (supabase.from('bookings') as any)
        .update({ status: 'paid' })
        .in('id', payBookingIds)

      setPayDialogOpen(false)
      setLoading(false)
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
      setLoading(false)
    }
  }

  const getBookingPayments = (bookingId: string) => {
    return payments.filter((p) => p.booking_id === bookingId)
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

  return (
    <>
      {/* Grouped payment banner */}
      {!isAdmin && pendingBookings.length > 1 && (
        <Card className="mb-4 border-[#f57e3b]/30 bg-[#f57e3b]/5">
          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <p className="font-medium text-[#153c85]">รอชำระเงิน {pendingBookings.length} รายการ</p>
              <p className="text-sm text-gray-600">
                {pendingBookings.map((b) => bookingChildNamesMap[b.id]?.join(', ') || b.children?.full_name || 'ตัวเอง').join(', ')} — รวม ฿{pendingTotal.toLocaleString()}
              </p>
            </div>
            <Button className="bg-[#f57e3b] hover:bg-[#e06a2a] whitespace-nowrap" onClick={openGroupPayDialog}>
              <Upload className="h-4 w-4 mr-1" />ชำระเงินรวม ฿{pendingTotal.toLocaleString()}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {bookings.map((booking) => {
          const status = STATUS_MAP[booking.status] || STATUS_MAP.pending_payment
          const bookingPayments = getBookingPayments(booking.id)

          return (
            <Card key={booking.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={status.color}>{status.label}</Badge>
                      <Badge variant="outline">{booking.course_types ? COURSE_LABELS[booking.course_types.name] || booking.course_types.name : '-'}</Badge>
                    </div>

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
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <span>👦 {bookingChildNamesMap[booking.id]?.join(', ') || booking.children?.full_name || '-'}</span>
                        </div>
                      )}
                    </div>
                    {isAdmin && booking.profiles && (
                      <p className="text-xs text-gray-400 mt-1">ผู้จอง: {booking.profiles.full_name} ({booking.profiles.email})</p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <p className="text-xl font-bold text-[#2748bf]">฿{booking.total_price.toLocaleString()}</p>
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
                        <Button
                          size="sm"
                          className="bg-[#2748bf] hover:bg-[#153c85]"
                          onClick={() => openPickDatesDialog(booking)}
                        >
                          <CalendarDays className="h-3.5 w-3.5 mr-1" />
                          เลือกวันเรียน ({sessionCountMap[booking.id] || 0}/{booking.total_sessions})
                        </Button>
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
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-green-600 border-green-300 hover:bg-green-50"
                                  onClick={() => handleApprovePayment(payment.id, booking.id, 'approved')}
                                  disabled={loading}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  อนุมัติ
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-red-600 border-red-300 hover:bg-red-50"
                                  onClick={() => handleApprovePayment(payment.id, booking.id, 'rejected')}
                                  disabled={loading}
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  ปฏิเสธ
                                </Button>
                              </div>
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

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
              <p className="font-medium text-blue-700 mb-2">ข้อมูลการโอนเงิน</p>
              <p className="text-blue-600">ธนาคาร: กสิกรไทย</p>
              <p className="text-blue-600">เลขบัญชี: XXX-X-XXXXX-X</p>
              <p className="text-blue-600">ชื่อบัญชี: New Athlete School</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slip-upload">อัปโหลดสลิป</Label>
              <Input
                id="slip-upload"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
            </div>

            {slipPreview && (
              <div className="border rounded-lg overflow-hidden">
                <img src={slipPreview} alt="สลิป" className="w-full max-h-64 object-contain bg-gray-50" />
              </div>
            )}

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
                    กำลังส่ง...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    ส่งสลิปชำระเงิน
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pick Dates Dialog */}
      <Dialog open={pickDatesOpen} onOpenChange={setPickDatesOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">เลือกวันเรียน</DialogTitle>
            <DialogDescription>
              เลือกวันเรียนได้ {selectedBooking ? selectedBooking.total_sessions - (sessionCountMap[selectedBooking.id] || 0) : 0} วัน
              (สาขา: {selectedBooking?.branches?.name})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-200">
                {error}
              </div>
            )}

            {selectedDates.map((row, index) => (
              <div key={index} className="flex items-end gap-2 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <Label className="text-xs">วันที่เรียน #{index + 1}</Label>
                  <Input
                    type="date"
                    value={row.date}
                    onChange={(e) => updateDateRow(index, 'date', e.target.value)}
                    min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                    className="mt-1"
                  />
                </div>
                <div className="w-24">
                  <Label className="text-xs">เริ่ม</Label>
                  <Input
                    type="time"
                    value={row.startTime}
                    onChange={(e) => updateDateRow(index, 'startTime', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="w-24">
                  <Label className="text-xs">สิ้นสุด</Label>
                  <Input
                    type="time"
                    value={row.endTime}
                    onChange={(e) => updateDateRow(index, 'endTime', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 text-red-500 hover:text-red-700"
                  onClick={() => removeDateRow(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {selectedBooking && selectedDates.length < (selectedBooking.total_sessions - (sessionCountMap[selectedBooking.id] || 0)) && (
              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={addDateRow}
              >
                <Plus className="h-4 w-4 mr-1" />
                เพิ่มวันเรียน
              </Button>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPickDatesOpen(false)}
                disabled={loading}
              >
                ยกเลิก
              </Button>
              <Button
                className="flex-1 bg-[#2748bf] hover:bg-[#153c85]"
                onClick={handleSubmitDates}
                disabled={selectedDates.length === 0 || loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <CalendarDays className="mr-2 h-4 w-4" />
                    บันทึกตารางเรียน ({selectedDates.length} วัน)
                  </>
                )}
              </Button>
            </div>
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
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">
                  <p>จำนวน: <strong>{selectedBooking.total_sessions} ครั้ง</strong></p>
                  {(bookingChildNamesMap[selectedBooking.id]?.length > 0 || selectedBooking.children) && (
                    <p className="mt-0.5">👦 {bookingChildNamesMap[selectedBooking.id]?.join(', ') || selectedBooking.children?.full_name}</p>
                  )}
                </div>
                <p className="text-lg font-bold text-[#2748bf]">฿{selectedBooking.total_price.toLocaleString()}</p>
              </div>

              {/* Session list */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">วันเรียนที่จอง:</p>
                {(bookingSessionsMap[selectedBooking.id] || []).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีวันเรียน</p>
                ) : (
                  (bookingSessionsMap[selectedBooking.id] || []).map((session) => {
                    const sessionDate = new Date(session.date + 'T00:00:00')
                    const dayLabel = sessionDate.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })
                    const isPending = selectedBooking.status === 'pending_payment'

                    return (
                      <div key={session.id} className="flex items-center justify-between p-2.5 bg-white border rounded-lg">
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
                        {isPending && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                            onClick={() => handleDeleteSession(session.id, selectedBooking.id)} disabled={loading} title="ลบ">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

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
    </>
  )
}
