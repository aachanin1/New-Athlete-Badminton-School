'use client'

import { useMemo, useState } from 'react'
import { COACH_OVERTIME } from '@/constants/pricing'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  LineChart,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'

interface PaymentData {
  id: string
  amount: number
  status: string
  created_at: string
  payer_name: string
  branch_name: string
  course_type: string
  booking_month: number
  booking_year: number
  total_sessions: number
}

interface PayrollSourceRow {
  assignment_id: string
  coach_id: string
  coach_name: string
  schedule_slot_id: string
  branch_name: string
  course_type: string
  date: string
  start_time: string
  end_time: string
  checkin_id: string | null
  checkin_time: string | null
  photo_url: string | null
}

interface PayableEntry {
  row: PayrollSourceRow
  hours: number
  otHours: number
  otPay: number
  isPrivate: boolean
  weekKey: string
}

interface FinanceClientProps {
  payments: PaymentData[]
  payrollRows: PayrollSourceRow[]
  currentMonth: number
  currentYear: number
}

const MONTH_LABELS = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const OT_THRESHOLD_WEEKLY = COACH_OVERTIME.weeklyThreshold
const OT_RATE_PRIVATE = COACH_OVERTIME.privateRate
const OT_RATE_GROUP = COACH_OVERTIME.groupRate

function getHours(row: PayrollSourceRow) {
  const start = new Date(`${row.date}T${row.start_time}`)
  const end = new Date(`${row.date}T${row.end_time}`)
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60))
}

function isPayable(row: PayrollSourceRow) {
  return Boolean(row.checkin_id && row.photo_url)
}

function isPrivateCourse(courseType: string) {
  const value = courseType.toLowerCase()
  return value.includes('private') || value.includes('ส่วน')
}

