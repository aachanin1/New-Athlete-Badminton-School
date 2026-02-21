'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  DollarSign, TrendingUp, TrendingDown, Calendar, Building2, Users,
} from 'lucide-react'

interface PaymentData {
  id: string
  amount: number
  status: string
  created_at: string
  branch_name: string
  course_type: string
  booking_month: number
  booking_year: number
}

interface FinanceClientProps {
  payments: PaymentData[]
  currentMonth: number
  currentYear: number
}

const MONTH_LABELS = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const COURSE_LABELS: Record<string, string> = {
  'เด็ก (กลุ่ม)': 'เด็ก (กลุ่ม)',
  'ผู้ใหญ่ (กลุ่ม)': 'ผู้ใหญ่ (กลุ่ม)',
  'ส่วนตัว': 'Private',
  kids_group: 'เด็ก (กลุ่ม)',
  adult_group: 'ผู้ใหญ่ (กลุ่ม)',
  private: 'Private',
}

export function FinanceClient({ payments, currentMonth, currentYear }: FinanceClientProps) {
  const [viewMonth, setViewMonth] = useState<number>(currentMonth)
  const [viewYear, setViewYear] = useState<number>(currentYear)
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month')

  // Filter payments
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (p.status !== 'approved') return false
      if (viewMode === 'month') {
        return p.booking_month === viewMonth && p.booking_year === viewYear
      }
      return p.booking_year === viewYear
    })
  }, [payments, viewMonth, viewYear, viewMode])

  // Calculate stats
  const stats = useMemo(() => {
    const totalRevenue = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0)
    const byBranch: Record<string, number> = {}
    const byCourse: Record<string, number> = {}
    const byMonth: Record<number, number> = {}

    filteredPayments.forEach((p) => {
      byBranch[p.branch_name] = (byBranch[p.branch_name] || 0) + Number(p.amount)
      const courseLabel = COURSE_LABELS[p.course_type] || p.course_type
      byCourse[courseLabel] = (byCourse[courseLabel] || 0) + Number(p.amount)
      byMonth[p.booking_month] = (byMonth[p.booking_month] || 0) + Number(p.amount)
    })

    return { totalRevenue, byBranch, byCourse, byMonth, count: filteredPayments.length }
  }, [filteredPayments])

  // Year options
  const years = useMemo(() => {
    const ySet = new Set(payments.map((p) => p.booking_year))
    ySet.add(currentYear)
    return Array.from(ySet).sort((a, b) => b - a)
  }, [payments, currentYear])

  const fmt = (n: number) => n.toLocaleString('th-TH')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">รายรับ-รายจ่าย</h1>
        <p className="text-gray-500 text-sm mt-1">สรุปรายรับจากคอร์สเรียน</p>
      </div>

      {/* View Mode & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2">
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${viewMode === 'month' ? 'bg-[#2748bf] text-white' : 'bg-gray-100 text-gray-600'}`}
            onClick={() => setViewMode('month')}
          >
            รายเดือน
          </button>
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${viewMode === 'year' ? 'bg-[#2748bf] text-white' : 'bg-gray-100 text-gray-600'}`}
            onClick={() => setViewMode('year')}
          >
            รายปี
          </button>
        </div>
        {viewMode === 'month' && (
          <Select value={String(viewMonth)} onValueChange={(v) => setViewMonth(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTH_LABELS.slice(1).map((label, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={String(viewYear)} onValueChange={(v) => setViewYear(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="ring-2 ring-green-200">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">รายรับ{viewMode === 'month' ? ` ${MONTH_LABELS[viewMonth]}` : ''} {viewYear + 543}</p>
                <p className="text-2xl font-bold text-green-600">฿{fmt(stats.totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">จำนวนรายการ</p>
                <p className="text-2xl font-bold text-[#2748bf]">{stats.count}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">เฉลี่ย/รายการ</p>
                <p className="text-2xl font-bold text-orange-500">฿{stats.count > 0 ? fmt(Math.round(stats.totalRevenue / stats.count)) : '0'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Branch */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-bold text-[#153c85] mb-3 flex items-center gap-2"><Building2 className="h-4 w-4" />รายรับแยกตามสาขา</h3>
          {Object.keys(stats.byBranch).length === 0 ? (
            <p className="text-sm text-gray-400">ไม่มีข้อมูล</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(stats.byBranch).sort(([, a], [, b]) => b - a).map(([branch, amount]) => {
                const pct = stats.totalRevenue > 0 ? (amount / stats.totalRevenue) * 100 : 0
                return (
                  <div key={branch} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-36 truncate">{branch}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#2748bf] rounded-full transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                    <span className="text-sm font-bold w-28 text-right">฿{fmt(amount)}</span>
                    <span className="text-xs text-gray-400 w-12 text-right">{pct.toFixed(0)}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue by Course Type */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-bold text-[#153c85] mb-3 flex items-center gap-2"><Users className="h-4 w-4" />รายรับแยกตามประเภทคอร์ส</h3>
          {Object.keys(stats.byCourse).length === 0 ? (
            <p className="text-sm text-gray-400">ไม่มีข้อมูล</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.entries(stats.byCourse).sort(([, a], [, b]) => b - a).map(([course, amount]) => (
                <div key={course} className="p-3 bg-gray-50 rounded-lg text-center">
                  <Badge className="mb-2 bg-blue-100 text-blue-700">{course}</Badge>
                  <p className="text-lg font-bold text-[#153c85]">฿{fmt(amount)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly breakdown (year view) */}
      {viewMode === 'year' && Object.keys(stats.byMonth).length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h3 className="font-bold text-[#153c85] mb-3 flex items-center gap-2"><Calendar className="h-4 w-4" />รายรับแยกรายเดือน ปี {viewYear + 543}</h3>
            <div className="space-y-2">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const amount = stats.byMonth[m] || 0
                const maxAmount = Math.max(...Object.values(stats.byMonth), 1)
                const pct = (amount / maxAmount) * 100
                return (
                  <div key={m} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-12">{MONTH_LABELS[m]}</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.max(pct, amount > 0 ? 2 : 0)}%` }} />
                    </div>
                    <span className={`text-sm font-bold w-28 text-right ${amount > 0 ? '' : 'text-gray-300'}`}>฿{fmt(amount)}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
