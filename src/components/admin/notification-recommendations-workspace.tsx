'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
  Users,
} from 'lucide-react'
import { ListPagination } from '@/components/admin/list-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
  FollowUpWorkspaceSnapshot,
  NearCourseRecommendation,
  RecommendationWorkspaceData,
} from '@/lib/admin-notification-recommendations'

const PAGE_SIZE = 10
const COURSE_LABELS = {
  kids_group: 'เด็กกลุ่ม',
  adult_group: 'ผู้ใหญ่กลุ่ม',
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

function formatDateTime(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
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
  const [followUpPage, setFollowUpPage] = useState(1)
  const [followUp, setFollowUp] = useState(initialData.followUp)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<FollowUpPreview | null>(null)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(initialData.followUp.error)

  const resolvedLowPage = safePage(lowPage, initialData.lowEnrollment.length)
  const resolvedNearPage = safePage(nearPage, initialData.nearCourse.length)
  const resolvedFollowUpPage = safePage(followUpPage, followUp.items.length)
  const pagedLow = paginate(initialData.lowEnrollment, resolvedLowPage)
  const pagedNear = paginate(initialData.nearCourse, resolvedNearPage)
  const pagedFollowUp = paginate(followUp.items, resolvedFollowUpPage)
  const bulkEligibleItems = useMemo(
    () => followUp.items.filter((item) => item.canBulk && item.status === 'pending'),
    [followUp.items]
  )

  function replaceFollowUp(next: FollowUpWorkspaceSnapshot) {
    setFollowUp(next)
    setSelectedUserIds(new Set())
    setFollowUpPage(1)
    setError(next.error)
  }

  async function requestWorkspace(
    method: 'GET' | 'POST',
    body?: Record<string, unknown>,
    actionName = 'refresh'
  ) {
    setLoadingAction(actionName)
    setError(null)
    try {
      const response = await fetch('/api/admin/notifications/customer-follow-up', {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: method === 'POST' ? JSON.stringify(body) : undefined,
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.workspace) {
        setError(result?.error || 'ดำเนินการคิวติดตามลูกค้าไม่สำเร็จ')
        return false
      }
      replaceFollowUp(result.workspace as FollowUpWorkspaceSnapshot)
      return true
    } catch {
      setError('เชื่อมต่อระบบติดตามลูกค้าไม่สำเร็จ กรุณาลองใหม่')
      return false
    } finally {
      setLoadingAction(null)
    }
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

  function openFollowUpPreview(userIds: string[]) {
    const selected = followUp.items.filter((item) => userIds.includes(item.userId))
    if (selected.length !== userIds.length) {
      setError('ไม่พบผู้รับในคิวปัจจุบัน กรุณารีเฟรชข้อมูล')
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
    const success = await requestWorkspace('POST', {
      action: 'send',
      requestKey: preview.requestKey,
      userIds: preview.userIds,
    }, 'send')
    if (success) setPreview(null)
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
              ติดตามลูกค้าเก่า ({followUp.totalRemaining})
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
                          <p className="font-semibold text-slate-800">{item.recipientName}</p>
                          <Badge variant="outline">{COURSE_LABELS[item.courseName]}</Badge>
                          <Badge className={item.level === 'red' ? 'bg-rose-600' : item.level === 'yellow' ? 'bg-amber-500' : 'bg-emerald-600'}>
                            {item.progressPercent}%
                          </Badge>
                        </div>
                        {item.courseName !== 'private' && item.learnerName && (
                          <p className="text-sm text-slate-600">ผู้เรียน: {item.learnerName}</p>
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
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <SummaryCard label="ทั้งหมด" value={followUp.totalRemaining} tone="text-[#153c85]" />
              <SummaryCard label="คิวปัจจุบัน" value={followUp.currentCount} tone="text-amber-600" />
              <SummaryCard label="รอ" value={followUp.waitingCount} tone="text-slate-600" />
              <SummaryCard label="ดำเนินการแล้ว" value={followUp.processedCount} tone="text-emerald-600" />
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-600">
                คิวร่วมของ Admin สูงสุด 30 ราย · แสดง 10 รายต่อหน้า · ไม่มีการสร้างคิวหรือส่งอัตโนมัติ
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={loadingAction !== null}
                  onClick={() => requestWorkspace('GET', undefined, 'refresh')}
                >
                  {loadingAction === 'refresh' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  รีเฟรช
                </Button>
                {followUp.canStart && (
                  <Button
                    size="sm"
                    disabled={loadingAction !== null}
                    onClick={() => requestWorkspace('POST', { action: 'start_batch' }, 'start')}
                  >
                    {loadingAction === 'start' && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                    เริ่ม Batch 30 ราย
                  </Button>
                )}
                {followUp.canLoadNext && (
                  <Button
                    size="sm"
                    disabled={loadingAction !== null}
                    onClick={() => requestWorkspace('POST', { action: 'load_next' }, 'next')}
                  >
                    {loadingAction === 'next' && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                    โหลด Batch ถัดไป
                  </Button>
                )}
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            {selectedUserIds.size > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-blue-800">เลือกสำหรับ Bulk {selectedUserIds.size}/10 ราย</p>
                <Button
                  size="sm"
                  className="gap-1"
                  onClick={() => openFollowUpPreview(Array.from(selectedUserIds))}
                >
                  <Send className="h-3.5 w-3.5" /> Preview การส่งพร้อมกัน
                </Button>
              </div>
            )}

            {pagedFollowUp.length === 0 ? (
              <EmptyState>
                {followUp.state === 'unavailable'
                  ? 'คิวติดตามลูกค้ายังไม่พร้อมใช้งาน'
                  : followUp.canStart
                    ? `มีลูกค้าที่เข้าเกณฑ์ ${followUp.availableTotal} ราย กดเริ่ม Batch เมื่อต้องการดำเนินการ`
                    : 'ยังไม่มีรายการในคิวปัจจุบัน'}
              </EmptyState>
            ) : (
              <div className="space-y-2">
                {pagedFollowUp.map((item) => {
                  const isSelected = selectedUserIds.has(item.userId)
                  return (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 gap-3">
                          <Checkbox
                            aria-label={`เลือก ${item.recipientName} สำหรับ Bulk`}
                            className="mt-1"
                            checked={isSelected}
                            disabled={!item.canBulk || (!isSelected && selectedUserIds.size >= 10)}
                            onCheckedChange={(checked) => toggleBulkUser(item.userId, checked === true)}
                          />
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-800">{item.position}. {item.recipientName}</p>
                              {item.status === 'sent' && <Badge className="bg-emerald-600">ส่งแล้ว</Badge>}
                              {!item.isCurrentlyEligible && <Badge variant="destructive">ไม่เข้าเกณฑ์แล้ว</Badge>}
                            </div>
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
                            {item.status === 'pending' && !item.canBulk && item.isCurrentlyEligible && (
                              <p className="text-xs text-slate-500">รายการนี้ต้องดำเนินการรายบุคคล</p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-1 sm:w-auto"
                          disabled={item.status !== 'pending' || !item.isCurrentlyEligible || loadingAction !== null}
                          onClick={() => openFollowUpPreview([item.userId])}
                        >
                          <BellRing className="h-3.5 w-3.5" /> Preview รายบุคคล
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <FixedPagination page={resolvedFollowUpPage} total={followUp.items.length} onPageChange={setFollowUpPage} />

            {bulkEligibleItems.length === 0 && followUp.items.some((item) => item.status === 'pending') && (
              <p className="text-xs text-slate-500">คิวนี้ไม่มีรายการที่ส่งแบบ Bulk ได้ กรุณาดำเนินการรายบุคคล</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && !loadingAction && setPreview(null)}>
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
            <Button variant="outline" disabled={loadingAction === 'send'} onClick={() => setPreview(null)}>
              ยกเลิก
            </Button>
            <Button disabled={loadingAction === 'send'} onClick={confirmFollowUpSend}>
              {loadingAction === 'send' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
              ยืนยันส่ง {preview?.userIds.length || 0} ราย
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
