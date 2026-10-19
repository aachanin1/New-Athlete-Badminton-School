'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ListPagination } from '@/components/admin/list-pagination'
import { KidsFamilyMakeupPanel } from '@/components/admin/kids-family-makeup-panel'
import type { MakeupContinuation } from '@/components/admin/admin-lesson-manager'
import type { KidsFamilyMakeupCard } from '@/lib/kids-family-makeup'
import type { BranchOption } from '@/lib/admin-makeup-read-model'

export function KidsFamilyMakeupBrowse({ month, active, branches, search, branch, course, status, onSavingChange, continuation, onContinuationHandled }: {
  month: string; active: boolean; branches: BranchOption[]; search: string; branch: string; course: string; status: 'all' | 'actionable' | 'makeup' | 'expired'
  onSavingChange: (saving: boolean) => void; continuation: MakeupContinuation | null; onContinuationHandled: () => void
}) {
  const [page, setPage] = useState(1), [pageScope, setPageScope] = useState(''), [epoch, setEpoch] = useState(0)
  const [list, setList] = useState<{ key: string; cards: KidsFamilyMakeupCard[]; total: number } | null>(null)
  const [direct, setDirect] = useState<{ scope: string; card: KidsFamilyMakeupCard } | null>(null)
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [locked, setLocked] = useState(false)
  const handled = useRef('')
  const scope = JSON.stringify([month, branch, course, search, status]), currentPage = pageScope === scope ? page : 1
  const key = JSON.stringify([scope, currentPage, epoch]), visible = list?.key === key ? list : null
  useEffect(() => {
    if (!active || course !== 'kids_group') return
    const controller = new AbortController()
    setLoading(true); setError('')
    const q = new URLSearchParams({ month, course, search: search.trim(), branch, status, page: String(currentPage) })
    const timer = setTimeout(() => { void fetch('/api/admin/makeup/browse?' + q, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json()
      if (!response.ok || !Array.isArray(data.cards)) throw new Error(data.error || 'อ่านสิทธิ์ครอบครัวไม่สำเร็จ')
      if (!controller.signal.aborted) {
        const last = Math.max(1, Math.ceil(data.total / 10))
        if (currentPage > last) { setPageScope(scope); setPage(last) } else setList({ ...data, key })
      }
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'อ่านสิทธิ์ครอบครัวไม่สำเร็จ') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) }) }, 200)
    return () => { clearTimeout(timer); controller.abort() }
  }, [active, month, course, search, branch, status, currentPage, key, scope])
  useEffect(() => {
    if (!active || !continuation || handled.current === continuation.key) return
    const controller = new AbortController()
    setLoading(true); setError('')
    void fetch('/api/admin/makeup/family-card?' + new URLSearchParams({ parent: continuation.parentId, month: continuation.sourceMonth }), { cache: 'no-store', signal: controller.signal }).then(async response => {
      const card = await response.json()
      if (!response.ok || !card.state?.sourceMonth) throw new Error(card.error || 'อ่านสิทธิ์ต้นทางที่เก็บไม่สำเร็จ')
      if (!controller.signal.aborted) { handled.current = continuation.key; setDirect({ scope, card }) }
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'อ่านสิทธิ์ไม่สำเร็จ') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [active, continuation, scope, epoch])
  const directCard = direct?.scope === scope ? direct.card : null
  const cards = useMemo(() => directCard ? [directCard] : visible?.cards || [], [directCard, visible])
  if (course !== 'kids_group') return null
  return <section aria-label="รายการสิทธิ์ครอบครัว" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-[#153c85]">เด็กกลุ่ม — สิทธิ์ร่วมครอบครัว</h2>{directCard ? <Button variant="outline" disabled={locked} onClick={() => setDirect(null)}>กลับรายการทั้งหมด</Button> : visible ? <p className="text-sm text-gray-500">{visible.total} ครอบครัว</p> : null}</div>
    {loading ? <p role="status" className="text-sm text-blue-700">กำลังอ่านสิทธิ์ครอบครัว...</p> : null}
    {error ? <p role="alert" className="text-sm text-red-700">{error} <Button variant="outline" onClick={() => setEpoch(v => v + 1)}>ลองใหม่</Button></p> : null}
    {!loading && !error && (visible || directCard) ? <>
      <KidsFamilyMakeupPanel cards={cards} scheduleTemplates={[]} branches={branches} search="" branch="all" course="kids_group" status="all"
        onSavingChange={value => { setLocked(value); onSavingChange(value) }} continuation={continuation} onContinuationHandled={onContinuationHandled} onChanged={() => { setDirect(null); setEpoch(v => v + 1) }} />
      {!directCard && visible && visible.total > 10 ? <ListPagination page={currentPage} total={visible.total} pageSize={10} pageSizeOptions={[10]} onPageChange={value => { setPageScope(scope); setPage(value) }} onPageSizeChange={() => {}} /> : null}
    </> : null}
  </section>
}
