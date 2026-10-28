'use client'
import { useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function BookingChoice({ title, options, selected, onApply, removalCount, disabled = false }: {
  title: string; options: Array<{ id: string; label: string; description?: string }>; selected: string[]
  onApply: (ids: string[]) => void; removalCount?: (ids: string[]) => number; disabled?: boolean
}) {
  const [open, setOpen] = useState(false), [draft, setDraft] = useState<string[]>([]), [search, setSearch] = useState('')
  const labels = options.filter(o => selected.includes(o.id)).map(o => o.label), removed = removalCount?.(draft) || 0
  return <div className="min-w-0 space-y-1">
    <button type="button" disabled={disabled} onClick={() => { setDraft(selected); setSearch(''); setOpen(true) }} aria-invalid={!selected.length || undefined} className={"flex min-h-16 w-full items-center gap-3 rounded-xl border bg-white p-3 text-left hover:bg-blue-50 " + (!selected.length ? "border-red-500" : "border-blue-200")} aria-label={`เปลี่ยน${title}`}>
      <span className="min-w-0 flex-1"><span className="block text-xs text-gray-500">{title}{selected.length > 0 && ` · ${selected.length} ${title === 'สาขา' ? 'สาขา' : 'คน'}`}</span><span className="mt-1 block truncate font-semibold text-[#153c85]">{labels.slice(0, 2).join(', ') || `เลือก${title}`}{labels.length > 2 && ` และอีก ${labels.length - 2}`}</span></span>
      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-blue-700">{selected.length ? 'เปลี่ยน' : 'เลือก'}<ChevronDown className="h-4 w-4" /></span>
    </button>
    {!selected.length && <p className="text-sm font-medium text-red-700">กรุณาเลือก{title}</p>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="flex max-h-[85dvh] w-[calc(100%-1.5rem)] max-w-lg flex-col overflow-hidden rounded-2xl p-4 sm:p-6">
      <DialogHeader><DialogTitle>เลือก{title}</DialogTitle><DialogDescription>เลือกได้หลาย{title === 'สาขา' ? 'สาขา' : 'คน'} แล้วกดใช้ที่เลือก</DialogDescription></DialogHeader>
      {options.length > 4 && <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><Input className="pl-9" aria-label={`ค้นหา${title}`} placeholder={`ค้นหา${title}`} value={search} onChange={e => setSearch(e.target.value)} /></div>}
      <div className="min-h-0 space-y-2 overflow-y-auto overscroll-contain" role="group" aria-label={`ตัวเลือก${title}`}>
        {options.filter(o => (o.label + ' ' + (o.description || '')).toLowerCase().includes(search.toLowerCase())).map(o => <label key={o.id} className={'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3 ' + (draft.includes(o.id) ? 'border-blue-600 bg-blue-50' : 'border-gray-200')}>
          <input type="checkbox" className="h-5 w-5 shrink-0 accent-blue-700" checked={draft.includes(o.id)} onChange={e => setDraft(prev => e.target.checked ? [...prev, o.id] : prev.filter(id => id !== o.id))} />
          <span className="min-w-0 break-words"><span className="block font-medium">{o.label}</span>{o.description && <span className="text-xs text-gray-500">{o.description}</span>}</span>
        </label>)}
        {!options.some(o => (o.label + ' ' + (o.description || '')).toLowerCase().includes(search.toLowerCase())) && <p className="p-4 text-center text-gray-500">ไม่พบรายการ ลองค้นหาด้วยคำอื่น</p>}
      </div>
      {removed > 0 && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">การเปลี่ยนนี้จะนำวันเรียนที่เลือกไว้ออก {removed} รอบ ตรวจสอบก่อนใช้ที่เลือก</p>}
      <Button className="min-h-12 shrink-0 bg-[#153c85]" disabled={!draft.length} onClick={() => { onApply(draft); setOpen(false) }}><Check className="mr-2 h-4 w-4" />ใช้{title}ที่เลือก · {draft.length}</Button>
    </DialogContent></Dialog>
  </div>
}
