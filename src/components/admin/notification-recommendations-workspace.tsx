'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Search,
  Send,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { ListPagination } from '@/components/admin/list-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  FollowUpWorkspaceSnapshot,
  NearCourseRecommendation,
  RecommendationWorkspaceData,
} from '@/lib/admin-notification-recommendations'

const PAGE_SIZE = 10
const SAFETY_REFRESH_MS = 5 * 60 * 1000
const COURSE_LABELS = {
  kids_group: 'เด็กกลุ่ม',
  adult_group: 'ผู้ใหญ่กลุ่ม',
  private: 'ส่วนตัว',
} as const
const FOLLOW_UP_COURSE_LABELS = {
  kids_group: 'กลุ่มเด็ก',
  adult_group: 'กลุ่มผู้ใหญ่',
  private: 'ส่วนตัว',
} as const

interface NotificationRecommendationsWorkspaceProps {
  initialData: RecommendationWorkspaceData
  onNearCourseSend: (recommendation: NearCourseRecommendation) => void
}

interface FollowUpPreview {
  userIds: string[]
  recipientNames: string[]
  requestKey: string
}

type FollowUpMode = FollowUpWorkspaceSnapshot['mode']
type RefreshReason = 'initial' | 'focus' | 'visible' | 'search' | 'filter' | 'page' | 'preview' | 'after-send' | 'safety'

