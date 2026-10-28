'use client'

import type { ReactNode } from 'react'

export interface BookingCalendarDay {
  date: string
  selectable: boolean
  selected: boolean
  expanded: boolean
  selectedCount: number
  existing: Array<{ label: string; color: string }>
}

/** Shared visual controls: new booking and editing use the same day/slot interactions. */
export function BookingCalendar({ days, onDay, children, invalid = false }: {
  days: BookingCalendarDay[]; onDay: (date: string) => void; children?: ReactNode; invalid?: boolean
}) {
  const offset = days.length ? new Date(days[0].date + 'T12:00:00Z').getUTCDay() : 0
  return <div className={'rounded-xl border bg-white p-3 shadow-sm ' + (invalid ? 'border-red-500' : 'border-gray-200')} data-testid="booking-calendar" aria-invalid={invalid || undefined}>
    <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500">
      {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((d, i) => <div key={d} className={'py-0.5 ' + (i === 0 ? 'text-red-500' : '')}>{d}</div>)}
    </div>
    <div className="grid grid-cols-7 gap-1">
      {Array.from({ length: offset }, (_, i) => <div key={'blank-' + i} />)}
      {days.map((d, i) => <button type="button" key={d.date} onClick={() => onDay(d.date)} disabled={!d.selectable}
        aria-label={'เลือกวันที่ ' + d.date} aria-pressed={d.selected} data-testid={'booking-date-' + d.date}
        className={'relative h-10 w-full rounded-lg text-sm font-medium transition-all ' + (!d.selectable ? 'cursor-not-allowed text-gray-300 ' : 'hover:bg-[#2748bf]/10 ') + (d.selected ? 'bg-[#2748bf] text-white hover:bg-[#2748bf]/90 ' : (i + offset) % 7 === 0 ? 'text-red-500 ' : '') + (d.existing.length && !d.selected ? 'bg-green-50 ring-1 ring-green-300 ' : '') + (d.expanded ? 'ring-2 ring-[#f57e3b]' : '')}>
        {Number(d.date.slice(8))}
        <span className="absolute bottom-0.5 left-1/2 flex -translate-x-1/2 gap-0.5">
          {d.existing.slice(0, 5).map((e, n) => <span key={'existing-' + n} className={'h-1.5 w-1.5 rounded-full ' + e.color} title={e.label + ' จองแล้ว'} />)}
          {Array.from({ length: Math.min(d.selectedCount, 4) }, (_, n) => <span key={n} className={'h-1 w-1 rounded-full ' + (d.selected ? 'bg-white' : 'bg-[#2748bf]')} />)}
        </span>
      </button>)}
    </div>
    {invalid && <p className="mt-3 text-sm font-medium text-red-700">กรุณาเลือกวันและรอบเรียน</p>}
    {children}
  </div>
}
