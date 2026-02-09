'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Child, Branch, CourseTypeName } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  calculateKidsGroupPrice,
  calculateAdultGroupPrice,
  calculatePrivatePrice,
  getKidsGroupTiers,
  getAdultGroupTiers,
  getPrivateTiers,
} from '@/lib/pricing'
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Users,
  User,
  Star,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Minus,
  Plus,
} from 'lucide-react'

interface CourseTypeRow {
  id: string
  name: string
}

interface BookingClientProps {
  userId: string
  userName: string
  children: Child[]
  branches: Branch[]
  courseTypes: CourseTypeRow[]
}

type Step = 'type' | 'learner' | 'branch' | 'sessions' | 'summary'

const STEPS: { key: Step; label: string }[] = [
  { key: 'type', label: 'ประเภท' },
  { key: 'learner', label: 'ผู้เรียน' },
  { key: 'branch', label: 'สาขา' },
  { key: 'sessions', label: 'จำนวนครั้ง' },
  { key: 'summary', label: 'สรุป' },
]

const COURSE_TYPES: { value: CourseTypeName; label: string; desc: string; icon: typeof Users }[] = [
  { value: 'kids_group', label: 'เด็ก (กลุ่ม)', desc: 'กลุ่มเล็ก 4-6 คน • 2 ชม.', icon: Users },
  { value: 'adult_group', label: 'ผู้ใหญ่ (กลุ่ม)', desc: '1-6 คน • 2 ชม.', icon: User },
  { value: 'private', label: 'Private', desc: 'เด็ก & ผู้ใหญ่ • 1 ชม.', icon: Star },
]

