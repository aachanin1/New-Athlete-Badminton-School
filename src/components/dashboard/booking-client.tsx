'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Child, Branch, CourseTypeName } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  X,
  CalendarDays,
  Clock,
} from 'lucide-react'
import { getAvailableSlots, hasAvailableSlots, DAY_LABELS, type TimeSlot } from '@/lib/branch-schedules'
import { getKidsGroupTotal, getKidsGroupIncremental, getAdultGroupTotal, getSessionStatusLabel, getKidsGroupTiers, getAdultGroupTiers, getPrivateTiers } from '@/lib/pricing'
import { fmtTime } from '@/lib/utils'

interface CourseTypeRow {
  id: string
  name: string
}

interface ExistingBooking {
  id: string
  child_id: string | null
  course_type_id: string
  month: number
  year: number
  total_sessions: number
  total_price: number
  status: string
}

interface ExistingBookingSession {
  id: string
  booking_id: string
  date: string
  start_time: string
  end_time: string
  branch_id: string
  child_id: string | null
  status: string
}

interface SelectedSession {
  date: string       // "2026-02-15"
  dayOfWeek: number  // 0-6
  start: string      // "17:00"
  end: string        // "19:00"
  branchId: string
}

interface EditBookingSession {
  id: string
  date: string
  start_time: string
  end_time: string
  branch_id: string
  child_id: string | null
}

interface EditBookingData {
  id: string
  learner_type: string
  child_id: string | null
  branch_id: string
  course_type_id: string
  month: number
  year: number
  total_sessions: number
  total_price: number
  status: string
  course_types: { name: string } | null
  sessions: EditBookingSession[]
  childIds: string[]
}

interface BookingClientProps {
  userId: string
  userName: string
  children: Child[]
  branches: Branch[]
  courseTypes: CourseTypeRow[]
  existingBookings: ExistingBooking[]
  existingBookingSessions?: ExistingBookingSession[]
  editBooking?: EditBookingData | null
}

type Step = 'type' | 'learner' | 'branch' | 'calendar' | 'summary'

const STEPS: { key: Step; label: string }[] = [
  { key: 'type', label: 'ประเภท' },
  { key: 'learner', label: 'ผู้เรียน' },
  { key: 'branch', label: 'สาขา' },
  { key: 'calendar', label: 'เลือกวันเรียน' },
  { key: 'summary', label: 'สรุป' },
]

const COURSE_TYPES: { value: CourseTypeName; label: string; desc: string; icon: typeof Users }[] = [
  { value: 'kids_group', label: 'เด็ก (กลุ่ม)', desc: 'กลุ่มเล็ก 4-6 คน • 2 ชม.', icon: Users },
  { value: 'adult_group', label: 'ผู้ใหญ่ (กลุ่ม)', desc: '1-6 คน • 2 ชม.', icon: User },
  { value: 'private', label: 'Private', desc: 'เด็ก & ผู้ใหญ่ • 1 ชม.', icon: Star },
]

const MONTH_NAMES_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

