'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertCircle,
  Banknote,
  Calendar,
  CheckCircle2,
  Edit3,
  Eye,
  Hash,
  Percent,
  Plus,
  Search,
  Ticket,
  ToggleLeft,
  ToggleRight,
  Users,
} from 'lucide-react'

interface CouponUsage {
  id: string
  user_name: string
  booking_id: string
  discount_amount: number
  booking_total: number | null
  booking_month: number | null
  booking_year: number | null
  used_at: string
}

interface CouponData {
  id: string
  code: string
  discount_type: 'fixed' | 'percent'
  discount_value: number
  min_purchase: number | null
  max_uses: number | null
  current_uses: number
  valid_from: string
  valid_to: string | null
  is_active: boolean
  created_at: string
  created_by_name: string
  usage_count: number
  total_discount: number
  usages: CouponUsage[]
}

interface CouponsClientProps {
  coupons: CouponData[]
}

type CouponFormMode = 'create' | 'edit'
type CouponStatus = 'ready' | 'inactive' | 'scheduled' | 'expired' | 'maxed'

interface CouponFormState {
  code: string
  discountType: 'fixed' | 'percent'
  discountValue: string
  minPurchase: string
  maxUses: string
  validFrom: string
  validTo: string
  isActive: boolean
}

const emptyForm = (): CouponFormState => ({
  code: '',
  discountType: 'fixed',
  discountValue: '',
  minPurchase: '',
  maxUses: '',
  validFrom: new Date().toISOString().split('T')[0],
  validTo: '',
  isActive: true,
})

