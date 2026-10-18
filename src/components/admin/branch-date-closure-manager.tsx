'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarOff, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatThaiDateWithWeekday, getBangkokDateKey } from '@/lib/date-format'
import type { BranchDateClosure } from '@/lib/branch-date-closures'

interface Impact { id: string; date: string; start: string; end: string; status: string; bookingStatus: string; learner: string; course: string }
interface Change { branchId: string; date: string; closed: boolean; reason: string; requestId: string }

export function BranchDateClosureManager({ branches }: { branches: Array<{ id: string; name: string }> }) {
  const router = useRouter()
  const [branch, setBranch] = useState(branches[0]?.id || ''), [date, setDate] = useState(getBangkokDateKey(new Date())!)
  const [reason, setReason] = useState(''), [closures, setClosures] = useState<BranchDateClosure[]>([]), [impact, setImpact] = useState<Impact[]>([])
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [loadedScope, setLoadedScope] = useState('')
  const [dialog, setDialog] = useState<boolean | null>(null), [saving, setSaving] = useState(false), [uncertain, setUncertain] = useState(false)
  const pending = useRef<Change | null>(null), inFlight = useRef(false), revision = useRef(0)
  const locked = saving || uncertain, current = closures.find(row => row.branch_id === branch && row.closure_date === date && row.is_active)
  const readReady = loadedScope === `${branch}|${date}` && !loading && !error
  const load = useCallback(async () => {
    if (!branch || !date) return false
    const rev = ++revision.current; setLoading(true); setError('')
    try {
      const response = await fetch(`/api/admin/branch-closures?${new URLSearchParams({ branch, date })}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok || !Array.isArray(data.closures) || !Array.isArray(data.impact)) throw new Error(data.error || 'อ่านวันปิดสาขาไม่สำเร็จ')
      if (revision.current === rev) { setClosures(data.closures); setImpact(data.impact); setLoadedScope(`${branch}|${date}`) }
      return true
    } catch (cause) { if (revision.current === rev) { setClosures([]); setImpact([]); setError(cause instanceof Error ? cause.message : 'อ่านข้อมูลไม่สำเร็จ') } return false }
    finally { if (revision.current === rev) setLoading(false) }
  }, [branch, date])
  const invalidateLoad = useCallback(() => { revision.current++ }, [])
  useEffect(() => { void load(); return invalidateLoad }, [load, invalidateLoad])
  async function commit() {
    if (inFlight.current || dialog === null) return
    if (!pending.current) { if (!reason.trim()) return; pending.current = { branchId: branch, date, closed: dialog, reason: reason.trim(), requestId: crypto.randomUUID() } }
    inFlight.current = true; setSaving(true); setError(''); setMessage(''); let resolved = false
    try {
      const response = await fetch('/api/admin/branch-closures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending.current) })
      const data = await response.json()
      if (!response.ok || data.success !== true) {
        if (response.status >= 400 && response.status < 500 && data.code && data.code !== 'BRANCH_CLOSURE_UNAVAILABLE') resolved = true
        throw new Error(data.error || 'ยังยืนยันผลไม่ได้')
      }
      if (!await load()) throw new Error('บันทึกแล้วแต่ยังอ่านสถานะล่าสุดไม่ได้ กรุณาตรวจสอบคำขอเดิม')
      resolved = true; setDialog(null); setReason(''); setMessage(dialog ? 'ประกาศปิดเฉพาะวันที่แล้ว · รายการจองเดิมยังอยู่ให้จัดการต่อ' : 'ยกเลิกวันปิดแล้ว · เปิดรับจองตามรอบประจำที่เปิดใช้งาน'); router.refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'ยังยืนยันผลไม่ได้') }
    finally { inFlight.current = false; setSaving(false); setUncertain(!resolved); if (resolved) pending.current = null }
  }
  const branchName = branches.find(row => row.id === branch)?.name
  return <Card className="border-blue-100"><CardContent className="space-y-4 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold text-[#153c85]"><CalendarOff className="h-5 w-5" />วันปิดสาขาเฉพาะวันที่</h2><p className="mt-1 text-sm text-gray-500">ปิดรับจองทุกคอร์สเฉพาะวัน รอบประจำวันอื่นยังเปิดตามเดิม</p></div><Badge variant="outline">Super Admin</Badge></div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>สาขา</Label><Select value={branch} onValueChange={value => { setBranch(value); setMessage('') }} disabled={locked}><SelectTrigger aria-label="สาขาที่ประกาศปิด"><SelectValue /></SelectTrigger><SelectContent>{branches.map(row => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="branch-closure-date">วันที่ปิดเฉพาะวัน</Label><Input id="branch-closure-date" type="date" value={date} onChange={event => { setDate(event.target.value); setMessage('') }} disabled={locked} /></div></div>
    {message ? <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
    {error && dialog === null ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}<Button variant="outline" onClick={() => void load()} className="ml-3">ลองอ่านใหม่</Button></p> : null}
    {!readReady && !error ? <p role="status" className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />กำลังอ่านสถานะและรายการจองเดิม...</p> : readReady ? <div className="rounded-lg border bg-gray-50 p-3 text-sm"><p className="font-semibold">{date ? formatThaiDateWithWeekday(date) : 'เลือกวันที่'} · {branchName}</p><p className="mt-1">{current ? `ปิดเฉพาะวันนี้ · ${current.reason}` : 'รับจองตามรอบประจำที่เปิดใช้งาน'}</p><p className="mt-1">รายการจองเดิม {impact.length} รายการ · Admin เลือกจัดการเอง</p></div> : null}
    <div className="flex flex-wrap gap-2"><Button className="bg-[#f57e3b] hover:bg-[#e06d2e]" disabled={!readReady || locked || !date || !branch} onClick={() => { setDialog(true); setReason(current?.reason || ''); setError('') }}>{current ? 'แก้เหตุผลวันปิด' : 'ประกาศปิดเฉพาะวันนี้'}</Button>{current ? <Button variant="outline" disabled={!readReady || locked} onClick={() => { setDialog(false); setReason('เปิดรับจองตามรอบประจำ'); setError('') }}>ยกเลิกวันปิด</Button> : null}</div>
    {impact.length > 0 ? <details><summary className="cursor-pointer text-sm font-medium text-[#2748bf]">ดูรายการจองเดิม ({impact.length})</summary><div className="mt-3 space-y-2">{impact.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"><div><p className="font-medium">{row.learner}</p><p className="text-gray-500">{row.start.slice(0, 5)}–{row.end.slice(0, 5)} · {row.course === 'kids_group' ? 'เด็กกลุ่ม' : row.course === 'adult_group' ? 'ผู้ใหญ่กลุ่ม' : 'Private'}{row.bookingStatus !== 'verified' ? ' · ยังไม่ยืนยันชำระ' : ''}</p></div>{row.bookingStatus === 'verified' && row.status === 'scheduled' ? <Button variant="outline" size="sm" asChild><Link href={`/admin/makeup?month=${row.date.slice(0, 7)}&tab=manage&session=${row.id}`}>จัดการวันเรียน</Link></Button> : <Button variant="outline" size="sm" asChild><Link href={`/admin/makeup?month=${row.date.slice(0, 7)}&session=${row.id}`}>ดูรายการเดิม</Link></Button>}</div>)}</div></details> : null}
    {closures.filter(row => row.is_active).length > 0 ? <div className="space-y-2 border-t pt-3"><h3 className="text-sm font-semibold text-[#153c85]">วันปิดในเดือนที่เลือก</h3><div className="flex flex-wrap gap-2">{closures.filter(row => row.is_active).map(row => <Button key={row.id} variant="outline" size="sm" disabled={locked} onClick={() => { setBranch(row.branch_id); setDate(row.closure_date); setMessage('') }}>{branches.find(b => b.id === row.branch_id)?.name} · {formatThaiDateWithWeekday(row.closure_date)}</Button>)}</div></div> : null}
    <Dialog open={dialog !== null} onOpenChange={value => { if (!value && !pending.current && !inFlight.current) setDialog(null) }}><DialogContent onEscapeKeyDown={event => { if (locked) event.preventDefault() }} onInteractOutside={event => { if (locked) event.preventDefault() }}><DialogHeader><DialogTitle>{dialog ? 'ยืนยันประกาศปิดเฉพาะวันที่' : 'ยืนยันยกเลิกวันปิด'}</DialogTitle><DialogDescription>{branchName} · {date ? formatThaiDateWithWeekday(date) : ''}</DialogDescription></DialogHeader><div className="space-y-3"><p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{dialog ? `ปิดรับจองเพิ่มทุกคอร์สเฉพาะวันนี้ รายการเดิม ${impact.length} รายการยังอยู่ให้ Admin จัดการ` : 'เปิดรับจองตามรอบประจำที่เปิดใช้งานของวันนี้'}</p><Label htmlFor="branch-closure-reason">เหตุผล *</Label><Textarea id="branch-closure-reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} disabled={locked} placeholder="เช่น สาขาหยุดทำการ 1 วัน" />{error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}{uncertain ? <p role="status" className="text-sm text-amber-800">ยังยืนยันผลไม่ได้ ตรวจซ้ำด้วยคำขอเดิมเพื่อป้องกันรายการซ้ำ</p> : null}</div><DialogFooter><Button variant="outline" disabled={locked} onClick={() => setDialog(null)}>ยกเลิก</Button><Button disabled={saving || (!uncertain && !reason.trim())} onClick={() => void commit()} className="bg-[#f57e3b] hover:bg-[#e06d2e]">{saving ? 'กำลังบันทึก...' : uncertain ? 'ตรวจสอบคำขอเดิม' : dialog ? 'ยืนยันปิดเฉพาะวันนี้' : 'ยืนยันยกเลิกวันปิด'}</Button></DialogFooter></DialogContent></Dialog>
  </CardContent></Card>
}
