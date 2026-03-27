'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Search, ArrowLeft, ArrowRight, Users, User, Star, CheckCircle2, Loader2,
  AlertCircle, MapPin, CalendarDays, Clock, Baby, Shield,
} from 'lucide-react'
import { getAvailableSlots, hasAvailableSlots, DAY_LABELS, type TimeSlot } from '@/lib/branch-schedules'
import { getKidsGroupTotal, getKidsGroupIncremental, getAdultGroupTotal, getSessionStatusLabel } from '@/lib/pricing'
import { fmtTime } from '@/lib/utils'
import type { Branch, CourseTypeName } from '@/types/database'

interface UserOption {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: string
  children: { id: string; full_name: string; nickname: string | null }[]
}

interface CourseTypeRow {
  id: string
  name: string
}

interface ExistingBooking {
  id: string
  user_id: string
  course_type_id: string
  month: number
  year: number
  total_sessions: number
  total_price: number
}

interface SelectedSession {
  date: string
  dayOfWeek: number
  start: string
  end: string
  branchId: string
}

interface AdminBookingClientProps {
  users: UserOption[]
  branches: Branch[]
  courseTypes: CourseTypeRow[]
  existingBookings: ExistingBooking[]
}

type Step = 'user' | 'type' | 'learner' | 'branch' | 'calendar' | 'summary'

const STEPS: { key: Step; label: string }[] = [
  { key: 'user', label: 'เลือกผู้ใช้' },
  { key: 'type', label: 'ประเภท' },
  { key: 'learner', label: 'ผู้เรียน' },
  { key: 'branch', label: 'สาขา' },
  { key: 'calendar', label: 'เลือกวัน' },
  { key: 'summary', label: 'สรุป' },
]

const COURSE_TYPES: { value: CourseTypeName; label: string; desc: string; icon: typeof Users }[] = [
  { value: 'kids_group', label: 'เด็ก (กลุ่ม)', desc: 'กลุ่มเล็ก 4-6 คน • 2 ชม.', icon: Users },
  { value: 'adult_group', label: 'ผู้ใหญ่ (กลุ่ม)', desc: '1-6 คน • 2 ชม.', icon: User },
  { value: 'private', label: 'Private', desc: 'เด็ก & ผู้ใหญ่ • 1 ชม.', icon: Star },
]

const MONTH_NAMES_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

