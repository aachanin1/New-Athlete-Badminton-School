'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Image as ImageIcon,
  Loader2,
  MapPin,
  ReceiptText,
  Search,
  ShieldAlert,
  User,
  Users,
  XCircle,
} from 'lucide-react'

import { ListPagination } from '@/components/admin/list-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import type {
  AdminPayrollCoachSummary,
  AdminPayrollCoachWeekDetail,
  AdminPayrollMonthTotals,
  AdminPayrollReadMetrics,
  AdminPayrollWeekSummary,
} from '@/lib/admin-payroll-read'
import { getCoachTeachingRule, type CoachTeachingRules } from '@/lib/coach-teaching-rules'
import { formatThaiDateRangeWithWeekday, formatThaiDateWithWeekday } from '@/lib/date-format'
import { cn } from '@/lib/utils'

interface PayrollClientProps {
  coaches: AdminPayrollCoachSummary[]
  totals: AdminPayrollMonthTotals
  currentMonth: number
  currentYear: number
  teachingRules: CoachTeachingRules
  initialPerformance: AdminPayrollReadMetrics
}

interface DetailState {
  key: string | null
  status: 'idle' | 'loading' | 'success' | 'error'
  data: AdminPayrollCoachWeekDetail | null
  error: string | null
}

const MONTH_LABELS = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const DEFAULT_PAGE_SIZE = 12

const REASON_LABELS: Record<string, string> = {
  evidence_complete: 'หลักฐานครบ',
  missing_checkin: 'ยังไม่มีเช็คอิน',
  missing_photo: 'ไม่มีรูปเช็คอิน',
  missing_location: 'ไม่มีพิกัด',
  missing_attendance: 'ยังไม่มี Attendance',
  no_eligible_learner: 'ไม่มีผู้เรียนที่เข้าเกณฑ์เดิม',
  duplicate_assignment_data: 'Assignment ซ้ำ/ขัดแย้ง ต้องตรวจสอบ',
}

function formatNumber(value: number, maximumFractionDigits = 1) {
  return value.toLocaleString('th-TH', { maximumFractionDigits })
}

