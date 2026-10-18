'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const reasons: Record<string, string> = { wrong: 'เลือกวันผิด', sick: 'ผู้เรียนป่วย / ลา', closure: 'สาขาประกาศหยุด', no_date: 'เดือนนี้ไม่มีวันใช้แล้ว', other: 'อื่น ๆ' }

export function adminActionReason(value: string, note: string) {
  if (!reasons[value] || (value === 'other' && !note.trim())) return ''
  return value === 'other' ? note.trim() : `${reasons[value]}${note.trim() ? ` — ${note.trim()}` : ''}`
}

export function AdminActionReason({ value, note, onValueChange, onNoteChange, disabled = false }: {
  value: string; note: string; onValueChange: (value: string) => void; onNoteChange: (value: string) => void; disabled?: boolean
}) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <div className="space-y-2"><Label>เหตุผลการจัดการ *</Label><Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger aria-label="เหตุผลการจัดการ"><SelectValue placeholder="เลือกเหตุผล" /></SelectTrigger>
      <SelectContent>{Object.entries(reasons).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
    </Select></div>
    <div className="space-y-2"><Label htmlFor="admin-action-reason-note">{value === 'other' ? 'ระบุเหตุผล (จำเป็น)' : 'บันทึกเพิ่มเติม (ถ้ามี)'}</Label>
      <Input id="admin-action-reason-note" value={note} onChange={event => onNoteChange(event.target.value)} disabled={disabled} maxLength={900} placeholder="ระบุว่าเกิดอะไรขึ้น" />
    </div>
  </div>
}