interface WorkspaceQuery {
  page: number
  mode: FollowUpMode
  search: string
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatThaiDateOnly(value: string | null) {
  if (!value) return 'ไม่พบประวัติเข้าเรียนที่ยืนยันแล้ว'
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return 'ไม่พบประวัติเข้าเรียนที่ยืนยันแล้ว'
  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return 'ไม่พบประวัติเข้าเรียนที่ยืนยันแล้ว'
  }
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function paginate<T>(items: T[], page: number) {
  return items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
}

function safePage(page: number, total: number) {
  return Math.min(page, Math.max(1, Math.ceil(total / PAGE_SIZE)))
}

function FixedPagination({
  page,
  total,
  onPageChange,
}: {
  page: number
  total: number
  onPageChange: (page: number) => void
}) {
  if (total <= PAGE_SIZE) return null
  return (
    <ListPagination
      page={page}
      pageSize={PAGE_SIZE}
      total={total}
      onPageChange={onPageChange}
      onPageSizeChange={() => undefined}
      pageSizeOptions={[PAGE_SIZE]}
    />
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone}`}>{value.toLocaleString('th-TH')}</p>
    </div>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
      {children}
    </div>
  )
}

export function NotificationRecommendationsWorkspace({
  initialData,
  onNearCourseSend,
}: NotificationRecommendationsWorkspaceProps) {
  const [lowPage, setLowPage] = useState(1)
  const [nearPage, setNearPage] = useState(1)
  const [followUp, setFollowUp] = useState(initialData.followUp)
  const [searchDraft, setSearchDraft] = useState(initialData.followUp.search)
  const [mode, setMode] = useState<FollowUpMode>(initialData.followUp.mode)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<FollowUpPreview | null>(null)
  const [loadingGet, setLoadingGet] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(initialData.followUp.error)
  const requestSequenceRef = useRef(0)
  const activeGetControllerRef = useRef<AbortController | null>(null)
  const activeGetPromiseRef = useRef<Promise<FollowUpWorkspaceSnapshot | null> | null>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentQueryRef = useRef<WorkspaceQuery>({
    page: initialData.followUp.page,
    mode: initialData.followUp.mode,
    search: initialData.followUp.search,
  })

  const resolvedLowPage = safePage(lowPage, initialData.lowEnrollment.length)
  const resolvedNearPage = safePage(nearPage, initialData.nearCourse.length)
  const pagedLow = paginate(initialData.lowEnrollment, resolvedLowPage)
  const pagedNear = paginate(initialData.nearCourse, resolvedNearPage)
  const bulkEligibleItems = useMemo(
    () => followUp.items.filter((item) => item.canBulk && item.status === 'actionable'),
    [followUp.items]
  )

  const clearSearchDebounce = useCallback(() => {
    if (searchDebounceRef.current !== null) {
      clearTimeout(searchDebounceRef.current)
      searchDebounceRef.current = null
    }
  }, [])

  const requestWorkspace = useCallback(async function requestWorkspace(
    query: WorkspaceQuery,
    reason: RefreshReason,
    replaceInFlight = true
  ): Promise<FollowUpWorkspaceSnapshot | null> {
    const previousRequest = activeGetPromiseRef.current
    let requestSequence: number
    if (previousRequest) {
      if (!replaceInFlight) return null
      requestSequence = ++requestSequenceRef.current
      activeGetControllerRef.current?.abort()
      await previousRequest.catch(() => null)
      if (requestSequence !== requestSequenceRef.current) return null
    } else {
      requestSequence = ++requestSequenceRef.current
    }

    const controller = new AbortController()
    activeGetControllerRef.current = controller
    setLoadingGet(true)
    setError(null)

    const requestPromise = (async () => {
      const searchParams = new URLSearchParams({
        page: String(query.page),
        mode: query.mode,
        search: query.search.trim(),
      })
      const response = await fetch(`/api/admin/notifications/customer-follow-up?${searchParams}`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.workspace) {
        throw new Error(result?.error || 'โหลดคิวติดตามลูกค้าไม่สำเร็จ')
      }
      return result.workspace as FollowUpWorkspaceSnapshot
    })()
    activeGetPromiseRef.current = requestPromise

    try {
      const next = await requestPromise
      if (requestSequence !== requestSequenceRef.current) return null
      setFollowUp(next)
      setMode(next.mode)
      currentQueryRef.current = { page: next.page, mode: next.mode, search: next.search }
      setSelectedUserIds((current) => {
        const visibleEligible = new Set(
          next.items
            .filter((item) => item.status === 'actionable' && item.canBulk)
            .map((item) => item.userId)
        )
        const retained = new Set(Array.from(current).filter((userId) => visibleEligible.has(userId)))
        const removedCount = current.size - retained.size
        if (removedCount > 0) {
          toast.warning(`นำ ${removedCount} รายการที่จองแล้ว ส่งแล้ว หรือไม่อยู่ในหน้าปัจจุบันออกจากรายการเลือก`)
        }
        return retained
      })
      setError(next.error)
      return next
    } catch (requestError) {
      if ((requestError as { name?: string })?.name === 'AbortError') return null
      if (requestSequence !== requestSequenceRef.current) return null
      const message = requestError instanceof Error && requestError.message
        ? requestError.message
        : 'เชื่อมต่อระบบติดตามลูกค้าไม่สำเร็จ กรุณาลองใหม่'
      setError(message)
      if (reason === 'preview') toast.error('รีเฟรชข้อมูลล่าสุดไม่สำเร็จ จึงยังเปิด Preview ไม่ได้')
      return null
    } finally {
      if (requestSequence === requestSequenceRef.current) {
        if (activeGetControllerRef.current === controller) {
          activeGetControllerRef.current = null
          activeGetPromiseRef.current = null
        }
        setLoadingGet(false)
      }
    }
  }, [])

  useEffect(() => {
    if (searchDraft.trim() === followUp.search) return
    clearSearchDebounce()
    searchDebounceRef.current = setTimeout(() => {
      searchDebounceRef.current = null
      void requestWorkspace({ page: 1, mode, search: searchDraft }, 'search')
    }, 300)
    return clearSearchDebounce
  }, [clearSearchDebounce, followUp.search, mode, requestWorkspace, searchDraft])

  useEffect(() => {
    void requestWorkspace(currentQueryRef.current, 'initial', false)
  }, [requestWorkspace])

  useEffect(() => {
    const refreshIfVisible = (reason: 'focus' | 'visible') => {
      if (document.visibilityState !== 'visible') return
      void requestWorkspace(currentQueryRef.current, reason, false)
    }
    const handleFocus = () => refreshIfVisible('focus')
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshIfVisible('visible')
    }
    const safetyTimer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void requestWorkspace(currentQueryRef.current, 'safety', false)
    }, SAFETY_REFRESH_MS)

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.clearInterval(safetyTimer)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [requestWorkspace])

  useEffect(() => () => {
    clearSearchDebounce()
    requestSequenceRef.current += 1
    activeGetControllerRef.current?.abort()
  }, [clearSearchDebounce])

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearSearchDebounce()
    void requestWorkspace({ page: 1, mode, search: searchDraft }, 'search')
  }

  function changeMode(nextMode: FollowUpMode) {
    clearSearchDebounce()
    void requestWorkspace({ page: 1, mode: nextMode, search: searchDraft }, 'filter')
  }

  function toggleBulkUser(userId: string, checked: boolean) {
    setSelectedUserIds((current) => {
      const next = new Set(current)
      if (checked) {
        if (next.size >= 10) return current
        next.add(userId)
      } else {
        next.delete(userId)
      }
      return next
    })
  }

  async function openFollowUpPreview(userIds: string[]) {
    const fresh = await requestWorkspace({
      page: followUp.page,
      mode: 'actionable',
      search: followUp.search,
    }, 'preview')
    if (!fresh) return
    const selected = fresh.items.filter((item) => userIds.includes(item.userId) && item.status === 'actionable')
    const bulkInvalid = userIds.length > 1 && selected.some((item) => !item.canBulk)
    if (selected.length !== userIds.length || bulkInvalid) {
      setError('รายการเลือกมีบัญชีที่จองแล้ว ส่งแล้ว หรือส่งแบบ Bulk ไม่ได้ กรุณาตรวจรายการล่าสุด')
      toast.warning('รายการเลือกเปลี่ยนแปลงหลังตรวจข้อมูลล่าสุด จึงยังเปิด Preview ไม่ได้')
      return
    }
    setPreview({
      userIds,
      recipientNames: selected.map((item) => item.recipientName),
      requestKey: crypto.randomUUID(),
    })
  }

  async function confirmFollowUpSend() {
    if (!preview) return
    const requestSequence = ++requestSequenceRef.current
    activeGetControllerRef.current?.abort()
    if (activeGetPromiseRef.current) await activeGetPromiseRef.current.catch(() => null)
    if (requestSequence !== requestSequenceRef.current) return

    setSending(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/notifications/customer-follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          requestKey: preview.requestKey,
          userIds: preview.userIds,
          page: followUp.page,
          mode: 'actionable',
          search: followUp.search,
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.result) {
        throw new Error(result?.error || 'ส่งแจ้งเตือนไม่สำเร็จ')
      }
      toast.success(`ส่งแจ้งเตือนสำเร็จ ${preview.userIds.length} บัญชี`)
      setPreview(null)
      await requestWorkspace({
        page: followUp.page,
        mode: 'actionable',
        search: followUp.search,
      }, 'after-send')
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'ส่งแจ้งเตือนไม่สำเร็จ')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="overflow-hidden border-slate-200">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-semibold text-[#153c85]">Recommendation Workspace</p>
            <p className="text-xs text-slate-500">
              สรุปรอบคนน้อย, การใช้สิทธิ์ใกล้หมดคอร์ส และคิวติดตามลูกค้าแบบมีหลักฐาน
            </p>
          </div>
          <Badge variant="outline" className="w-fit">คำนวณจากข้อมูล Server</Badge>
        </div>

        <Tabs defaultValue="low-enrollment" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-1 bg-slate-100 p-1 sm:grid-cols-3">
            <TabsTrigger value="low-enrollment" className="min-h-10 whitespace-normal">
              รอบเรียนคนน้อย ({initialData.lowEnrollment.length})
            </TabsTrigger>
            <TabsTrigger value="near-course" className="min-h-10 whitespace-normal">
              ผู้เรียนใกล้หมดคอร์ส ({initialData.nearCourse.length})
            </TabsTrigger>
            <TabsTrigger value="follow-up" className="min-h-10 whitespace-normal">
              ติดตามลูกค้าเก่า ({followUp.actionableCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="low-enrollment" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryCard label="รอบเข้าเกณฑ์ทั้งหมด" value={initialData.lowEnrollment.length} tone="text-rose-600" />
              <SummaryCard
                label="รอบที่มีผู้เรียน 1 คน"
                value={initialData.lowEnrollment.filter((item) => item.learnerCount === 1).length}
                tone="text-amber-600"
              />
            </div>
            <p className="text-xs text-slate-500">แสดงเฉพาะเด็กกลุ่ม/ผู้ใหญ่กลุ่มที่ยืนยันแล้ว 1–2 คน แยกตามรอบและสาขา</p>
            {pagedLow.length === 0 ? (
              <EmptyState>ยังไม่มีรอบเรียนคนน้อยที่เข้าเกณฑ์</EmptyState>
            ) : (
              <div className="space-y-2">
                {pagedLow.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <AlertTriangle className={item.level === 'red' ? 'h-4 w-4 text-rose-600' : 'h-4 w-4 text-amber-600'} />
                          <p className="font-semibold text-slate-800">{item.branchName} · {COURSE_LABELS[item.courseName]}</p>
                          <Badge variant="outline">{item.learnerCount} คน</Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.date} · {item.startTime.slice(0, 5)}–{item.endTime.slice(0, 5)}
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm" className="w-full gap-1 sm:w-auto">
                        <Link href={item.href}>
                          เปิดจัดรอบ/จัดกลุ่ม <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <FixedPagination page={resolvedLowPage} total={initialData.lowEnrollment.length} onPageChange={setLowPage} />
          </TabsContent>

          <TabsContent value="near-course" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryCard label="รายการเข้าเกณฑ์ทั้งหมด" value={initialData.nearCourse.length} tone="text-[#153c85]" />
              <SummaryCard
                label="แพ็กเกจส่วนตัว"
                value={initialData.nearCourse.filter((item) => item.courseName === 'private').length}
                tone="text-violet-600"
              />
            </div>
            <p className="text-xs text-slate-500">เริ่มแนะนำตั้งแต่ใช้สิทธิ์ 70% และตัดรายการที่มีคอร์สเดือนถัดไปแล้ว</p>
            {pagedNear.length === 0 ? (
              <EmptyState>ยังไม่มีผู้เรียนหรือแพ็กเกจที่ต้องติดตาม</EmptyState>
            ) : (
              <div className="space-y-2">
                {pagedNear.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-800">
                            {item.courseName === 'private'
                              ? 'แพ็กเกจส่วนตัว'
                              : item.learnerNames.join(', ')}
                          </p>
                          <Badge variant="outline">{COURSE_LABELS[item.courseName]}</Badge>
                          <Badge className={item.level === 'red' ? 'bg-rose-600' : item.level === 'yellow' ? 'bg-amber-500' : 'bg-emerald-600'}>
                            {item.progressPercent}%
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600">ผู้ปกครอง/ผู้รับ: {item.recipientName}</p>
                        {item.courseName === 'private' && item.learnerNames.length > 0 && (
                          <p className="text-sm text-slate-600">ผู้เรียนในแพ็กเกจ: {item.learnerNames.join(', ')}</p>
                        )}
                        <p className="text-sm text-slate-600">ใช้แล้ว {item.usedSessions}/{item.totalSessions} รอบ</p>
                        <p className="text-xs text-slate-500">สาขา: {item.branchNames.join(', ')}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1 sm:w-auto"
                        onClick={() => onNearCourseSend(item)}
                      >
                        <BellRing className="h-3.5 w-3.5" /> ส่งแจ้งเตือน
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <FixedPagination page={resolvedNearPage} total={initialData.nearCourse.length} onPageChange={setNearPage} />
          </TabsContent>

          <TabsContent value="follow-up" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryCard label="ต้องติดตามตอนนี้" value={followUp.actionableCount} tone="text-amber-600" />
              <SummaryCard label="ส่งแล้วเดือนนี้" value={followUp.sentCurrentMonthCount} tone="text-emerald-600" />
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-600">
                  คิวคำนวณใหม่จากข้อมูลจริงตามเดือน Asia/Bangkok · Server แสดง 10 รายต่อหน้า · ไม่มีการส่งอัตโนมัติ
                </div>
                {loadingGet && (
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังอัปเดตข้อมูล
                  </div>
                )}
              </div>

              <div className="grid gap-2 lg:grid-cols-[minmax(260px,1fr)_190px]">
                <form className="flex gap-2" onSubmit={submitSearch}>
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={searchDraft}
                      maxLength={100}
                      placeholder="ค้นหาชื่อเล่น ชื่อผู้เรียน หรือผู้ปกครอง"
                      className="pl-9"
                      onChange={(event) => setSearchDraft(event.target.value)}
                    />
                  </div>
                  <Button type="submit" variant="outline" disabled={loadingGet || sending}>
                    ค้นหา
                  </Button>
                </form>
                <Select value={mode} onValueChange={(value) => changeMode(value as FollowUpMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="actionable">ต้องติดตามตอนนี้</SelectItem>
                    <SelectItem value="sent">ส่งแล้วเดือนนี้</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <p className="text-xs text-slate-500">
                พบจริง {followUp.filteredCount.toLocaleString('th-TH')} รายการในมุมมองนี้
              </p>
            </div>

            {error && (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            {mode === 'actionable' && selectedUserIds.size > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-blue-800">เลือกจากหน้าปัจจุบันสำหรับ Bulk {selectedUserIds.size}/10 ราย</p>
                <Button
                  size="sm"
                  className="gap-1"
                  disabled={loadingGet || sending}
                  onClick={() => openFollowUpPreview(Array.from(selectedUserIds))}
                >
                  <Send className="h-3.5 w-3.5" /> Preview การส่งพร้อมกัน
                </Button>
              </div>
            )}

            {followUp.items.length === 0 ? (
              <EmptyState>ไม่พบรายการตามคำค้นหาหรือมุมมองปัจจุบัน</EmptyState>
            ) : (
              <div className="space-y-2">
                {followUp.items.map((item) => {
                  const isSelected = selectedUserIds.has(item.userId)
                  const learnerLabel = item.learners.length > 0
                    ? item.learners.map((learner) => `${learner.name}${learner.isSelf ? ' (ตัวเอง)' : ''}`).join(', ')
                    : 'ไม่พบชื่อผู้เรียนที่ยืนยันแล้ว'
                  return (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 gap-3">
                          {item.status === 'actionable' && (
                            <Checkbox
                              aria-label={`เลือก ${learnerLabel} สำหรับ Bulk`}
                              className="mt-1"
                              checked={isSelected}
                              disabled={!item.canBulk || (!isSelected && selectedUserIds.size >= 10)}
                              onCheckedChange={(checked) => toggleBulkUser(item.userId, checked === true)}
                            />
                          )}
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-800">{item.position}. {learnerLabel}</p>
                              {item.status === 'sent' && <Badge className="bg-emerald-600">ส่งแล้วเดือนนี้</Badge>}
                            </div>
                            <p className="text-sm text-slate-600">ผู้ปกครอง/ผู้รับ: {item.recipientName}</p>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                              <span>ประวัติคอร์ส:</span>
                              {item.courseNames.length > 0
                                ? item.courseNames.map((courseName) => (
                                  <Badge key={courseName} variant="outline">
                                    {FOLLOW_UP_COURSE_LABELS[courseName]}
                                  </Badge>
                                ))
                                : <span>ไม่พบประวัติคอร์สที่ยืนยันแล้ว</span>}
                            </div>
                            <p className="text-xs text-slate-500">
                              เข้าเรียนล่าสุด: {formatThaiDateOnly(item.lastAttendedDate)}
                            </p>
                            <p className="text-xs text-slate-500">
                              ติดตามที่ยืนยันแล้ว {item.verifiedAttemptCount} ครั้ง
                              {item.latestVerifiedAt ? ` · ล่าสุด ${formatDateTime(item.latestVerifiedAt)}` : ''}
                              {item.latestVerifiedRead === true ? ' · อ่านแล้ว' : item.latestVerifiedRead === false ? ' · ยังไม่อ่าน' : ''}
                            </p>
                            {item.ambiguousLegacyCount > 0 && (
                              <p className="text-xs text-amber-700">
                                ประวัติเดิม—ยืนยันที่มาไม่ได้ {item.ambiguousLegacyCount} รายการ
                              </p>
                            )}
                            {item.status === 'actionable' && !item.canBulk && (
                              <p className="text-xs text-slate-500">รายการนี้ต้องดำเนินการรายบุคคล</p>
                            )}
                          </div>
                        </div>
                        {item.status === 'actionable' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-1 sm:w-auto"
                            disabled={loadingGet || sending}
                            onClick={() => openFollowUpPreview([item.userId])}
                          >
                            <BellRing className="h-3.5 w-3.5" /> Preview รายบุคคล
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <FixedPagination
              page={followUp.page}
              total={followUp.filteredCount}
              onPageChange={(page) => {
                void requestWorkspace({ page, mode, search: followUp.search }, 'page')
              }}
            />

            {mode === 'actionable' && bulkEligibleItems.length === 0 && followUp.items.some((item) => item.status === 'actionable') && (
              <p className="text-xs text-slate-500">คิวนี้ไม่มีรายการที่ส่งแบบ Bulk ได้ กรุณาดำเนินการรายบุคคล</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && !sending && setPreview(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Preview แจ้งเตือนติดตามลูกค้า</DialogTitle>
            <DialogDescription>
              ตรวจผู้รับและข้อความก่อนยืนยัน ระบบจะ revalidate ทั้งรายการอีกครั้งบน Server
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2 font-semibold text-slate-800">
                  <Users className="h-4 w-4" /> ผู้รับ {preview.userIds.length} ราย
                </div>
                <p className="mt-1 break-words text-xs text-slate-600">{preview.recipientNames.join(', ')}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="font-semibold">คิดถึงนะ กลับมาลงเรียนกันต่อได้เลย</p>
                <p className="mt-2 text-slate-600">
                  เดือนนี้ยังไม่พบการจองของคุณ หากต้องการกลับมาเรียนสามารถเข้าแอปเพื่อเลือกวันเรียนได้ทันที
                </p>
                <p className="mt-2 text-xs text-slate-500">ลิงก์: /dashboard/booking</p>
              </div>
              {preview.userIds.length > 1 && (
                <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Bulk เป็น all-or-nothing หากผู้รับแม้แต่หนึ่งรายไม่ผ่าน จะไม่ส่งทั้งหมด
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={sending} onClick={() => setPreview(null)}>
              ยกเลิก
            </Button>
            <Button disabled={sending} onClick={confirmFollowUpSend}>
              {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
              ยืนยันส่ง {preview?.userIds.length || 0} ราย
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
