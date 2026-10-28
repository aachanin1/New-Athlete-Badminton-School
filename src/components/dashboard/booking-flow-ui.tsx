'use client'

import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function BookingFlowSteps({ step }: { step: number }) {
  return <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="ขั้นตอนการจอง">
    {['เลือกคอร์ส', 'ผู้เรียนและวันเรียน', 'สรุปและชำระเงิน'].map((label, i) => <li key={label} aria-current={i === step ? 'step' : undefined} className={`rounded-xl px-2 py-3 text-center text-xs font-semibold ${i <= step ? 'bg-[#2748bf] text-white' : 'bg-gray-100 text-gray-500'}`}>
      {i < step ? '✓' : i + 1} {label}
    </li>)}
  </ol>
}

export function BookingCalendarHeading({ title, month, onPrevious, onNext, previousDisabled, nextDisabled }: {
  title: string; month: string; onPrevious: () => void; onNext: () => void; previousDisabled?: boolean; nextDisabled?: boolean
}) {
  return <div className="flex items-center justify-between flex-wrap gap-2">
    <h3 className="font-bold text-lg text-[#153c85]">เลือกวันเรียน — {title}</h3>
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" aria-label="เดือนก่อนหน้า" onClick={onPrevious} disabled={previousDisabled}><ArrowLeft className="h-4 w-4" /></Button>
      <span className="text-sm font-medium w-36 text-center">{month}</span>
      <Button type="button" variant="outline" size="sm" aria-label="เดือนถัดไป" onClick={onNext} disabled={nextDisabled}><ArrowRight className="h-4 w-4" /></Button>
    </div>
  </div>
}

export function BookingLearnerTabs({ learners, activeId, onChange, disabled }: {
  learners: Array<{ id: string; name: string; count: number }>; activeId: string; onChange: (id: string) => void; disabled?: boolean
}) {
  const active = learners.find(l => l.id === activeId)
  return <>
    {learners.length > 1 && <div className="flex flex-wrap gap-2 border-b pb-2" role="group" aria-label="เลือกผู้เรียนที่ต้องการเลือกวัน">
      {learners.map(l => <Button type="button" key={l.id} size="sm" variant={activeId === l.id ? 'default' : 'outline'} aria-pressed={activeId === l.id} disabled={disabled} className={'h-auto min-h-9 max-w-full whitespace-normal break-words text-left ' + (activeId === l.id ? 'bg-[#2748bf]' : '')} onClick={() => onChange(l.id)}>
        {l.name} {l.count > 0 && `(${l.count})`}
      </Button>)}
    </div>}
    {active && <p className="text-sm text-gray-600">กำลังเลือกวันเรียนของ: <span className="font-medium text-[#153c85]">{active.name}</span></p>}
  </>
}

export function BookingReviewCard({ children }: { children: ReactNode }) {
  return <><h3 className="font-bold text-lg mb-4 text-[#153c85]">สรุปการจอง</h3><Card><CardContent className="p-6 space-y-4">{children}</CardContent></Card></>
}