function formatCurrency(value: number) {
  return value.toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

function formatTime(value: string) {
  return value.slice(0, 5)
}

function getEmploymentLabel(coach: AdminPayrollCoachSummary, rules: CoachTeachingRules) {
  return coach.employment_type ? getCoachTeachingRule(coach.employment_type, rules).label : 'ยังไม่กำหนด'
}

function moveMonth(year: number, month: number, offset: number) {
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
}

function rangesOverlap(startA: string, endA: string, startB: string, endB: string) {
  return startA <= endB && endA >= startB
}

function findOverlappingClosedSummary(coach: AdminPayrollCoachSummary, week: AdminPayrollWeekSummary) {
  return coach.weeks
    .map((item) => item.closed_summary)
    .filter((summary): summary is NonNullable<typeof summary> => Boolean(summary))
    .find((summary) => (
      (summary.week_start !== week.week_start || summary.week_end !== week.week_end)
      && rangesOverlap(summary.week_start, summary.week_end, week.week_start, week.week_end)
    )) || null
}

function MetricCard({ label, value, detail, tone = 'blue' }: {
  label: string
  value: string
  detail: string
  tone?: 'blue' | 'emerald' | 'amber' | 'violet'
}) {
  const tones = {
    blue: 'border-blue-100 bg-blue-50/60 text-blue-700',
    emerald: 'border-emerald-100 bg-emerald-50/60 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50/60 text-amber-700',
    violet: 'border-violet-100 bg-violet-50/60 text-violet-700',
  }
  return (
    <Card className={cn('shadow-sm', tones[tone])}>
      <CardContent className="p-4">
        <p className="text-xs font-medium opacity-80">{label}</p>
        <p className="mt-1 text-2xl font-bold text-gray-950">{value}</p>
        <p className="mt-1 text-xs opacity-80">{detail}</p>
      </CardContent>
    </Card>
  )
}

export function PayrollClient({
  coaches,
  totals,
  currentMonth,
  currentYear,
  teachingRules,
  initialPerformance,
}: PayrollClientProps) {
  const router = useRouter()
  const [isNavigating, startNavigation] = useTransition()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null)
  const [detailState, setDetailState] = useState<DetailState>({ key: null, status: 'idle', data: null, error: null })
  const [closeTarget, setCloseTarget] = useState<{ coach: AdminPayrollCoachSummary; week: AdminPayrollWeekSummary } | null>(null)
  const [closeNotes, setCloseNotes] = useState('')
  const [closingKey, setClosingKey] = useState<string | null>(null)
  const [closeError, setCloseError] = useState<string | null>(null)
  const detailControllerRef = useRef<AbortController | null>(null)
  const detailGenerationRef = useRef(0)

  useEffect(() => () => {
    detailControllerRef.current?.abort()
    detailGenerationRef.current += 1
  }, [])

  const filteredCoaches = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('th-TH')
    if (!query) return coaches
    return coaches.filter((coach) => coach.coach_name.toLocaleLowerCase('th-TH').includes(query))
  }, [coaches, search])
  const visibleCoaches = filteredCoaches.slice((page - 1) * pageSize, page * pageSize)
  const selectedCoach = coaches.find((coach) => coach.coach_id === selectedCoachId) || null
  const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - 2 + index)

  const navigateToMonth = (year: number, month: number) => {
    detailControllerRef.current?.abort()
    detailGenerationRef.current += 1
    setDetailState({ key: null, status: 'idle', data: null, error: null })
    startNavigation(() => {
      router.push(`/admin/payroll?year=${year}&month=${month}`, { scroll: false })
    })
  }

  const loadDetail = async (coach: AdminPayrollCoachSummary, week: AdminPayrollWeekSummary) => {
    const key = `${coach.coach_id}:${week.week_start}`
    if (detailState.key === key && detailState.status !== 'error') {
      setDetailState({ key: null, status: 'idle', data: null, error: null })
      return
    }

    detailControllerRef.current?.abort()
    const controller = new AbortController()
    detailControllerRef.current = controller
    const generation = detailGenerationRef.current + 1
    detailGenerationRef.current = generation
    setDetailState({ key, status: 'loading', data: null, error: null })

    try {
      const params = new URLSearchParams({
        coachId: coach.coach_id,
        weekStart: week.week_start,
        weekEnd: week.week_end,
      })
      const response = await fetch(`/api/admin/coach-teaching-hours?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      const payload = await response.json() as AdminPayrollCoachWeekDetail & { error?: string }
      if (!response.ok) throw new Error(payload.error || 'โหลดรายละเอียดไม่สำเร็จ')
      if (controller.signal.aborted || generation !== detailGenerationRef.current) return
      setDetailState({ key, status: 'success', data: payload, error: null })
    } catch (error) {
      if (controller.signal.aborted || generation !== detailGenerationRef.current) return
      setDetailState({
        key,
        status: 'error',
        data: null,
        error: error instanceof Error ? error.message : 'โหลดรายละเอียดไม่สำเร็จ',
      })
    }
  }

  const closeWeek = async () => {
    if (!closeTarget?.coach.employment_type || closeTarget.week.countable_round_count === 0) return
    const key = `${closeTarget.coach.coach_id}:${closeTarget.week.week_start}`
    setClosingKey(key)
    setCloseError(null)
    try {
      const response = await fetch('/api/admin/coach-payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId: closeTarget.coach.coach_id,
          weekStart: closeTarget.week.week_start,
          weekEnd: closeTarget.week.week_end,
          notes: closeNotes.trim() || null,
        }),
      })
      const payload = await response.json() as { error?: string }
      if (!response.ok) throw new Error(payload.error || 'ปิดสัปดาห์ไม่สำเร็จ')
      setCloseTarget(null)
      setCloseNotes('')
      router.refresh()
    } catch (error) {
      setCloseError(error instanceof Error ? error.message : 'ปิดสัปดาห์ไม่สำเร็จ')
    } finally {
      setClosingKey(null)
    }
  }

  return (
    <div
      className="space-y-5 pb-10"
      data-payroll-summary-bytes={initialPerformance.responseBytes}
      data-payroll-external-calls={initialPerformance.externalCalls}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#153c85]">Payroll & Teaching Hours</h1>
          <p className="mt-1 text-sm text-gray-500">
            สรุปชั่วโมงรายสัปดาห์ที่ทับเดือน {MONTH_LABELS[currentMonth]} {currentYear + 543} — โหลดรายละเอียดเมื่อเปิดดู
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-2 shadow-sm">
          <Button
            variant="outline"
            size="icon"
            disabled={isNavigating}
            aria-label="เดือนก่อนหน้า"
            onClick={() => {
              const previous = moveMonth(currentYear, currentMonth, -1)
              navigateToMonth(previous.year, previous.month)
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select
            value={String(currentMonth)}
            disabled={isNavigating}
            onValueChange={(value) => navigateToMonth(currentYear, Number(value))}
          >
            <SelectTrigger className="w-[112px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTH_LABELS.slice(1).map((label, index) => (
                <SelectItem key={label} value={String(index + 1)}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(currentYear)}
            disabled={isNavigating}
            onValueChange={(value) => navigateToMonth(Number(value), currentMonth)}
          >
            <SelectTrigger className="w-[108px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => <SelectItem key={year} value={String(year)}>{year + 543}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            disabled={isNavigating}
            aria-label="เดือนถัดไป"
            onClick={() => {
              const next = moveMonth(currentYear, currentMonth, 1)
              navigateToMonth(next.year, next.month)
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {isNavigating && <Loader2 className="h-5 w-5 animate-spin text-[#153c85]" aria-label="กำลังโหลดเดือน" />}
        </div>
      </div>

      {isNavigating && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลดสรุปเดือนใหม่…
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="โค้ชในช่วงนี้" value={formatNumber(totals.coach_count, 0)} detail={`${formatNumber(totals.assigned_round_count, 0)} รอบที่ได้รับมอบหมาย`} />
        <MetricCard label="หลักฐานครบ" value={`${formatNumber(totals.countable_round_count, 0)} รอบ`} detail={`${formatNumber(totals.total_hours)} ชั่วโมง`} tone="emerald" />
        <MetricCard label="รอหลักฐาน / ตรวจสอบ" value={`${formatNumber(totals.review_round_count, 0)} รอบ`} detail={`ไม่เข้าเกณฑ์เดิม ${formatNumber(totals.excluded_round_count, 0)} รอบ`} tone="amber" />
        <MetricCard label="ยอดจ่ายโดยประมาณ" value={`฿${formatCurrency(totals.payable_amount)}`} detail={`${formatNumber(totals.payable_hours)} ชั่วโมงที่จ่าย`} tone="violet" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="ค้นหาชื่อโค้ช"
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {visibleCoaches.length === 0 ? (
        <Card><CardContent className="py-14 text-center text-sm text-gray-500">ไม่พบข้อมูลโค้ชในช่วงเดือนนี้</CardContent></Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibleCoaches.map((coach) => (
            <Card key={coach.coach_id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-bold text-gray-950">{coach.coach_name}</p>
                      <Badge variant="secondary">{getEmploymentLabel(coach, teachingRules)}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{coach.weeks.length} สัปดาห์ · {coach.assigned_round_count} รอบ</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setSelectedCoachId(coach.coach_id)}>
                    <Eye className="mr-1.5 h-4 w-4" /> ดูสัปดาห์
                  </Button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div className="rounded-lg bg-emerald-50 p-2"><p className="text-xs text-emerald-700">ครบหลักฐาน</p><p className="font-bold">{coach.countable_round_count} รอบ</p></div>
                  <div className="rounded-lg bg-amber-50 p-2"><p className="text-xs text-amber-700">รอตรวจ</p><p className="font-bold">{coach.review_round_count} รอบ</p></div>
                  <div className="rounded-lg bg-blue-50 p-2"><p className="text-xs text-blue-700">ชั่วโมงรวม</p><p className="font-bold">{formatNumber(coach.total_hours)}</p></div>
                  <div className="rounded-lg bg-violet-50 p-2"><p className="text-xs text-violet-700">ยอดจ่าย</p><p className="font-bold">฿{formatCurrency(coach.payable_amount)}</p></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ListPagination
        page={page}
        pageSize={pageSize}
        total={filteredCoaches.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[12, 24, 48]}
      />

      <Sheet
        open={Boolean(selectedCoach)}
        onOpenChange={(open) => {
          if (open) return
          detailControllerRef.current?.abort()
          detailGenerationRef.current += 1
          setDetailState({ key: null, status: 'idle', data: null, error: null })
          setSelectedCoachId(null)
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader className="pr-8">
            <SheetTitle className="text-[#153c85]">รายละเอียดรายสัปดาห์</SheetTitle>
            <SheetDescription>สรุปจะแสดงก่อน และโหลดหลักฐานรายรอบเฉพาะเมื่อกดเปิด</SheetDescription>
          </SheetHeader>
          {selectedCoach && (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><p className="font-bold text-gray-950">{selectedCoach.coach_name}</p><p className="text-xs text-gray-500">{getEmploymentLabel(selectedCoach, teachingRules)}</p></div>
                  <p className="text-lg font-bold text-violet-700">฿{formatCurrency(selectedCoach.payable_amount)}</p>
                </div>
              </div>
              {selectedCoach.weeks.map((week) => {
                const detailKey = `${selectedCoach.coach_id}:${week.week_start}`
                const isDetailOpen = detailState.key === detailKey
                const overlappingClosed = findOverlappingClosedSummary(selectedCoach, week)
                return (
                  <div key={week.week_start} className="rounded-xl border bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-gray-950">{formatThaiDateRangeWithWeekday(week.week_start, week.week_end)}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          มอบหมาย {week.assigned_round_count} · ครบ {week.countable_round_count} · รอตรวจ {week.review_round_count} · ไม่เข้าเกณฑ์ {week.excluded_round_count}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="font-bold text-gray-950">{formatNumber(week.total_hours)} ชม.</p>
                        <p className="text-xs font-semibold text-violet-700">จ่าย {formatNumber(week.payable_hours)} ชม. / ฿{formatCurrency(week.payable_amount)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">Group {formatNumber(week.group_hours)} ชม.</Badge>
                      <Badge variant="outline">Private {formatNumber(week.private_hours)} ชม.</Badge>
                      <Badge variant="outline">ฐาน/ไม่จ่าย {formatNumber(week.regular_hours)} ชม.</Badge>
                      {week.issue_counts.missing_checkin > 0 && <Badge variant="destructive">ขาดเช็คอิน {week.issue_counts.missing_checkin}</Badge>}
                      {week.issue_counts.missing_photo > 0 && <Badge variant="destructive">ขาดรูป {week.issue_counts.missing_photo}</Badge>}
                      {week.issue_counts.missing_location > 0 && <Badge variant="destructive">ขาดพิกัด {week.issue_counts.missing_location}</Badge>}
                      {week.issue_counts.missing_attendance > 0 && <Badge variant="destructive">ขาด Attendance {week.issue_counts.missing_attendance}</Badge>}
                      {week.issue_counts.no_eligible_learner > 0 && <Badge variant="secondary">ไม่มีผู้เรียนเข้าเกณฑ์ {week.issue_counts.no_eligible_learner}</Badge>}
                      {week.issue_counts.duplicate_assignment_data > 0 && <Badge variant="destructive">Assignment ต้องตรวจ {week.issue_counts.duplicate_assignment_data}</Badge>}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => loadDetail(selectedCoach, week)}>
                        {isDetailOpen && detailState.status === 'loading' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ReceiptText className="mr-1.5 h-4 w-4" />}
                        {isDetailOpen ? 'ซ่อน/ปิดรายละเอียด' : 'โหลดรายละเอียดรอบสอน'}
                      </Button>
                      {week.closed_summary ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">ปิดแล้ว ฿{formatCurrency(week.closed_summary.payable_amount)}</Badge>
                      ) : overlappingClosed ? (
                        <Badge variant="destructive">มีสรุปเดิมทับช่วง</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!selectedCoach.employment_type || week.countable_round_count === 0 || Boolean(closingKey)}
                          onClick={() => {
                            setCloseTarget({ coach: selectedCoach, week })
                            setCloseNotes('')
                            setCloseError(null)
                          }}
                        >
                          <CheckCircle2 className="mr-1.5 h-4 w-4" /> ปิดสัปดาห์
                        </Button>
                      )}
                    </div>
                    {week.closed_summary && (
                      <p className="mt-2 text-xs text-emerald-700">
                        ปิดเมื่อ {formatThaiDateWithWeekday(week.closed_summary.closed_at.slice(0, 10))}
                        {week.closed_summary.closed_by_name ? ` โดย ${week.closed_summary.closed_by_name}` : ''}
                        {week.closed_summary.notes ? ` · ${week.closed_summary.notes}` : ''}
                      </p>
                    )}
                    {isDetailOpen && <DetailPanel state={detailState} onRetry={() => loadDetail(selectedCoach, week)} />}
                  </div>
                )
              })}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(closeTarget)} onOpenChange={(open) => !open && !closingKey && setCloseTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันปิดสัปดาห์</DialogTitle>
            <DialogDescription>ระบบจะบันทึก snapshot จากเกณฑ์และหลักฐานเดิม ณ เวลานี้</DialogDescription>
          </DialogHeader>
          {closeTarget && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-slate-50 p-3 text-sm">
                <p className="font-bold">{closeTarget.coach.coach_name}</p>
                <p className="text-gray-500">{formatThaiDateRangeWithWeekday(closeTarget.week.week_start, closeTarget.week.week_end)}</p>
                <p className="mt-1 font-semibold text-violet-700">จ่าย {formatNumber(closeTarget.week.payable_hours)} ชม. / ฿{formatCurrency(closeTarget.week.payable_amount)}</p>
              </div>
              <Textarea value={closeNotes} onChange={(event) => setCloseNotes(event.target.value)} placeholder="หมายเหตุ (ถ้ามี)" />
              {closeError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{closeError}</div>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" disabled={Boolean(closingKey)} onClick={() => setCloseTarget(null)}>ยกเลิก</Button>
                <Button disabled={Boolean(closingKey)} onClick={closeWeek}>
                  {closingKey && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}ยืนยันปิดสัปดาห์
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailPanel({ state, onRetry }: { state: DetailState; onRetry: () => void }) {
  if (state.status === 'loading') {
    return <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 p-4 text-sm text-blue-800" role="status"><Loader2 className="h-4 w-4 animate-spin" />กำลังโหลดรายละเอียด…</div>
  }
  if (state.status === 'error') {
    return (
      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{state.error}</div>
        <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>ลองใหม่</Button>
      </div>
    )
  }
  if (state.status !== 'success' || !state.data) return null
  if (state.data.rows.length === 0) {
    return <div className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-gray-500">ไม่พบรายละเอียดรอบสอน</div>
  }
  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      {state.data.rows.map((row) => (
        <div key={`${row.assignment_source}:${row.assignment_id}:${row.schedule_slot_id}`} className="rounded-lg border bg-slate-50/70 p-3 text-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold text-gray-950">{formatThaiDateWithWeekday(row.date)} · {formatTime(row.start_time)}–{formatTime(row.end_time)}</p>
              <p className="text-xs text-gray-500">{row.branch_name} · {row.course_type || 'ไม่ระบุประเภทคอร์ส'} · {row.student_count} คน</p>
            </div>
            <ClassificationBadge classification={row.classification} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <EvidenceBadge ok={row.has_checkin} icon={Clock3} label="เช็คอิน" />
            <EvidenceBadge ok={row.has_photo} icon={ImageIcon} label="รูป" />
            <EvidenceBadge ok={row.has_location} icon={MapPin} label="พิกัด" />
            <EvidenceBadge ok={row.has_attendance} icon={Users} label={`Attendance ${row.attendance_count}`} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-600">
            <span>Present {row.present_count}</span><span>Late {row.late_count}</span><span>Absent {row.absent_count}</span>
            {row.classification === 'counted' && <span className="font-semibold text-violet-700">{formatNumber(row.hours)} ชม. · จ่าย ฿{formatCurrency(row.payable_amount)}</span>}
          </div>
          {row.evidence_reasons[0] !== 'evidence_complete' && (
            <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-800"><ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{row.evidence_reasons.map((reason) => REASON_LABELS[reason] || reason).join(' · ')}</div>
          )}
          {(row.photo_url || row.has_location) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {row.photo_url && <a className="text-xs font-medium text-blue-700 underline" href={row.photo_url} target="_blank" rel="noreferrer">เปิดรูปหลักฐาน</a>}
              {row.has_location && <span className="text-xs text-gray-500">มีพิกัด GPS</span>}
            </div>
          )}
        </div>
      ))}
      <p className="pt-1 text-xs text-gray-400">รายละเอียด {state.data.rows.length} รอบ · โหลดเมื่อเปิดสัปดาห์นี้เท่านั้น</p>
    </div>
  )
}

function ClassificationBadge({ classification }: { classification: 'counted' | 'review' | 'excluded' }) {
  if (classification === 'counted') return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />นับชั่วโมง</Badge>
  if (classification === 'excluded') return <Badge variant="secondary"><XCircle className="mr-1 h-3.5 w-3.5" />ไม่เข้าเกณฑ์เดิม</Badge>
  return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100"><AlertCircle className="mr-1 h-3.5 w-3.5" />รอหลักฐาน/ตรวจสอบ</Badge>
}

function EvidenceBadge({ ok, icon: Icon, label }: {
  ok: boolean
  icon: typeof User
  label: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1', ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700')}>
      <Icon className="h-3.5 w-3.5" />{label}
    </span>
  )
}