export function BookingClient({ userId, userName, children, branches, courseTypes, existingBookings, existingBookingSessions = [], editBooking }: BookingClientProps) {
  const router = useRouter()
  const isEditMode = !!editBooking

  // Pre-fill from editBooking if in edit mode
  const editCourseTypeName = editBooking?.course_types?.name as CourseTypeName | undefined
  const editBranchId = editBooking?.branch_id

  const [step, setStep] = useState<Step>(isEditMode ? 'calendar' : 'type')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Coupon state
  const [couponCode, setCouponCode] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: string; code: string; discount_type: string; discount_value: number; discountAmount: number
  } | null>(null)

  // Booking state
  const [courseType, setCourseType] = useState<CourseTypeName | null>(editCourseTypeName || null)
  const [learnerType, setLearnerType] = useState<'self' | 'child' | null>(
    isEditMode ? (editBooking.learner_type === 'child' ? 'child' : 'self') : null
  )
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>(editBooking?.childIds || [])
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(editBranchId ? [editBranchId] : [])

  // Calendar state — per-child sessions map
  const now = new Date()
  const [calMonth, setCalMonth] = useState(isEditMode ? (editBooking.month - 1) : now.getMonth())
  const [calYear, setCalYear] = useState(isEditMode ? editBooking.year : now.getFullYear())

  // Build initial sessionsMap from editBooking sessions
  const buildEditSessionsMap = (): Record<string, SelectedSession[]> => {
    if (!editBooking) return {}
    const map: Record<string, SelectedSession[]> = {}
    for (const s of editBooking.sessions) {
      const key = s.child_id || 'self'
      const d = new Date(s.date + 'T00:00:00')
      if (!map[key]) map[key] = []
      map[key].push({
        date: s.date,
        dayOfWeek: d.getDay(),
        start: s.start_time.slice(0, 5),
        end: s.end_time.slice(0, 5),
        branchId: s.branch_id,
      })
    }
    return map
  }

  const [sessionsMap, setSessionsMap] = useState<Record<string, SelectedSession[]>>(buildEditSessionsMap)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [activeChildTab, setActiveChildTab] = useState<string>(
    isEditMode && editBooking.childIds.length > 0 ? editBooking.childIds[0] : 'self'
  )

  const currentStepIndex = STEPS.findIndex((s) => s.key === step)
  const selectedBranches = branches.filter((b) => selectedBranchIds.includes(b.id))
  const branchNameMap = useMemo(() => {
    const m: Record<string, string> = {}
    branches.forEach((b) => { m[b.id] = b.name })
    return m
  }, [branches])

  // For non-kids bookings, use 'self' as key in sessionsMap
  const activeSessions = sessionsMap[activeChildTab] || []

  // Total sessions across all selected children (for this booking batch)
  const allSelectedSessions = useMemo(() => {
    return Object.entries(sessionsMap).flatMap(([childId, sessions]) => {
      if (courseType === 'kids_group' && !selectedChildIds.includes(childId)) return []
      return sessions
    })
  }, [sessionsMap, courseType, selectedChildIds])

  // Count ALL existing sessions & total paid this month (for incremental pricing)
  const existingMonthData = useMemo(() => {
    if (courseType !== 'kids_group') return { sessions: 0, paid: 0 }
    const courseTypeRow = courseTypes.find((ct) => ct.name === courseType)
    if (!courseTypeRow) return { sessions: 0, paid: 0 }
    const editId = editBooking?.id
    const monthBookings = existingBookings.filter(
      (b) => b.month === calMonth + 1 && b.year === calYear && b.course_type_id === courseTypeRow.id && b.id !== editId
    )
    return {
      sessions: monthBookings.reduce((sum, b) => sum + b.total_sessions, 0),
      paid: monthBookings.reduce((sum, b) => sum + (b.total_price || 0), 0),
    }
  }, [courseType, calMonth, calYear, existingBookings, courseTypes, editBooking])

  // Incremental pricing for kids_group
  const kidsIncremental = useMemo(() => {
    if (courseType !== 'kids_group' || allSelectedSessions.length === 0) return null
    return getKidsGroupIncremental(existingMonthData.sessions, existingMonthData.paid, allSelectedSessions.length)
  }, [courseType, allSelectedSessions.length, existingMonthData])

  const pricing = useMemo(() => {
    if (!courseType || allSelectedSessions.length === 0) return null
    if (courseType === 'kids_group' && kidsIncremental) {
      return { total: kidsIncremental.incrementalPrice, perSession: kidsIncremental.perSession, tierLabel: kidsIncremental.tierLabel }
    }
    if (courseType === 'adult_group') return getAdultGroupTotal(allSelectedSessions.length)
    return { total: allSelectedSessions.length * 900, perSession: 900, tierLabel: 'รายชั่วโมง' }
  }, [courseType, allSelectedSessions.length, kidsIncremental])

  // Total price for entire batch (incremental for kids, normal for others)
  const totalBatchPrice = useMemo(() => {
    if (!pricing) return 0
    if (courseType === 'kids_group' && kidsIncremental) return kidsIncremental.incrementalPrice
    return pricing.perSession * allSelectedSessions.length
  }, [pricing, courseType, kidsIncremental, allSelectedSessions.length])

  // Per-child price breakdown (proportional based on session count)
  const childPriceBreakdown = useMemo(() => {
    if (!pricing || courseType !== 'kids_group') return {}
    const map: Record<string, number> = {}
    const totalNew = allSelectedSessions.length
    selectedChildIds.forEach((cid) => {
      const count = (sessionsMap[cid] || []).length
      map[cid] = totalNew > 0 ? Math.round(totalBatchPrice * count / totalNew) : 0
    })
    return map
  }, [pricing, courseType, selectedChildIds, sessionsMap, totalBatchPrice, allSelectedSessions.length])

  // Existing booked sessions for calendar display (filter by current month)
  const existingSessionsForCalendar = useMemo(() => {
    if (!editBooking) {
      return existingBookingSessions.filter((s) => {
        const d = new Date(s.date + 'T00:00:00')
        return d.getMonth() === calMonth && d.getFullYear() === calYear
      })
    }
    // In edit mode, exclude sessions from the booking being edited
    return existingBookingSessions.filter((s) => {
      if (s.booking_id === editBooking.id) return false
      const d = new Date(s.date + 'T00:00:00')
      return d.getMonth() === calMonth && d.getFullYear() === calYear
    })
  }, [existingBookingSessions, calMonth, calYear, editBooking])

  const getExistingSessionsForDate = (day: number) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return existingSessionsForCalendar.filter((s) => s.date === dateStr)
  }

  const sessionStatus = allSelectedSessions.length > 0 ? getSessionStatusLabel(allSelectedSessions.length) : null

  // Final price after coupon discount
  const finalPrice = appliedCoupon ? Math.max(0, totalBatchPrice - appliedCoupon.discountAmount) : totalBatchPrice

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    setCouponError(null)
    try {
      const res = await fetch('/api/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim(), totalAmount: totalBatchPrice }),
      })
      const json = await res.json()
      if (!res.ok) {
        setCouponError(json.error || 'คูปองไม่ถูกต้อง')
        setAppliedCoupon(null)
      } else {
        setAppliedCoupon({
          id: json.coupon.id,
          code: json.coupon.code,
          discount_type: json.coupon.discount_type,
          discount_value: json.coupon.discount_value,
          discountAmount: json.discountAmount,
        })
        setCouponError(null)
      }
    } catch {
      setCouponError('เกิดข้อผิดพลาด')
    }
    setCouponLoading(false)
  }

  const removeCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode('')
    setCouponError(null)
  }

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1)
    const lastDay = new Date(calYear, calMonth + 1, 0)
    const startDow = firstDay.getDay()
    const totalDays = lastDay.getDate()
    const days: (number | null)[] = []
    for (let i = 0; i < startDow; i++) days.push(null)
    for (let d = 1; d <= totalDays; d++) days.push(d)
    return days
  }, [calMonth, calYear])

  const isDateSelectable = (day: number) => {
    if (selectedBranchIds.length === 0 || !courseType) return false
    const date = new Date(calYear, calMonth, day)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    if (date <= today) return false
    return selectedBranches.some((b) => hasAvailableSlots(b.slug, courseType, date))
  }

  const isDateSelected = (day: number) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return activeSessions.some((s) => s.date === dateStr)
  }

  const getDateSessions = (day: number) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return activeSessions.filter((s) => s.date === dateStr)
  }

  const handleDayClick = (day: number) => {
    if (!isDateSelectable(day)) return
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setExpandedDate(expandedDate === dateStr ? null : dateStr)
  }

  const handleSlotSelect = (day: number, slot: TimeSlot, slotBranchId: string) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const date = new Date(calYear, calMonth, day)
    const key = activeChildTab
    const current = sessionsMap[key] || []
    const existing = current.find((s) => s.date === dateStr && s.start === slot.start && s.branchId === slotBranchId)
    if (existing) {
      setSessionsMap((prev) => ({ ...prev, [key]: current.filter((s) => !(s.date === dateStr && s.start === slot.start && s.branchId === slotBranchId)) }))
    } else {
      setSessionsMap((prev) => ({ ...prev, [key]: [...current, { date: dateStr, dayOfWeek: date.getDay(), start: slot.start, end: slot.end, branchId: slotBranchId }] }))
    }
  }

  const removeSession = (key: string, index: number) => {
    const current = sessionsMap[key] || []
    setSessionsMap((prev) => ({ ...prev, [key]: current.filter((_, i) => i !== index) }))
  }

  const toggleChild = (childId: string) => {
    setSelectedChildIds((prev) =>
      prev.includes(childId) ? prev.filter((id) => id !== childId) : [...prev, childId]
    )
  }

  const goNext = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      // When entering calendar, set activeChildTab
      if (STEPS[nextIndex].key === 'calendar') {
        if (courseType === 'kids_group' && selectedChildIds.length > 0) {
          setActiveChildTab(selectedChildIds[0])
        } else {
          setActiveChildTab('self')
        }
      }
      setStep(STEPS[nextIndex].key)
    }
  }
  const goBack = () => {
    if (isEditMode && step === 'calendar') return // Can't go back before calendar in edit mode
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) setStep(STEPS[prevIndex].key)
  }
  const canGoNext = () => {
    switch (step) {
      case 'type': return !!courseType
      case 'learner':
        if (courseType === 'kids_group') return selectedChildIds.length > 0
        return !!learnerType
      case 'branch': return selectedBranchIds.length > 0
      case 'calendar': return allSelectedSessions.length > 0
      default: return false
    }
  }

  const handleSubmitBooking = async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const courseTypeRow = courseTypes.find((ct) => ct.name === courseType)
    if (!courseTypeRow) {
      setError('ไม่พบประเภทคอร์สในระบบ')
      setLoading(false)
      return
    }

    try {
      const primaryBranchId = selectedBranchIds[0] || null

      // Always create 1 booking = 1 bill regardless of number of children
      const isKids = courseType === 'kids_group'
      const singleChildId = isKids && selectedChildIds.length === 1 ? selectedChildIds[0] : null

      // Gather all sessions with child_id
      const allSessions: { date: string; start: string; end: string; branchId: string; childId: string | null }[] = []
      if (isKids) {
        for (const childId of selectedChildIds) {
          const childSessions = sessionsMap[childId] || []
          childSessions.forEach((s) => allSessions.push({ ...s, childId }))
        }
      } else {
        const selfSessions = sessionsMap['self'] || []
        selfSessions.forEach((s) => allSessions.push({ ...s, childId: null }))
      }

      if (allSessions.length === 0) {
        setError('กรุณาเลือกวันเรียนอย่างน้อย 1 วัน')
        setLoading(false)
        return
      }

      if (isEditMode && editBooking) {
        // Edit mode: delete old sessions and insert new ones, update booking
        await (supabase.from('booking_sessions') as any).delete().eq('booking_id', editBooking.id)

        const { error: updateErr } = await (supabase.from('bookings') as any)
          .update({
            total_sessions: allSessions.length,
            total_price: finalPrice,
            branch_id: primaryBranchId,
          })
          .eq('id', editBooking.id)

        if (updateErr) { setError(`เกิดข้อผิดพลาด: ${updateErr.message}`); setLoading(false); return }

        await (supabase.from('booking_sessions') as any).insert(
          allSessions.map((s) => ({
            booking_id: editBooking.id,
            date: s.date,
            start_time: s.start,
            end_time: s.end,
            branch_id: s.branchId,
            child_id: s.childId,
            status: 'scheduled',
            is_makeup: false,
          }))
        )

        router.push('/dashboard/history')
        router.refresh()
      } else {
        // New booking mode
        const { data: bookingData, error: insertErr } = await (supabase.from('bookings') as any)
          .insert({
            user_id: userId,
            learner_type: isKids ? 'child' : (learnerType || 'self'),
            child_id: singleChildId,
            branch_id: primaryBranchId,
            course_type_id: courseTypeRow.id,
            month: calMonth + 1,
            year: calYear,
            total_sessions: allSessions.length,
            total_price: finalPrice,
            status: 'pending_payment',
          }).select('id').single()

        if (insertErr) { setError(`เกิดข้อผิดพลาด: ${insertErr.message}`); setLoading(false); return }

        if (bookingData) {
          await (supabase.from('booking_sessions') as any).insert(
            allSessions.map((s) => ({
              booking_id: bookingData.id,
              date: s.date,
              start_time: s.start,
              end_time: s.end,
              branch_id: s.branchId,
              child_id: s.childId,
              status: 'scheduled',
              is_makeup: false,
            }))
          )

          // Record coupon usage if applied
          if (appliedCoupon) {
            await (supabase.from('coupon_usages') as any).insert({
              coupon_id: appliedCoupon.id,
              user_id: userId,
              booking_id: bookingData.id,
              discount_amount: appliedCoupon.discountAmount,
            })
            // Increment coupon usage count
            const { data: couponData } = await (supabase.from('coupons') as any)
              .select('current_uses')
              .eq('id', appliedCoupon.id)
              .single()
            if (couponData) {
              await (supabase.from('coupons') as any)
                .update({ current_uses: (couponData.current_uses || 0) + 1 })
                .eq('id', appliedCoupon.id)
            }
          }
        }

        router.push('/dashboard/history')
        router.refresh()
      }
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
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${i <= currentStepIndex ? 'bg-[#2748bf] text-white' : 'bg-gray-100 text-gray-400'}`}>
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">{i < currentStepIndex ? '✓' : i + 1}</span>
              {s.label}
            </div>
            {i < STEPS.length - 1 && <div className={`w-6 h-0.5 mx-1 ${i < currentStepIndex ? 'bg-[#2748bf]' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-200 mb-4 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {/* Step 1: Course Type */}
      {step === 'type' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COURSE_TYPES.map((ct) => (
              <Card key={ct.value} className={`cursor-pointer transition-all hover:shadow-md ${courseType === ct.value ? 'border-2 border-[#2748bf] shadow-md' : 'border hover:border-[#2748bf]/30'}`}
                onClick={() => { setCourseType(ct.value); setLearnerType(ct.value === 'kids_group' ? 'child' : ct.value === 'adult_group' ? 'self' : null) }}>
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 bg-[#2748bf]/10 rounded-xl flex items-center justify-center mx-auto mb-3"><ct.icon className="h-7 w-7 text-[#2748bf]" /></div>
                  <h3 className="font-bold text-lg mb-1">{ct.label}</h3>
                  <p className="text-sm text-gray-500">{ct.desc}</p>
                  {courseType === ct.value && <Badge className="mt-3 bg-[#2748bf]">เลือกแล้ว</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pricing Table */}
          {courseType && (
            <Card>
              <CardContent className="p-4">
                <h4 className="font-bold text-[#153c85] mb-3">ตารางเรทราคา — {COURSE_TYPES.find((c) => c.value === courseType)?.label}</h4>
                {courseType === 'kids_group' && (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-gray-500">
                            <th className="pb-2 pr-4">จำนวนครั้ง/เดือน</th>
                            <th className="pb-2 pr-4 text-right">ราคา/ครั้ง</th>
                            <th className="pb-2 text-right">ตัวอย่าง (7 ครั้ง)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getKidsGroupTiers().map((t) => (
                            <tr key={t.min} className="border-b last:border-0">
                              <td className="py-2 pr-4 font-medium">{t.label}</td>
                              <td className="py-2 pr-4 text-right text-[#2748bf] font-medium">{t.per_session} บาท</td>
                              <td className="py-2 text-right text-gray-500">
                                {t.min <= 7 && (t.max === null || t.max >= 7) ? `${(t.per_session * 7).toLocaleString()} บาท` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">* กฎพี่น้อง: ลูกหลายคนนับรวมครั้งกัน → ได้เรทที่ถูกกว่า</p>
                  </>
                )}
                {courseType === 'adult_group' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-500">
                          <th className="pb-2 pr-4">แพ็กเกจ</th>
                          <th className="pb-2 pr-4 text-right">ราคา</th>
                          <th className="pb-2 text-right">เฉลี่ย/ครั้ง</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getAdultGroupTiers().map((t) => (
                          <tr key={t.min} className="border-b last:border-0">
                            <td className="py-2 pr-4 font-medium">{t.label}{t.expiry_months ? ` (หมดอายุ ${t.expiry_months} เดือน)` : ''}</td>
                            <td className="py-2 pr-4 text-right text-[#2748bf] font-medium">{t.package_price.toLocaleString()} บาท</td>
                            <td className="py-2 text-right text-gray-500">{t.per_session} บาท</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {courseType === 'private' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-500">
                          <th className="pb-2 pr-4">แพ็กเกจ</th>
                          <th className="pb-2 pr-4 text-right">ราคา</th>
                          <th className="pb-2 text-right">เฉลี่ย/ชม.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getPrivateTiers().map((t) => (
                          <tr key={t.min} className="border-b last:border-0">
                            <td className="py-2 pr-4 font-medium">{t.label}</td>
                            <td className="py-2 pr-4 text-right text-[#2748bf] font-medium">{t.package_price.toLocaleString()} บาท</td>
                            <td className="py-2 text-right text-gray-500">{t.per_hour} บาท</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Step 2: Learner */}
      {step === 'learner' && (
        <div>
          {courseType === 'kids_group' ? (
            <div>
              <h3 className="font-bold text-lg mb-4 text-[#153c85]">เลือกลูกที่จะเรียน (เลือกได้หลายคน)</h3>
              {children.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-gray-400">
                  <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-50" /><p>ยังไม่มีข้อมูลลูก</p>
                  <Button variant="outline" className="mt-3" onClick={() => router.push('/dashboard/children')}>เพิ่มข้อมูลลูก</Button>
                </CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {children.map((child) => {
                    const isSelected = selectedChildIds.includes(child.id)
                    return (
                      <Card key={child.id} className={`cursor-pointer transition-all ${isSelected ? 'border-2 border-[#2748bf] bg-[#2748bf]/5' : 'hover:border-[#2748bf]/30'}`}
                        onClick={() => toggleChild(child.id)}>
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSelected ? 'bg-[#2748bf] text-white' : 'bg-gray-100'}`}>
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
              {selectedChildIds.length > 1 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>กฎพี่น้อง: เลือก {selectedChildIds.length} คน → ระบบจะรวมครั้งทุกคนเพื่อใช้เรทที่ดีกว่า + รวมบิลเดียว!</span>
                </div>
              )}
              {existingMonthData.sessions > 0 && selectedChildIds.length > 0 && (
                <div className="mt-2 p-3 bg-green-50 rounded-lg text-sm text-green-700 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>จองไว้แล้ว {existingMonthData.sessions} ครั้งเดือนนี้ (฿{existingMonthData.paid.toLocaleString()}) → ระบบนับต่อให้อัตโนมัติ!</span>
                </div>
              )}
            </div>
          ) : courseType === 'private' ? (
            <div>
              <h3 className="font-bold text-lg mb-4 text-[#153c85]">ใครจะเรียน?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Card className={`cursor-pointer transition-all ${learnerType === 'self' ? 'border-2 border-[#2748bf] bg-[#2748bf]/5' : 'hover:border-[#2748bf]/30'}`} onClick={() => { setLearnerType('self'); setSelectedChildIds([]) }}>
                  <CardContent className="p-5 flex items-center gap-3"><User className="h-6 w-6 text-[#2748bf]" /><div><p className="font-medium">ตัวเอง</p><p className="text-xs text-gray-500">{userName}</p></div></CardContent>
                </Card>
                <Card className={`cursor-pointer transition-all ${learnerType === 'child' ? 'border-2 border-[#2748bf] bg-[#2748bf]/5' : 'hover:border-[#2748bf]/30'}`} onClick={() => setLearnerType('child')}>
                  <CardContent className="p-5 flex items-center gap-3"><Users className="h-6 w-6 text-[#2748bf]" /><div><p className="font-medium">ลูก/บุตรหลาน</p><p className="text-xs text-gray-500">{children.length} คน</p></div></CardContent>
                </Card>
              </div>
              {learnerType === 'child' && children.length > 0 && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {children.map((c) => (
                    <Card key={c.id} className={`cursor-pointer ${selectedChildIds.includes(c.id) ? 'border-2 border-[#2748bf] bg-[#2748bf]/5' : ''}`} onClick={() => setSelectedChildIds([c.id])}>
                      <CardContent className="p-3"><p className="font-medium text-sm">{c.full_name}</p></CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <h3 className="font-bold text-lg mb-4 text-[#153c85]">ผู้เรียน: {userName}</h3>
              <Card className="border-2 border-[#2748bf] bg-[#2748bf]/5">
                <CardContent className="p-5 flex items-center gap-3"><User className="h-6 w-6 text-[#2748bf]" /><div><p className="font-medium">{userName}</p><p className="text-xs text-gray-500">ผู้ใหญ่ (กลุ่ม)</p></div></CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Branch (multi-select) */}
      {step === 'branch' && (
        <div>
          <h3 className="font-bold text-lg mb-4 text-[#153c85]">เลือกสาขา (เลือกได้หลายสาขา)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {branches.map((branch) => {
              const isSel = selectedBranchIds.includes(branch.id)
              return (
                <Card key={branch.id} className={`cursor-pointer transition-all ${isSel ? 'border-2 border-[#2748bf] bg-[#2748bf]/5' : 'hover:border-[#2748bf]/30'}`}
                  onClick={() => {
                    setSelectedBranchIds((prev) => prev.includes(branch.id) ? prev.filter((id) => id !== branch.id) : [...prev, branch.id])
                    setSessionsMap({})
                  }}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSel ? 'bg-[#2748bf] text-white' : 'bg-gray-100'}`}>
                      {isSel ? <CheckCircle2 className="h-4 w-4" /> : <MapPin className="h-4 w-4 text-[#f57e3b]" />}
                    </div>
                    <div><p className="font-medium">{branch.name}</p>{branch.address && <p className="text-xs text-gray-500">{branch.address}</p>}</div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          {selectedBranchIds.length > 1 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700 flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
              <span>เลือก {selectedBranchIds.length} สาขา — ในปฏิทินจะแสดงรอบเรียนของทุกสาขาให้เลือก</span>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Calendar — เลือกวันเรียน */}
      {step === 'calendar' && selectedBranches.length > 0 && courseType && (
        <div className="space-y-4">
          {/* Month Selector */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-bold text-lg text-[#153c85]">เลือกวันเรียน — {selectedBranches.map((b) => b.name).join(', ')}</h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1) } else setCalMonth(calMonth - 1)
                setSessionsMap({}); setExpandedDate(null)
              }} disabled={calMonth === now.getMonth() && calYear === now.getFullYear()}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium w-36 text-center">{MONTH_NAMES_TH[calMonth]} {calYear + 543}</span>
              <Button variant="outline" size="sm" onClick={() => {
                if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1) } else setCalMonth(calMonth + 1)
                setSessionsMap({}); setExpandedDate(null)
              }}>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Child tabs (kids_group only) */}
          {courseType === 'kids_group' && selectedChildIds.length > 1 && (
            <div className="flex gap-2 border-b pb-2">
              {selectedChildIds.map((cid) => {
                const child = children.find((c) => c.id === cid)
                const count = (sessionsMap[cid] || []).length
                return (
                  <Button key={cid} size="sm"
                    variant={activeChildTab === cid ? 'default' : 'outline'}
                    className={activeChildTab === cid ? 'bg-[#2748bf]' : ''}
                    onClick={() => { setActiveChildTab(cid); setExpandedDate(null) }}>
                    {child?.nickname || child?.full_name} {count > 0 && `(${count})`}
                  </Button>
                )
              })}
            </div>
          )}

          {/* Active child label */}
          {courseType === 'kids_group' && (() => {
            const child = children.find((c) => c.id === activeChildTab)
            return child ? (
              <p className="text-sm text-gray-600">กำลังเลือกวันเรียนของ: <span className="font-medium text-[#153c85]">{child.full_name}</span></p>
            ) : null
          })()}

          {/* Calendar Grid */}
          <Card>
            <CardContent className="p-3">
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500 mb-1">
                {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((d, idx) => <div key={d} className={`py-0.5 ${idx === 0 ? 'text-red-500' : ''}`}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => {
                  if (day === null) return <div key={`empty-${i}`} />
                  const selectable = isDateSelectable(day)
                  const selected = isDateSelected(day)
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const isExpanded = expandedDate === dateStr
                  const dateSessions = getDateSessions(day)
                  const existingForDate = getExistingSessionsForDate(day)
                  const hasExisting = existingForDate.length > 0

                  return (
                    <div key={day} className="relative">
                      <button onClick={() => handleDayClick(day)} disabled={!selectable}
                        className={`w-full h-10 rounded-lg text-sm font-medium transition-all relative
                          ${!selectable ? 'text-gray-300 cursor-not-allowed' : i % 7 === 0 && !selected ? 'text-red-500 cursor-pointer hover:bg-[#2748bf]/10' : 'cursor-pointer hover:bg-[#2748bf]/10'}
                          ${selected ? 'bg-[#2748bf] text-white hover:bg-[#2748bf]/90' : ''}
                          ${hasExisting && !selected ? 'bg-green-50 ring-1 ring-green-300' : ''}
                          ${isExpanded ? 'ring-2 ring-[#f57e3b]' : ''}`}>
                        {day}
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                          {existingForDate.map((es, ei) => {
                            const childName = es.child_id ? children.find(c => c.id === es.child_id)?.nickname || children.find(c => c.id === es.child_id)?.full_name || '' : 'ตัวเอง'
                            const dotColors = ['bg-emerald-500', 'bg-purple-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500']
                            const childIdx = es.child_id ? children.findIndex(c => c.id === es.child_id) : -1
                            const dotColor = childIdx >= 0 ? dotColors[childIdx % dotColors.length] : 'bg-gray-500'
                            return <span key={`ex-${ei}`} className={`w-1.5 h-1.5 ${dotColor} rounded-full`} title={`${childName} จองแล้ว`} />
                          })}
                          {dateSessions.map((_: SelectedSession, si: number) => <span key={si} className={`w-1 h-1 rounded-full ${selected ? 'bg-white' : 'bg-[#2748bf]'}`} />)}
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Existing bookings legend */}
              {existingSessionsForCalendar.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 items-center text-xs text-gray-500">
                  <span>จองแล้ว:</span>
                  {(() => {
                    const dotColors = ['bg-emerald-500', 'bg-purple-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500']
                    const seen = new Set<string>()
                    return existingSessionsForCalendar.map((es) => {
                      const key = es.child_id || 'self'
                      if (seen.has(key)) return null
                      seen.add(key)
                      const child = es.child_id ? children.find(c => c.id === es.child_id) : null
                      const name = child ? (child.nickname || child.full_name) : 'ตัวเอง'
                      const idx = child ? children.findIndex(c => c.id === es.child_id) : -1
                      const dotColor = idx >= 0 ? dotColors[idx % dotColors.length] : 'bg-gray-500'
                      return (
                        <span key={key} className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                          {name}
                        </span>
                      )
                    })
                  })()}
                </div>
              )}

              {/* Expanded slot picker — grouped by branch */}
              {expandedDate && (() => {
                const day = parseInt(expandedDate.split('-')[2])
                const date = new Date(calYear, calMonth, day)
                const dow = date.getDay()
                const existingHere = getExistingSessionsForDate(day)
                return (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg border space-y-3">
                    <p className="text-sm font-medium">
                      <CalendarDays className="inline h-4 w-4 mr-1" />
                      {DAY_LABELS[dow]} {day} {MONTH_NAMES_TH[calMonth]} — เลือกรอบเรียน:
                    </p>
                    {existingHere.length > 0 && (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 space-y-1">
                        <p className="font-medium">จองแล้วในวันนี้:</p>
                        {existingHere.map((es, ei) => {
                          const child = es.child_id ? children.find(c => c.id === es.child_id) : null
                          const name = child ? (child.nickname || child.full_name) : 'ตัวเอง'
                          const branch = branches.find(b => b.id === es.branch_id)
                          return (
                            <p key={ei}>• {name} — {fmtTime(es.start_time)}-{fmtTime(es.end_time)} @{branch?.name || '-'}</p>
                          )
                        })}
                      </div>
                    )}
                    {selectedBranches.map((branch) => {
                      const slots = getAvailableSlots(branch.slug, courseType, dow)
                      if (slots.length === 0) return null
                      return (
                        <div key={branch.id}>
                          {selectedBranches.length > 1 && (
                            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><MapPin className="h-3 w-3" />{branch.name}</p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {slots.map((slot) => {
                              const isSlotSelected = activeSessions.some((s) => s.date === expandedDate && s.start === slot.start && s.branchId === branch.id)
                              return (
                                <Button key={`${branch.id}-${slot.start}-${slot.end}`} size="sm"
                                  variant={isSlotSelected ? 'default' : 'outline'}
                                  className={isSlotSelected ? 'bg-[#2748bf]' : ''}
                                  onClick={() => handleSlotSelect(day, slot, branch.id)}>
                                  <Clock className="h-3 w-3 mr-1" />{fmtTime(slot.start)} - {fmtTime(slot.end)}
                                </Button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </CardContent>
          </Card>

          {/* Selected sessions list per child + combined pricing */}
          {allSelectedSessions.length > 0 && (
            <Card className="bg-[#2748bf]/5 border-[#2748bf]/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-[#153c85]">รวมทั้งหมด {allSelectedSessions.length} ครั้ง</p>
                  {sessionStatus && (
                    <Badge className={sessionStatus.warning ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}>
                      {sessionStatus.emoji} {sessionStatus.label}
                    </Badge>
                  )}
                </div>

                {sessionStatus?.warning && (
                  <p className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded">{sessionStatus.warning}</p>
                )}

                {/* Per-child session badges */}
                {courseType === 'kids_group' ? selectedChildIds.map((cid) => {
                  const child = children.find((c) => c.id === cid)
                  const childSess = (sessionsMap[cid] || []).sort((a: SelectedSession, b: SelectedSession) => a.date.localeCompare(b.date))
                  if (childSess.length === 0) return null
                  return (
                    <div key={cid}>
                      <p className="text-xs font-medium text-gray-600 mb-1">{child?.nickname || child?.full_name} ({childSess.length} ครั้ง)</p>
                      <div className="flex flex-wrap gap-1">
                        {childSess.map((s: SelectedSession, si: number) => {
                          const d = new Date(s.date + 'T00:00:00')
                          return (
                            <Badge key={si} variant="outline" className="text-xs py-0.5 px-1.5 gap-1">
                              {DAY_LABELS[s.dayOfWeek]} {d.getDate()}/{calMonth + 1} {fmtTime(s.start)}-{fmtTime(s.end)}{selectedBranchIds.length > 1 && ` @${branchNameMap[s.branchId] || ''}`}
                              <button onClick={() => removeSession(cid, si)} className="ml-0.5 hover:text-red-500"><X className="h-3 w-3" /></button>
                            </Badge>
                          )
                        })}
                      </div>
                    </div>
                  )
                }) : (
                  <div className="flex flex-wrap gap-2">
                    {activeSessions.sort((a, b) => a.date.localeCompare(b.date)).map((s, i) => {
                      const d = new Date(s.date + 'T00:00:00')
                      return (
                        <Badge key={i} variant="outline" className="text-xs py-1 px-2 gap-1">
                          {DAY_LABELS[s.dayOfWeek]} {d.getDate()}/{calMonth + 1} {fmtTime(s.start)}-{fmtTime(s.end)}{selectedBranchIds.length > 1 && ` @${branchNameMap[s.branchId] || ''}`}
                          <button onClick={() => removeSession('self', i)} className="ml-1 hover:text-red-500"><X className="h-3 w-3" /></button>
                        </Badge>
                      )
                    })}
                  </div>
                )}

                {/* Pricing */}
                {pricing && (
                  <div className="border-t pt-3 flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-600">{pricing.tierLabel} • {pricing.perSession} บาท/ครั้ง</p>
                      {kidsIncremental && existingMonthData.sessions > 0 && (
                        <p className="text-xs text-green-600 font-medium">รวมทั้งเดือน {kidsIncremental.totalSessionsForMonth} ครั้ง → เรท {kidsIncremental.perSession} บาท/ครั้ง</p>
                      )}
                      {selectedChildIds.length > 1 && !existingMonthData.sessions && (
                        <p className="text-xs text-green-600 font-medium">กฎพี่น้อง: รวม {allSelectedSessions.length} ครั้ง → ได้เรทที่ดีกว่า!</p>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-[#2748bf]">฿{totalBatchPrice.toLocaleString()}</p>
                  </div>
                )}
              </CardContent>
            </Card>
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
                <div><p className="text-gray-500">ประเภทคอร์ส</p><p className="font-medium">{COURSE_TYPES.find((c) => c.value === courseType)?.label}</p></div>
                <div><p className="text-gray-500">สาขา</p><p className="font-medium">{selectedBranches.map((b) => b.name).join(', ')}</p></div>
                <div><p className="text-gray-500">ผู้เรียน</p><p className="font-medium">
                  {courseType === 'kids_group'
                    ? selectedChildIds.map((id) => children.find((c) => c.id === id)?.full_name).join(', ')
                    : userName}
                </p></div>
                <div><p className="text-gray-500">เดือน</p><p className="font-medium">{MONTH_NAMES_TH[calMonth]} {calYear + 543}</p></div>
                <div><p className="text-gray-500">จำนวนครั้ง</p><p className="font-medium">{allSelectedSessions.length} ครั้ง</p></div>
                {pricing && <div><p className="text-gray-500">เรท</p><p className="font-medium">{pricing.perSession} บาท/ครั้ง ({pricing.tierLabel})</p></div>}
              </div>

              {/* Per-child breakdown */}
              {courseType === 'kids_group' && selectedChildIds.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  {selectedChildIds.map((cid) => {
                    const child = children.find((c) => c.id === cid)
                    const childSess = (sessionsMap[cid] || []).sort((a: SelectedSession, b: SelectedSession) => a.date.localeCompare(b.date))
                    const childPrice = childPriceBreakdown[cid] || 0
                    return (
                      <div key={cid} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-sm font-medium">{child?.full_name} — {childSess.length} ครั้ง</p>
                          <p className="text-sm font-bold text-[#2748bf]">฿{childPrice.toLocaleString()}</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {childSess.map((s: SelectedSession, si: number) => {
                            const d = new Date(s.date + 'T00:00:00')
                            return <Badge key={si} variant="outline" className="text-xs">{DAY_LABELS[s.dayOfWeek]} {d.getDate()}/{calMonth + 1} {fmtTime(s.start)}-{fmtTime(s.end)}{selectedBranchIds.length > 1 && ` @${branchNameMap[s.branchId] || ''}`}</Badge>
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Non-kids session list */}
              {courseType !== 'kids_group' && (
                <div className="border-t pt-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">วันเรียนที่เลือก:</p>
                  <div className="flex flex-wrap gap-1">
                    {(sessionsMap['self'] || []).sort((a: SelectedSession, b: SelectedSession) => a.date.localeCompare(b.date)).map((s: SelectedSession, i: number) => {
                      const d = new Date(s.date + 'T00:00:00')
                      return <Badge key={i} variant="outline" className="text-xs">{DAY_LABELS[s.dayOfWeek]} {d.getDate()}/{calMonth + 1} {fmtTime(s.start)}-{fmtTime(s.end)}{selectedBranchIds.length > 1 && ` @${branchNameMap[s.branchId] || ''}`}</Badge>
                    })}
                  </div>
                </div>
              )}

              {courseType === 'kids_group' && kidsIncremental && (existingMonthData.sessions > 0 || selectedChildIds.length > 1) && (
                <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700 space-y-1">
                  <p>กฎพี่น้อง: รวมทั้งเดือน {kidsIncremental.totalSessionsForMonth} ครั้ง → เรท {kidsIncremental.perSession} บาท/ครั้ง</p>
                  {existingMonthData.sessions > 0 && (
                    <p className="text-xs">จ่ายไปแล้ว ฿{existingMonthData.paid.toLocaleString()} ({existingMonthData.sessions} ครั้ง) • ยอดครั้งนี้ ฿{totalBatchPrice.toLocaleString()}</p>
                  )}
                </div>
              )}

              {/* Coupon input */}
              {!isEditMode && (
                <div className="border-t pt-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">คูปองส่วนลด</p>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-green-700 text-sm">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="font-medium">{appliedCoupon.code}</span>
                        <span>
                          — ลด {appliedCoupon.discount_type === 'percent' ? `${appliedCoupon.discount_value}%` : `฿${appliedCoupon.discount_value.toLocaleString()}`}
                          {' '}(฿{appliedCoupon.discountAmount.toLocaleString()})
                        </span>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 text-red-500 hover:text-red-700" onClick={removeCoupon}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="กรอกรหัสคูปอง"
                        className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2748bf]/30"
                      />
                      <Button size="sm" variant="outline" onClick={handleApplyCoupon} disabled={couponLoading || !couponCode.trim()}>
                        {couponLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'ใช้คูปอง'}
                      </Button>
                    </div>
                  )}
                  {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}
                </div>
              )}

              <div className="border-t pt-4 space-y-2">
                {appliedCoupon && (
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>ยอดก่อนส่วนลด</span>
                    <span>฿{totalBatchPrice.toLocaleString()}</span>
                  </div>
                )}
                {appliedCoupon && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>ส่วนลดคูปอง ({appliedCoupon.code})</span>
                    <span>-฿{appliedCoupon.discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <p className="text-lg font-medium">ยอดชำระรวม</p>
                  <p className="text-3xl font-bold text-[#2748bf]">฿{finalPrice.toLocaleString()}</p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
                <p className="font-medium">หลังจากกดยืนยัน:</p>
                <p>• ระบบจะสร้างรายการจอง สถานะ &quot;รอชำระเงิน&quot;</p>
                <p>• กรุณาแนบสลิปโอนเงินในหน้าประวัติการจอง — ระบบจะตรวจสลิปอัตโนมัติ</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        {isEditMode && step === 'calendar' ? (
          <Button variant="outline" onClick={() => router.push('/dashboard/history')}>
            <ArrowLeft className="h-4 w-4 mr-2" />กลับหน้าประวัติ
          </Button>
        ) : (
          <Button variant="outline" onClick={goBack} disabled={isEditMode ? step === 'calendar' : currentStepIndex === 0}>
            <ArrowLeft className="h-4 w-4 mr-2" />ย้อนกลับ
          </Button>
        )}
        {step === 'summary' ? (
          <Button className="bg-[#f57e3b] hover:bg-[#e06a2a] text-white" onClick={handleSubmitBooking} disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEditMode ? 'กำลังบันทึก...' : 'กำลังจอง...'}</> : <><CheckCircle2 className="mr-2 h-4 w-4" />{isEditMode ? 'บันทึกการแก้ไข' : 'ยืนยันการจอง'}</>}
          </Button>
        ) : (
          <Button className="bg-[#2748bf] hover:bg-[#153c85]" onClick={goNext} disabled={!canGoNext()}>
            ถัดไป<ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
