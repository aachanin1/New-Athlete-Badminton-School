'use client'

import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ListPagination } from '@/components/admin/list-pagination'
import { formatThaiDateTimeWithWeekday, formatThaiDateWithWeekday, formatThaiMonthYear } from '@/lib/date-format'
import { availableFamilyMakeupCount } from '@/lib/kids-family-makeup'
import type { MakeupHistoryLesson, MakeupHistoryResult, MakeupHistorySubject } from '@/lib/admin-makeup-history'

const kinds = { all: 'ทั้งหมด', wallet: 'กระเป๋า', absent: 'ขาดเรียน', use: 'ใช้สิทธิ์' } as const
function lessonText(s: MakeupHistoryLesson) { return `${formatThaiDateWithWeekday(s.date)} · ${s.startTime.slice(0, 5)}–${s.endTime.slice(0, 5)} · ${s.branchName}` }
export function MakeupHistoryDialog({ subject, onClose }: { subject: MakeupHistorySubject | null; onClose: () => void }) {
  const [kind, setKind] = useState<keyof typeof kinds>('all'), [page, setPage] = useState(1), [epoch, setEpoch] = useState(0)
  const [data, setData] = useState<(MakeupHistoryResult & { key: string }) | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState('')
  const focusReturn = useRef<HTMLElement | null>(null)
  const subjectKey = subject ? JSON.stringify([subject.parentId, subject.childId, subject.month, subject.course]) : ''
  const [scope, setScope] = useState('')
  const currentKind = scope === subjectKey ? kind : 'all', currentPage = scope === subjectKey ? page : 1
  const key = JSON.stringify([subjectKey, currentKind, currentPage, epoch])
  useEffect(() => {
    if (!subject) return
    const controller = new AbortController()
    setLoading(true); setError('')
    const q = new URLSearchParams({ parent: subject.parentId, month: subject.month, course: subject.course, kind: currentKind, page: String(currentPage), summary: 'true' })
    if (subject.childId) q.set('child', subject.childId)
    void fetch('/api/admin/makeup/history?' + q, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const result = await response.json()
      if (!response.ok || !Array.isArray(result.items)) throw new Error(result.error || 'อ่านประวัติไม่สำเร็จ')
      if (!controller.signal.aborted) {
        const last = Math.max(1, Math.ceil(result.total / 20))
        if (currentPage > last) { setScope(subjectKey); setPage(last) } else setData({ ...result, key })
      }
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'อ่านประวัติไม่สำเร็จ') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [subject, subjectKey, currentKind, currentPage, key])
  const result = data?.key === key ? data : null, summary = result?.summary
  return <Dialog open={Boolean(subject)} onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" onOpenAutoFocus={() => { focusReturn.current = document.activeElement instanceof HTMLElement ? document.activeElement : null }} onCloseAutoFocus={event => { event.preventDefault(); (focusReturn.current?.isConnected ? focusReturn.current : document.querySelector<HTMLElement>('[role="tab"][data-state="active"]'))?.focus({ preventScroll: true }) }}>
      <DialogHeader><DialogTitle>ประวัติสิทธิ์และการชดเชย</DialogTitle><DialogDescription>{subject?.title} · เดือนต้นทาง {subject ? formatThaiMonthYear(`${subject.month}-01`) : ''}</DialogDescription></DialogHeader>
      {summary ? <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
        <p>ซื้อยืนยันแล้ว {summary.sourcePurchase.quantity} รอบ → โควตา {summary.quota} · ใช้แล้ว {summary.used} · เหลือ {summary.remaining}</p>
        {summary.exceptionUsed ? <p>ในยอดใช้จริงนี้ เป็นกรณีพิเศษ {summary.exceptionUsed} ครั้ง</p> : null}
        <p>ต้นทางที่ใช้ได้ {summary.sources.length} · ใช้ได้ตอนนี้ {availableFamilyMakeupCount(summary)} ครั้ง</p>
        <p>สิทธิ์ชดเชยถึง {formatThaiDateTimeWithWeekday(new Date(Date.parse(summary.expiresAt) - 1))} · แยกจากวันหมดอายุกระเป๋าปกติ</p>
      </div> : null}
      <div className="flex flex-wrap gap-2" aria-label="ประเภทประวัติ">{Object.entries(kinds).map(([value, label]) => <Button key={value} variant={currentKind === value ? 'default' : 'outline'} size="sm" aria-pressed={currentKind === value} onClick={() => { setScope(subjectKey); setKind(value as keyof typeof kinds); setPage(1) }}>{label}{result ? ` ${result.counts[value as keyof typeof kinds]}` : ''}</Button>)}</div>
      <div aria-live="polite" className="space-y-3">
        {loading ? <p role="status">กำลังอ่านประวัติ...</p> : null}
        {error ? <p role="alert" className="text-sm text-red-700">{error} <Button variant="outline" onClick={() => setEpoch(v => v + 1)}>ลองใหม่</Button></p> : null}
        {!loading && !error && result ? <>
          {result.items.length === 0 ? <p className="py-5 text-center text-sm text-gray-500">ไม่มีประวัติประเภทนี้ในหลักฐานที่พบ</p> : null}
          {result.items.map((event, index) => <div key={event.id}>
            {!event.at && (index === 0 || result.items[index - 1].at) ? <h3 className="mb-3 text-sm font-semibold text-gray-600">เหตุการณ์ที่ไม่พบเวลาบันทึก</h3> : null}
            <article data-history-event={event.id} className="space-y-2 rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-[#153c85]">{event.title}</h3><Badge variant="outline" className={event.kind === 'wallet' ? 'border-purple-200 bg-purple-50 text-purple-800' : event.kind === 'absent' ? 'border-orange-200 bg-orange-50 text-orange-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}>{event.status}</Badge></div>
              <p className="text-gray-600">{event.at ? `${event.timeLabel}: ${formatThaiDateTimeWithWeekday(event.at)}` : 'ไม่พบเวลาบันทึกเดิม'}</p>
              <p className="font-medium">{event.learner}</p>
              {event.participants.length > 1 ? <p>ร่วมกัน {event.participants.length} คน · {event.participants.map(p => p.name).join(' · ')}</p> : null}
              <div className="rounded-md bg-gray-50 p-2"><p>รอบต้นทาง: {lessonText(event.source)}</p>{event.destination ? <p>{event.destination.isMakeup ? 'วันเรียนชดเชย' : 'รอบปลายทาง'}: {lessonText(event.destination)}</p> : null}</div>
              {event.walletExpiresAt ? <p>หมดอายุกระเป๋าปกติ: {formatThaiDateTimeWithWeekday(event.walletExpiresAt)}</p> : null}
              {event.actor ? <p>ผู้ทำรายการ: {event.actor}</p> : null}
              {event.reason ? <p>เหตุผลที่ Admin บันทึก: {event.reason}</p> : null}
            </article>
          </div>)}
          {result.total > 20 ? <ListPagination page={currentPage} pageSize={20} pageSizeOptions={[20]} total={result.total} onPageChange={value => { setScope(subjectKey); setPage(value) }} onPageSizeChange={() => {}} /> : null}
        </> : null}
      </div>
      <div className="flex justify-end"><Button variant="outline" onClick={onClose}>ปิด</Button></div>
    </DialogContent>
  </Dialog>
}
