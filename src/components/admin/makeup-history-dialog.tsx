'use client'

import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ListPagination } from '@/components/admin/list-pagination'
import { formatThaiDateTimeWithWeekday, formatThaiDateWithWeekday, formatThaiMonthYear } from '@/lib/date-format'
import { availableFamilyMakeupCount } from '@/lib/kids-family-makeup'
import type { MakeupHistoryLesson, MakeupHistoryResult, MakeupHistorySubject } from '@/lib/admin-makeup-history'

const kinds = { use: 'การใช้และจัดวัน', wallet: 'ประวัติการเก็บ', absent: 'ขาดเรียน', all: 'ทุกเหตุการณ์' } as const
function lessonText(s: MakeupHistoryLesson) { return `${formatThaiDateWithWeekday(s.date)} · ${s.startTime.slice(0, 5)}–${s.endTime.slice(0, 5)} · ${s.branchName}` }
export function MakeupHistoryDialog({ subject, onClose }: { subject: MakeupHistorySubject | null; onClose: () => void }) {
  const [kind, setKind] = useState<keyof typeof kinds>('use'), [page, setPage] = useState(1), [epoch, setEpoch] = useState(0)
  const [data, setData] = useState<(MakeupHistoryResult & { key: string }) | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState('')
  const focusReturn = useRef<HTMLElement | null>(null)
  const subjectKey = subject ? JSON.stringify([subject.parentId, subject.childId, subject.month, subject.course, subject.reference]) : ''
  const [scope, setScope] = useState('')
  const [sourcePage, setSourcePage] = useState({ key: '', page: 1 })
  const currentKind = scope === subjectKey ? kind : 'use', currentPage = scope === subjectKey ? page : 1
  const key = JSON.stringify([subjectKey, currentKind, currentPage, epoch])
  useEffect(() => {
    if (!subject) return
    const controller = new AbortController()
    setLoading(true); setError('')
    const q = new URLSearchParams({ parent: subject.parentId, month: subject.month, course: subject.course, kind: currentKind, page: String(currentPage), summary: 'true' })
    if (subject.childId) q.set('child', subject.childId)
    if (subject.reference) q.set('reference', subject.reference)
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
  const result = data?.key === key ? data : null, summary = result?.summary, balance = result?.balance
  const walletPage = Math.min(sourcePage.key === subjectKey ? sourcePage.page : 1, Math.max(1, Math.ceil((balance?.sources.length ?? 0) / 10)))
  return <Dialog open={Boolean(subject)} onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" onOpenAutoFocus={() => { focusReturn.current = document.activeElement instanceof HTMLElement ? document.activeElement : null }} onCloseAutoFocus={event => { event.preventDefault(); (focusReturn.current?.isConnected ? focusReturn.current : document.querySelector<HTMLElement>('[role="tab"][data-state="active"]'))?.focus({ preventScroll: true }) }}>
      <DialogHeader><DialogTitle>ยอดคงเหลือและประวัติ</DialogTitle><DialogDescription>{subject?.title} · เปิดจากการ์ด {subject ? formatThaiMonthYear(`${subject.month}-01`) : ''}</DialogDescription></DialogHeader>
      {balance ? <section aria-label={subject?.course === 'kids_group' ? 'ต้นทางเดือนที่เลือก' : 'ยอดที่ยังใช้ได้'} className="space-y-2 rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm text-purple-950">
        <h2 className="font-semibold">{subject?.course === 'kids_group' ? 'ต้นทางที่พบในเดือนนี้' : 'กระเป๋าคงเหลือตอนนี้ · รวมทุกเดือนต้นทาง'}</h2>
        <p className="text-xl font-bold">{subject?.course === 'kids_group' ? 'จากกระเป๋า' : 'เหลือ'} {balance.walletQuantity} {balance.unit}</p>
        {subject?.course === 'private' ? <p>นับชั่วโมงต่อหน่วยครอบครัว ไม่คูณจำนวนผู้เรียน</p> : null}
        <p>ต้นทางขาดเรียน {balance.absentSourceCount} รายการ{subject ? ` · เดือน ${formatThaiMonthYear(`${subject.month}-01`)}` : ''}</p>
        {balance.sources.length ? <details>
          <summary className="cursor-pointer font-medium">ดูต้นทางกระเป๋าที่ยังเหลือ ({balance.walletSourceCount} รายการ)</summary>
          <div className="mt-2 space-y-2">{balance.sources.slice((walletPage - 1) * 10, walletPage * 10).map(source => <div key={source.creditId} className="rounded-md bg-white p-2">
            <p>{lessonText({ ...source, id: source.creditId })} · {source.quantity} {balance.unit}</p>
            <p>หมดอายุ {formatThaiDateTimeWithWeekday(source.expiresAt)}</p>
          </div>)}</div>
          {balance.sources.length > 10 ? <ListPagination page={walletPage} pageSize={10} pageSizeOptions={[10]} total={balance.sources.length} onPageChange={page => setSourcePage({ key: subjectKey, page })} onPageSizeChange={() => {}} /> : null}
        </details> : null}
      </section> : !loading && result ? <p className="rounded-lg bg-amber-50 p-3 text-sm">ยังยืนยันยอดคงเหลือจากการ์ดนี้ไม่ได้ กรุณาเปิดจากการ์ดเดือนที่มีรายการซื้อยืนยันแล้ว</p> : null}
      {summary ? <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
        <p className="font-semibold">สิทธิ์ชดเชยเด็กกลุ่ม · เดือน {formatThaiMonthYear(`${summary.sourceMonth}-01`)}</p>
        <p>โควตาปกติ {summary.quota} · ใช้แล้ว {summary.used} · เหลือ {summary.remaining} ครั้ง</p>
        {summary.exceptionUsed ? <p>ในยอดใช้จริงนี้ เป็นกรณีพิเศษ {summary.exceptionUsed} ครั้ง</p> : null}
        <p>รวมต้นทางที่เลือกชดเชยได้ตอนนี้ {availableFamilyMakeupCount(summary)} ครั้ง ตามกติกาเดิม</p>
        <p>สิทธิ์ชดเชยถึง {formatThaiDateTimeWithWeekday(new Date(Date.parse(summary.expiresAt) - 1))} · แยกจากวันหมดอายุกระเป๋าปกติ</p>
      </div> : null}
      <div className="space-y-2 border-t pt-3">
        <h2 className="font-semibold">รายการย้อนหลังทุกเดือน</h2>
        <p className="text-sm text-gray-600">จำนวนด้านล่างคือเหตุการณ์ย้อนหลัง เช่น เก็บ ใช้ หรือย้ายวัน ไม่ใช่ยอดคงเหลือ</p>
        <div className="flex flex-wrap gap-2" aria-label="ประเภทประวัติ">{Object.entries(kinds).map(([value, label]) => <Button key={value} variant={currentKind === value ? 'default' : 'outline'} size="sm" aria-pressed={currentKind === value} onClick={() => { setScope(subjectKey); setKind(value as keyof typeof kinds); setPage(1) }}>{label}{result ? ` ${result.counts[value as keyof typeof kinds]} รายการ` : ''}</Button>)}</div>
      </div>
      <div aria-live="polite" className="space-y-3">
        {loading ? <p role="status">กำลังอ่านประวัติ...</p> : null}
        {error ? <p role="alert" className="text-sm text-red-700">{error} <Button variant="outline" onClick={() => setEpoch(v => v + 1)}>ลองใหม่</Button></p> : null}
        {!loading && !error && result ? <>
          {result.items.length === 0 ? <p className="py-5 text-center text-sm text-gray-500">ยังไม่มีรายการประเภทนี้</p> : null}
          {result.items.map((event, index) => <div key={event.id}>
            {!event.at && (index === 0 || result.items[index - 1].at) ? <h3 className="mb-3 text-sm font-semibold text-gray-600">เหตุการณ์ที่ไม่พบเวลาบันทึก</h3> : null}
            <article data-history-event={event.id} className="space-y-2 rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-[#153c85]">{event.walletQuantity != null ? `ใช้กระเป๋า ${event.walletQuantity} ${subject?.course === 'private' ? 'ชั่วโมง' : 'ครั้ง'}` : event.title}</h3><Badge variant="outline" className={event.kind === 'wallet' ? 'border-purple-200 bg-purple-50 text-purple-800' : event.kind === 'absent' ? 'border-orange-200 bg-orange-50 text-orange-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}>{event.status}</Badge></div>
              <p className="text-gray-600">{event.at ? `${event.timeLabel}: ${formatThaiDateTimeWithWeekday(event.at)}` : 'ไม่พบเวลาบันทึกเดิม'}</p>
              {event.participants.length > 1 ? <p className="font-medium">ผู้เรียนร่วมกัน {event.participants.length} คน · {event.participants.map(p => p.name).join(' · ')}</p> : <p className="font-medium">{event.learner}</p>}
              {event.id.startsWith('move:') ? <p>ย้ายวันโดยใช้สิทธิ์เดิม · ไม่ได้ใช้กระเป๋า</p> : null}
              <div className="rounded-md bg-gray-50 p-2"><p>{event.source.referenceOnly?'รายการซื้ออ้างอิง':'รอบต้นทาง'}: {lessonText(event.source)}</p>{event.destination ? <p>{event.destination.isMakeup ? 'วันเรียนชดเชย' : 'นำไปเรียน'}: {lessonText(event.destination)}</p> : null}</div>
              {event.walletExpiresAt ? <p>วันหมดอายุสิทธิ์ต้นทาง: {formatThaiDateTimeWithWeekday(event.walletExpiresAt)}</p> : null}
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