export function BookingClient({ userId, userName, children, branches, courseTypes }: BookingClientProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('type')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Booking state
  const [courseType, setCourseType] = useState<CourseTypeName | null>(null)
  const [learnerType, setLearnerType] = useState<'self' | 'child' | null>(null)
  const [selectedChildren, setSelectedChildren] = useState<string[]>([])
  const [branchId, setBranchId] = useState<string | null>(null)
  const [sessions, setSessions] = useState(4)
  const [childSessions, setChildSessions] = useState<Record<string, number>>({})

  // Coupon state
  const [couponCode, setCouponCode] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: string; code: string; discount_type: 'fixed' | 'percent'; discount_value: number
  } | null>(null)
  const [discountAmount, setDiscountAmount] = useState(0)

  const currentStepIndex = STEPS.findIndex((s) => s.key === step)

  const goNext = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      setStep(STEPS[nextIndex].key)
    }
  }

  const goBack = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setStep(STEPS[prevIndex].key)
    }
  }

  const canGoNext = () => {
    switch (step) {
      case 'type':
        return !!courseType
      case 'learner':
        if (courseType === 'kids_group') return selectedChildren.length > 0
        return !!learnerType
      case 'branch':
        return !!branchId
      case 'sessions':
        return sessions > 0
      default:
        return false
    }
  }

  // Calculate pricing
  const getPricing = () => {
    if (!courseType) return null

    if (courseType === 'kids_group') {
      const sessionsPerChild = selectedChildren.map((cid) => ({
        childId: cid,
        sessions: childSessions[cid] || 4,
      }))
      return calculateKidsGroupPrice(sessionsPerChild)
    }

    if (courseType === 'adult_group') {
      return calculateAdultGroupPrice(sessions)
    }

    if (courseType === 'private') {
      return calculatePrivatePrice(sessions)
    }

    return null
  }

  const pricing = getPricing()
  const selectedBranch = branches.find((b) => b.id === branchId)

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    setCouponError(null)

    const supabase = createClient()
    const { data: coupon, error: err } = await (supabase
      .from('coupons') as any)
      .select('*')
      .eq('code', couponCode.trim().toUpperCase())
      .eq('is_active', true)
      .single()

    if (err || !coupon) {
      setCouponError('ไม่พบคูปองนี้ หรือคูปองหมดอายุแล้ว')
      setCouponLoading(false)
      return
    }

    // Check expiry
    const now = new Date()
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      setCouponError('คูปองนี้ยังไม่เริ่มใช้งาน')
      setCouponLoading(false)
      return
    }
    if (coupon.valid_to && new Date(coupon.valid_to) < now) {
      setCouponError('คูปองนี้หมดอายุแล้ว')
      setCouponLoading(false)
      return
    }

    // Check usage limit
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      setCouponError('คูปองนี้ถูกใช้ครบจำนวนแล้ว')
      setCouponLoading(false)
      return
    }

    // Check min purchase
    const totalPrice = pricing?.package_price || 0
    if (coupon.min_purchase && totalPrice < coupon.min_purchase) {
      setCouponError(`ยอดขั้นต่ำ ฿${coupon.min_purchase.toLocaleString()} สำหรับคูปองนี้`)
      setCouponLoading(false)
      return
    }

    // Calculate discount
    let discount = 0
    if (coupon.discount_type === 'fixed') {
      discount = Math.min(coupon.discount_value, totalPrice)
    } else {
      discount = Math.floor(totalPrice * coupon.discount_value / 100)
    }

    setAppliedCoupon({
      id: coupon.id,
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
    })
    setDiscountAmount(discount)
    setCouponLoading(false)
  }

  const handleSubmitBooking = async () => {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()

    const finalPrice = (pricing?.package_price || 0) - discountAmount

    // Resolve course_type_id UUID from name
    const courseTypeRow = courseTypes.find((ct) => ct.name === courseType)
    if (!courseTypeRow) {
      setError('ไม่พบประเภทคอร์สในระบบ กรุณาติดต่อแอดมิน')
      setLoading(false)
      return
    }
    const courseTypeUUID = courseTypeRow.id

    try {
      let bookingId: string | null = null

      if (courseType === 'kids_group') {
        // Create one booking per child
        for (const childId of selectedChildren) {
          const childSess = childSessions[childId] || 4

          const { data: bookingData, error: insertErr } = await (supabase.from('bookings') as any)
            .insert({
              user_id: userId,
              learner_type: 'child',
              child_id: childId,
              branch_id: branchId,
              course_type_id: courseTypeUUID,
              month,
              year,
              total_sessions: childSess,
              total_price: finalPrice,
              status: 'pending_payment',
            })
            .select('id')
            .single()

          if (insertErr) {
            console.error('Booking insert error:', insertErr)
            setError(`เกิดข้อผิดพลาดในการจอง: ${insertErr.message}`)
            setLoading(false)
            return
          }
          if (bookingData) bookingId = bookingData.id
        }
      } else {
        const { data: bookingData, error: insertErr } = await (supabase.from('bookings') as any)
          .insert({
            user_id: userId,
            learner_type: learnerType || 'self',
            child_id: null,
            branch_id: branchId,
            course_type_id: courseTypeUUID,
            month,
            year,
            total_sessions: sessions,
            total_price: finalPrice,
            status: 'pending_payment',
          })
          .select('id')
          .single()

        if (insertErr) {
          console.error('Booking insert error:', insertErr)
          setError(`เกิดข้อผิดพลาดในการจอง: ${insertErr.message}`)
          setLoading(false)
          return
        }
        if (bookingData) bookingId = bookingData.id
      }

      // Record coupon usage
      if (appliedCoupon && bookingId) {
        await (supabase.from('coupon_usages') as any).insert({
          coupon_id: appliedCoupon.id,
          user_id: userId,
          booking_id: bookingId,
          discount_amount: discountAmount,
          used_at: new Date().toISOString(),
        })
        // Increment coupon usage count
        await (supabase.from('coupons') as any)
          .update({ current_uses: appliedCoupon ? 1 : 0 })
          .eq('id', appliedCoupon.id)
      }

      router.push('/dashboard/history')
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Progress Steps */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                i <= currentStepIndex
                  ? 'bg-[#2748bf] text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                {i < currentStepIndex ? '✓' : i + 1}
              </span>
              {s.label}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-0.5 mx-1 ${i < currentStepIndex ? 'bg-[#2748bf]' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-200 mb-4 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Step 1: Course Type */}
      {step === 'type' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COURSE_TYPES.map((ct) => (
            <Card
              key={ct.value}
              className={`cursor-pointer transition-all hover:shadow-md ${
                courseType === ct.value
                  ? 'border-2 border-[#2748bf] shadow-md'
                  : 'border hover:border-[#2748bf]/30'
              }`}
              onClick={() => {
                setCourseType(ct.value)
                if (ct.value === 'kids_group') {
                  setLearnerType('child')
                } else if (ct.value === 'adult_group') {
                  setLearnerType('self')
                } else {
                  setLearnerType(null)
                }
              }}
            >
              <CardContent className="p-6 text-center">
                <div className="w-14 h-14 bg-[#2748bf]/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <ct.icon className="h-7 w-7 text-[#2748bf]" />
                </div>
                <h3 className="font-bold text-lg mb-1">{ct.label}</h3>
                <p className="text-sm text-gray-500">{ct.desc}</p>
                {courseType === ct.value && (
                  <Badge className="mt-3 bg-[#2748bf]">เลือกแล้ว</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Step 2: Learner Selection */}
      {step === 'learner' && (
        <div>
          {courseType === 'kids_group' ? (
            <div>
              <h3 className="font-bold text-lg mb-4 text-[#153c85]">เลือกลูกที่จะเรียน</h3>
              {children.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-gray-400">
                    <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>ยังไม่มีข้อมูลลูก</p>
                    <Button
                      variant="outline"
                      className="mt-3"
                      onClick={() => router.push('/dashboard/children')}
                    >
                      เพิ่มข้อมูลลูก
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {children.map((child) => {
                    const isSelected = selectedChildren.includes(child.id)
                    return (
                      <Card
                        key={child.id}
                        className={`cursor-pointer transition-all ${
                          isSelected ? 'border-2 border-[#2748bf] bg-[#2748bf]/5' : 'hover:border-[#2748bf]/30'
                        }`}
                        onClick={() => {
                          setSelectedChildren((prev) =>
                            isSelected ? prev.filter((id) => id !== child.id) : [...prev, child.id]
                          )
                          if (!childSessions[child.id]) {
                            setChildSessions((prev) => ({ ...prev, [child.id]: 4 }))
                          }
                        }}
                      >
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isSelected ? 'bg-[#2748bf] text-white' : 'bg-gray-100'
                          }`}>
                            {isSelected ? <CheckCircle2 className="h-5 w-5" /> : <User className="h-5 w-5 text-gray-400" />}
                          </div>
                          <div>
                            <p className="font-medium">{child.full_name}</p>
                            {child.nickname && <p className="text-xs text-gray-500">({child.nickname})</p>}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
              {selectedChildren.length > 1 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>กฎพี่น้อง: รวมจำนวนครั้งของลูกทุกคน แล้วใช้เรทรวมที่ถูกกว่า!</span>
                </div>
              )}
            </div>
          ) : courseType === 'private' ? (
            <div>
              <h3 className="font-bold text-lg mb-4 text-[#153c85]">ใครจะเรียน?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Card
                  className={`cursor-pointer transition-all ${
                    learnerType === 'self' ? 'border-2 border-[#2748bf] bg-[#2748bf]/5' : 'hover:border-[#2748bf]/30'
                  }`}
                  onClick={() => setLearnerType('self')}
                >
                  <CardContent className="p-5 flex items-center gap-3">
                    <User className="h-6 w-6 text-[#2748bf]" />
                    <div>
                      <p className="font-medium">ตัวเอง</p>
                      <p className="text-xs text-gray-500">{userName}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card
                  className={`cursor-pointer transition-all ${
                    learnerType === 'child' ? 'border-2 border-[#2748bf] bg-[#2748bf]/5' : 'hover:border-[#2748bf]/30'
                  }`}
                  onClick={() => setLearnerType('child')}
                >
                  <CardContent className="p-5 flex items-center gap-3">
                    <Users className="h-6 w-6 text-[#2748bf]" />
                    <div>
                      <p className="font-medium">ลูก/บุตรหลาน</p>
                      <p className="text-xs text-gray-500">{children.length} คน</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
              {learnerType === 'child' && children.length > 0 && (
                <div className="mt-4">
                  <Select
                    value={selectedChildren[0] || ''}
                    onValueChange={(v) => setSelectedChildren([v])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกลูก" />
                    </SelectTrigger>
                    <SelectContent>
                      {children.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ) : (
            <div>
              <h3 className="font-bold text-lg mb-4 text-[#153c85]">ผู้เรียน: {userName}</h3>
              <Card className="border-2 border-[#2748bf] bg-[#2748bf]/5">
                <CardContent className="p-5 flex items-center gap-3">
                  <User className="h-6 w-6 text-[#2748bf]" />
                  <div>
                    <p className="font-medium">{userName}</p>
                    <p className="text-xs text-gray-500">ผู้ใหญ่ (กลุ่ม)</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Branch Selection */}
      {step === 'branch' && (
        <div>
          <h3 className="font-bold text-lg mb-4 text-[#153c85]">เลือกสาขา</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {branches.map((branch) => (
              <Card
                key={branch.id}
                className={`cursor-pointer transition-all ${
                  branchId === branch.id
                    ? 'border-2 border-[#2748bf] bg-[#2748bf]/5'
                    : 'hover:border-[#2748bf]/30'
                }`}
                onClick={() => setBranchId(branch.id)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <MapPin className={`h-5 w-5 ${branchId === branch.id ? 'text-[#2748bf]' : 'text-[#f57e3b]'}`} />
                  <div>
                    <p className="font-medium">{branch.name}</p>
                    {branch.address && <p className="text-xs text-gray-500">{branch.address}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Sessions */}
      {step === 'sessions' && (
        <div>
          <h3 className="font-bold text-lg mb-4 text-[#153c85]">เลือกจำนวนครั้ง</h3>

          {courseType === 'kids_group' ? (
            <div className="space-y-4">
              {selectedChildren.map((childId) => {
                const child = children.find((c) => c.id === childId)
                const sess = childSessions[childId] || 4
                return (
                  <Card key={childId}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{child?.full_name}</p>
                          <p className="text-xs text-gray-500">ครั้ง/เดือน</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setChildSessions((p) => ({ ...p, [childId]: Math.max(1, sess - 1) }))}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="text-xl font-bold w-8 text-center">{sess}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setChildSessions((p) => ({ ...p, [childId]: sess + 1 }))}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}

              {/* Pricing display */}
              {pricing && (
                <Card className="bg-[#2748bf]/5 border-[#2748bf]/20">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-600">รวม {'sessions' in pricing ? pricing.sessions : 0} ครั้ง/เดือน ({pricing.tier_label})</p>
                        {'sibling_discount' in pricing && pricing.sibling_discount && (
                          <p className="text-xs text-green-600 font-medium mt-1">✓ ใช้กฎพี่น้อง — รวมครั้งทุกคน</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-[#2748bf]">฿{pricing.package_price.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">({'per_session' in pricing ? pricing.per_session : 0} บาท/ครั้ง)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tier reference */}
              <details className="text-sm">
                <summary className="cursor-pointer text-gray-500 hover:text-[#2748bf]">ดูเรทราคาทั้งหมด</summary>
                <div className="mt-2 space-y-1">
                  {getKidsGroupTiers().map((t) => (
                    <div key={t.label} className="flex justify-between py-1 px-2 bg-gray-50 rounded text-xs">
                      <span>{t.label}</span>
                      <span className="font-medium">฿{t.package_price.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          ) : courseType === 'adult_group' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {getAdultGroupTiers().map((t) => (
                  <Card
                    key={t.label}
                    className={`cursor-pointer transition-all ${
                      sessions === t.min ? 'border-2 border-[#2748bf] bg-[#2748bf]/5' : 'hover:border-[#2748bf]/30'
                    }`}
                    onClick={() => setSessions(t.min)}
                  >
                    <CardContent className="p-4 text-center">
                      <p className="font-bold text-lg">{t.label}</p>
                      <p className="text-2xl font-bold text-[#2748bf] mt-1">฿{t.package_price.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">({t.per_session} บาท/ครั้ง)</p>
                      {t.expiry_months && (
                        <p className="text-xs text-orange-600 mt-1">ใช้ได้ {t.expiry_months} เดือน</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {getPrivateTiers().map((t) => (
                  <Card
                    key={t.label}
                    className={`cursor-pointer transition-all ${
                      sessions === t.min ? 'border-2 border-[#2748bf] bg-[#2748bf]/5' : 'hover:border-[#2748bf]/30'
                    }`}
                    onClick={() => setSessions(t.min)}
                  >
                    <CardContent className="p-4 text-center">
                      <p className="font-bold text-lg">{t.label}</p>
                      <p className="text-2xl font-bold text-[#2748bf] mt-1">฿{t.package_price.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">({t.per_hour} บาท/ชม.)</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 5: Summary */}
      {step === 'summary' && (
        <div>
          <h3 className="font-bold text-lg mb-4 text-[#153c85]">สรุปการจอง</h3>
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">ประเภทคอร์ส</p>
                  <p className="font-medium">{COURSE_TYPES.find((c) => c.value === courseType)?.label}</p>
                </div>
                <div>
                  <p className="text-gray-500">สาขา</p>
                  <p className="font-medium">{selectedBranch?.name}</p>
                </div>
                <div>
                  <p className="text-gray-500">ผู้เรียน</p>
                  <p className="font-medium">
                    {courseType === 'kids_group'
                      ? selectedChildren.map((id) => children.find((c) => c.id === id)?.full_name).join(', ')
                      : learnerType === 'self'
                        ? userName
                        : children.find((c) => c.id === selectedChildren[0])?.full_name
                    }
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">จำนวน</p>
                  <p className="font-medium">{pricing && 'sessions' in pricing ? pricing.sessions : sessions} ครั้ง</p>
                </div>
              </div>

              {/* Coupon Section */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">คูปองส่วนลด</p>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-700">
                        {appliedCoupon.code} — ลด {appliedCoupon.discount_type === 'fixed'
                          ? `฿${appliedCoupon.discount_value.toLocaleString()}`
                          : `${appliedCoupon.discount_value}%`}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 h-7 px-2"
                      onClick={() => { setAppliedCoupon(null); setDiscountAmount(0); setCouponCode('') }}
                    >
                      ยกเลิก
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="กรอกรหัสคูปอง"
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(null) }}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={handleApplyCoupon}
                      disabled={!couponCode.trim() || couponLoading}
                    >
                      {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'ใช้คูปอง'}
                    </Button>
                  </div>
                )}
                {couponError && (
                  <p className="text-xs text-red-500 mt-1">{couponError}</p>
                )}
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span>ราคาเต็ม</span>
                  <span>฿{(pricing?.package_price || 0).toLocaleString()}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-sm text-green-600">
                    <span>ส่วนลดคูปอง</span>
                    <span>-฿{discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <p className="text-lg font-medium">ยอดชำระ</p>
                  <p className="text-3xl font-bold text-[#2748bf]">
                    ฿{((pricing?.package_price || 0) - discountAmount).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
                <p className="font-medium">หลังจากกดยืนยัน:</p>
                <p>• ระบบจะสร้างรายการจองสถานะ &quot;รอชำระเงิน&quot;</p>
                <p>• กรุณาแนบสลิปโอนเงินในหน้าประวัติการจอง</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          onClick={goBack}
          disabled={currentStepIndex === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          ย้อนกลับ
        </Button>

        {step === 'summary' ? (
          <Button
            className="bg-[#f57e3b] hover:bg-[#e06a2a] text-white"
            onClick={handleSubmitBooking}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                กำลังจอง...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                ยืนยันการจอง
              </>
            )}
          </Button>
        ) : (
          <Button
            className="bg-[#2748bf] hover:bg-[#153c85]"
            onClick={goNext}
            disabled={!canGoNext()}
          >
            ถัดไป
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
