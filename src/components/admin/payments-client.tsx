'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Search, CreditCard, CheckCircle2, XCircle, Clock, Eye, Receipt, User, Building2, ImageIcon,
} from 'lucide-react'

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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'รอตรวจสอบ', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved: { label: 'อนุมัติแล้ว', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  rejected: { label: 'ปฏิเสธ', color: 'bg-red-100 text-red-700', icon: XCircle },
}

const MONTH_NAMES = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

const COURSE_LABELS: Record<string, string> = {
  kids_group: 'เด็กกลุ่ม',
  adult_group: 'ผู้ใหญ่กลุ่ม',
  private: 'ส่วนตัว',
}

export function PaymentsClient({ payments }: PaymentsClientProps) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [detailPayment, setDetailPayment] = useState<PaymentData | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [slipOpen, setSlipOpen] = useState(false)
  const [slipUrl, setSlipUrl] = useState('')

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (filterStatus !== 'all' && p.status !== filterStatus) return false
      if (!search) return true
      const q = search.toLowerCase()
      return p.user_name.toLowerCase().includes(q) ||
        p.user_email.toLowerCase().includes(q) ||
        p.branch_name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
    })
  }, [payments, search, filterStatus])

  const stats = useMemo(() => ({
    total: payments.length,
    pending: payments.filter((p) => p.status === 'pending').length,
    approved: payments.filter((p) => p.status === 'approved').length,
    rejected: payments.filter((p) => p.status === 'rejected').length,
    totalAmount: payments.filter((p) => p.status === 'approved').reduce((s, p) => s + p.amount, 0),
  }), [payments])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  const formatMoney = (amount: number) => `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 0 })}`

  const openDetail = (payment: PaymentData) => {
    setDetailPayment(payment)
    setDetailOpen(true)
  }

  const openSlipImage = (url: string) => {
    setSlipUrl(url)
    setSlipOpen(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">ตรวจสอบการชำระเงิน</h1>
        <p className="text-gray-500 text-sm mt-1">ติดตามผลการตรวจสอบสลิปอัตโนมัติจาก SlipOK และดูหลักฐานการโอน</p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        สถานะการชำระเงินหน้านี้อัปเดตจากระบบตรวจสลิปอัตโนมัติ โดย admin ใช้สำหรับตรวจดูรายละเอียดและติดตามผลเท่านั้น
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-[#2748bf]">{stats.total}</p><p className="text-xs text-gray-500">ทั้งหมด</p>
        </CardContent></Card>
        <Card className={stats.pending > 0 ? 'ring-2 ring-yellow-400' : ''}><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p><p className="text-xs text-gray-500">รอตรวจสอบ</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.approved}</p><p className="text-xs text-gray-500">อนุมัติแล้ว</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.rejected}</p><p className="text-xs text-gray-500">ปฏิเสธ</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{formatMoney(stats.totalAmount)}</p><p className="text-xs text-gray-500">ยอดอนุมัติรวม</p>
        </CardContent></Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="ค้นหาชื่อ, อีเมล, สาขา..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48"><SelectValue placeholder="ทุกสถานะ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสถานะ</SelectItem>
            <SelectItem value="pending">รอตรวจสอบ</SelectItem>
            <SelectItem value="approved">อนุมัติแล้ว</SelectItem>
            <SelectItem value="rejected">ปฏิเสธ</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-gray-500">แสดง {filtered.length} จาก {payments.length} รายการ</p>

      {/* Payment list */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">
          <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">{search || filterStatus !== 'all' ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีรายการชำระเงิน'}</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((payment) => {
            const statusCfg = STATUS_CONFIG[payment.status]
            const StatusIcon = statusCfg.icon
            return (
              <Card key={payment.id} className={`overflow-hidden ${payment.status === 'pending' ? 'border-yellow-300' : ''}`}>
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 p-4">
                    {/* Slip thumbnail or placeholder */}
                    <div
                      className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 cursor-pointer overflow-hidden border"
                      onClick={() => payment.slip_image_url && openSlipImage(payment.slip_image_url)}
                    >
                      {payment.slip_image_url ? (
                        <Image src={payment.slip_image_url} alt="slip" width={56} height={56} className="object-cover w-full h-full" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-gray-300" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{payment.user_name}</p>
                        <Badge className={`text-[10px] ${statusCfg.color}`}>
                          <StatusIcon className="h-3 w-3 mr-0.5" />{statusCfg.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1"><Receipt className="h-3 w-3" />{formatMoney(payment.amount)}</span>
                        <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{payment.branch_name}</span>
                        <span>{COURSE_LABELS[payment.course_type] || payment.course_type} • {payment.total_sessions} ครั้ง</span>
                        <span>{MONTH_NAMES[payment.booking_month]} {payment.booking_year}</span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(payment.created_at)}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openDetail(payment)}>
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

      {/* ===== Detail Dialog ===== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">รายละเอียดการชำระเงิน</DialogTitle>
          </DialogHeader>
          {detailPayment && (
            <div className="space-y-4">
              {/* Status */}
              {(() => {
                const cfg = STATUS_CONFIG[detailPayment.status]
                const Icon = cfg.icon
                return (
                  <div className={`p-3 rounded-lg flex items-center gap-2 ${cfg.color}`}>
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{cfg.label}</span>
                  </div>
                )
              })()}

              {/* User info */}
              <div className="p-3 bg-gray-50 rounded-lg space-y-1">
                <div className="flex items-center gap-2"><User className="h-4 w-4 text-gray-400" /><span className="font-medium">{detailPayment.user_name}</span></div>
                <p className="text-sm text-gray-500 ml-6">{detailPayment.user_email}</p>
              </div>

              {/* Booking info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <p className="text-gray-400 text-xs">ยอดเงิน</p>
                  <p className="font-bold text-lg text-[#2748bf]">{formatMoney(detailPayment.amount)}</p>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <p className="text-gray-400 text-xs">ประเภทคอร์ส</p>
                  <p className="font-medium">{COURSE_LABELS[detailPayment.course_type] || detailPayment.course_type}</p>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <p className="text-gray-400 text-xs">สาขา</p>
                  <p className="font-medium">{detailPayment.branch_name}</p>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <p className="text-gray-400 text-xs">เดือน / จำนวนครั้ง</p>
                  <p className="font-medium">{MONTH_NAMES[detailPayment.booking_month]} {detailPayment.booking_year} • {detailPayment.total_sessions} ครั้ง</p>
                </div>
              </div>

              {/* Slip image */}
              {detailPayment.slip_image_url && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">สลิปการโอนเงิน:</p>
                  <div className="relative cursor-pointer rounded-lg overflow-hidden border" onClick={() => openSlipImage(detailPayment.slip_image_url!)}>
                    <Image src={detailPayment.slip_image_url} alt="Payment slip" width={400} height={300} className="w-full object-contain max-h-64" />
                  </div>
                </div>
              )}

              {/* Notes */}
              {detailPayment.notes && (
                <div className="p-3 bg-blue-50 rounded-lg text-sm">
                  <p className="text-xs text-blue-400 mb-1">หมายเหตุ:</p>
                  <p className="text-blue-700">{detailPayment.notes}</p>
                </div>
              )}

              {/* Verified by */}
              {detailPayment.verified_by_name && (
                <p className="text-xs text-gray-400">
                  ตรวจสอบโดย: {detailPayment.verified_by_name} • {detailPayment.verified_at ? formatDate(detailPayment.verified_at) : ''}
                </p>
              )}

              {!detailPayment.verified_by_name && detailPayment.status === 'pending' && (
                <p className="text-xs text-amber-600">ระบบกำลังรอผลตรวจสอบสลิปอัตโนมัติจาก SlipOK</p>
              )}

              <p className="text-xs text-gray-400">สร้างเมื่อ: {formatDate(detailPayment.created_at)}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Slip fullscreen Dialog ===== */}
      <Dialog open={slipOpen} onOpenChange={setSlipOpen}>
        <DialogContent className="max-w-2xl max-h-[95vh] p-2">
          <DialogHeader>
            <DialogTitle className="text-sm">สลิปการโอนเงิน</DialogTitle>
          </DialogHeader>
          {slipUrl && (
            <div className="flex items-center justify-center">
              <Image src={slipUrl} alt="Payment slip" width={600} height={800} className="max-h-[80vh] w-auto object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