function formatDate(value: string) {
  return new Date(`${value.includes('T') ? value : `${value}T00:00:00`}`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
}

function formatCurrency(value: number) {
  return value.toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

function getCouponStatus(coupon: CouponData): CouponStatus {
  const today = new Date().toISOString().split('T')[0]
  if (coupon.valid_from && today < coupon.valid_from) return 'scheduled'
  if (coupon.valid_to && today > coupon.valid_to) return 'expired'
  if (coupon.max_uses !== null && coupon.current_uses >= coupon.max_uses) return 'maxed'
  if (!coupon.is_active) return 'inactive'
  return 'ready'
}

const STATUS_META: Record<CouponStatus, { label: string; className: string }> = {
  ready: { label: 'พร้อมใช้', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  inactive: { label: 'ปิดใช้งาน', className: 'bg-gray-100 text-gray-500 hover:bg-gray-100' },
  scheduled: { label: 'รอเริ่มใช้', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  expired: { label: 'หมดอายุ', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
  maxed: { label: 'ใช้ครบแล้ว', className: 'bg-orange-100 text-orange-700 hover:bg-orange-100' },
}

export function CouponsClient({ coupons }: CouponsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [formMode, setFormMode] = useState<CouponFormMode>('create')
  const [selectedCoupon, setSelectedCoupon] = useState<CouponData | null>(null)
  const [form, setForm] = useState<CouponFormState>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const stats = useMemo(() => {
    const statusCounts = coupons.reduce<Record<CouponStatus, number>>((map, coupon) => {
      const status = getCouponStatus(coupon)
      map[status] += 1
      return map
    }, { ready: 0, inactive: 0, scheduled: 0, expired: 0, maxed: 0 })

    return {
      total: coupons.length,
      ready: statusCounts.ready,
      inactive: statusCounts.inactive,
      totalUsed: coupons.reduce((sum, coupon) => sum + coupon.current_uses, 0),
      totalDiscount: coupons.reduce((sum, coupon) => sum + coupon.total_discount, 0),
    }
  }, [coupons])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return coupons.filter((coupon) => {
      const status = getCouponStatus(coupon)
      if (filterStatus !== 'all' && status !== filterStatus) return false
      if (!q) return true
      return coupon.code.toLowerCase().includes(q) || coupon.created_by_name.toLowerCase().includes(q)
    })
  }, [coupons, filterStatus, search])

  const updateForm = (patch: Partial<CouponFormState>) => setForm((current) => ({ ...current, ...patch }))

  const generateCouponCode = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
    updateForm({ code })
  }

  const openCreate = () => {
    setFormMode('create')
    setSelectedCoupon(null)
    setForm(emptyForm())
    setMessage(null)
    setFormOpen(true)
  }

  const openEdit = (coupon: CouponData) => {
    setFormMode('edit')
    setSelectedCoupon(coupon)
    setForm({
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: String(coupon.discount_value),
      minPurchase: coupon.min_purchase === null ? '' : String(coupon.min_purchase),
      maxUses: coupon.max_uses === null ? '' : String(coupon.max_uses),
      validFrom: coupon.valid_from,
      validTo: coupon.valid_to || '',
      isActive: coupon.is_active,
    })
    setMessage(null)
    setFormOpen(true)
  }

  const buildPayload = () => ({
    code: form.code.trim(),
    discountType: form.discountType,
    discountValue: Number(form.discountValue),
    minPurchase: form.minPurchase ? Number(form.minPurchase) : null,
    maxUses: form.maxUses ? Number(form.maxUses) : null,
    validFrom: form.validFrom || null,
    validTo: form.validTo || null,
    isActive: form.isActive,
  })

  const validateForm = () => {
    if (!form.code.trim()) return 'กรุณากรอกรหัสคูปอง'
    if (!form.discountValue || Number(form.discountValue) <= 0) return 'กรุณากรอกมูลค่าส่วนลดมากกว่า 0'
    if (form.discountType === 'percent' && (Number(form.discountValue) < 1 || Number(form.discountValue) > 100)) return 'เปอร์เซ็นต์ต้องอยู่ระหว่าง 1-100'
    if (form.validTo && form.validFrom && form.validTo < form.validFrom) return 'วันหมดอายุต้องไม่อยู่ก่อนวันเริ่มใช้งาน'
    return null
  }

  const saveCoupon = async () => {
    const validationError = validateForm()
    if (validationError) {
      setMessage({ type: 'error', text: validationError })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const payload = buildPayload()
      const response = await fetch('/api/admin/coupons', {
        method: formMode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formMode === 'create' ? payload : { couponId: selectedCoupon?.id, ...payload }),
      })
      const json = await response.json().catch(() => null)

      if (!response.ok) {
        setMessage({ type: 'error', text: json?.error || 'บันทึกคูปองไม่สำเร็จ' })
        setLoading(false)
        return
      }

      setMessage({ type: 'success', text: formMode === 'create' ? 'สร้างคูปองสำเร็จ' : 'บันทึกการแก้ไขสำเร็จ' })
      setLoading(false)
      setTimeout(() => {
        setFormOpen(false)
        router.refresh()
      }, 700)
    } catch {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด กรุณาลองใหม่' })
      setLoading(false)
    }
  }

  const toggleActive = async (coupon: CouponData) => {
    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/coupons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponId: coupon.id, isActive: !coupon.is_active }),
      })
      const json = await response.json().catch(() => null)

      if (!response.ok) {
        setMessage({ type: 'error', text: json?.error || 'อัปเดตสถานะคูปองไม่สำเร็จ' })
        setLoading(false)
        return
      }

      setMessage({ type: 'success', text: `${coupon.code} ${coupon.is_active ? 'ถูกปิดใช้งานแล้ว' : 'ถูกเปิดใช้งานแล้ว'}` })
      setLoading(false)
      router.refresh()
    } catch {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด กรุณาลองใหม่' })
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#2748bf]">
            <Ticket className="h-4 w-4" />
            Discount Operations
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">คูปองส่วนลด</h1>
          <p className="mt-1 text-sm text-gray-500">สร้าง แก้ไข เปิด/ปิด และตรวจประวัติการใช้งานคูปองสำหรับลูกค้า</p>
        </div>
        <Button onClick={openCreate} className="bg-[#2748bf] hover:bg-[#153c85]">
          <Plus className="h-4 w-4" />
          สร้างคูปอง
        </Button>
      </div>

      {message && (
        <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-5">
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3">
            <div><p className="text-xs text-gray-500">ทั้งหมด</p><p className="mt-1 text-xl font-bold text-[#2748bf]">{stats.total}</p></div>
            <Ticket className="h-5 w-5 text-[#2748bf]" />
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="flex items-center justify-between p-3">
            <div><p className="text-xs text-gray-500">พร้อมใช้</p><p className="mt-1 text-xl font-bold text-emerald-700">{stats.ready}</p></div>
            <ToggleRight className="h-5 w-5 text-emerald-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3">
            <div><p className="text-xs text-gray-500">ปิดใช้งาน</p><p className="mt-1 text-xl font-bold text-gray-700">{stats.inactive}</p></div>
            <ToggleLeft className="h-5 w-5 text-gray-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3">
            <div><p className="text-xs text-gray-500">ใช้แล้ว</p><p className="mt-1 text-xl font-bold text-purple-600">{stats.totalUsed}</p></div>
            <Users className="h-5 w-5 text-purple-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200 max-xl:col-span-2">
          <CardContent className="flex items-center justify-between p-3">
            <div><p className="text-xs text-gray-500">ส่วนลดรวม</p><p className="mt-1 text-xl font-bold text-orange-600">฿{formatCurrency(stats.totalDiscount)}</p></div>
            <Banknote className="h-5 w-5 text-orange-500" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(240px,1fr)_180px_auto] md:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input className="pl-10" placeholder="ค้นหารหัสคูปองหรือผู้สร้าง..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              <SelectItem value="ready">พร้อมใช้</SelectItem>
              <SelectItem value="scheduled">รอเริ่มใช้</SelectItem>
              <SelectItem value="inactive">ปิดใช้งาน</SelectItem>
              <SelectItem value="expired">หมดอายุ</SelectItem>
              <SelectItem value="maxed">ใช้ครบแล้ว</SelectItem>
            </SelectContent>
          </Select>
          <p className="whitespace-nowrap text-sm text-gray-500">แสดง {filtered.length} จาก {coupons.length} รายการ</p>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center text-gray-400">
            <Ticket className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ไม่พบคูปองตามเงื่อนไข</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filtered.map((coupon) => {
            const status = getCouponStatus(coupon)
            const meta = STATUS_META[status]
            const isAutoClosed = status === 'expired' || status === 'maxed'
            const usedPercent = coupon.max_uses ? Math.min(100, (coupon.current_uses / coupon.max_uses) * 100) : coupon.current_uses > 0 ? 100 : 0

            return (
              <Card key={coupon.id} className={status === 'ready' ? 'border-gray-200' : 'border-gray-200 bg-gray-50/50'}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-xl font-bold text-[#153c85]">{coupon.code}</p>
                        <Badge className={meta.className}>{meta.label}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge className={coupon.discount_type === 'percent' ? 'bg-purple-100 text-purple-700 hover:bg-purple-100' : 'bg-blue-100 text-blue-700 hover:bg-blue-100'}>
                          {coupon.discount_type === 'percent' ? <Percent className="mr-1 h-3.5 w-3.5" /> : <Banknote className="mr-1 h-3.5 w-3.5" />}
                          {coupon.discount_type === 'percent' ? `ลด ${coupon.discount_value}%` : `ลด ฿${formatCurrency(coupon.discount_value)}`}
                        </Badge>
                        {coupon.min_purchase !== null && <Badge variant="outline">ขั้นต่ำ ฿{formatCurrency(coupon.min_purchase)}</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setSelectedCoupon(coupon); setDetailOpen(true) }}>
                        <Eye className="h-4 w-4" />
                        รายละเอียด
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(coupon)}>
                        <Edit3 className="h-4 w-4" />
                        แก้ไข
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">ใช้งาน</p>
                      <p className="mt-1 font-bold text-gray-900">{coupon.current_uses}{coupon.max_uses ? ` / ${coupon.max_uses}` : ''} ครั้ง</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">ส่วนลดรวม</p>
                      <p className="mt-1 font-bold text-orange-600">฿{formatCurrency(coupon.total_discount)}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">ช่วงเวลา</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">{formatDate(coupon.valid_from)}{coupon.valid_to ? ` - ${formatDate(coupon.valid_to)}` : ' เป็นต้นไป'}</p>
                    </div>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className={status === 'maxed' ? 'h-full rounded-full bg-orange-400' : 'h-full rounded-full bg-[#2748bf]'} style={{ width: `${usedPercent}%` }} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <p className="text-xs text-gray-500">สร้างโดย {coupon.created_by_name} • {formatDate(coupon.created_at)}</p>
                    <Button size="sm" variant={coupon.is_active ? 'outline' : 'default'} className={coupon.is_active ? '' : 'bg-[#2748bf] hover:bg-[#153c85]'} onClick={() => toggleActive(coupon)} disabled={loading || isAutoClosed}>
                      {coupon.is_active ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4" />}
                      {isAutoClosed && <span>ปิดอัตโนมัติ</span>}
                      <span className={isAutoClosed ? 'hidden' : ''}>
                      {coupon.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                      </span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={(open) => { if (!loading) setFormOpen(open) }}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">{formMode === 'create' ? 'สร้างคูปองใหม่' : `แก้ไขคูปอง ${selectedCoupon?.code}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {message && (
              <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {message.text}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>รหัสคูปอง *</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input className="pl-9 pr-24 font-mono uppercase" value={form.code} onChange={(event) => updateForm({ code: event.target.value.toUpperCase() })} placeholder="WELCOME50" />
                  <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1/2 h-7 -translate-y-1/2 px-2 text-xs" onClick={generateCouponCode}>
                    Gen 6
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>สถานะ</Label>
                <Select value={form.isActive ? 'active' : 'inactive'} onValueChange={(value) => updateForm({ isActive: value === 'active' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">เปิดใช้งาน</SelectItem>
                    <SelectItem value="inactive">ปิดใช้งาน</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>ประเภทส่วนลด</Label>
                <Select value={form.discountType} onValueChange={(value) => updateForm({ discountType: value as 'fixed' | 'percent' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">ลดเป็นบาท</SelectItem>
                    <SelectItem value="percent">ลดเป็นเปอร์เซ็นต์</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>มูลค่าส่วนลด *</Label>
                <Input type="number" min="0" value={form.discountValue} onChange={(event) => updateForm({ discountValue: event.target.value })} placeholder={form.discountType === 'percent' ? '1-100' : 'จำนวนบาท'} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>ยอดขั้นต่ำ</Label>
                <Input type="number" min="0" value={form.minPurchase} onChange={(event) => updateForm({ minPurchase: event.target.value })} placeholder="ไม่กำหนด" />
              </div>
              <div className="space-y-2">
                <Label>จำนวนครั้งที่ใช้ได้</Label>
                <Input type="number" min="1" value={form.maxUses} onChange={(event) => updateForm({ maxUses: event.target.value })} placeholder="ไม่จำกัด" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>เริ่มใช้งาน</Label>
                <Input type="date" value={form.validFrom} onChange={(event) => updateForm({ validFrom: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>หมดอายุ</Label>
                <Input type="date" value={form.validTo} onChange={(event) => updateForm({ validTo: event.target.value })} />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setFormOpen(false)} disabled={loading}>ยกเลิก</Button>
              <Button onClick={saveCoupon} disabled={loading} className="bg-[#2748bf] hover:bg-[#153c85]">
                {loading ? 'กำลังบันทึก...' : formMode === 'create' ? 'สร้างคูปอง' : 'บันทึกการแก้ไข'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">รายละเอียดคูปอง</DialogTitle>
          </DialogHeader>
          {selectedCoupon && (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-4 text-center">
                <p className="font-mono text-2xl font-bold text-[#153c85]">{selectedCoupon.code}</p>
                <p className={selectedCoupon.discount_type === 'percent' ? 'mt-1 text-lg font-bold text-purple-600' : 'mt-1 text-lg font-bold text-blue-600'}>
                  {selectedCoupon.discount_type === 'percent' ? `ลด ${selectedCoupon.discount_value}%` : `ลด ฿${formatCurrency(selectedCoupon.discount_value)}`}
                </p>
              </div>

              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between rounded-lg border p-3"><span className="text-gray-500">สถานะ</span><Badge className={STATUS_META[getCouponStatus(selectedCoupon)].className}>{STATUS_META[getCouponStatus(selectedCoupon)].label}</Badge></div>
                <div className="flex justify-between rounded-lg border p-3"><span className="text-gray-500">ใช้แล้ว</span><span className="font-semibold">{selectedCoupon.current_uses}{selectedCoupon.max_uses ? ` / ${selectedCoupon.max_uses}` : ''} ครั้ง</span></div>
                <div className="flex justify-between rounded-lg border p-3"><span className="text-gray-500">ส่วนลดรวม</span><span className="font-semibold text-orange-600">฿{formatCurrency(selectedCoupon.total_discount)}</span></div>
                <div className="flex justify-between rounded-lg border p-3"><span className="text-gray-500">ยอดขั้นต่ำ</span><span className="font-semibold">{selectedCoupon.min_purchase ? `฿${formatCurrency(selectedCoupon.min_purchase)}` : 'ไม่กำหนด'}</span></div>
                <div className="flex justify-between rounded-lg border p-3"><span className="text-gray-500">เริ่มใช้</span><span className="font-semibold">{formatDate(selectedCoupon.valid_from)}</span></div>
                <div className="flex justify-between rounded-lg border p-3"><span className="text-gray-500">หมดอายุ</span><span className="font-semibold">{selectedCoupon.valid_to ? formatDate(selectedCoupon.valid_to) : 'ไม่กำหนด'}</span></div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#153c85]">
                  <Calendar className="h-4 w-4" />
                  ประวัติการใช้งาน
                </div>
                {selectedCoupon.usages.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-5 text-center text-sm text-gray-400">ยังไม่มีการใช้งานคูปองนี้</div>
                ) : (
                  <div className="space-y-2">
                    {selectedCoupon.usages.map((usage) => (
                      <div key={usage.id} className="rounded-lg border bg-white p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">{usage.user_name}</p>
                            <p className="text-xs text-gray-500">
                              {formatDate(usage.used_at)}
                              {usage.booking_month && usage.booking_year ? ` • คอร์ส ${usage.booking_month}/${usage.booking_year + 543}` : ''}
                            </p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="font-bold text-orange-600">-฿{formatCurrency(usage.discount_amount)}</p>
                            {usage.booking_total !== null && <p className="text-xs text-gray-500">ยอดจอง ฿{formatCurrency(usage.booking_total)}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button variant="outline" onClick={() => openEdit(selectedCoupon)}>
                  <Edit3 className="h-4 w-4" />
                  แก้ไขคูปอง
                </Button>
                <Button variant={selectedCoupon.is_active ? 'outline' : 'default'} className={selectedCoupon.is_active ? '' : 'bg-[#2748bf] hover:bg-[#153c85]'} onClick={() => toggleActive(selectedCoupon)} disabled={loading || ['expired', 'maxed'].includes(getCouponStatus(selectedCoupon))}>
                  {['expired', 'maxed'].includes(getCouponStatus(selectedCoupon)) && <span>ปิดอัตโนมัติ</span>}
                  <span className={['expired', 'maxed'].includes(getCouponStatus(selectedCoupon)) ? 'hidden' : ''}>
                  {selectedCoupon.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  </span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
