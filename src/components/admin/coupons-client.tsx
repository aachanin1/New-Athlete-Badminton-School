'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Search, Plus, Ticket, ToggleLeft, ToggleRight, AlertCircle, CheckCircle2, Percent, Banknote, Calendar, Hash, Eye,
} from 'lucide-react'

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
}

interface CouponsClientProps {
  coupons: CouponData[]
}

export function CouponsClient({ coupons }: CouponsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<string>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailCoupon, setDetailCoupon] = useState<CouponData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Add form
  const [formCode, setFormCode] = useState('')
  const [formType, setFormType] = useState<'fixed' | 'percent'>('fixed')
  const [formValue, setFormValue] = useState('')
  const [formMinPurchase, setFormMinPurchase] = useState('')
  const [formMaxUses, setFormMaxUses] = useState('')
  const [formValidFrom, setFormValidFrom] = useState(new Date().toISOString().split('T')[0])
  const [formValidTo, setFormValidTo] = useState('')

  const resetForm = () => {
    setFormCode('')
    setFormType('fixed')
    setFormValue('')
    setFormMinPurchase('')
    setFormMaxUses('')
    setFormValidFrom(new Date().toISOString().split('T')[0])
    setFormValidTo('')
    setError(null)
    setSuccess(null)
  }

  const filtered = useMemo(() => {
    return coupons.filter((c) => {
      if (filterActive === 'active' && !c.is_active) return false
      if (filterActive === 'inactive' && c.is_active) return false
      if (!search) return true
      return c.code.toLowerCase().includes(search.toLowerCase())
    })
  }, [coupons, search, filterActive])

  const stats = useMemo(() => ({
    total: coupons.length,
    active: coupons.filter((c) => c.is_active).length,
    totalUsed: coupons.reduce((s, c) => s + c.current_uses, 0),
  }), [coupons])

  const formatDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })

  const isExpired = (c: CouponData) => c.valid_to && new Date(c.valid_to) < new Date()
  const isMaxed = (c: CouponData) => c.max_uses !== null && c.current_uses >= c.max_uses

  const handleAdd = async () => {
    if (!formCode.trim() || !formValue) {
      setError('กรุณากรอกรหัสคูปองและมูลค่าส่วนลด')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: formCode.trim(),
          discountType: formType,
          discountValue: parseFloat(formValue),
          minPurchase: formMinPurchase ? parseFloat(formMinPurchase) : null,
          maxUses: formMaxUses ? parseInt(formMaxUses) : null,
          validFrom: formValidFrom,
          validTo: formValidTo || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error); setLoading(false); return }

      setSuccess(`สร้างคูปอง "${formCode.toUpperCase()}" สำเร็จ!`)
      setLoading(false)
      setTimeout(() => { setAddOpen(false); resetForm(); router.refresh() }, 1200)
    } catch {
      setError('เกิดข้อผิดพลาด')
      setLoading(false)
    }
  }

  const toggleActive = async (coupon: CouponData) => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponId: coupon.id, isActive: !coupon.is_active }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error || 'อัปเดตสถานะคูปองไม่สำเร็จ')
        setLoading(false)
        return
      }

      setSuccess(`${coupon.code} ${coupon.is_active ? 'ถูกปิดใช้งานแล้ว' : 'ถูกเปิดใช้งานแล้ว'}`)
      setLoading(false)
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#153c85]">คูปองส่วนลด</h1>
          <p className="text-gray-500 text-sm mt-1">สร้างและจัดการคูปองส่วนลดสำหรับลูกค้า</p>
        </div>
        <Button onClick={() => { resetForm(); setAddOpen(true) }} className="bg-[#2748bf] hover:bg-[#153c85]">
          <Plus className="h-4 w-4 mr-2" />สร้างคูปองใหม่
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-[#2748bf]">{stats.total}</p><p className="text-xs text-gray-500">คูปองทั้งหมด</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.active}</p><p className="text-xs text-gray-500">ใช้งานอยู่</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{stats.totalUsed}</p><p className="text-xs text-gray-500">ใช้ไปแล้ว (ครั้ง)</p>
        </CardContent></Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="ค้นหารหัสคูปอง..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterActive} onValueChange={setFilterActive}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทั้งหมด</SelectItem>
            <SelectItem value="active">ใช้งานอยู่</SelectItem>
            <SelectItem value="inactive">ปิดใช้งาน</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Coupon list */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">
          <Ticket className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">ไม่พบคูปอง</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((coupon) => {
            const expired = isExpired(coupon)
            const maxed = isMaxed(coupon)
            return (
              <Card key={coupon.id} className={`overflow-hidden ${!coupon.is_active || expired || maxed ? 'opacity-60' : ''}`}>
                <div className={`h-1.5 ${coupon.is_active && !expired && !maxed ? 'bg-green-500' : 'bg-gray-300'}`} />
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono font-bold text-lg text-[#153c85]">{coupon.code}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {coupon.discount_type === 'percent' ? (
                          <Badge className="bg-purple-100 text-purple-700 text-xs"><Percent className="h-3 w-3 mr-0.5" />ลด {coupon.discount_value}%</Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-700 text-xs"><Banknote className="h-3 w-3 mr-0.5" />ลด ฿{coupon.discount_value.toLocaleString()}</Badge>
                        )}
                        {!coupon.is_active && <Badge variant="outline" className="text-xs text-gray-400">ปิดใช้งาน</Badge>}
                        {expired && <Badge variant="outline" className="text-xs text-red-400">หมดอายุ</Badge>}
                        {maxed && <Badge variant="outline" className="text-xs text-orange-400">ใช้ครบแล้ว</Badge>}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDetailCoupon(coupon); setDetailOpen(true) }}>
                      <Eye className="h-4 w-4 text-gray-400" />
                    </Button>
                  </div>

                  <div className="text-xs text-gray-500 space-y-1">
                    <div className="flex justify-between">
                      <span>ใช้ไปแล้ว</span>
                      <span className="font-medium">{coupon.current_uses}{coupon.max_uses ? ` / ${coupon.max_uses}` : ''} ครั้ง</span>
                    </div>
                    {coupon.min_purchase && (
                      <div className="flex justify-between">
                        <span>ขั้นต่ำ</span>
                        <span>฿{coupon.min_purchase.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>ระยะเวลา</span>
                      <span>{formatDate(coupon.valid_from)}{coupon.valid_to ? ` - ${formatDate(coupon.valid_to)}` : ' เป็นต้นไป'}</span>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" className="w-full" onClick={() => toggleActive(coupon)} disabled={loading}>
                    {coupon.is_active ? (
                      <><ToggleRight className="h-4 w-4 mr-1.5 text-green-500" />ใช้งานอยู่ — กดเพื่อปิด</>
                    ) : (
                      <><ToggleLeft className="h-4 w-4 mr-1.5 text-gray-400" />ปิดอยู่ — กดเพื่อเปิด</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ===== Add Coupon Dialog ===== */}
      <Dialog open={addOpen} onOpenChange={(v) => { if (!loading) { setAddOpen(v); if (!v) resetForm() } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">สร้างคูปองใหม่</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
            {success && <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" />{success}</div>}

            <div className="space-y-2">
              <Label>รหัสคูปอง *</Label>
              <Input placeholder="เช่น WELCOME50" value={formCode} onChange={(e) => setFormCode(e.target.value.toUpperCase())} className="font-mono" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ประเภทส่วนลด</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as 'fixed' | 'percent')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">ลดเป็นบาท (฿)</SelectItem>
                    <SelectItem value="percent">ลดเป็น %</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>มูลค่า *</Label>
                <Input type="number" placeholder={formType === 'percent' ? '1-100' : 'จำนวนบาท'} value={formValue} onChange={(e) => setFormValue(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ยอดขั้นต่ำ (ไม่บังคับ)</Label>
                <Input type="number" placeholder="฿" value={formMinPurchase} onChange={(e) => setFormMinPurchase(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>จำกัดจำนวนครั้ง (ไม่บังคับ)</Label>
                <Input type="number" placeholder="ไม่จำกัด" value={formMaxUses} onChange={(e) => setFormMaxUses(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>เริ่มใช้ได้</Label>
                <Input type="date" value={formValidFrom} onChange={(e) => setFormValidFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>หมดอายุ (ไม่บังคับ)</Label>
                <Input type="date" value={formValidTo} onChange={(e) => setFormValidTo(e.target.value)} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setAddOpen(false); resetForm() }} disabled={loading}>ยกเลิก</Button>
              <Button onClick={handleAdd} disabled={loading} className="bg-[#2748bf] hover:bg-[#153c85]">
                {loading ? 'กำลังสร้าง...' : 'สร้างคูปอง'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Detail Dialog ===== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">รายละเอียดคูปอง</DialogTitle>
          </DialogHeader>
          {detailCoupon && (
            <div className="space-y-3">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="font-mono font-bold text-2xl text-[#153c85]">{detailCoupon.code}</p>
                {detailCoupon.discount_type === 'percent' ? (
                  <p className="text-purple-600 font-bold text-lg mt-1">ลด {detailCoupon.discount_value}%</p>
                ) : (
                  <p className="text-blue-600 font-bold text-lg mt-1">ลด ฿{detailCoupon.discount_value.toLocaleString()}</p>
                )}
              </div>

              <div className="text-sm space-y-2">
                <div className="flex justify-between"><span className="text-gray-500">สถานะ</span>
                  <Badge className={detailCoupon.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                    {detailCoupon.is_active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
                  </Badge>
                </div>
                <div className="flex justify-between"><span className="text-gray-500">ใช้ไปแล้ว</span><span className="font-medium">{detailCoupon.current_uses}{detailCoupon.max_uses ? ` / ${detailCoupon.max_uses}` : ''} ครั้ง</span></div>
                {detailCoupon.min_purchase && <div className="flex justify-between"><span className="text-gray-500">ยอดขั้นต่ำ</span><span>฿{detailCoupon.min_purchase.toLocaleString()}</span></div>}
                <div className="flex justify-between"><span className="text-gray-500">เริ่มใช้ได้</span><span>{formatDate(detailCoupon.valid_from)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">หมดอายุ</span><span>{detailCoupon.valid_to ? formatDate(detailCoupon.valid_to) : 'ไม่มี'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">สร้างโดย</span><span>{detailCoupon.created_by_name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">สร้างเมื่อ</span><span>{formatDate(detailCoupon.created_at)}</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
