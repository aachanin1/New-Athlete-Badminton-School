'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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

interface HistoryClientProps {
  bookings: BookingWithRelations[]
  payments: PaymentRow[]
  userId: string
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

export function HistoryClient({ bookings, payments, userId }: HistoryClientProps) {
  const router = useRouter()
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<BookingWithRelations | null>(null)
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipPreview, setSlipPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openPayDialog = (booking: BookingWithRelations) => {
    setSelectedBooking(booking)
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
    if (!selectedBooking || !slipFile) return
    setLoading(true)
    setError(null)

    const supabase = createClient()

    try {
      // Upload slip to Supabase Storage
      const fileExt = slipFile.name.split('.').pop()
      const fileName = `${userId}/${selectedBooking.id}-${Date.now()}.${fileExt}`

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

      // Create payment record
      await (supabase.from('payments') as any).insert({
        booking_id: selectedBooking.id,
        user_id: userId,
        amount: selectedBooking.total_price,
        method: 'transfer',
        slip_image_url: publicUrl,
        status: 'pending',
      })

      // Update booking status
      await (supabase.from('bookings') as any)
        .update({ status: 'paid' })
        .eq('id', selectedBooking.id)

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

  return (
    <>
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
                      {booking.children && (
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <span>👦 {booking.children.full_name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-bold text-[#2748bf]">฿{booking.total_price.toLocaleString()}</p>
                    {booking.status === 'pending_payment' && (
                      <Button
                        size="sm"
                        className="mt-2 bg-[#f57e3b] hover:bg-[#e06a2a]"
                        onClick={() => openPayDialog(booking)}
                      >
                        <Upload className="h-3.5 w-3.5 mr-1" />
                        แนบสลิป
                      </Button>
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
              ยอดชำระ: ฿{selectedBooking?.total_price.toLocaleString()}
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
    </>
  )
}