export function AdminBookingClient({ users, branches, courseTypes, existingBookings }: AdminBookingClientProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('user')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // User search
  const [userSearch, setUserSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null)

  // Booking state
  const [courseType, setCourseType] = useState<CourseTypeName | null>(null)
  const [learnerType, setLearnerType] = useState<'self' | 'child' | null>(null)
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([])
  const [privateSelfAttend, setPrivateSelfAttend] = useState(false)
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [autoVerify, setAutoVerify] = useState(true)

  // Calendar state
  const now = new Date()
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [sessionsMap, setSessionsMap] = useState<Record<string, SelectedSession[]>>({})
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [activeChildTab, setActiveChildTab] = useState<string>('self')

  const currentStepIndex = STEPS.findIndex((s) => s.key === step)
  const selectedBranch = branches.find((b) => b.id === selectedBranchId)

  const branchNameMap = useMemo(() => {
    const m: Record<string, string> = {}
    branches.forEach((b) => { m[b.id] = b.name })
    return m
  }, [branches])

  // Filtered users for search
  const filteredUsers = useMemo(() => {
    if (!userSearch) return users.slice(0, 20)
    const q = userSearch.toLowerCase()
    return users.filter((u) =>
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone && u.phone.includes(q)) ||
      u.children.some((c) => c.full_name.toLowerCase().includes(q))
    ).slice(0, 20)
  }, [users, userSearch])

  // Sessions
  const activeSessions = sessionsMap[activeChildTab] || []

  const allSelectedSessions = useMemo(() => {
    return Object.entries(sessionsMap).flatMap(([childId, sessions]) => {
      if (courseType === 'kids_group' && !selectedChildIds.includes(childId)) return []
      return sessions
    })
  }, [sessionsMap, courseType, selectedChildIds])

  // Existing month data for incremental pricing
  const existingMonthData = useMemo(() => {
    if (!selectedUser || courseType !== 'kids_group') return { sessions: 0, paid: 0 }
    const courseTypeRow = courseTypes.find((ct) => ct.name === courseType)
    if (!courseTypeRow) return { sessions: 0, paid: 0 }
    const monthBookings = existingBookings.filter(
      (b) => b.user_id === selectedUser.id && b.month === calMonth + 1 && b.year === calYear && b.course_type_id === courseTypeRow.id
    )
    return {
      sessions: monthBookings.reduce((sum, b) => sum + b.total_sessions, 0),
      paid: monthBookings.reduce((sum, b) => sum + (b.total_price || 0), 0),
    }
  }, [selectedUser, courseType, calMonth, calYear, existingBookings, courseTypes])

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

  const totalPrice = useMemo(() => {
    if (!pricing) return 0
    if (courseType === 'kids_group' && kidsIncremental) return kidsIncremental.incrementalPrice
    return pricing.perSession * allSelectedSessions.length
  }, [pricing, courseType, kidsIncremental, allSelectedSessions.length])

  const sessionStatus = allSelectedSessions.length > 0 ? getSessionStatusLabel(allSelectedSessions.length) : null

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
    if (!selectedBranch || !courseType) return false
    const date = new Date(calYear, calMonth, day)
    return hasAvailableSlots(selectedBranch.slug, courseType, date)
  }

  const isDateSelected = (day: number) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return activeSessions.some((s) => s.date === dateStr)
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
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) setStep(STEPS[prevIndex].key)
  }

  const canGoNext = () => {
    switch (step) {
      case 'user': return !!selectedUser
      case 'type': return !!courseType
      case 'learner':
        if (courseType === 'kids_group') return selectedChildIds.length > 0
        if (courseType === 'private') return privateSelfAttend || selectedChildIds.length > 0
        return !!learnerType
      case 'branch': return !!selectedBranchId
      case 'calendar': return allSelectedSessions.length > 0
      default: return false
    }
  }

  const handleSubmit = async () => {
    if (!selectedUser || !courseType || !selectedBranchId) return
    setLoading(true)
    setError(null)

    const courseTypeRow = courseTypes.find((ct) => ct.name === courseType)
    if (!courseTypeRow) { setError('ไม่พบประเภทคอร์ส'); setLoading(false); return }

    const isKids = courseType === 'kids_group'
    const singleChildId = isKids && selectedChildIds.length === 1 ? selectedChildIds[0] : null

    // Build all sessions
    const allSessions: { date: string; startTime: string; endTime: string; branchId: string; childId: string | null }[] = []
    if (isKids) {
      for (const childId of selectedChildIds) {
        const childSessions = sessionsMap[childId] || []
        childSessions.forEach((s) => allSessions.push({ date: s.date, startTime: s.start, endTime: s.end, branchId: s.branchId, childId }))
      }
    } else if (courseType === 'private') {
      const slots = sessionsMap['self'] || []
      for (const s of slots) {
        if (privateSelfAttend) allSessions.push({ date: s.date, startTime: s.start, endTime: s.end, branchId: s.branchId, childId: null })
        for (const childId of selectedChildIds) {
          allSessions.push({ date: s.date, startTime: s.start, endTime: s.end, branchId: s.branchId, childId })
        }
      }
    } else {
      const selfSessions = sessionsMap['self'] || []
      selfSessions.forEach((s) => allSessions.push({ date: s.date, startTime: s.start, endTime: s.end, branchId: s.branchId, childId: null }))
    }

    const bookingTotalSessions = courseType === 'private' ? (sessionsMap['self'] || []).length : allSessions.length

    try {
      const res = await fetch('/api/admin/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedUser.id,
          learnerType: isKids ? 'child' : (learnerType || 'self'),
          childId: singleChildId,
          branchId: selectedBranchId,
          courseTypeId: courseTypeRow.id,
          month: calMonth + 1,
          year: calYear,
          totalSessions: bookingTotalSessions,
          totalPrice: totalPrice,
          sessions: allSessions,
          autoVerify,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'เกิดข้อผิดพลาด'); setLoading(false); return }

      setSuccess(`จองสำเร็จ! สร้างการจอง ${bookingTotalSessions} ครั้ง ให้ "${selectedUser.full_name}" แล้ว`)
      setLoading(false)
      setTimeout(() => router.refresh(), 2000)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
      setLoading(false)
    }
  }

  const formatMoney = (n: number) => `฿${n.toLocaleString('th-TH')}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">จองคอร์สแทนผู้ใช้</h1>
        <p className="text-gray-500 text-sm mt-1">Admin สร้างการจองให้ผู้ปกครอง/นักเรียน</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
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
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-200 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-600 text-sm p-3 rounded-md border border-green-200 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />{success}
        </div>
      )}

      {/* ===== Step 1: Select User ===== */}
      {step === 'user' && (
        <div className="space-y-4">
          <h3 className="font-bold text-lg text-[#153c85]">เลือกผู้ใช้ที่จะจองให้</h3>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="ค้นหาชื่อ, อีเมล, เบอร์โทร..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-10" />
          </div>

          {selectedUser && (
            <Card className="border-2 border-[#2748bf] bg-[#2748bf]/5">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#2748bf] text-white flex items-center justify-center font-bold">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{selectedUser.full_name}</p>
                  <p className="text-xs text-gray-500">{selectedUser.email}</p>
                  {selectedUser.children.length > 0 && (
                    <div className="flex gap-1 mt-1">{selectedUser.children.map((c) => (
                      <Badge key={c.id} variant="outline" className="text-[10px]"><Baby className="h-3 w-3 mr-0.5" />{c.full_name}</Badge>
                    ))}</div>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedUser(null)}>เปลี่ยน</Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filteredUsers.filter((u) => u.id !== selectedUser?.id).map((user) => (
              <Card key={user.id} className="cursor-pointer hover:border-[#2748bf]/30 transition-all" onClick={() => setSelectedUser(user)}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">
                    {user.full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{user.full_name}</p>
                      <Badge className="text-[10px] bg-gray-100 text-gray-600">{user.role}</Badge>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{user.email}{user.phone ? ` • ${user.phone}` : ''}</p>
                    {user.children.length > 0 && (
                      <p className="text-[11px] text-gray-400 mt-0.5">ลูก: {user.children.map((c) => c.full_name).join(', ')}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredUsers.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">ไม่พบผู้ใช้</p>
            )}
          </div>
        </div>
      )}

      {/* ===== Step 2: Course Type ===== */}
      {step === 'type' && (
        <div className="space-y-4">
          <h3 className="font-bold text-lg text-[#153c85]">เลือกประเภทคอร์ส</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COURSE_TYPES.map((ct) => (
              <Card key={ct.value}
                className={`cursor-pointer transition-all hover:shadow-md ${courseType === ct.value ? 'border-2 border-[#2748bf] shadow-md' : 'hover:border-[#2748bf]/30'}`}
                onClick={() => { setCourseType(ct.value); setLearnerType(ct.value === 'kids_group' ? 'child' : 'self'); setSelectedChildIds([]); setPrivateSelfAttend(false); setSessionsMap({}) }}>
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 bg-[#2748bf]/10 rounded-xl flex items-center justify-center mx-auto mb-3"><ct.icon className="h-7 w-7 text-[#2748bf]" /></div>
                  <h3 className="font-bold text-lg mb-1">{ct.label}</h3>
                  <p className="text-sm text-gray-500">{ct.desc}</p>
                  {courseType === ct.value && <Badge className="mt-3 bg-[#2748bf]">เลือกแล้ว</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ===== Step 3: Learner ===== */}
      {step === 'learner' && selectedUser && (
        <div className="space-y-4">
          {courseType === 'kids_group' ? (
            <>
              <h3 className="font-bold text-lg text-[#153c85]">เลือกลูกของ {selectedUser.full_name}</h3>
              {selectedUser.children.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-gray-400">
                  <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>ผู้ใช้คนนี้ยังไม่มีข้อมูลลูก</p>
                </CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedUser.children.map((child) => {
                    const isSelected = selectedChildIds.includes(child.id)
                    return (
                      <Card key={child.id} className={`cursor-pointer transition-all ${isSelected ? 'border-2 border-[#2748bf] bg-[#2748bf]/5' : 'hover:border-[#2748bf]/30'}`}
                        onClick={() => toggleChild(child.id)}>
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSelected ? 'bg-[#2748bf] text-white' : 'bg-gray-100'}`}>
                            {isSelected ? <CheckCircle2 className="h-5 w-5" /> : <User className="h-5 w-5 text-gray-400" />}
                          </div>
                          <div><p className="font-medium">{child.full_name}</p>{child.nickname && <p className="text-xs text-gray-500">({child.nickname})</p>}</div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </>
          ) : courseType === 'private' ? (
            <>
              <h3 className="font-bold text-lg text-[#153c85]">ใครจะเรียน Private?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Card className={`cursor-pointer transition-all ${privateSelfAttend ? 'border-2 border-[#2748bf] bg-[#2748bf]/5' : 'hover:border-[#2748bf]/30'}`}
                  onClick={() => setPrivateSelfAttend(!privateSelfAttend)}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${privateSelfAttend ? 'bg-[#2748bf] border-[#2748bf]' : 'border-gray-300'}`}>
                      {privateSelfAttend && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                    </div>
                    <User className="h-5 w-5 text-[#2748bf]" />
                    <div><p className="font-medium text-sm">{selectedUser.full_name}</p><p className="text-xs text-gray-500">ตัวเอง</p></div>
                  </CardContent>
                </Card>
                {selectedUser.children.map((child) => {
                  const isSel = selectedChildIds.includes(child.id)
                  return (
                    <Card key={child.id} className={`cursor-pointer transition-all ${isSel ? 'border-2 border-[#2748bf] bg-[#2748bf]/5' : 'hover:border-[#2748bf]/30'}`}
                      onClick={() => toggleChild(child.id)}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSel ? 'bg-[#2748bf] border-[#2748bf]' : 'border-gray-300'}`}>
                          {isSel && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                        </div>
                        <Baby className="h-5 w-5 text-[#2748bf]" />
                        <div><p className="font-medium text-sm">{child.full_name}</p>{child.nickname && <p className="text-xs text-gray-500">({child.nickname})</p>}</div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <h3 className="font-bold text-lg text-[#153c85]">ผู้เรียน: {selectedUser.full_name} (ตัวเอง)</h3>
              <Card className="border-2 border-[#2748bf] bg-[#2748bf]/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#2748bf]" />
                  <p className="font-medium">{selectedUser.full_name} จะเรียนเอง</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ===== Step 4: Branch ===== */}
      {step === 'branch' && (
        <div className="space-y-4">
          <h3 className="font-bold text-lg text-[#153c85]">เลือกสาขา</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {branches.filter((b) => {
              if (!courseType) return true
              return hasAvailableSlots(b.slug, courseType, new Date()) || true // Show all but indicate which have slots
            }).map((b) => {
              const isActive = b.id === selectedBranchId
              return (
                <Card key={b.id} className={`cursor-pointer transition-all ${isActive ? 'border-2 border-[#2748bf] shadow-md' : 'hover:border-[#2748bf]/30'}`}
                  onClick={() => { setSelectedBranchId(b.id); setSessionsMap({}); setExpandedDate(null) }}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <MapPin className={`h-5 w-5 ${isActive ? 'text-[#2748bf]' : 'text-gray-400'}`} />
                    <span className="font-medium text-sm">{b.name}</span>
                    {isActive && <CheckCircle2 className="h-4 w-4 text-[#2748bf] ml-auto" />}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* ===== Step 5: Calendar ===== */}
      {step === 'calendar' && selectedBranch && courseType && (
        <div className="space-y-4">
          {/* Child tabs for kids_group */}
          {courseType === 'kids_group' && selectedChildIds.length > 0 && selectedUser && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {selectedChildIds.map((cid) => {
                const child = selectedUser.children.find((c) => c.id === cid)
                const count = (sessionsMap[cid] || []).length
                return (
                  <Button key={cid} variant={activeChildTab === cid ? 'default' : 'outline'} size="sm"
                    className={activeChildTab === cid ? 'bg-[#2748bf]' : ''} onClick={() => setActiveChildTab(cid)}>
                    {child?.full_name || 'ลูก'} {count > 0 && `(${count})`}
                  </Button>
                )
              })}
            </div>
          )}

          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1) } else setCalMonth(calMonth - 1) }}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h3 className="font-bold text-[#153c85]">{MONTH_NAMES_TH[calMonth]} {calYear + 543}</h3>
            <Button variant="outline" size="sm" onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1) } else setCalMonth(calMonth + 1) }}>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Calendar grid */}
          <Card>
            <CardContent className="p-3">
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500 mb-2">
                {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((d) => <div key={d}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => {
                  if (day === null) return <div key={`e-${i}`} />
                  const selectable = isDateSelectable(day)
                  const selected = isDateSelected(day)
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const isExpanded = expandedDate === dateStr
                  return (
                    <div key={day}
                      className={`aspect-square flex items-center justify-center rounded-lg text-sm cursor-pointer transition-all
                        ${!selectable ? 'text-gray-300 cursor-default' : ''}
                        ${selected ? 'bg-[#2748bf] text-white font-bold' : selectable ? 'hover:bg-[#2748bf]/10' : ''}
                        ${isExpanded ? 'ring-2 ring-[#2748bf]' : ''}`}
                      onClick={() => selectable && handleDayClick(day)}>
                      {day}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Expanded date — slot picker */}
          {expandedDate && selectedBranch && courseType && (() => {
            const day = parseInt(expandedDate.split('-')[2])
            const date = new Date(calYear, calMonth, day)
            const slots = getAvailableSlots(selectedBranch.slug, courseType, date.getDay())
            return (
              <Card>
                <CardContent className="p-4">
                  <p className="font-medium text-sm mb-2">{DAY_LABELS[date.getDay()]} {day} {MONTH_NAMES_TH[calMonth]} — {selectedBranch.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((slot) => {
                      const isSlotSelected = activeSessions.some((s) => s.date === expandedDate && s.start === slot.start && s.branchId === selectedBranch.id)
                      return (
                        <Button key={`${slot.start}-${slot.end}`} size="sm"
                          variant={isSlotSelected ? 'default' : 'outline'}
                          className={isSlotSelected ? 'bg-[#2748bf]' : ''}
                          onClick={() => handleSlotSelect(day, slot, selectedBranch.id)}>
                          <Clock className="h-3 w-3 mr-1" />{fmtTime(slot.start)} - {fmtTime(slot.end)}
                        </Button>
                      )
                    })}
                    {slots.length === 0 && <p className="text-sm text-gray-400">ไม่มีรอบเรียนในวันนี้</p>}
                  </div>
                </CardContent>
              </Card>
            )
          })()}

          {/* Selected sessions list */}
          {activeSessions.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="font-medium text-sm mb-2">วันเรียนที่เลือก ({activeSessions.length} ครั้ง):</p>
                <div className="space-y-1">
                  {activeSessions.sort((a, b) => a.date.localeCompare(b.date)).map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-gray-50">
                      <span>{DAY_LABELS[s.dayOfWeek]} {parseInt(s.date.split('-')[2])} {MONTH_NAMES_TH[calMonth]} • {fmtTime(s.start)}-{fmtTime(s.end)}</span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-600" onClick={() => removeSession(activeChildTab, i)}>×</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pricing preview */}
          {pricing && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4 text-sm space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex justify-between flex-1"><span>จำนวนครั้ง</span><span className="font-bold">{allSelectedSessions.length} ครั้ง</span></div>
                  {sessionStatus && (
                    <Badge className={sessionStatus.warning ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}>
                      {sessionStatus.emoji} {sessionStatus.label}
                    </Badge>
                  )}
                </div>
                {sessionStatus?.warning && (
                  <p className="rounded bg-yellow-50 p-2 text-xs text-yellow-600">{sessionStatus.warning}</p>
                )}
                <div className="flex justify-between"><span>เรท</span><span>{pricing.tierLabel} ({formatMoney(pricing.perSession)}/ครั้ง)</span></div>
                <div className="flex justify-between font-bold text-lg mt-1 text-[#2748bf]"><span>รวม</span><span>{formatMoney(totalPrice)}</span></div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ===== Step 6: Summary ===== */}
      {step === 'summary' && selectedUser && selectedBranch && courseType && (
        <div className="space-y-4">
          <h3 className="font-bold text-lg text-[#153c85]">สรุปการจอง</h3>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <User className="h-5 w-5 text-[#2748bf]" />
                <div>
                  <p className="font-semibold">{selectedUser.full_name}</p>
                  <p className="text-xs text-gray-500">{selectedUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <p className="text-gray-400 text-xs">ประเภท</p>
                  <p className="font-medium">{COURSE_TYPES.find((c) => c.value === courseType)?.label}</p>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <p className="text-gray-400 text-xs">สาขา</p>
                  <p className="font-medium">{selectedBranch.name}</p>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <p className="text-gray-400 text-xs">เดือน</p>
                  <p className="font-medium">{MONTH_NAMES_TH[calMonth]} {calYear + 543}</p>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <p className="text-gray-400 text-xs">จำนวนครั้ง</p>
                  <p className="font-medium">{allSelectedSessions.length} ครั้ง</p>
                </div>
              </div>

              {courseType === 'kids_group' && selectedChildIds.length > 0 && (
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <p className="text-gray-400 text-xs mb-1">ผู้เรียน</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedChildIds.map((cid) => {
                      const child = selectedUser.children.find((c) => c.id === cid)
                      const count = (sessionsMap[cid] || []).length
                      return <Badge key={cid} variant="outline" className="text-xs">{child?.full_name} ({count} ครั้ง)</Badge>
                    })}
                  </div>
                </div>
              )}

              <div className="border-t pt-3">
                <div className="flex justify-between text-lg font-bold text-[#2748bf]">
                  <span>ยอดรวม</span>
                  <span>{formatMoney(totalPrice)}</span>
                </div>
              </div>

              {/* Auto-verify toggle */}
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
                <Checkbox checked={autoVerify} onCheckedChange={(v) => setAutoVerify(!!v)} />
                <div>
                  <p className="font-medium text-sm flex items-center gap-1.5"><Shield className="h-4 w-4 text-green-600" />อนุมัติทันที (ข้ามการชำระเงิน)</p>
                  <p className="text-xs text-gray-500">ระบบจะสร้างการจองและ payment ที่ verified แล้วทันที</p>
                </div>
              </label>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={goBack} disabled={step === 'user' || loading}>
          <ArrowLeft className="h-4 w-4 mr-1" />ย้อนกลับ
        </Button>
        {step === 'summary' ? (
          <Button onClick={handleSubmit} disabled={loading || !!success} className="bg-[#2748bf] hover:bg-[#153c85]">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />กำลังจอง...</> : 'ยืนยันจอง'}
          </Button>
        ) : (
          <Button onClick={goNext} disabled={!canGoNext()} className="bg-[#2748bf] hover:bg-[#153c85]">
            ถัดไป<ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  )
}