function getWeekKey(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`)
  const start = new Date(date)
  start.setDate(date.getDate() - date.getDay())
  const year = start.getFullYear()
  const month = String(start.getMonth() + 1).padStart(2, '0')
  const day = String(start.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildPayableEntries(payableRows: PayrollSourceRow[]) {
  const weeklyHours = new Map<string, number>()

  return [...payableRows]
    .sort((a, b) => `${a.date}T${a.start_time}`.localeCompare(`${b.date}T${b.start_time}`))
    .map<PayableEntry>((row) => {
      const hours = getHours(row)
      const weekKey = getWeekKey(row.date)
      const usedHours = weeklyHours.get(weekKey) || 0
      const regularCapacity = Math.max(0, OT_THRESHOLD_WEEKLY - usedHours)
      const regularHours = Math.min(hours, regularCapacity)
      const otHours = Math.max(0, hours - regularHours)
      const isPrivate = isPrivateCourse(row.course_type)
      const otPay = otHours * (isPrivate ? OT_RATE_PRIVATE : OT_RATE_GROUP)

      weeklyHours.set(weekKey, usedHours + hours)

      return { row, hours, otHours, otPay, isPrivate, weekKey }
    })
}

function formatNumber(value: number, fractionDigits = 0) {
  return value.toLocaleString('th-TH', { maximumFractionDigits: fractionDigits })
}

function getCourseLabel(courseType: string) {
  if (courseType === 'kids_group') return 'เด็กกลุ่ม'
  if (courseType === 'adult_group') return 'ผู้ใหญ่กลุ่ม'
  if (courseType === 'private') return 'Private'
  if (courseType.toLowerCase().includes('private')) return 'Private'
  return courseType || 'ไม่ระบุ'
}

export function FinanceClient({ payments, payrollRows, currentMonth, currentYear }: FinanceClientProps) {
  const [viewMonth, setViewMonth] = useState(currentMonth)
  const [viewYear, setViewYear] = useState(currentYear)
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month')

  const periodLabel = viewMode === 'month'
    ? `${MONTH_LABELS[viewMonth]} ${viewYear + 543}`
    : `ปี ${viewYear + 543}`

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      if (viewMode === 'month') {
        return payment.booking_month === viewMonth && payment.booking_year === viewYear
      }

      return payment.booking_year === viewYear
    })
  }, [payments, viewMode, viewMonth, viewYear])

  const filteredPayrollRows = useMemo(() => {
    return payrollRows.filter((row) => {
      const date = new Date(`${row.date}T00:00:00`)
      if (viewMode === 'month') {
        return date.getMonth() + 1 === viewMonth && date.getFullYear() === viewYear
      }

      return date.getFullYear() === viewYear
    })
  }, [payrollRows, viewMode, viewMonth, viewYear])

  const finance = useMemo(() => {
    const approvedPayments = filteredPayments.filter((payment) => payment.status === 'approved')
    const pendingPayments = filteredPayments.filter((payment) => payment.status === 'pending')
    const rejectedPayments = filteredPayments.filter((payment) => payment.status === 'rejected')
    const revenue = approvedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    const pendingRevenue = pendingPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    const sessionsSold = approvedPayments.reduce((sum, payment) => sum + Number(payment.total_sessions || 0), 0)

    const payableRows = filteredPayrollRows.filter(isPayable)
    const payableEntriesByCoach = new Map<string, PayrollSourceRow[]>()
    payableRows.forEach((row) => {
      if (!payableEntriesByCoach.has(row.coach_id)) payableEntriesByCoach.set(row.coach_id, [])
      payableEntriesByCoach.get(row.coach_id)?.push(row)
    })

    const payableEntries = Array.from(payableEntriesByCoach.values()).flatMap(buildPayableEntries)
    const payableHours = payableEntries.reduce((sum, entry) => sum + entry.hours, 0)
    const otHours = payableEntries.reduce((sum, entry) => sum + entry.otHours, 0)
    const otPay = payableEntries.reduce((sum, entry) => sum + entry.otPay, 0)
    const netAfterKnownCosts = revenue - otPay

    const byBranch = new Map<string, { revenue: number; count: number }>()
    const byCourse = new Map<string, { revenue: number; count: number }>()
    const byMonth = new Map<number, { revenue: number; otPay: number }>()
    const coachCosts = new Map<string, { coach: string; hours: number; otHours: number; otPay: number }>()

    approvedPayments.forEach((payment) => {
      const branch = byBranch.get(payment.branch_name) || { revenue: 0, count: 0 }
      branch.revenue += payment.amount
      branch.count += 1
      byBranch.set(payment.branch_name, branch)

      const course = getCourseLabel(payment.course_type)
      const courseData = byCourse.get(course) || { revenue: 0, count: 0 }
      courseData.revenue += payment.amount
      courseData.count += 1
      byCourse.set(course, courseData)

      const monthData = byMonth.get(payment.booking_month) || { revenue: 0, otPay: 0 }
      monthData.revenue += payment.amount
      byMonth.set(payment.booking_month, monthData)
    })

    payableEntries.forEach((entry) => {
      const current = coachCosts.get(entry.row.coach_id) || {
        coach: entry.row.coach_name,
        hours: 0,
        otHours: 0,
        otPay: 0,
      }
      current.hours += entry.hours
      current.otHours += entry.otHours
      current.otPay += entry.otPay
      coachCosts.set(entry.row.coach_id, current)

      const month = new Date(`${entry.row.date}T00:00:00`).getMonth() + 1
      const monthData = byMonth.get(month) || { revenue: 0, otPay: 0 }
      monthData.otPay += entry.otPay
      byMonth.set(month, monthData)
    })

    return {
      revenue,
      pendingRevenue,
      pendingCount: pendingPayments.length,
      rejectedCount: rejectedPayments.length,
      approvedCount: approvedPayments.length,
      sessionsSold,
      payableHours,
      otHours,
      otPay,
      netAfterKnownCosts,
      marginPercent: revenue > 0 ? (netAfterKnownCosts / revenue) * 100 : 0,
      byBranch: Array.from(byBranch.entries()).map(([branch, data]) => ({ branch, ...data })).sort((a, b) => b.revenue - a.revenue),
      byCourse: Array.from(byCourse.entries()).map(([course, data]) => ({ course, ...data })).sort((a, b) => b.revenue - a.revenue),
      byMonth,
      coachCosts: Array.from(coachCosts.values()).sort((a, b) => b.otPay - a.otPay || b.hours - a.hours),
    }
  }, [filteredPayments, filteredPayrollRows])

  const years = useMemo(() => {
    const values = new Set<number>()
    payments.forEach((payment) => {
      if (payment.booking_year) values.add(payment.booking_year)
    })
    payrollRows.forEach((row) => {
      if (row.date) values.add(new Date(`${row.date}T00:00:00`).getFullYear())
    })
    values.add(currentYear)
    return Array.from(values).sort((a, b) => b - a)
  }, [currentYear, payments, payrollRows])

  const maxMonthlyValue = useMemo(() => {
    const values = Array.from(finance.byMonth.values()).map((month) => Math.max(month.revenue, month.otPay))
    return Math.max(...values, 1)
  }, [finance.byMonth])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#2748bf]">
            <LineChart className="h-4 w-4" />
            Financial Overview
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">รายรับ-รายจ่าย</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            สรุปเงินรับจากรายการชำระที่ยืนยันแล้ว เทียบกับรายจ่ายโค้ชที่ระบบคำนวณได้ตอนนี้คือค่า OT จากรอบสอนที่มีหลักฐานเช็คอิน
          </p>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <p className="font-semibold">หมายเหตุ</p>
          <p>รายจ่ายฐานเงินเดือน/ค่าแรงปกติยังไม่ถูกหัก เพราะยังไม่มี rate ใน requirement</p>
        </div>
      </div>

      <Card className="border-gray-200">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[auto_150px_130px] sm:items-center lg:w-fit">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
            <button
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${viewMode === 'month' ? 'bg-white text-[#2748bf] shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              onClick={() => setViewMode('month')}
            >
              รายเดือน
            </button>
            <button
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${viewMode === 'year' ? 'bg-white text-[#2748bf] shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              onClick={() => setViewMode('year')}
            >
              รายปี
            </button>
          </div>

          {viewMode === 'month' && (
            <Select value={String(viewMonth)} onValueChange={(value) => setViewMonth(Number(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_LABELS.slice(1).map((label, index) => (
                  <SelectItem key={index + 1} value={String(index + 1)}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={String(viewYear)} onValueChange={(value) => setViewYear(Number(value))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>{year + 543}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-6">
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <p className="text-xs text-gray-500">รายรับ {periodLabel}</p>
              <p className="mt-1 text-xl font-bold text-emerald-700">฿{formatNumber(finance.revenue)}</p>
            </div>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <p className="text-xs text-gray-500">รายจ่าย OT</p>
              <p className="mt-1 text-xl font-bold text-orange-600">฿{formatNumber(finance.otPay)}</p>
            </div>
            <TrendingDown className="h-5 w-5 text-orange-500" />
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <p className="text-xs text-gray-500">สุทธิที่รู้แล้ว</p>
              <p className="mt-1 text-xl font-bold text-[#2748bf]">฿{formatNumber(finance.netAfterKnownCosts)}</p>
            </div>
            <Wallet className="h-5 w-5 text-[#2748bf]" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <p className="text-xs text-gray-500">รายการรับเงิน</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{finance.approvedCount}</p>
            </div>
            <ReceiptText className="h-5 w-5 text-gray-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <p className="text-xs text-gray-500">รอชำระ/ตรวจ</p>
              <p className="mt-1 text-xl font-bold text-amber-600">{finance.pendingCount}</p>
              <p className="text-xs text-gray-500">฿{formatNumber(finance.pendingRevenue)}</p>
            </div>
            <CreditCard className="h-5 w-5 text-amber-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <p className="text-xs text-gray-500">ชม. โค้ชพร้อมจ่าย</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{formatNumber(finance.payableHours, 1)} ชม.</p>
            </div>
            <Clock className="h-5 w-5 text-gray-500" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-[#153c85]">รายรับแยกตามสาขา</h3>
                <p className="text-xs text-gray-500">คำนวณจาก payment ที่ approved แล้ว</p>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{finance.sessionsSold} ครั้งเรียน</Badge>
            </div>

            {finance.byBranch.length === 0 ? (
              <div className="rounded-lg border border-dashed py-10 text-center text-sm text-gray-400">ยังไม่มีรายรับในช่วงนี้</div>
            ) : (
              <div className="space-y-3">
                {finance.byBranch.map((item) => {
                  const percent = finance.revenue > 0 ? (item.revenue / finance.revenue) * 100 : 0
                  return (
                    <div key={item.branch} className="rounded-lg border bg-white p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <Building2 className="h-4 w-4 shrink-0 text-[#2748bf]" />
                          <p className="truncate text-sm font-semibold text-gray-900">{item.branch}</p>
                        </div>
                        <p className="text-sm font-bold text-emerald-700">฿{formatNumber(item.revenue)}</p>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-[#2748bf]" style={{ width: `${Math.max(percent, 2)}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-gray-400">{formatNumber(percent, 0)}% • {item.count} รายการ</p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="mb-4">
              <h3 className="font-bold text-[#153c85]">รายรับแยกตามคอร์ส</h3>
              <p className="text-xs text-gray-500">ช่วยดูว่าคอร์สไหนเป็นตัวหลักของรายรับ</p>
            </div>

            {finance.byCourse.length === 0 ? (
              <div className="rounded-lg border border-dashed py-10 text-center text-sm text-gray-400">ยังไม่มีข้อมูลคอร์ส</div>
            ) : (
              <div className="grid gap-2">
                {finance.byCourse.map((item) => (
                  <div key={item.course} className="flex items-center justify-between rounded-lg border bg-gray-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-[#2748bf]" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{item.course}</p>
                        <p className="text-xs text-gray-500">{item.count} รายการ</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-[#153c85]">฿{formatNumber(item.revenue)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="mb-4">
              <h3 className="font-bold text-[#153c85]">ต้นทุนโค้ชที่ระบบคำนวณได้</h3>
              <p className="text-xs text-gray-500">OT เกิน {OT_THRESHOLD_WEEKLY} ชม./สัปดาห์: Private {OT_RATE_PRIVATE} บาท/ชม. • กลุ่ม {OT_RATE_GROUP} บาท/ชม.</p>
            </div>

            {finance.coachCosts.length === 0 ? (
              <div className="rounded-lg border border-dashed py-10 text-center text-sm text-gray-400">ยังไม่มีรอบสอนที่พร้อมคิดเงิน</div>
            ) : (
              <div className="space-y-2">
                {finance.coachCosts.slice(0, 8).map((coach) => (
                  <div key={coach.coach} className="rounded-lg border bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{coach.coach}</p>
                        <p className="text-xs text-gray-500">รวม {formatNumber(coach.hours, 1)} ชม. • OT {formatNumber(coach.otHours, 1)} ชม.</p>
                      </div>
                      <p className="text-sm font-bold text-orange-600">฿{formatNumber(coach.otPay)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#2748bf]" />
              <div>
                <h3 className="font-bold text-[#153c85]">แนวโน้มรายเดือน</h3>
                <p className="text-xs text-gray-500">เปรียบเทียบรายรับกับค่า OT ในปี {viewYear + 543}</p>
              </div>
            </div>

            <div className="space-y-2">
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
                const data = finance.byMonth.get(month) || { revenue: 0, otPay: 0 }
                const revenueWidth = (data.revenue / maxMonthlyValue) * 100
                const otWidth = (data.otPay / maxMonthlyValue) * 100
                return (
                  <div key={month} className="grid grid-cols-[3.5rem_1fr_5.5rem] items-center gap-2">
                    <p className="text-xs font-semibold text-gray-500">{MONTH_LABELS[month]}</p>
                    <div className="space-y-1">
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(revenueWidth, data.revenue > 0 ? 2 : 0)}%` }} />
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.max(otWidth, data.otPay > 0 ? 2 : 0)}%` }} />
                      </div>
                    </div>
                    <div className="text-right text-[11px]">
                      <p className="font-semibold text-emerald-700">฿{formatNumber(data.revenue)}</p>
                      <p className="font-semibold text-orange-600">฿{formatNumber(data.otPay)}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />รายรับ</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400" />ค่า OT</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />เฉพาะข้อมูลที่ตรวจยืนยันแล้ว</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {finance.rejectedCount > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-red-700">
            <Banknote className="h-5 w-5" />
            มีรายการชำระไม่ผ่าน {finance.rejectedCount} รายการในช่วงนี้ ควรตรวจในหน้า “ตรวจสอบการชำระเงิน” หากต้องติดตามลูกค้า
          </CardContent>
        </Card>
      )}
    </div>
  )
}
