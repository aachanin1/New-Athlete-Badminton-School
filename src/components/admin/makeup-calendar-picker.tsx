'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatThaiDateWithWeekday, formatThaiMonthYear } from '@/lib/date-format'
import { makeupCalendarCells, type MakeupCalendarDay, type MakeupCalendarSlot } from '@/lib/makeup-calendar'
import { Building2, Calendar, Clock } from 'lucide-react'

// Presentation clock only: never refreshes server data, sends a transaction,
// or releases a mutation lock. Auth and the global Date implementation stay real.
export function useMakeupCalendarNow(open: boolean) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!open) return
    const update = () => setNow(new Date())
    update()
    const timer = window.setInterval(update, 1000)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update) }
  }, [open])
  return now
}

export function MakeupCalendarPicker({ month, days, selectedDate, selectedSlot, disabled, onDateChange, onSlotChange }: {
  month: string; days: MakeupCalendarDay[]; selectedDate: string; selectedSlot: MakeupCalendarSlot | null
  disabled: boolean; onDateChange: (date: string) => void; onSlotChange: (slot: MakeupCalendarSlot) => void
}) {
  const selectedDay = days.find(day => day.dateInput === selectedDate)
  return <div data-testid="makeup-calendar" className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,.95fr)]">
    <div className="min-w-0 rounded-lg border border-gray-200 p-3">
      <div className="mb-3 flex items-center justify-between gap-2"><div>
        <p className="text-sm font-semibold text-gray-950">{formatThaiMonthYear(`${month}-01`)}</p>
        <p className="text-xs text-gray-500">เลือกวันที่มีรอบเรียนเพื่อดูเวลา</p>
      </div><Badge variant="outline">{days.length} วัน</Badge></div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] text-gray-500">{['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {makeupCalendarCells(month, days).map((cell, index) => {
          if (!cell) return <div key={`empty-${index}`} className="aspect-square" />
          const available = Boolean(cell.availableDay)
          const selected = selectedDate === cell.dateInput
          const count = cell.availableDay?.slotsByBranch.reduce((sum, item) => sum + item.slots.length, 0) || 0
          return <button key={cell.dateInput} type="button" data-testid={`makeup-day-${cell.dateInput}`} aria-label={formatThaiDateWithWeekday(cell.dateInput)} aria-pressed={selected}
            disabled={disabled || !available} onClick={() => onDateChange(cell.dateInput)}
            className={`flex aspect-square min-h-11 flex-col items-center justify-center rounded-lg border text-xs sm:min-h-14 ${selected ? 'border-[#2748bf] bg-[#2748bf] text-white' : available ? 'border-blue-100 bg-blue-50 text-[#153c85] hover:border-[#2748bf]' : 'border-gray-100 bg-gray-50 text-gray-400'}`}>
            <span className="font-semibold">{Number(cell.dateInput.slice(-2))}</span>
            {available && <span className="mt-0.5 text-[10px]">{count} รอบ</span>}
          </button>
        })}
      </div>
      {!days.length && <p className="mt-3 text-sm text-gray-500">ไม่มีวันและรอบที่เลือกได้ในเดือนสิทธิ์นี้</p>}
    </div>
    <div className="min-w-0 rounded-lg border border-gray-200 p-3">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Calendar className="h-4 w-4 shrink-0" />{selectedDay ? formatThaiDateWithWeekday(selectedDay.dateInput) : 'เลือกรอบเรียน'}</p>
      {!selectedDay ? <p className="rounded-lg border border-dashed px-3 py-10 text-center text-sm text-gray-500">เลือกวันที่ในปฏิทินก่อน</p> : <div className="space-y-3">
        {selectedDay.slotsByBranch.map(({ branch, slots }) => <div key={branch.id}>
          <p className="mb-2 flex items-start gap-1 break-words text-xs text-gray-600"><Building2 className="h-3.5 w-3.5 shrink-0" />{branch.name}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{slots.map(slot => {
            const picked = selectedSlot?.date === selectedDay.dateInput && selectedSlot.branchId === branch.id && selectedSlot.start === slot.start && selectedSlot.end === slot.end && selectedSlot.templateId === slot.templateId
            return <Button key={`${slot.templateId || branch.id}:${slot.start}:${slot.end}`} type="button" size="sm" data-template-id={slot.templateId} disabled={disabled} aria-pressed={picked}
              variant={picked ? 'default' : 'outline'} className="justify-start" onClick={() => onSlotChange({ ...slot, date: selectedDay.dateInput, dayOfWeek: selectedDay.dayOfWeek, branchId: branch.id, branchName: branch.name })}>
              <Clock className="mr-1 h-3.5 w-3.5 shrink-0" />{slot.start.slice(0, 5)}-{slot.end.slice(0, 5)}
            </Button>
          })}</div>
        </div>)}
      </div>}
    </div>
  </div>
}
